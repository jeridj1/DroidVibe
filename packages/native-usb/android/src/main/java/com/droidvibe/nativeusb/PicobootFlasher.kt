package com.droidvibe.nativeusb

import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager

/** RP2040 BOOTSEL PICOBOOT flasher using the documented 32-byte command format. */
object PicobootFlasher {
    private const val PICOBOOT_MAGIC = 0x431FD10B
    private const val BOOTSEL_VID = 0x2E8A
    private const val BOOTSEL_PID = 0x0003
    private const val PAGE = 256
    private const val SECTOR = 4096
    private const val FLASH_START = 0x10000000

    private const val PC_EXCLUSIVE_ACCESS = 0x01
    private const val PC_REBOOT = 0x02
    private const val PC_FLASH_ERASE = 0x03
    private const val PC_READ = 0x84
    private const val PC_WRITE = 0x05
    private const val PC_EXIT_XIP = 0x06

    private const val PICOBOOT_IF_RESET = 0x41
    private const val PICOBOOT_IF_CMD_STATUS = 0x42

    private const val UF2_MAGIC_START0 = 0x0A324655
    private const val UF2_MAGIC_START1 = 0x9E5D5157.toInt()
    private const val UF2_MAGIC_END = 0x0AB16F30
    private const val UF2_FLAG_FAMILY_ID_PRESENT = 0x00002000
    private const val RP2040_FAMILY_ID = 0xE48BFF56.toInt()

    private var nextToken = 1

    data class Result(val ok: Boolean, val stage: String, val verified: Boolean, val message: String)
    private data class Uf2Block(val address: Int, val data: ByteArray)

    fun flash(
        usbManager: UsbManager,
        device: UsbDevice,
        uf2: ByteArray,
        verify: Boolean,
        onProgress: ProgressCb,
    ): Result {
        if (device.vendorId != BOOTSEL_VID || device.productId != BOOTSEL_PID) {
            return Result(false, "failed", false, "Device is not an RP2040 in BOOTSEL mode")
        }
        val blocks = try { parseUf2(uf2) } catch (e: Exception) {
            return Result(false, "failed", false, e.message ?: "Invalid UF2")
        }
        if (blocks.isEmpty()) return Result(false, "failed", false, "UF2 contains no flash blocks")

        val conn = usbManager.openDevice(device)
            ?: return Result(false, "failed", false, "openDevice failed")
        val iface = findPicobootInterface(device)
            ?: run { conn.close(); return Result(false, "failed", false, "PICOBOOT interface not found") }
        if (!conn.claimInterface(iface, true)) {
            conn.close(); return Result(false, "failed", false, "PICOBOOT interface could not be claimed")
        }
        val epOut = (0 until iface.endpointCount).map { iface.getEndpoint(it) }
            .firstOrNull { it.type == UsbConstants.USB_ENDPOINT_XFER_BULK && it.direction == UsbConstants.USB_DIR_OUT }
        val epIn = (0 until iface.endpointCount).map { iface.getEndpoint(it) }
            .firstOrNull { it.type == UsbConstants.USB_ENDPOINT_XFER_BULK && it.direction == UsbConstants.USB_DIR_IN }
        if (epOut == null || epIn == null) {
            conn.releaseInterface(iface); conn.close()
            return Result(false, "failed", false, "PICOBOOT bulk endpoints missing")
        }

        try {
            onProgress("handshake", 0.0, "exclusive flash access")
            if (!command(conn, epOut, epIn, PC_EXCLUSIVE_ACCESS, 1, byteArrayOf(2))) {
                return Result(false, "failed", false, "PICOBOOT exclusive access failed")
            }
            onProgress("handshake", 0.25, "exit XIP")
            if (!command(conn, epOut, epIn, PC_EXIT_XIP, 0, null)) {
                return Result(false, "failed", false, "PICOBOOT exit XIP failed")
            }

            val erases = blocks.map { it.address - FLASH_START }
                .flatMap { listOf(it / SECTOR) }.distinct().sorted()
            onProgress("erasing", 0.0, "erase flash sectors")
            for ((index, sector) in erases.withIndex()) {
                val addr = FLASH_START + sector * SECTOR
                if (!command(conn, epOut, epIn, PC_FLASH_ERASE, 8, rangeArgs(addr, SECTOR))) {
                    return Result(false, "failed", false, "Flash erase failed at 0x" + addr.toString(16))
                }
                onProgress("erasing", (index + 1).toDouble() / erases.size, "sector " + sector)
            }

            for ((index, block) in blocks.withIndex()) {
                onProgress("writing", index.toDouble() / blocks.size, "UF2 block " + (index + 1) + "/" + blocks.size)
                if (block.data.size != PAGE) {
                    return Result(false, "failed", false, "UF2 block payload must be 256 bytes")
                }
                if (!command(conn, epOut, epIn, PC_WRITE, 8, rangeArgs(block.address, PAGE), block.data)) {
                    return Result(false, "failed", false, "Flash write failed at 0x" + block.address.toString(16))
                }
            }

            var verified = false
            if (verify) {
                onProgress("verifying", 0.0, "read back UF2 blocks")
                verified = verifyBlocks(conn, epOut, epIn, blocks, onProgress)
                if (!verified) {
                    reboot(conn, epOut, epIn)
                    return Result(false, "failed", false, "Verification mismatch")
                }
            }

            onProgress("handshake", 0.95, "reboot")
            reboot(conn, epOut, epIn)
            onProgress("done", 1.0, "flashed")
            return Result(true, "done", verify && verified, "PICOBOOT flash complete")
        } finally {
            runCatching { conn.releaseInterface(iface) }
            conn.close()
        }
    }

    private fun command(
        conn: UsbDeviceConnection,
        epOut: UsbEndpoint,
        epIn: UsbEndpoint,
        cmdId: Int,
        cmdSize: Int,
        args: ByteArray?,
        payload: ByteArray? = null,
    ): Boolean {
        val token = synchronized(this) { nextToken++ }
        val header = ByteArray(32)
        putU32(header, 0, PICOBOOT_MAGIC)
        putU32(header, 4, token)
        header[8] = cmdId.toByte()
        header[9] = cmdSize.toByte()
        putU32(header, 12, payload?.size ?: 0)
        if (args != null) System.arraycopy(args, 0, header, 16, minOf(args.size, 16))
        if (conn.bulkTransfer(epOut, header, header.size, 3000) != header.size) return false
        if (payload != null && payload.isNotEmpty()) {
            if (conn.bulkTransfer(epOut, payload, payload.size, 3000) != payload.size) return false
        }
        // The documented protocol completes an OUT command with a zero-length IN ACK.
        val ack = ByteArray(1)
        val ackResult = conn.bulkTransfer(epIn, ack, 0, 3000)
        if (ackResult < 0) return false
        return statusOk(conn, token)
    }

    private fun statusOk(conn: UsbDeviceConnection, token: Int): Boolean {
        val status = ByteArray(16)
        val n = conn.controlTransfer(
            UsbConstants.USB_DIR_IN or UsbConstants.USB_TYPE_VENDOR or UsbConstants.USB_RECIP_DEVICE,
            PICOBOOT_IF_CMD_STATUS, 0, 0, status, status.size, 1000,
        )
        if (n < 8) return true
        val returnedToken = readU32(status, 0)
        val statusCode = readU32(status, 4)
        return returnedToken == token && statusCode == 0
    }

    private fun reboot(conn: UsbDeviceConnection, epOut: UsbEndpoint, epIn: UsbEndpoint) {
        // dPC=0, dSP=0, dDelayMS=500
        command(conn, epOut, epIn, PC_REBOOT, 12, u32(0) + u32(0) + u32(500))
    }

    private fun verifyBlocks(
        conn: UsbDeviceConnection,
        epOut: UsbEndpoint,
        epIn: UsbEndpoint,
        blocks: List<Uf2Block>,
        onProgress: ProgressCb,
    ): Boolean {
        for ((index, block) in blocks.withIndex()) {
            val token = synchronized(this) { nextToken++ }
            val header = ByteArray(32)
            putU32(header, 0, PICOBOOT_MAGIC)
            putU32(header, 4, token)
            header[8] = PC_READ.toByte()
            header[9] = 8
            putU32(header, 12, block.data.size)
            val args = rangeArgs(block.address, block.data.size)
            System.arraycopy(args, 0, header, 16, args.size)
            if (conn.bulkTransfer(epOut, header, header.size, 3000) != header.size) return false
            val got = ByteArray(block.data.size)
            var offset = 0
            while (offset < got.size) {
                val n = conn.bulkTransfer(epIn, got, offset, got.size - offset, 3000)
                if (n <= 0) return false
                offset += n
            }
            if (!got.contentEquals(block.data)) return false
            if (!statusOk(conn, token)) return false
            onProgress("verifying", (index + 1).toDouble() / blocks.size, "block " + (index + 1))
        }
        return true
    }

    private fun parseUf2(uf2: ByteArray): List<Uf2Block> {
        require(uf2.size % 512 == 0) { "UF2 size is not a multiple of 512 bytes" }
        val out = ArrayList<Uf2Block>()
        for (offset in uf2.indices step 512) {
            val m0 = readU32(uf2, offset)
            val m1 = readU32(uf2, offset + 4)
            val end = readU32(uf2, offset + 508)
            if (m0 != UF2_MAGIC_START0 || m1 != UF2_MAGIC_START1 || end != UF2_MAGIC_END) continue
            val flags = readU32(uf2, offset + 8)
            val address = readU32(uf2, offset + 12)
            val payloadSize = readU32(uf2, offset + 16)
            val family = readU32(uf2, offset + 32 + 256)
            require(payloadSize == PAGE) { "UF2 payload size must be 256 bytes" }
            if ((flags and UF2_FLAG_FAMILY_ID_PRESENT) != 0 && family != RP2040_FAMILY_ID) continue
            require(address >= FLASH_START) { "UF2 block targets non-flash address 0x" + address.toString(16) }
            require(address % PAGE == 0) { "UF2 target address is not 256-byte aligned" }
            out.add(Uf2Block(address, uf2.copyOfRange(offset + 32, offset + 32 + payloadSize)))
        }
        return out.sortedBy { it.address }
    }

    private fun findPicobootInterface(device: UsbDevice): UsbInterface? {
        for (i in 0 until device.interfaceCount) {
            val iface = device.getInterface(i)
            if (iface.interfaceClass == 0xff && iface.endpointCount >= 2) return iface
        }
        return null
    }

    private fun rangeArgs(address: Int, size: Int): ByteArray = u32(address) + u32(size)

    private fun u32(value: Int): ByteArray = byteArrayOf(
        (value and 0xff).toByte(), ((value ushr 8) and 0xff).toByte(),
        ((value ushr 16) and 0xff).toByte(), ((value ushr 24) and 0xff).toByte(),
    )

    private fun putU32(out: ByteArray, offset: Int, value: Int) {
        val b = u32(value)
        System.arraycopy(b, 0, out, offset, 4)
    }

    private fun readU32(b: ByteArray, offset: Int): Int =
        (b[offset].toInt() and 0xff) or
            ((b[offset + 1].toInt() and 0xff) shl 8) or
            ((b[offset + 2].toInt() and 0xff) shl 16) or
            ((b[offset + 3].toInt() and 0xff) shl 24)
}
