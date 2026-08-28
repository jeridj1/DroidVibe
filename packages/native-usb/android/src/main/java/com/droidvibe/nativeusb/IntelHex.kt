package com.droidvibe.nativeusb

/**
 * Minimal Intel HEX parser + page splitter used by the AVR uploaders.
 * Mirrors the shared TypeScript hex.ts.
 */
object IntelHex {
    data class Image(val startAddress: Int, val endAddress: Int, val bytes: ByteArray)

    fun parse(text: String): Image {
        var base = 0
        val mem = HashMap<Int, Byte>()
        var min = Int.MAX_VALUE; var max = Int.MIN_VALUE
        for (raw in text.split("\n".toRegex())) {
            val line = raw.trim()
            if (!line.startsWith(":")) continue
            val b = line.substring(1)
            val byteCount = b.substring(0, 2).toInt(16)
            val addr = b.substring(2, 6).toInt(16)
            val type = b.substring(6, 8).toInt(16)
            var sum = byteCount + (addr shr 8) + (addr and 0xff) + type
            val data = ByteArray(byteCount)
            for (i in 0 until byteCount) {
                val v = b.substring(8 + i * 2, 8 + i * 2 + 2).toInt(16)
                data[i] = v.toByte(); sum += v
            }
            val chk = b.substring(8 + byteCount * 2, 8 + byteCount * 2 + 2).toInt(16)
            if (((sum.inv() + 1) and 0xff) != chk) throw IllegalStateException("HEX checksum mismatch")
            when (type) {
                0x00 -> { for (i in 0 until byteCount) { val a = base + addr + i; mem[a] = data[i]; if (a < min) min = a; if (a > max) max = a } }
                0x01 -> break
                0x02 -> base = ((data[0].toInt() and 0xff) shl 8 or (data[1].toInt() and 0xff)) shl 4
                0x04 -> base = ((data[0].toInt() and 0xff) shl 8 or (data[1].toInt() and 0xff)) shl 16
            }
        }
        if (mem.isEmpty()) return Image(0, 0, ByteArray(0))
        val out = ByteArray(max - min + 1)
        for ((a, v) in mem) out[a - min] = v
        return Image(min, max, out)
    }

    fun toPages(img: Image, pageSize: Int): List<Pair<Int, ByteArray>> {
        val out = ArrayList<Pair<Int, ByteArray>>()
        var addr = img.startAddress
        var i = 0
        while (i < img.bytes.size) {
            val len = minOf(pageSize, img.bytes.size - i)
            out.add(addr to img.bytes.copyOfRange(i, i + len))
            addr += len; i += len
        }
        return out
    }
}
