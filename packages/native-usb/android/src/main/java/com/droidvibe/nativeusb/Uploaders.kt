package com.droidvibe.nativeusb

import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.util.Base64
import android.util.Log
import java.io.ByteArrayOutputStream

data class UploadResult(
    val ok: Boolean,
    val stage: String,
    val verified: Boolean,
    val message: String,
)

typealias ProgressCb = (stage: String, progress: Double, message: String?) -> Unit

/**
 * Upload backends for AVR (STK500v1, AVR109) and ESP (ROM loader).
 * STK500v1 and AVR109 now include automatic retry loops with DTR/RTS
 * toggling so users no longer need to manually tap reset repeatedly.
 */
object Uploaders {
    private const val TAG = "Uploaders"

    private const val STK_GET_SYNC: Byte = 0x30
    private const val STK_READ_SIGN: Byte = 0x75
    private const val STK_ENTER_PROGMODE: Byte = 0x50
    private const val STK_LEAVE_PROGMODE: Byte = 0x51
    private const val STK_CHIP_ERASE: Byte = 0x52
    private const val STK_LOAD_ADDRESS: Byte = 0x55
    private const val STK_PROG_PAGE: Byte = 0x64
    private const val STK_READ_PAGE: Byte = 0x74
    private const val CRC_EOP: Byte = 0x20
    private const val INSYNC: Byte = 0x14
    private const val OK: Byte = 0x10

    fun upload(
        usbManager: UsbManager,
        device: UsbDevice,
        protocol: String,
        firmware: ByteArray,
        filename: String,
        baudRate: Int,
        verify: Boolean,
        onProgress: ProgressCb,
    ): UploadResult {
        return when (protocol) {
            "stk500v1" -> stk500v1(usbManager, device, firmware, baudRate, verify, onProgress)
            "avr109" -> avr109(usbManager, device, firmware, baudRate, verify, onProgress)
            "esptool" -> espRom(usbManager, device, firmware, verify, onProgress)
            "dfu" -> UploadResult(false, "failed", false, "DFU backend not yet implemented (use arduino-cli upload path).")
            else -> UploadResult(false, "failed", false, "Unknown upload protocol: " + protocol)
        }
    }

    // ---------------- STK500v1 (Uno, Mega) ----------------

    private fun stk500v1(
        usbManager: UsbManager,
        device: UsbDevice,
        firmware: ByteArray,
        baudRate: Int,
        verify: Boolean,
        onProgress: ProgressCb,
    ): UploadResult {
        val hex = IntelHex.parse(firmware.toString(Charsets.US_ASCII))
        val pages = IntelHex.toPages(hex, 128)
        onProgress("resetting", 0.0, "Opening serial port")
        val driver = UsbSerialDriver(usbManager, device) {}
        if (!driver.open(baudRate, 8, 1, "none", true, false)) {
            return UploadResult(false, "failed", false, "Could not open serial port for STK500v1")
        }
        try {
            var synced = false
            for (attempt in 1..15) {
                onProgress("handshake", (attempt - 1) / 15.0, "STK_GET_SYNC attempt " + attempt + "/15")
                driver.setDtrRts(false, false)
                Thread.sleep(50)
                driver.setDtrRts(true, false)
                Thread.sleep(100)
                driver.drainInput()
                driver.write(byteArrayOf(0))
                Thread.sleep(20)
                if (stkExpect(driver, byteArrayOf(STK_GET_SYNC, CRC_EOP), byteArrayOf(INSYNC, OK))) {
                    synced = true
                    Log.i(TAG, "STK500v1 sync achieved on attempt " + attempt)
                    break
                }
                Log.w(TAG, "STK500v1 sync attempt " + attempt + " failed, retrying...")
            }
            if (!synced) {
                return UploadResult(false, "failed", false, "No STK500v1 sync after 15 attempts (bootloader not responding). Try pressing reset on the board.")
            }
            onProgress("handshake", 0.5, "STK_READ_SIGN")
            stkQuery(driver, byteArrayOf(STK_READ_SIGN, CRC_EOP), 3)
            onProgress("erasing", 0.0, "chip erase")
            stkExpect(driver, byteArrayOf(STK_CHIP_ERASE, CRC_EOP), byteArrayOf(INSYNC, OK))
            var written = 0
            for ((addr, page) in pages) {
                onProgress("writing", written.toDouble() / pages.size, "page @0x" + addr.toString(16))
                val loadAddr = byteArrayOf(STK_LOAD_ADDRESS, ((addr shr 1) and 0xff).toByte(), ((addr shr 9) and 0xff).toByte(), CRC_EOP)
                if (!stkExpect(driver, loadAddr, byteArrayOf(INSYNC, OK))) {
                    return UploadResult(false, "failed", false, "Load address failed at 0x" + addr.toString(16))
                }
                val cmd = ByteArrayOutputStream()
                cmd.write(STK_PROG_PAGE.toInt())
                cmd.write(0); cmd.write(page.size)
                cmd.write('F'.code)
                cmd.write(page)
                cmd.write(CRC_EOP.toInt())
                if (!stkExpect(driver, cmd.toByteArray(), byteArrayOf(INSYNC, OK))) {
                    return UploadResult(false, "failed", false, "Program page failed at 0x" + addr.toString(16))
                }
                written++
            }
            var verifiedOk = false
            if (verify) {
                onProgress("verifying", 0.0, "read-back")
                verifiedOk = stkVerify(driver, pages)
                onProgress("verifying", 1.0, if (verifiedOk) "match" else "mismatch")
                if (!verifiedOk) {
                    stkExpect(driver, byteArrayOf(STK_LEAVE_PROGMODE, CRC_EOP), byteArrayOf(INSYNC, OK))
                    return UploadResult(false, "failed", false, "Verification mismatch (read-back)")
                }
            }
            stkExpect(driver, byteArrayOf(STK_LEAVE_PROGMODE, CRC_EOP), byteArrayOf(INSYNC, OK))
            onProgress("done", 1.0, "uploaded")
            return UploadResult(true, "done", verify && verifiedOk, "STK500v1 upload complete")
        } finally {
            driver.close()
        }
    }

    private fun stkExpect(driver: UsbSerialDriver, cmd: ByteArray, expect: ByteArray): Boolean {
        driver.write(cmd)
        val got = stkRead(driver, expect.size + 32, 2000)
        return contains(got, expect)
    }

    private fun stkQuery(driver: UsbSerialDriver, cmd: ByteArray, len: Int): ByteArray {
        driver.write(cmd)
        return stkRead(driver, len + 2, 2000)
    }

    @Synchronized
    private fun stkRead(driver: UsbSerialDriver, minLen: Int, timeoutMs: Int): ByteArray {
        return SyncSerial.read(driver, minLen, timeoutMs)
    }

    private fun stkVerify(driver: UsbSerialDriver, pages: List<Pair<Int, ByteArray>>): Boolean {
        for ((addr, page) in pages) {
            val loadAddr = byteArrayOf(STK_LOAD_ADDRESS, ((addr shr 1) and 0xff).toByte(), ((addr shr 9) and 0xff).toByte(), CRC_EOP)
            stkExpect(driver, loadAddr, byteArrayOf(INSYNC, OK))
            val cmd = byteArrayOf(STK_READ_PAGE, 0, page.size.toByte(), 'F'.code.toByte(), CRC_EOP)
            driver.write(cmd)
            val got = SyncSerial.read(driver, page.size + 2, 2000)
            if (!got.copyOfRange(0, minOf(page.size, got.size)).contentEquals(page)) return false
        }
        return true
    }

    private fun contains(haystack: ByteArray, needle: ByteArray): Boolean {
        if (needle.isEmpty()) return true
        for (i in 0..haystack.size - needle.size) {
            var match = true
            for (j in needle.indices) if (haystack[i + j] != needle[j]) { match = false; break }
            if (match) return true
        }
        return false
    }

    // ---------------- AVR109 / Caterina ----------------

    private fun avr109(
        usbManager: UsbManager,
        device: UsbDevice,
        firmware: ByteArray,
        baudRate: Int,
        verify: Boolean,
        onProgress: ProgressCb,
    ): UploadResult {
        val hex = IntelHex.parse(firmware.toString(Charsets.US_ASCII))
        val pages = IntelHex.toPages(hex, 128)
        var driver: UsbSerialDriver? = null
        var enteredProgmode = false
        for (attempt in 1..10) {
            onProgress("resetting", (attempt - 1) / 10.0, "1200-baud Caterina attempt " + attempt + "/10")
            val touch = UsbSerialDriver(usbManager, device) {}
            if (touch.open(1200, 8, 1, "none", false, false)) {
                touch.write(byteArrayOf(0))
                touch.close()
            }
            Thread.sleep(800)
            driver = UsbSerialDriver(usbManager, device) {}
            if (!driver.open(maxOf(baudRate, 19200), 8, 1, "none", true, false)) {
                driver = null
                Log.w(TAG, "AVR109 open attempt " + attempt + " failed, retrying...")
                continue
            }
            driver.drainInput()
            driver.write("P".toByteArray())
            val ack = SyncSerial.read(driver, 1, 2000)
            if (!ack.isEmpty() && ack[0] == 0x0d.toByte()) {
                enteredProgmode = true
                Log.i(TAG, "AVR109 entered progmode on attempt " + attempt)
                break
            }
            driver.close()
            driver = null
            Log.w(TAG, "AVR109 progmode attempt " + attempt + " failed, retrying...")
        }
        if (!enteredProgmode || driver == null) {
            return UploadResult(false, "failed", false, "AVR109 did not enter progmode after 10 attempts (bootloader may not be running)")
        }
        try {
            driver.write("V".toByteArray()); Thread.sleep(50)
            var done = 0
            for ((addr, page) in pages) {
                onProgress("writing", done.toDouble() / pages.size, "page @0x" + addr.toString(16))
                val wordAddr = addr / 2
                driver.write(byteArrayOf('A'.code.toByte(), ((wordAddr shr 8) and 0xff).toByte(), (wordAddr and 0xff).toByte()))
                Thread.sleep(5)
                val cmd = ByteArrayOutputStream()
                cmd.write('B'.code); cmd.write(0); cmd.write(page.size); cmd.write('F'.code); cmd.write(page)
                driver.write(cmd.toByteArray())
                Thread.sleep((page.size / 32 + 2).toLong())
                done++
            }
            driver.write("L".toByteArray())
            onProgress("done", 1.0, "uploaded")
            return UploadResult(true, "done", false, "AVR109 upload complete (read-back verify requires board support)")
        } finally {
            driver.close()
        }
    }

    // ---------------- ESP ROM loader ----------------

    private fun espRom(
        usbManager: UsbManager,
        device: UsbDevice,
        firmware: ByteArray,
        verify: Boolean,
        onProgress: ProgressCb,
    ): UploadResult {
        onProgress("resetting", 0.0, "ESP reset/boot")
        val conn = usbManager.openDevice(device) ?: return UploadResult(false, "failed", false, "openDevice failed")
        val iface = (0 until device.interfaceCount).map { device.getInterface(it) }
            .firstOrNull { it.endpointCount >= 2 } ?: run { conn.close(); return UploadResult(false, "failed", false, "no interface") }
        if (!conn.claimInterface(iface, true)) { conn.close(); return UploadResult(false, "failed", false, "claimInterface failed") }
        val epIn = (0 until iface.endpointCount).map { iface.getEndpoint(it) }.first { it.direction == 0x80 }
        val epOut = (0 until iface.endpointCount).map { iface.getEndpoint(it) }.first { it.direction == 0x00 }
        try {
            onProgress("handshake", 0.0, "ESP SYNC")
            val sync = EspRom.syncCommand()
            var attempts = 0
            var synced = false
            while (attempts < 10 && !synced) {
                conn.bulkTransfer(epOut, sync, sync.size, 1000)
                val resp = ByteArray(64)
                val n = conn.bulkTransfer(epIn, resp, resp.size, 1000)
                if (n > 0 && EspRom.isSyncReply(resp.copyOfRange(0, n))) synced = true
                attempts++
            }
            if (!synced) return UploadResult(false, "failed", false, "ESP ROM did not respond to SYNC")
            onProgress("erasing", 0.0, "flash begin")
            val chunkSize = 0x4000
            val numPackets = (firmware.size + chunkSize - 1) / chunkSize
            conn.bulkTransfer(epOut, EspRom.flashBegin(firmware.size, 0x0, numPackets), 64, 2000)
            readAck(conn, epIn)
            var off = 0; var seq = 0
            while (off < firmware.size) {
                onProgress("writing", off.toDouble() / firmware.size, "block " + seq)
                val len = minOf(chunkSize, firmware.size - off)
                val block = firmware.copyOfRange(off, off + len)
                conn.bulkTransfer(epOut, EspRom.flashData(block, seq, chunkSize), 8 + block.size + 256, 3000)
                readAck(conn, epIn)
                off += len; seq++
            }
            onProgress("verifying", 1.0, "reboot")
            conn.bulkTransfer(epOut, EspRom.flashEnd(true), 64, 2000)
            readAck(conn, epIn)
            onProgress("done", 1.0, "uploaded")
            return UploadResult(true, "done", false, "ESP ROM upload complete (MD5 verify optional)")
        } finally {
            conn.releaseInterface(iface); conn.close()
        }
    }

    private fun readAck(conn: android.hardware.usb.UsbDeviceConnection, epIn: android.hardware.usb.UsbEndpoint) {
        val buf = ByteArray(64)
        val deadline = System.currentTimeMillis() + 3000
        while (System.currentTimeMillis() < deadline) {
            val n = conn.bulkTransfer(epIn, buf, buf.size, 500)
            if (n > 0 && buf[0] == 0x01.toByte()) return
        }
    }
}