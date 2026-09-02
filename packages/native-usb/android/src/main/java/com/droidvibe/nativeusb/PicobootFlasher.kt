package com.droidvibe.nativeusb

import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import java.io.IOException

/** Real RP2040 BOOTSEL PICOBOOT flasher. */
object PicobootFlasher {
    private const val PICOBOOT_MAGIC = 0x431FD10B
    private const val VID = 0x2E8A
    private const val PID_BOOTSEL = 0x0003
    private const val PAGE = 256
    private const val SECTOR = 4096

    private const val PC_EXCLUSIVE_ACCESS = 0x01
    private const val PC_REBOOT = 0x02
    private const val PC_FLASH_ERASE = 0x03
    private const val PC_READ = 0x84
    private const val PC_WRITE = 0x05
    private const val PC_EXIT_XIP = 0x06

    data class Result(val ok: Boolean, val stage: String, val verified: Boolean, val message: String)
    private data class Uf2Block(val address: Int, val data: ByteArray)

    fun flash(
        usbManager: UsbManager,
        device: UsbDevice,
        uf2: ByteArray,
        verify: Boolean,
        onProgress: ProgressCb,
    ): Result {
        if (device.vendorId != VID || device.productId != PID_BOOTSEL) {
            return Result(false, "failed", false, "Device is not an RP2040 in BOOTSEL mode")
        }
        val blocks = try { parseUf2(uf2) } catch (e: Exception) {
            return Result(false, "failed", false, "Invalid UF2: ${e.message}")
        }
        if (blocks.isEmpty()) return Result(false, "failed", false, "UF2 contains no flash blocks")

        val conn = usbManager.openDevice(device)
            ?: return Result(false, "failed", false, "Unable to open RP2040 USB device")
        val iface = findPicobootInterface(device)
        if (iface == null || !conn.claimInterface(iface, true)) {
            conn.close()
            return Result(false, "failed", false, "PICOBOOT interface not found or could not be claimed")
        }
        val epOut = (0 until iface.endpointCount).map { iface.getEndpoint(it) }
            .firstOrNull { it.direction == 0x00 && it.type == 2 }
        val epIn = (0 until iface.endpointCount).map { iface.getEndpoint(it) }
            .firstOrNull { it.direction == 0x80 && it.type == 2 }
        if (epOut == null || epIn == null) {
            conn.releaseInterface(iface); conn.close()
            return Result(false, "failed", false, "PICOBOOT bulk endpoints not found")
        }

        try {
            onProgress("handshake", 0.05, "claim PICOBOOT")
            if (!command(conn, epOut, epIn, PC_EXCLUSIVE_ACCESS, 1, 0) { putU8(it, 0, 2) }) {
                return Result(false, "failed", false, "PICOBOOT exclusive access failed")
            }
            if (!command(conn, epOut, epIn, PC_EXIT_XIP, 0, 0)) {
                return Result(false, "failed", false, "PICOBOOT exit XIP failed")
            }

            val ranges = eraseRanges(blocks)
            ranges.forEachIndexed { index, range ->
                onProgress("erasing", index.toDouble() / ranges.size, "erase 0x${range.first.toString(16)}")
                if (!command(conn, epOut, epIn, PC_FLASH_ERASE, 8, 0) {
                    putU32(it, 0, range.first)
                    putU32(it, 4, range.second)
                }) {
                    return Result(false, "failed", false, "Flash erase failed at 0x${range.first.toString(16)}")
                }
            }

            val pageList = pages(blocks)
            pageList.forEachIndexed { index, pair ->
                onProgress("writing", index.toDouble() / maxOf(1, pageList.size), "page $index/${pageList.size}")
                if (!command(conn, epOut, epIn, PC_WRITE, 8, PAGE, {
                    putU32(it, 0, pair.first)
                    putU32(it, 4, PAGE)
                }, pair.second)) {
                    return Result(false, "failed", false, "Flash write failed at 0x${pair.first.toString(16)}")
                }
            }

            var verified = false
            if (verify) {
                verified = true
                blocks.forEachIndexed { index, block ->
                    onProgress("verifying", index.toDouble() / blocks.size, "read 0x${block.address.toString(16)}")
                    var offset = 0
                    while (offset < block.data.size) {
                        val len = minOf(PAGE, block.data.size - offset)
                        val actual = read(conn, epOut, epIn, block.address + offset, len)
                        if (!actual.contentEquals(block.data.copyOfRange(offset, offset + len))) {
                            verified = false
                            break
                        }
                        offset += len
                    }
                }
                onProgress("verifying", 1.0, if (verified) "read-back matches" else "read-back mismatch")
                if (!verified) return Result(false, "failed", false, "Verification mismatch")
            }

            onProgress("handshake", 0.95, "reboot")
            if (!command(conn, epOut, epIn, PC_REBOOT, 12, 0) {
                putU32(it, 0, 0)
                putU32(it, 4, 0)
                putU32(it, 8, 100)
            }) {
                return Result(false, "failed", false, "PICOBOOT reboot failed")
            }
            onProgress("done", 1.0, "flashed")
            return Result(true, "done", !verify || verified, "PICOBOOT flash complete")
        } catch (e: Exception) {
            return Result(false, "failed", false, e.message ?: "PICOBOOT error")
        } finally {
            conn.releaseInterface(iface)
            conn.close()
        }
    }

    private fun pages(blocks: List<Uf2Block>): List<Pair<Int, ByteArray>> = blocks.flatMap { block ->
        block.data.asList().chunked(PAGE).mapIndexed { pageIndex, bytes ->
            val page = ByteArray(PAGE)
            bytes.toByteArray().copyInto(page)
            block.address + pageIndex * PAGE to page
        }
    }

    private fun command(
        conn: UsbDeviceConnection,
        out: UsbEndpoint,
        input: UsbEndpoint,
        id: Int,
        argSize: Int,
        transferLength: Int,
        fill: ((ByteArray) -> Unit)? = null,
        payload: ByteArray? = null,
    ): Boolean {
        val cmd = ByteArray(32)
        putU32(cmd, 0, PICOBOOT_MAGIC)
        putU32(cmd, 4, token++)
        cmd[8] = id.toByte()
        cmd[9] = argSize.toByte()
        putU32(cmd, 12, transferLength)
        fill?.invoke(cmd)
        if (conn.bulkTransfer(out, cmd, cmd.size, 5000) != cmd.size) return false
        if (payload != null && transferLength > 0) {
            if (conn.bulkTransfer(out, payload, transferLength, 10000) != transferLength) return false
        }
        return receiveAck(conn, input)
    }

    private fun read(
        conn: UsbDeviceConnection,
        out: UsbEndpoint,
        input: UsbEndpoint,
        address: Int,
        length: Int,
    ): ByteArray {
        val cmd = ByteArray(32)
        putU32(cmd, 0, PICOBOOT_MAGIC)
        putU32(cmd, 4, token++)
        cmd[8] = PC_READ.toByte()
        cmd[9] = 8
        putU32(cmd, 12, length)
        putU32(cmd, 16, address)
        putU32(cmd, 20, length)
        if (conn.bulkTransfer(out, cmd, cmd.size, 5000) != cmd.size) throw IOException("PICOBOOT read command failed")
        val data = ByteArray(length)
        var offset = 0
        while (offset < length) {
            val n = conn.bulkTransfer(input, data, offset, length - offset, 5000)
            if (n <= 0) throw IOException("PICOBOOT read data failed")
            offset += n
        }
        if (!receiveAckOnOut(conn, out)) throw IOException("PICOBOOT read ACK failed")
        return data
    }

    private fun receiveAck(conn: UsbDeviceConnection, input: UsbEndpoint): Boolean =
        conn.bulkTransfer(input, ByteArray(0), 0, 5000) == 0

    private fun receiveAckOnOut(conn: UsbDeviceConnection, out: UsbEndpoint): Boolean =
        conn.bulkTransfer(out, ByteArray(0), 0, 5000) == 0

    private var token = 1

    private fun putU8(b: ByteArray, off: Int, v: Int) { b[off] = v.toByte() }
    private fun putU32(b: ByteArray, off: Int, v: Int) {
        b[off] = (v and 0xff).toByte()
        b[off + 1] = ((v ushr 8) and 0xff).toByte()
        b[off + 2] = ((v ushr 16) and 0xff).toByte()
        b[off + 3] = ((v ushr 24) and 0xff).toByte()
    }

    private fun readU32(b: ByteArray, off: Int): Int =
        (b[off].toInt() and 0xff) or
            ((b[off + 1].toInt() and 0xff) shl 8) or
            ((b[off + 2].toInt() and 0xff) shl 16) or
            ((b[off + 3].toInt() and 0xff) shl 24)

    private fun parseUf2(uf2: ByteArray): List<Uf2Block> {
        require(uf2.size % 512 == 0) { "size is not a multiple of 512" }
        val result = ArrayList<Uf2Block>()
        for (i in uf2.indices step 512) {
            require(readU32(uf2, i) == 0x0A324655) { "bad UF2 start magic" }
            require(readU32(uf2, i + 508) == 0x0AB16F30) { "bad UF2 end magic" }
            val address = readU32(uf2, i + 12)
            val size = readU32(uf2, i + 16)
            require(size in 1..256) { "invalid payload size $size" }
            require(i + 32 + size <= i + 512) { "payload exceeds UF2 block" }
            result += Uf2Block(address, uf2.copyOfRange(i + 32, i + 32 + size))
        }
        return result.sortedBy { it.address }
    }

    private fun eraseRanges(blocks: List<Uf2Block>): List<Pair<Int, Int>> {
        val sectors = blocks.flatMap { block ->
            val first = block.address and (SECTOR - 1).inv()
            val last = (block.address + block.data.size - 1) and (SECTOR - 1).inv()
            generateSequence(first) { current -> if (current < last) current + SECTOR else null }.toList()
        }.distinct().sorted()
        return sectors.map { it to SECTOR }
    }

    private fun findPicobootInterface(device: UsbDevice): UsbInterface? {
        for (i in 0 until device.interfaceCount) {
            val iface = device.getInterface(i)
            if (iface.interfaceClass == 0xff && iface.endpointCount >= 2) return iface
        }
        return null
    }
}
