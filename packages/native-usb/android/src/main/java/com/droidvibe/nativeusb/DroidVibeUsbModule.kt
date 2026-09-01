package com.droidvibe.nativeusb

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.util.Base64
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.util.concurrent.ConcurrentHashMap

// ---- Record input types (mirror the shared TypeScript types) ----

class SerialOptionsInput : Record() {
    @Field val baudRate: Int = 115200
    @Field val dataBits: Int = 8
    @Field val stopBits: Int = 1
    @Field val parity: String = "none"
    @Field val dtr: Boolean = false
    @Field val rts: Boolean = false
}

class UploadRequestInput : Record() {
    @Field val deviceId: String = ""
    @Field val vendorId: String = ""
    @Field val productId: String = ""
    @Field val protocol: String = "stk500v1"
    @Field val firmwareBase64: String = ""
    @Field val filename: String = ""
    @Field val baudRate: Int = 115200
    @Field val verify: Boolean = true
}

class CaptureConfigInput : Record() {
    @Field val deviceId: String = ""
    @Field val sampleRate: Int = 1_000_000
    @Field val numSamples: Int = 8192
    @Field val channels: Int = 8
    @Field val triggerType: String = "none"
    @Field val triggerChannel: Int = 0
    @Field val triggerEdge: String = "rising"
}

class HelperFirmwareInput : Record() {
    @Field val deviceId: String = ""
    @Field val uf2Base64: String = ""
    @Field val verify: Boolean = true
}

class SwdTransferInput : Record() {
    @Field val deviceId: String = ""
    @Field val isRead: Boolean = true
    @Field val apDp: Int = 0
    @Field val addr: Int = 0
    @Field val data: Int = 0
}

class JtagTransferInput : Record() {
    @Field val deviceId: String = ""
    @Field val tmsBase64: String = ""
    @Field val tdiBase64: String = ""
    @Field val bitCount: Int = 0
}

/**
 * DroidVibe native USB transport module.
 *
 * Wraps android.hardware.usb to expose device enumeration, the Android USB
 * permission flow, CDC-ACM serial I/O, upload, RP2040 multi-mode control,
 * and capture to the React layer. Only available in a custom Expo dev/production build.
 */
class DroidVibeUsbModule : Module() {

    companion object {
        private const val TAG = "DroidVibeUsb"
        private const val ACTION_USB_PERMISSION = "com.droidvibe.USB_PERMISSION"
    }

    private val usbManager: UsbManager
        get() = appContext.reactContext?.getSystemService(Context.USB_SERVICE) as UsbManager

    private val serialConnections = ConcurrentHashMap<String, UsbSerialDriver>()
    private val permissionPromises = ConcurrentHashMap<String, Promise>()

    private val usbReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                UsbManager.ACTION_USB_DEVICE_ATTACHED -> {
                    intent.getParcelableExtra<UsbDevice>(UsbManager.EXTRA_DEVICE)?.let {
                        sendEvent("onDeviceEvent", mapOf("type" to "attach", "device" to deviceToMap(it)))
                    }
                }
                UsbManager.ACTION_USB_DEVICE_DETACHED -> {
                    intent.getParcelableExtra<UsbDevice>(UsbManager.EXTRA_DEVICE)?.let {
                        val id = it.deviceId.toString()
                        serialConnections.remove(id)?.close()
                        sendEvent("onDeviceEvent", mapOf("type" to "detach", "device" to deviceToMap(it)))
                    }
                }
                ACTION_USB_PERMISSION -> {
                    val device = intent.getParcelableExtra<UsbDevice>(UsbManager.EXTRA_DEVICE)
                    val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
                    val id = device?.deviceId?.toString() ?: ""
                    permissionPromises.remove(id)?.let { if (granted) it.resolve(true) else it.resolve(false) }
                }
            }
        }
    }

    override fun definition() = ModuleDefinition {
        Name("DroidVibeUsb")
        Events("onUsbData", "onDeviceEvent", "onUploadProgress")

        OnCreate {
            val filter = IntentFilter().apply {
                addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED)
                addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
                addAction(ACTION_USB_PERMISSION)
            }
            appContext.reactContext?.registerReceiver(usbReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        }

        OnDestroy {
            serialConnections.values.forEach { it.close() }
            serialConnections.clear()
            runCatching { appContext.reactContext?.unregisterReceiver(usbReceiver) }
        }

        // ---- Device enumeration ----
        AsyncFunction("listDevices") { promise: Promise ->
            try {
                val devices = usbManager.deviceList.values.map { deviceToMap(it) }
                promise.resolve(devices)
            } catch (e: Exception) {
                promise.reject("USB_LIST_FAILED", e.message ?: "listDevices failed", e)
            }
        }

        AsyncFunction("hasDevicePermission") { deviceId: String, promise: Promise ->
            try {
                val device = findDevice(deviceId)
                promise.resolve(usbManager.hasPermission(device))
            } catch (e: Exception) {
                promise.reject("USB_LOOKUP_FAILED", e.message ?: "device not found", e)
            }
        }

        AsyncFunction("requestPermission") { deviceId: String, promise: Promise ->
            try {
                val device = findDevice(deviceId)
                if (usbManager.hasPermission(device)) {
                    promise.resolve(true)
                    return@AsyncFunction
                }
                permissionPromises[deviceId] = promise
                val pi = android.app.PendingIntent.getBroadcast(
                    appContext.reactContext,
                    0,
                    Intent(ACTION_USB_PERMISSION).setPackage(appContext.reactContext?.packageName),
                    android.app.PendingIntent.FLAG_IMMUTABLE or android.app.PendingIntent.FLAG_UPDATE_CURRENT,
                )
                usbManager.requestPermission(device, pi)
            } catch (e: Exception) {
                permissionPromises.remove(deviceId)
                promise.reject("USB_PERMISSION_FAILED", e.message ?: "requestPermission failed", e)
            }
        }

        // ---- Serial ----
        AsyncFunction("openSerial") { deviceId: String, options: SerialOptionsInput, promise: Promise ->
            try {
                val device = findDevice(deviceId)
                if (!usbManager.hasPermission(device)) {
                    promise.reject("USB_NO_PERMISSION", "USB permission not granted", null)
                    return@AsyncFunction
                }
                val driver = UsbSerialDriver(usbManager, device) { data ->
                    sendEvent("onUsbData", mapOf("deviceId" to deviceId, "data" to data))
                }
                val ok = driver.open(options.baudRate, options.dataBits, options.stopBits, options.parity, options.dtr, options.rts)
                if (ok) {
                    serialConnections[deviceId] = driver
                    promise.resolve(true)
                } else {
                    promise.reject("USB_OPEN_FAILED", "Could not open serial interface", null)
                }
            } catch (e: Exception) {
                promise.reject("USB_OPEN_FAILED", e.message ?: "openSerial failed", e)
            }
        }

        AsyncFunction("writeSerial") { deviceId: String, dataBytes: ByteArray, promise: Promise ->
            try {
                val driver = serialConnections[deviceId]
                if (driver == null) { promise.reject("USB_NOT_OPEN", "serial not open", null); return@AsyncFunction }
                val n = driver.write(dataBytes)
                promise.resolve(n)
            } catch (e: Exception) {
                promise.reject("USB_WRITE_FAILED", e.message ?: "writeSerial failed", e)
            }
        }

        AsyncFunction("closeSerial") { deviceId: String, promise: Promise ->
            serialConnections.remove(deviceId)?.close()
            promise.resolve(true)
        }

        // ---- Upload (delegates to protocol uploaders) ----
        AsyncFunction("upload") { request: UploadRequestInput, promise: Promise ->
            try {
                val device = findDevice(request.deviceId)
                if (!usbManager.hasPermission(device)) {
                    promise.reject("USB_NO_PERMISSION", "USB permission not granted", null); return@AsyncFunction
                }
                val firmware = Base64.decode(request.firmwareBase64, Base64.DEFAULT)
                val result = Uploaders.upload(
                    usbManager, device, request.protocol, firmware,
                    request.filename, request.baudRate, request.verify,
                ) { stage, progress, message ->
                    sendEvent("onUploadProgress", mapOf(
                        "deviceId" to request.deviceId,
                        "stage" to stage,
                        "progress" to progress,
                        "message" to (message ?: ""),
                    ))
                }
                promise.resolve(mapOf(
                    "ok" to result.ok,
                    "stage" to result.stage,
                    "verified" to result.verified,
                    "message" to result.message,
                ))
            } catch (e: Exception) {
                promise.reject("USB_UPLOAD_FAILED", e.message ?: "upload failed", e)
            }
        }

        // ---- RP2040 UF2 / PICOBOOT flashing ----
        AsyncFunction("flashUf2") { deviceId: String, uf2Base64: String, verify: Boolean, promise: Promise ->
            try {
                val device = findDevice(deviceId)
                if (!usbManager.hasPermission(device)) {
                    promise.reject("USB_NO_PERMISSION", "USB permission not granted", null); return@AsyncFunction
                }
                val uf2 = Base64.decode(uf2Base64, Base64.DEFAULT)
                val result = PicobootFlasher.flash(usbManager, device, uf2, verify) { stage, progress, message ->
                    sendEvent("onUploadProgress", mapOf(
                        "deviceId" to deviceId,
                        "stage" to stage,
                        "progress" to progress,
                        "message" to (message ?: ""),
                    ))
                }
                promise.resolve(mapOf(
                    "ok" to result.ok,
                    "stage" to result.stage,
                    "verified" to result.verified,
                    "message" to result.message,
                ))
            } catch (e: Exception) {
                promise.reject("USB_PICOBOOT_FAILED", e.message ?: "flashUf2 failed", e)
            }
        }

        // ---- RP2040 helper firmware flashing (from base64 UF2 data) ----
        AsyncFunction("flashHelperFirmware") { request: HelperFirmwareInput, promise: Promise ->
            try {
                val device = findDevice(request.deviceId)
                if (!usbManager.hasPermission(device)) {
                    promise.reject("USB_NO_PERMISSION", "USB permission not granted", null); return@AsyncFunction
                }
                if (!RP2040Controller.isBootSel(device)) {
                    promise.reject("USB_NOT_BOOTSEL", "Device is not in BOOTSEL mode. Hold BOOTSEL while plugging in the Pico.", null)
                    return@AsyncFunction
                }
                val uf2 = Base64.decode(request.uf2Base64, Base64.DEFAULT)
                val result = PicobootFlasher.flash(usbManager, device, uf2, request.verify) { stage, progress, message ->
                    sendEvent("onUploadProgress", mapOf(
                        "deviceId" to request.deviceId,
                        "stage" to stage,
                        "progress" to progress,
                        "message" to (message ?: ""),
                    ))
                }
                promise.resolve(mapOf(
                    "ok" to result.ok,
                    "stage" to result.stage,
                    "verified" to result.verified,
                    "message" to result.message,
                ))
            } catch (e: Exception) {
                promise.reject("USB_HELPER_FLASH_FAILED", e.message ?: "flashHelperFirmware failed", e)
            }
        }

        // ---- RP2040 enter BOOTSEL via serial command ----
        AsyncFunction("enterBootselViaSerial") { deviceId: String, promise: Promise ->
            try {
                val driver = serialConnections[deviceId]
                if (driver == null) {
                    promise.reject("USB_NOT_OPEN", "Serial not open. Open serial to the Pico first.", null)
                    return@AsyncFunction
                }
                val ok = RP2040Controller.enterBootselViaSerial(driver)
                promise.resolve(ok)
            } catch (e: Exception) {
                promise.reject("USB_BOOTSEL_FAILED", e.message ?: "enterBootselViaSerial failed", e)
            }
        }

        // ---- RP2040 logic-analyzer capture (requires helper firmware) ----
        AsyncFunction("capture") { config: CaptureConfigInput, promise: Promise ->
            try {
                val driver = serialConnections[config.deviceId]
                if (driver == null) {
                    promise.reject("USB_NOT_OPEN", "Serial not open. Open serial to the Pico (running LA helper firmware) first.", null)
                    return@AsyncFunction
                }
                val result = RP2040Controller.capture(
                    driver, config.sampleRate, config.numSamples, config.channels,
                )
                promise.resolve(mapOf(
                    "actualSamples" to result.actualSamples,
                    "durationUs" to result.durationUs,
                    "data" to result.data,
                    "sampleRate" to result.sampleRate,
                    "channels" to result.channels,
                ))
            } catch (e: Exception) {
                promise.reject("USB_CAPTURE_FAILED", e.message ?: "capture failed", e)
            }
        }

        // ---- RP2040 SWD transfer ----
        AsyncFunction("swdTransfer") { input: SwdTransferInput, promise: Promise ->
            try {
                val driver = serialConnections[input.deviceId]
                if (driver == null) {
                    promise.reject("USB_NOT_OPEN", "Serial not open.", null)
                    return@AsyncFunction
                }
                val result = RP2040Controller.swdTransfer(driver, input.isRead, input.apDp, input.addr, input.data)
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("USB_SWD_FAILED", e.message ?: "swdTransfer failed", e)
            }
        }

        // ---- RP2040 JTAG transfer ----
        AsyncFunction("jtagTransfer") { input: JtagTransferInput, promise: Promise ->
            try {
                val driver = serialConnections[input.deviceId]
                if (driver == null) {
                    promise.reject("USB_NOT_OPEN", "Serial not open.", null)
                    return@AsyncFunction
                }
                val tms = Base64.decode(input.tmsBase64, Base64.DEFAULT)
                val tdi = Base64.decode(input.tdiBase64, Base64.DEFAULT)
                val result = RP2040Controller.jtagTransfer(driver, tms, tdi, input.bitCount)
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("USB_JTAG_FAILED", e.message ?: "jtagTransfer failed", e)
            }
        }

        // ---- Check if RP2040 is in BOOTSEL mode ----
        AsyncFunction("isRp2040Bootsel") { deviceId: String, promise: Promise ->
            try {
                val device = findDevice(deviceId)
                promise.resolve(RP2040Controller.isBootSel(device))
            } catch (e: Exception) {
                promise.reject("USB_LOOKUP_FAILED", e.message ?: "device not found", e)
            }
        }

        // ---- Get RP2040 mode info ----
        AsyncFunction("getRp2040Mode") { deviceId: String, promise: Promise ->
            try {
                val device = findDevice(deviceId)
                val mode = when {
                    RP2040Controller.isBootSel(device) -> "bootsel"
                    RP2040Controller.isApplicationMode(device) -> "application"
                    else -> "not-rp2040"
                }
                promise.resolve(mapOf("mode" to mode, "isRP2040" to RP2040Controller.isRP2040(device)))
            } catch (e: Exception) {
                promise.reject("USB_LOOKUP_FAILED", e.message ?: "device not found", e)
            }
        }
    }

    private fun findDevice(deviceId: String): UsbDevice {
        return usbManager.deviceList.values.firstOrNull { it.deviceId.toString() == deviceId }
            ?: throw Exception("device not found: " + deviceId)
    }

    private fun deviceToMap(d: UsbDevice): Map<String, Any?> {
        val vid = String.format("%04x", d.vendorId)
        val pid = String.format("%04x", d.productId)
        val driver = detectDriver(d)
        val bootsel = vid == "2e8a" && pid == "0003"
        val isRp2040 = vid == "2e8a"
        return mapOf(
            "id" to d.deviceId.toString(),
            "vendorId" to vid,
            "productId" to pid,
            "serialNumber" to (runCatching { d.serialNumber }.getOrNull()),
            "manufacturer" to (d.manufacturerName ?: null),
            "productName" to (d.productName ?: null),
            "driver" to driver,
            "bootsel" to bootsel,
            "isRp2040" to isRp2040,
            "permission" to (if (usbManager.hasPermission(d)) "granted" else "pending"),
            "state" to if (usbManager.hasPermission(d)) "detected" else "permission-required",
        )
    }

    private fun detectDriver(d: UsbDevice): String {
        for (i in 0 until d.interfaceCount) {
            val iface = d.getInterface(i)
            if (iface.interfaceClass == 2 && iface.interfaceSubclass == 2) return "cdc-acm"
        }
        return when (String.format("%04x", d.vendorId)) {
            "1a86" -> "ch340"
            "10c4" -> "cp210x"
            "0403" -> "ftdi"
            "2e8a" -> "cdc-acm"
            else -> "unknown"
        }
    }
}