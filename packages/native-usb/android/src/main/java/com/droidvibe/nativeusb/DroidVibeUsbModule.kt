package com.droidvibe.nativeusb

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.util.concurrent.ConcurrentHashMap

// ---- Record input types (mirror the shared TypeScript types) ----

class SerialOptionsInput : Record {
    @Field val baudRate: Int = 115200
    @Field val dataBits: Int = 8
    @Field val stopBits: Int = 1
    @Field val parity: String = "none"
    @Field val dtr: Boolean = false
    @Field val rts: Boolean = false
}

class UploadRequestInput : Record {
    @Field val deviceId: String = ""
    @Field val vendorId: String = ""
    @Field val productId: String = ""
    @Field val protocol: String = "stk500v1"
    @Field val firmwareBase64: String = ""
    @Field val filename: String = ""
    @Field val baudRate: Int = 115200
    @Field val verify: Boolean = true
}

class CaptureConfigInput : Record {
    @Field val sampleRate: Int = 1_000_000
    @Field val numSamples: Int = 8192
    @Field val channels: Int = 8
    @Field val triggerType: String = "none"
    @Field val triggerChannel: Int = 0
    @Field val triggerEdge: String = "rising"
}

/**
 * DroidVibe native USB transport module.
 *
 * Wraps android.hardware.usb to expose device enumeration, the Android USB
 * permission flow, CDC-ACM serial I/O, upload and capture to the React layer.
 * Only available in a custom Expo dev/production build.
 */
class DroidVibeUsbModule : Module() {

    companion object {
        private const val TAG = "DroidVibeUsb"
        private const val ACTION_USB_PERMISSION = "com.droidvibe.USB_PERMISSION"
    }

    private val usbManager: UsbManager
        get() = appContext.reactContext?.getSystemService(Context.USB_SERVICE) as UsbManager

    /** Open serial connections keyed by device id. */
    private val serialConnections = ConcurrentHashMap<String, UsbSerialDriver>()

    /** Pending permission promises keyed by device id. */
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
                    promise.reject("USB_NO_PERMISSION", "USB permission not granted")
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
                    promise.reject("USB_OPEN_FAILED", "Could not open serial interface")
                }
            } catch (e: Exception) {
                promise.reject("USB_OPEN_FAILED", e.message ?: "openSerial failed", e)
            }
        }

        AsyncFunction("writeSerial") { deviceId: String, dataBytes: ByteArray, promise: Promise ->
            try {
                val driver = serialConnections[deviceId]
                if (driver == null) { promise.reject("USB_NOT_OPEN", "serial not open"); return@AsyncFunction }
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
                    promise.reject("USB_NO_PERMISSION", "USB permission not granted"); return@AsyncFunction
                }
                val firmware = android.util.Base64.decode(request.firmwareBase64, android.util.Base64.DEFAULT)
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

        // ---- RP2040 UF2 / PICOBOOT ----
        AsyncFunction("flashUf2") { deviceId: String, uf2Base64: String, verify: Boolean, promise: Promise ->
            try {
                val device = findDevice(deviceId)
                if (!usbManager.hasPermission(device)) {
                    promise.reject("USB_NO_PERMISSION", "USB permission not granted"); return@AsyncFunction
                }
                val uf2 = android.util.Base64.decode(uf2Base64, android.util.Base64.DEFAULT)
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

        // ---- Logic-analyzer capture (requires an RP2040 helper image; best-effort) ----
        AsyncFunction("capture") { config: CaptureConfigInput, promise: Promise ->
            try {
                val result = CaptureService.capture(usbManager, config.sampleRate, config.numSamples, config.channels)
                promise.resolve(mapOf(
                    "actualSamples" to result.actualSamples,
                    "durationUs" to result.durationUs,
                    "data" to result.data,
                ))
            } catch (e: Exception) {
                promise.reject("USB_CAPTURE_FAILED", e.message ?: "capture failed", e)
            }
        }
    }

    private fun findDevice(deviceId: String): UsbDevice {
        return usbManager.deviceList.values.firstOrNull { it.deviceId.toString() == deviceId }
            ?: throw CodedException("USB_DEVICE_NOT_FOUND", "device not found: $deviceId")
    }

    /** Map a UsbDevice to the shared JS shape. */
    private fun deviceToMap(d: UsbDevice): Map<String, Any?> {
        val vid = String.format("%04x", d.vendorId)
        val pid = String.format("%04x", d.productId)
        val driver = detectDriver(d)
        val bootsel = vid == "2e8a" && pid == "0003"
        return mapOf(
            "id" to d.deviceId.toString(),
            "vendorId" to vid,
            "productId" to pid,
            "serialNumber" to (runCatching { d.serialNumber }.getOrNull()),
            "manufacturer" to (d.manufacturerName ?: null),
            "productName" to (d.productName ?: null),
            "driver" to driver,
            "bootsel" to bootsel,
            "permission" to (if (usbManager.hasPermission(d)) "granted" else "pending"),
            "state" to if (usbManager.hasPermission(d)) "detected" else "permission-required",
        )
    }

    /** Heuristic driver family from interface class + VID. */
    private fun detectDriver(d: UsbDevice): String {
        // CDC-ACM (class 02 / subclass 02) — Arduino Leonardo/Micro, native USB
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
