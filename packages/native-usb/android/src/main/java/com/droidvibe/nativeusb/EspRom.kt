package com.droidvibe.nativeusb

import java.io.ByteArrayOutputStream

/**
 * ESP ROM-loader (esptool-compatible) SLIP command builders.
 */
object EspRom {
    private const val SLIP_END: Byte = 0xC0
    private const val SLIP_ESC: Byte = 0xDB

    private fun le32(v: Int): ByteArray =
        byteArrayOf(v.toByte(), (v shr 8).toByte(), (v shr 16).toByte(), (v shr 24).toByte())

    private fun slipEncode(data: ByteArray): ByteArray {
        val out = ByteArrayOutputStream()
        for (b in data) {
            val u = b.toInt() and 0xff
            if (u == 0xC0) { out.write(0xDB); out.write(0xDC) }
            else if (u == 0xDB) { out.write(0xDB); out.write(0xDD) }
            else out.write(u)
        }
        return out.toByteArray()
    }

    private fun frame(cmd: Int, checksum: Int, data: ByteArray): ByteArray {
        val header = ByteArrayOutputStream()
        header.write(0x00)
        header.write(cmd and 0xff)
        header.write(le32(data.size))
        header.write(le32(checksum))
        val body = ByteArrayOutputStream(); body.write(header.toByteArray()); body.write(data)
        val framed = ByteArrayOutputStream(); framed.write(SLIP_END.toInt()); framed.write(slipEncode(body.toByteArray())); framed.write(SLIP_END.toInt())
        return framed.toByteArray()
    }

    fun syncCommand(): ByteArray {
        val data = ByteArray(36)
        data[0] = 0x07; data[1] = 0x07; data[2] = 0x07; data[3] = 0x07
        for (i in 4 until 36) data[i] = 0x55
        return frame(0x08, 0, data)
    }

    fun isSyncReply(buf: ByteArray): Boolean {
        return buf.size > 4 && (buf[0].toInt() and 0xff) == 0xC0 && (buf[1].toInt() and 0xff) == 0x01 && (buf[2].toInt() and 0xff) == 0x08
    }

    fun flashBegin(totalSize: Int, offset: Int, numPackets: Int): ByteArray {
        val data = ByteArrayOutputStream()
        data.write(le32(totalSize)); data.write(le32(numPackets)); data.write(le32(0)); data.write(le32(offset))
        return frame(0x02, 0, data.toByteArray())
    }

    fun flashData(block: ByteArray, seq: Int, padTo: Int): ByteArray {
        val data = ByteArrayOutputStream()
        data.write(le32(block.size))
        data.write(block)
        for (i in block.size until padTo) data.write(0xFF)
        val chk = block.fold(0) { acc, b -> acc xor (b.toInt() and 0xff) }
        return frame(0x03, chk, data.toByteArray())
    }

    fun flashEnd(reboot: Boolean): ByteArray {
        val data = le32(if (reboot) 1 else 0)
        return frame(0x04, 0, data)
    }
}
