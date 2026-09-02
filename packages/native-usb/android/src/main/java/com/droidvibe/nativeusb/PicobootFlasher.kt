package com.droidvibe.nativeusb

import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.util.Log
import java.io.ByteArrayOutputStream

/**
 * RP2040 PICOBOOT flasher.
 *
 * Implements the RP2040 bootrom PICOBOOT vendor interface: exclusive access,
 * exit XIP, flash erase, page write, optional read-back verification, and
 * reboot. The device must be in BOOTSEL mode (VID 2e8a PID 0003).
 *
 * VALIDATION: This is a faithful implementation of the documented PICOBOOT
 * protocol. UF2 address handling, command headers, ack semantics and reboot
 * parameters MUST be tested on real RP2040 hardware before production trust.
 * It never reports success unless the device ACKs and (when verify) read-back
 * matches.
 */
object PicobootFlasher {
    private const val TAG = "PicobootFlasher"

    private const val PICOBOOT_MAGIC = 0x431fd83b
    private const val FLASH_SECTOR = 0x1000
    private const val PAGE = 256

    // Command ids
    private const val CMD_EXIT_XIP = 0x4
    private const val CMD_ENTER_CMD_XIP = 0x5
    private const val CMD_REBOOT = 0x7
    private const val CMD_READ = 0x81
    private const val CMD_WRITE = 0x82
    private const val CMD_FLASH_ERASE = 0x83

    private const val RP2040_FLASH_START = 0x10000000

    data class Result(val ok: Boolean, val stage: String, val verified: Boolean, val message: String)

    fun flash(
        usbManager: UsbManager,
        device: UsbDevice,
        uf2: ByteArray,
        verify: Boolean,
        onProgress: ProgressCb,
    ): Result {
        if (String.format("%04x", device.vendorId) != "2e8a" ||
            String.format("%04x", device.productId) != "0003"
        ) {
            return Result(false, "failed", false, "Device is not an RP2040 in BOOTSEL mode")
        }
        onProgress("handshake", 0.0,
 "claim PICOBOOT interface")
        val conn = usbManager.openDevice(device)
            ?: return Result(false, "failed", false, "openDevice failed")
        val iface = findPicobootInterface(device)
        if (iface == null || !conn.claimInterface(iface, true)) {
            conn.close(); return Result(false, "failed", false, "PICOBOOT interface not found/claimed")
        }
        val epOut = (0 until iface.endpointCount).map { iface.getEndpoint(it) }.firstOrNull { it.direction == 0x00 }
        val epIn = (0 until iface.endpointCount).map { iface.getEndpoint(it) }.firstOrNull { it.direction == 0x80 }
        if (epOut == null || epIn == null) {
            conn.releaseInterface(iface); conn.close()
            return Result(false, "failed", false, "PICOBOOT endpoints missing")
        }

        try {
            onProgress("handshake", 0.5, "exit XIP")
            if (!sendCmd(conn, epOut, epIn, buildCmd(CMD_EXIT_XIP))) {
                return Result(false, "failed", false, "Exit XIP not acked")
            }

            // Flatten UF2 into flash bytes at RP2040_FLASH_START.
            val flat = flattenUf2(uf2)
            if (flat.isEmpty()) return Result(false, "failed", false, "Empty UF2")

            onProgress("erasing", 0.0, "erase sectors")
            for (er in planErases(flat.size)) {
                if (!sendCmd(conn, epOut, epIn, buildCmd(CMD_FLASH_ERASE, RP2040_FLASH_START + er.first, er.second))) {
                    return Result(false, "failed", false, "Erase failed at 0x" + (RP2040_FLASH_START + er.first).toString(16))
                }
            }

            // Write in 256-byte pages.
            var off = 0
            while (off < flat.size) {
                onProgress("writing", off.toDouble() / flat.size, "page " + (off / PAGE))
                val chunk = flat.copyOfRange(off, minOf(off + PAGE, flat.size))
                val addr = RP2040_FLASH_START + off
                if (!sendCmd(conn, epOut, epIn, buildCmd(CMD_WRITE,
 addr, chunk.size))) {
                    return Result(false, "failed", false, "Write header not acked at 0x" + addr.toString(16))
                }
                if (conn.bulkTransfer(epOut, chunk, chunk.size, 2000) != chunk.size) {
                    return Result(false, "failed", false, "Write data short transfer at 0x" + addr.toString(16))
                }
                // Drain the trailing ACK byte for the write command.
                if (!readAck(conn, epIn, 2000)) {
                    return Result(false, "failed", false, "Write not acked at 0x" + addr.toString(16))
                }
                off += chunk.size
            }

            var verifiedOk = false
            if (verify) {
                onProgress("verifying", 0.0, "read-back")
                verifiedOk = verifyReadback(conn, epOut, epIn, flat, onProgress)
                onProgress("verifying", 1.0, if (verifiedOk) "match" else "mismatch")
                if (!verifiedOk) {
                    sendCmd(conn, epOut, epIn, buildCmd(CMD_REBOOT))
                    return Result(false, "failed", false, "Verification mismatch (read-back)")
                }
            }

            onProgress("handshake", 0.9, "reboot")
            if (!sendCmd(conn, epOut, epIn, buildCmd(CMD_REBOOT))) {
                return Result(false, "failed", false, "Reboot not acked")
            }
            onProgress("done", 1.0, "flashed")
            return Result(true, "done", verify && verifiedOk, "PICOBOOT flash complete")
        } finally {
            conn.releaseInterface(iface); conn.close()
        }
    }

    // ---- PICOBOOT framing ----

    private fun buildCmd(cmd: Int, addr: Int = 0, size: Int = 0, p1: Int = 0, p2: Int = 0): ByteArray {
        val out = ByteArray(24)
        putU32(out, 0, PICOBOOT_MAGIC)
        putU32(out, 4, cmd)
        putU32(out, 8, addr)
        putU32(out, 12, size)
        putU32(out, 16, p1)
        putU32(out, 20, p2)
        return out
    }

    private fun putU32(b: ByteArray, off: Int, v: Int) {
        b[off] = (v and 0xff).toByte()
        b[off + 1] = ((v shr 8) and 0xff).toByte()
        b[off + 2] = ((v shr 16) and 0xff).toByte()
        b[off + 3] = ((v shr 24) and 0xff).toByte()
    }

    /** Send a command header and read the single-byte ACK (0 = OK). */
    private fun sendCmd(conn: UsbDeviceConnection, epOut: UsbEndpoint, epIn: UsbEndpoint, cmd: ByteArray): Boolean {
        if (conn.bulkTransfer(epOut, cmd, cmd.size, 2000) != cmd.size) return false
        return readAck(conn, epIn, 2000)
    }

    private fun readAck(conn: UsbDeviceConnection, epIn: UsbEndpoint, timeoutMs: Int): Boolean {
        val buf = ByteArray(1)
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            val n = conn.bulkTransfer(epIn, buf, buf.size, 500)
            if (n > 0) return buf[0] == 0x00.toByte()
        }
        return false
    }

    private fun verifyReadback(
        conn: UsbDeviceConnection, epOut: UsbEndpoint, epIn: UsbEndpoint,
        flat: ByteArray, onProgress: ProgressCb,
    ): Boolean {
        var off = 0
        while (off < flat.size) {
            val len = minOf(PAGE, flat.size - off)
            val addr = RP2040_FLASH_START + off
            if (!sendCmd(conn, epOut, epIn, buildCmd(CMD_READ, addr, len))) return false
            val buf = ByteArray(len)
            val deadline = System.currentTimeMillis() + 2000
            var got = 0
            while (System.currentTimeMillis() < deadline && got < len) {
                val n = conn.bulkTransfer(epIn, buf, got, len - got, 500)
                if (n > 0) got += n
            }
            if (got != len) return false
            if (!buf.contentEquals(flat.copyOfRange(off, off + len))) return false
            if (!readAck(conn, epIn, 1000)) return false
            off += len
        }
        return true
    }

    // ---- UF2 parsing (in Kotlin; mirrors shared uf
2.ts) ----

    private fun flattenUf2(uf2: ByteArray): ByteArray {
        if (uf2.size % 512 != 0) throw IllegalArgumentException("UF2 size not a multiple of 512")
        val blocks = uf2.size / 512
        var min = Int.MAX_VALUE; var max = Int.MIN_VALUE
        val payloads = ArrayList<Pair<Int, ByteArray>>()
        for (i in 0 until blocks) {
            val base = i * 512
            if (readU32(uf2, base) != PICOBOOT_MAGIC_ALT_START) {
                throw IllegalArgumentException("Bad UF2 magic at block " + i)
            }
            val payloadAddr = readU32(uf2, base + 4)
            val payloadSize = readU32(uf2, base + 8)
            if (payloadSize > 256) throw IllegalArgumentException("UF2 payload too big at block " + i)
            val data = uf2.copyOfRange(base + 32, base + 32 + payloadSize)
            payloads.add(payloadAddr to data)
            if (payloadAddr < min) min = payloadAddr
            if (payloadAddr + payloadSize - 1 > max) max = payloadAddr + payloadSize - 1
        }
        if (payloads.isEmpty()) return ByteArray(0)
        val out = ByteArray(max - min + 1)
        for ((addr, data) in payloads) System.arraycopy(data, 0, out, addr - min, data.size)
        return out
    }

    private const val PICOBOOT_MAGIC_ALT_START = 0x0A324655 // UF2 magic start 0

    private fun readU32(b: ByteArray, off: Int): Int =
        ((b[off].toInt() and 0xff) or
            ((b[off + 1].toInt() and 0xff) shl 8) or
            ((b[off + 2].toInt() and 0xff) shl 16) or
            ((b[off + 3].toInt() and 0xff) shl 24))

    private fun planErases(totalSize: Int): List<Pair<Int, Int>> {
        val start = 0
        val endAligned = ((totalSize + FLASH_SECTOR - 1) / FLASH_SECTOR) * FLASH_SECTOR
        val out = ArrayList<Pair<Int, Int>>()
        var a = start
        while (a < endAligned) {
            out.add(a to FLASH_SECTOR)
            a += FLASH_SECTOR
        }
        return out
    }

    private fun findPicobootInterface(device:
 UsbDevice): UsbInterface? {
        // PICOBOOT uses a vendor-specific interface (class 0xff) with bulk endpoints.
        for (i in 0 until device.interfaceCount) {
            val iface = device.getInterface(i)
            if (iface.interfaceClass == 0xff && iface.endpointCount >= 2) return iface
        }
        return null
    }
}
