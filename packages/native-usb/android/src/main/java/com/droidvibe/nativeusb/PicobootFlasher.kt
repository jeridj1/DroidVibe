package com.droidvibe.nativeusb

import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.util.Log

/**
 * RP2040 PICOBOOT flasher.
 *
 * The previous implementation used incorrect PICOBOOT command IDs and treated
 * the bulk response as a one-byte ACK. This implementation follows the
 * documented bootrom protocol: 32-byte command header, command-status control
 * transfer, optional bulk data, and the final one-byte bulk ACK.
 */
object PicobootFlasher {
    private const val TAG = "PicobootFlasher"

    private const val PICOBOOT_MAGIC = 0x431fd83b
    private const val UF2_MAGIC_START0 = 0x0A324655
    private const val UF2_MAGIC_START1 = 0x9E5D5157.toInt()

    private const val FLASH_SECTOR = 0x1000
    private const val PAGE = 256
    private const val RP2040_FLASH_START = 0x10000000

    private const val CMD_EXCLUSIVE_ACCESS = 0x01
    private const val CMD_REBOOT = 0x02
    private const val CMD_FLASH_ERASE = 0x03
    private const val CMD_WRITE = 0x05
    private const val CMD_EXIT_XIP = 0x06
    private const val CMD_READ = 0x84

    private const val REQUEST_GET_COMMAND_STATUS = 0x42
    private const val STATUS_OK = 0
    private const val STATUS_REBOOTING = 7

    data class Result(
        val ok: Boolean,
        val stage: String,
        val verified: Boolean,
        val message: String,
    )

    private data class CommandResult(val ok: Boolean, val message: String, val data: ByteArray? = null)

    fun flash(
        usbManager: UsbManager,
        device: UsbDevice,
        uf2: ByteArray,
        verify: Boolean,
        onProgress: ProgressCb,
    ): Result {
        if (device.vendorId != 0x2e8a || device.productId != 0x0003) {
            return Result(false, "failed", false, "Device is not an RP2040 in BOOTSEL mode")
        }

        val conn = usbManager.openDevice(device)
            ?: return Result(false, "failed", false, "Android could not open the RP2040 USB device")
        val iface = findPicobootInterface(device)
        if (iface == null) {
            conn.close()
            return Result(false, "failed", false, "PICOBOOT interface not found on RP2040")
        }
        if (!conn.claimInterface(iface, true)) {
            conn.close()
            return Result(false, "failed", false, "Android could not claim the PICOBOOT USB interface")
        }

        val epOut = findBulkEndpoint(iface, false)
        val epIn = findBulkEndpoint(iface, true)
        if (epOut == null || epIn == null) {
            conn.releaseInterface(iface)
            conn.close()
            return Result(false, "failed", false, "PICOBOOT bulk endpoints are missing")
        }

        var token = 1
        try {
            onProgress("handshake", 0.05, "claiming RP2040 PICOBOOT")

            // Eject/disable BOOTSEL mass storage so Android's file browser is
            // no longer competing with the PICOBOOT interface.
            val exclusive = sendCommand(
                conn, iface, epOut, epIn,
                cmdId = CMD_EXCLUSIVE_ACCESS,
                cmdSize = 1,
                transferLength = 0,
                args = byteArrayOf(2),
                token = token++,
            )
            if (!exclusive.ok) return Result(false, "failed", false, exclusive.message)

            onProgress("handshake", 0.15, "exiting flash XIP")
            val exitXip = sendCommand(
                conn, iface, epOut, epIn,
                cmdId = CMD_EXIT_XIP,
                cmdSize = 0,
                transferLength = 0,
                args = ByteArray(16),
                token = token++,
            )
            if (!exitXip.ok) return Result(false, "failed", false, exitXip.message)

            val blocks = parseUf2(uf2)
            if (blocks.isEmpty()) return Result(false, "failed", false, "UF2 contains no flash blocks")

            val minAddress = blocks.minOf { it.first }
            val maxAddress = blocks.maxOf { it.first + it.second.size }
            if (minAddress < RP2040_FLASH_START || maxAddress <= minAddress) {
                return Result(false, "failed", false, "UF2 contains an invalid RP2040 flash address")
            }

            val eraseStart = (minAddress / FLASH_SECTOR) * FLASH_SECTOR
            val eraseEnd = ((maxAddress + FLASH_SECTOR - 1) / FLASH_SECTOR) * FLASH_SECTOR
            val eraseTotal = eraseEnd - eraseStart
            var erased = 0
            var address = eraseStart
            while (address < eraseEnd) {
                onProgress("erasing", erased.toDouble() / eraseTotal, "erase 0x" + address.toString(16))
                val er = sendCommand(
                    conn, iface, epOut, epIn,
                    cmdId = CMD_FLASH_ERASE,
                    cmdSize = 8,
                    transferLength = 0,
                    args = rangeArgs(address, FLASH_SECTOR),
                    token = token++,
                )
                if (!er.ok) return Result(false, "failed", false, er.message)
                address += FLASH_SECTOR
                erased += FLASH_SECTOR
            }

            // UF2 blocks normally contain one 256-byte flash page. Keep the
            // actual target address instead of flattening gaps into flash.
            var written = 0
            val totalBytes = blocks.sumOf { it.second.size }
            for ((blockAddress, data) in blocks) {
                var pageOffset = 0
                while (pageOffset < data.size) {
                    val len = minOf(PAGE, data.size - pageOffset)
                    val page = ByteArray(PAGE)
                    System.arraycopy(data, pageOffset, page, 0, len)
                    val writeAddress = blockAddress + pageOffset
                    onProgress("writing", written.toDouble() / totalBytes, "write 0x" + writeAddress.toString(16))
                    val wr = sendCommand(
                        conn, iface, epOut, epIn,
                        cmdId = CMD_WRITE,
                        cmdSize = 8,
                        transferLength = PAGE,
                        args = rangeArgs(writeAddress, PAGE),
                        dataOut = page,
                        token = token++,
                    )
                    if (!wr.ok) return Result(false, "failed", false, wr.message)
                    pageOffset += len
                    written += len
                }
            }

            var verifiedOk = true
            if (verify) {
                onProgress("verifying", 0.0, "read-back verification")
                var checked = 0
                for ((blockAddress, data) in blocks) {
                    var pageOffset = 0
                    while (pageOffset < data.size) {
                        val len = minOf(PAGE, data.size - pageOffset)
                        val expected = ByteArray(PAGE)
                        System.arraycopy(data, pageOffset, expected, 0, len)
                        val read = sendCommand(
                            conn, iface, epOut, epIn,
                            cmdId = CMD_READ,
                            cmdSize = 8,
                            transferLength = PAGE,
                            args = rangeArgs(blockAddress + pageOffset, PAGE),
                            token = token++,
                            expectDataIn = PAGE,
                        )
                        if (!read.ok || read.data == null || !read.data.contentEquals(expected)) {
                            verifiedOk = false
                            break
                        }
                        pageOffset += len
                        checked += len
                        onProgress("verifying", checked.toDouble() / totalBytes, "verify 0x" + (blockAddress + pageOffset).toString(16))
                    }
                    if (!verifiedOk) break
                }
                if (!verifiedOk) {
                    return Result(false, "failed", false, "Verification mismatch during RP2040 flash read-back")
                }
            }

            onProgress("handshake", 0.98, "rebooting RP2040")
            val reboot = sendCommand(
                conn, iface, epOut, epIn,
                cmdId = CMD_REBOOT,
                cmdSize = 12,
                transferLength = 0,
                args = ByteArray(16),
                token = token++,
                allowStatus = setOf(STATUS_OK, STATUS_REBOOTING),
            )
            if (!reboot.ok) return Result(false, "failed", false, reboot.message)

            onProgress("done", 1.0, "RP2040 helper flashed")
            return Result(true, "done", !verify || verifiedOk, "PICOBOOT flash complete")
        } catch (e: Exception) {
            Log.e(TAG, "PICOBOOT flash failed", e)
            return Result(false, "failed", false, e.message ?: "PICOBOOT flash failed")
        } finally {
            runCatching { conn.releaseInterface(iface) }
            runCatching { conn.close() }
        }
    }

    private fun sendCommand(
        conn: UsbDeviceConnection,
        iface: UsbInterface,
        epOut: UsbEndpoint,
        epIn: UsbEndpoint,
        cmdId: Int,
        cmdSize: Int,
        transferLength: Int,
        args: ByteArray,
        token: Int,
        dataOut: ByteArray? = null,
        expectDataIn: Int = 0,
        allowStatus: Set<Int> = setOf(STATUS_OK),
    ): CommandResult {
        val header = buildCommandHeader(cmdId, cmdSize, transferLength, args, token)
        if (conn.bulkTransfer(epOut, header, header.size, 3000) != header.size) {
            return CommandResult(false, "PICOBOOT command header transfer failed (cmd 0x${cmdId.toString(16)})")
        }

        var status = getCommandStatus(conn, iface)
        if (status != STATUS_OK && status !in allowStatus) {
            return CommandResult(false, "PICOBOOT command 0x${cmdId.toString(16)} rejected with status $status")
        }

        var resultData: ByteArray? = null
        if (transferLength != 0) {
            if (expectDataIn > 0) {
                val data = ByteArray(expectDataIn)
                var got = 0
                val deadline = System.currentTimeMillis() + 5000
                while (got < expectDataIn && System.currentTimeMillis() < deadline) {
                    val n = conn.bulkTransfer(epIn, data, got, expectDataIn - got, 1000)
                    if (n > 0) got += n
                }
                if (got != expectDataIn) {
                    return CommandResult(false, "PICOBOOT read transfer was short: $got/$expectDataIn bytes")
                }
                resultData = data
            } else {
                val out = dataOut ?: ByteArray(transferLength)
                if (out.size != transferLength) {
                    return CommandResult(false, "PICOBOOT write buffer length mismatch")
                }
                if (conn.bulkTransfer(epOut, out, out.size, 5000) != out.size) {
                    return CommandResult(false, "PICOBOOT write data transfer failed")
                }
            }

            status = getCommandStatus(conn, iface)
            if (status != STATUS_OK && status !in allowStatus) {
                return CommandResult(false, "PICOBOOT data command 0x${cmdId.toString(16)} failed with status $status")
            }
        }

        // Final ACK direction follows the command direction bit.
        if ((cmdId and 0x80) != 0) {
            if (conn.bulkTransfer(epOut, byteArrayOf(0), 1, 2000) != 1) {
                return CommandResult(false, "PICOBOOT host ACK failed")
            }
        } else {
            val ack = ByteArray(1)
            if (conn.bulkTransfer(epIn, ack, 1, 2000) != 1) {
                return CommandResult(false, "PICOBOOT device ACK was not received")
            }
            if (ack[0].toInt() != 0) {
                return CommandResult(false, "PICOBOOT device returned ACK 0x${ack[0].toInt() and 0xff}")
            }
        }
        return CommandResult(true, "ok", resultData)
    }

    private fun buildCommandHeader(cmdId: Int, cmdSize: Int, transferLength: Int, args: ByteArray, token: Int): ByteArray {
        val out = ByteArray(32)
        putU32(out, 0, PICOBOOT_MAGIC)
        putU32(out, 4, token)
        out[8] = cmdId.toByte()
        out[9] = cmdSize.toByte()
        out[10] = 0
        out[11] = 0
        putU32(out, 12, transferLength)
        System.arraycopy(args, 0, out, 16, minOf(16, args.size))
        return out
    }

    private fun rangeArgs(addr: Int, size: Int): ByteArray {
        val out = ByteArray(16)
        putU32(out, 0, addr)
        putU32(out, 4, size)
        return out
    }

    private fun putU32(b: ByteArray, off: Int, value: Int) {
        b[off] = (value and 0xff).toByte()
        b[off + 1] = ((value ushr 8) and 0xff).toByte()
        b[off + 2] = ((value ushr 16) and 0xff).toByte()
        b[off + 3] = ((value ushr 24) and 0xff).toByte()
    }

    private fun getCommandStatus(conn: UsbDeviceConnection, iface: UsbInterface): Int {
        val buf = ByteArray(16)
        val n = conn.controlTransfer(0xC1, REQUEST_GET_COMMAND_STATUS, 0, iface.id, buf, buf.size, 2000)
        if (n != 16) throw IllegalStateException("PICOBOOT command-status request returned $n bytes")
        return readU32(buf, 4)
    }

    private fun readU32(b: ByteArray, off: Int): Int =
        (b[off].toInt() and 0xff) or
            ((b[off + 1].toInt() and 0xff) shl 8) or
            ((b[off + 2].toInt() and 0xff) shl 16) or
            ((b[off + 3].toInt() and 0xff) shl 24)

    private fun parseUf2(uf2: ByteArray): List<Pair<Int, ByteArray>> {
        require(uf2.size % 512 == 0) { "UF2 size is not a multiple of 512 bytes" }
        val blocks = ArrayList<Pair<Int, ByteArray>>()
        val count = uf2.size / 512
        for (i in 0 until count) {
            val base = i * 512
            require(readU32(uf2, base) == UF2_MAGIC_START0) { "Bad UF2 start magic at block $i" }
            require(readU32(uf2, base + 4) == UF2_MAGIC_START1) { "Bad UF2 second magic at block $i" }
            val target = readU32(uf2, base + 12)
            val payloadSize = readU32(uf2, base + 16)
            require(payloadSize in 1..PAGE) { "Invalid UF2 payload size $payloadSize at block $i" }
            blocks.add(target to uf2.copyOfRange(base + 32, base + 32 + payloadSize))
        }
        return blocks.sortedBy { it.first }
    }

    private fun findBulkEndpoint(iface: UsbInterface, input: Boolean): UsbEndpoint? {
        for (i in 0 until iface.endpointCount) {
            val ep = iface.getEndpoint(i)
            if (ep.type == android.hardware.usb.UsbConstants.USB_ENDPOINT_XFER_BULK &&
                ((ep.direction == android.hardware.usb.UsbConstants.USB_DIR_IN) == input)
            ) return ep
        }
        return null
    }

    private fun findPicobootInterface(device: UsbDevice): UsbInterface? {
        for (i in 0 until device.interfaceCount) {
            val iface = device.getInterface(i)
            if (iface.interfaceClass == 0xff && iface.endpointCount >= 2) return iface
        }
        return null
    }
}
