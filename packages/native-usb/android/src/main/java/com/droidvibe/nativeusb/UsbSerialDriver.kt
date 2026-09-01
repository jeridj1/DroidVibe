package com.droidvibe.nativeusb

import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.util.Log
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * USB serial driver supporting CDC-ACM and bridge chips CH340/CP210x/FTDI.
 */
class UsbSerialDriver(
    private val usbManager: UsbManager,
    private val device: UsbDevice,
    private val onData: (ByteArray) -> Unit,
) {
    companion object { private const val TAG = "UsbSerialDriver" }

    private var connection: UsbDeviceConnection? = null
    private var iface: UsbInterface? = null
    private var inEp: UsbEndpoint? = null
    private var outEp: UsbEndpoint? = null
    private val running = AtomicBoolean(false)
    private var readThread: Thread? = null
    private val readQueue = LinkedBlockingQueue<Byte>(8192)
    private val driverKind: String = detectDriver()

    fun open(baudRate: Int, dataBits: Int, stopBits: Int, parity: String, dtr: Boolean, rts: Boolean): Boolean {
        val conn = usbManager.openDevice(device) ?: run {
            Log.e(TAG, "openDevice returned null")
            return false
        }
        val (intf, epIn, epOut) = findInterface() ?: run {
            conn.close()
            Log.e(TAG, "no suitable bulk interface")
            return false
        }
        if (!conn.claimInterface(intf, true)) {
            conn.close()
            Log.e(TAG, "claimInterface failed")
            return false
        }
        connection = conn
        iface = intf
        inEp = epIn
        outEp = epOut
        if (!setLineCoding(baudRate, dataBits, stopBits, parity)) {
            Log.e(TAG, "setLineCoding failed")
            close()
            return false
        }
        setControlLines(dtr, rts)
        readQueue.clear()
        running.set(true)
        readThread = Thread { readLoop() }.apply { isDaemon = true; name = "droidvibe-serial-read"; start() }
        return true
    }

    fun write(data: ByteArray): Int {
        val conn = connection ?: return -1
        val ep = outEp ?: return -1
        val n = conn.bulkTransfer(ep, data, data.size, 1000)
        return if (n >= 0) n else -1
    }

    @Synchronized
    fun synchronizedRead(minLen: Int, timeoutMs: Int): ByteArray {
        val out = ArrayList<Byte>()
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline && out.size < minLen) {
            val remaining = deadline - System.currentTimeMillis()
            val b = readQueue.poll(if (remaining > 0) remaining else 1, TimeUnit.MILLISECONDS)
            if (b != null) out.add(b)
        }
        return out.toByteArray()
    }

    fun setDtrRts(dtr: Boolean, rts: Boolean) {
        setControlLines(dtr, rts)
    }

    fun drainInput() {
        readQueue.clear()
    }

    fun close() {
        running.set(false)
        runCatching { readThread?.interrupt() }
        iface?.let { connection?.releaseInterface(it) }
        runCatching { connection?.close() }
        connection = null
        iface = null
        inEp = null
        outEp = null
        readQueue.clear()
    }

    private fun readLoop() {
        val buf = ByteArray(4096)
        val conn = connection ?: return
        val ep = inEp ?: return
        while (running.get()) {
            val n = conn.bulkTransfer(ep, buf, buf.size, 100)
            if (n > 0) {
                onData(buf.copyOfRange(0, n))
                for (i in 0 until n) { readQueue.offer(buf[i]) }
            }
        }
    }

    private fun setLineCoding(baudRate: Int, dataBits: Int, stopBits: Int, parity: String): Boolean {
        val conn = connection ?: return false
        val coding = encodeLineCoding(baudRate, dataBits, stopBits, parity)
        return when (driverKind) {
            "cdc-acm" -> controlOut(0x21, 0x20, 0, 0, coding)
            "ch340" -> controlOut(0x40, 0xA1 or 0x9C, 0x9C00 or encodeCh340Baud(baudRate), 0, null) || controlOut(0x40, 0xA4, if (dataBits == 8) 0x03 else 0x00, 0, null)
            "cp210x" -> controlOut(0x41, 0x03, 0x0000, 0, coding)
            "ftdi" -> controlOut(0x40, 0x03, encodeFtdiBaud(baudRate), 0, null)
            else -> controlOut(0x21, 0x20, 0, 0, coding)
        }
    }

    private fun setControlLines(dtr: Boolean, rts: Boolean) {
        val conn = connection ?: return
        val value = (if (dtr) 1 else 0) or (if (rts) 2 else 0)
        when (driverKind) {
            "cdc-acm" -> controlOut(0x21, 0x22, value, 0, null)
            "ch340" -> controlOut(0xA1, 0xA4, value, 0, null)
            "cp210x" -> controlOut(0x41, 0x07, value, 0, null)
            "ftdi" -> controlOut(0x40, 0x01, 0x00FF or (value shl 8), 0, null)
        }
    }

    private fun controlOut(requestType: Int, request: Int, value: Int, index: Int, payload: ByteArray?): Boolean {
        val conn = connection ?: return false
        val out = payload ?: ByteArray(0)
        val res = conn.controlTransfer(requestType, request, value, index, out, out.size, 5000)
        return res >= 0
    }

    private fun encodeLineCoding(baud: Int, dataBits: Int, stopBits: Int, parity: String): ByteArray {
        val b = ByteArray(7)
        b[0] = (baud and 0xff).toByte()
        b[1] = ((baud shr 8) and 0xff).toByte()
        b[2] = ((baud shr 16) and 0xff).toByte()
        b[3] = ((baud shr 24) and 0xff).toByte()
        b[4] = if (stopBits == 2) 2.toByte() else 0.toByte()
        b[5] = when (parity) { "even" -> 2.toByte(); "odd" -> 1.toByte(); else -> 0.toByte() }
        b[6] = dataBits.toByte()
        return b
    }

    private fun encodeCh340Baud(baud: Int): Int {
        return when (baud) {
            9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600 -> baud
            else -> baud
        }
    }

    private fun encodeFtdiBaud(baud: Int): Int {
        val div = (3_000_000 / baud - 1).coerceAtLeast(0)
        return div and 0x3FFF
    }

    private fun findInterface(): Triple<UsbInterface, UsbEndpoint, UsbEndpoint>? {
        for (i in 0 until device.interfaceCount) {
            val intf = device.getInterface(i)
            var epIn: UsbEndpoint? = null
            var epOut: UsbEndpoint? = null
            for (j in 0 until intf.endpointCount) {
                val ep = intf.getEndpoint(j)
                if (ep.type == UsbConstants.USB_ENDPOINT_XFER_BULK) {
                    if (ep.direction == UsbConstants.USB_DIR_IN) epIn = ep
                    else if (ep.direction == UsbConstants.USB_DIR_OUT) epOut = ep
                }
            }
            if (epIn != null && epOut != null) return Triple(intf, epIn, epOut)
        }
        return null
    }

    private fun detectDriver(): String {
        val vid = String.format("%04x", device.vendorId)
        for (i in 0 until device.interfaceCount) {
            val intf = device.getInterface(i)
            if (intf.interfaceClass == 2 && intf.interfaceSubclass == 2) return "cdc-acm"
        }
        return when (vid) {
            "1a86" -> "ch340"
            "10c4" -> "cp210x"
            "0403" -> "ftdi"
            "2e8a" -> "cdc-acm"
            else -> "cdc-acm"
        }
    }
}