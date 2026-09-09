package com.droidvibe.nativeusb

import android.content.Context
import android.util.Base64
import android.util.Log
import org.apache.commons.compress.archivers.tar.TarArchiveEntry
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import java.io.BufferedInputStream
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.io.SequenceInputStream
import java.nio.file.Files
import java.util.concurrent.TimeUnit
import java.util.regex.Pattern
import java.util.zip.GZIPInputStream
import java.util.Vector

/** Runs a real Arduino CLI toolchain locally on the Android device. */
object LocalToolchain {
    private const val TAG = "DroidVibeLocalToolchain"
    private const val ASSET_ROOTFS = "droidvibe-toolchain-rootfs.tar.gz"
    private const val ASSET_ROOTFS_PART_PREFIX = "droidvibe-toolchain-rootfs.tar.gz.part-"
    private const val ASSET_PROOT = "droidvibe-toolchain-proot"
    private const val VERSION = "2026-09-local-cli-1.5.1-avr-megaavr-pico6.1-python3-chunked-stream-symlinkfix-persistent-cli-state"
    private const val MARKER = ".installed"
    private const val TIMEOUT_MINUTES = 5L

    data class CompileResult(
        val ok: Boolean,
        val diagnostics: List<Map<String, Any?>>,
        val firmware: String?,
        val firmwarePath: String?,
        val fqbn: String,
        val durationMs: Long,
        val stdout: String,
    )

    fun compile(context: Context, name: String, fqbn: String, files: List<Pair<String, String>>): CompileResult {
        val started = System.currentTimeMillis()
        val root = ensureInstalled(context)
        val safeName = name.replace(Regex("[^A-Za-z0-9_]+"), "_").ifBlank { "Sketch" }
        val job = File(context.cacheDir, "compile-$started-$safeName")
        val sketchDir = File(job, safeName)
        val buildDir = File(job, "build")
        sketchDir.mkdirs(); buildDir.mkdirs()
        if (files.isEmpty()) throw IllegalArgumentException("Sketch contains no source files")
        for ((relativePath, content) in files) {
            val clean = relativePath.replace('\\', '/').removePrefix("/")
            if (clean.isBlank() || clean.split('/').any { it == ".." }) throw SecurityException("Invalid sketch path")
            val dest = File(sketchDir, clean)
            if (!dest.absolutePath.startsWith(sketchDir.absolutePath + File.separator)) throw SecurityException("Sketch path escaped workspace")
            dest.parentFile?.mkdirs(); dest.writeText(content, Charsets.UTF_8)
        }
        val command = cliCommand(root, listOf("compile", "--fqbn", fqbn, "--build-path", "/work/build", "--warnings", "all", "/work/$safeName"), job)
        val process = startProcess(command, job, root)
        val output = process.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
        if (!process.waitFor(TIMEOUT_MINUTES, TimeUnit.MINUTES)) {
            process.destroyForcibly()
            return CompileResult(false, listOf(diag("error", safeName + ".ino", 0, 0, "Local compilation timed out after $TIMEOUT_MINUTES minutes")), null, null, fqbn, System.currentTimeMillis() - started, output)
        }
        val firmwareFile = findFirmware(buildDir, fqbn)
        val firmwareB64 = firmwareFile?.let { Base64.encodeToString(it.readBytes(), Base64.NO_WRAP) }
        val diagnostics = parseDiagnostics(output, safeName)
        val ok = process.exitValue() == 0 && firmwareFile != null
        val finalOutput = if (ok) output else if (firmwareFile == null && process.exitValue() == 0) output + "\nDroidVibe: compiler exited successfully but no .hex/.uf2/.bin artifact was produced." else output
        val result = CompileResult(ok, diagnostics, firmwareB64, firmwareFile?.absolutePath, fqbn, System.currentTimeMillis() - started, finalOutput)
        cleanupAsync(job); return result
    }

    fun runCli(context: Context, args: List<String>, timeoutMinutes: Long): Pair<Boolean, String> {
        require(timeoutMinutes > 0) { "timeoutMinutes must be positive" }
        val root = ensureInstalled(context)
        val work = File(context.cacheDir, "cli-${System.currentTimeMillis()}").apply { mkdirs() }
        val process = startProcess(cliCommand(root, args, work), work, root)
        val output = process.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
        if (!process.waitFor(timeoutMinutes, TimeUnit.MINUTES)) {
            process.destroyForcibly(); cleanupAsync(work)
            return false to (output + "\nDroidVibe: Arduino CLI operation timed out.")
        }
        val ok = process.exitValue() == 0
        cleanupAsync(work)
        return ok to output
    }

    data class InstalledPaths(val root: File, val rootfs: File, val proot: File)

    @Synchronized
    fun ensureInstalled(context: Context): InstalledPaths {
        val root = File(context.filesDir, "droidvibe-toolchain")
        val rootfs = File(root, "rootfs")
        val proot = File(root, "proot")
        val marker = File(root, MARKER)
        if (marker.isFile && marker.readText() == VERSION && proot.canExecute() && File(rootfs, "opt/droidvibe/bin/arduino-cli").isFile) return InstalledPaths(root, rootfs, proot)
        if (root.exists()) root.deleteRecursively()
        root.mkdirs(); extractAsset(context, ASSET_PROOT, proot)
        if (!proot.setExecutable(true, false)) throw IllegalStateException("Android refused to mark the local compiler runtime executable")
        rootfs.mkdirs()
        openRootfsAssetStream(context).use { input ->
            GZIPInputStream(BufferedInputStream(input, 64 * 1024)).use { gzip ->
                TarArchiveInputStream(BufferedInputStream(gzip, 64 * 1024)).use { tar ->
                    var entry: TarArchiveEntry? = tar.nextTarEntry
                    while (entry != null) {
                        val current = entry
                        val clean = current.name.removePrefix("/")
                        if (clean.isBlank() || clean.split('/').any { it == ".." }) throw SecurityException("Invalid toolchain archive path")
                        val out = File(rootfs, clean)
                        val safeAbsolute = out.absolutePath == rootfs.absolutePath || out.absolutePath.startsWith(rootfs.absolutePath + File.separator)
                        if (!safeAbsolute) throw SecurityException("Toolchain archive escaped rootfs")
                        when {
                            current.isDirectory -> out.mkdirs()
                            current.isSymbolicLink -> {
                                out.parentFile?.mkdirs()
                                val linkName = current.linkName
                                if (linkName.isBlank()) throw SecurityException("Invalid toolchain symlink")
                                val linkTarget = if (linkName.startsWith("/")) {
                                    val target = File(rootfs, linkName.removePrefix("/"))
                                    if (!target.absolutePath.startsWith(rootfs.absolutePath + File.separator) && target.absolutePath != rootfs.absolutePath) throw SecurityException("Invalid absolute symlink target")
                                    out.parentFile.toPath().relativize(target.toPath()).toString()
                                } else {
                                    if (linkName.split('/').any { it == ".." }) throw SecurityException("Invalid relative symlink target")
                                    linkName
                                }
                                runCatching { Files.deleteIfExists(out.toPath()) }
                                Files.createSymbolicLink(out.toPath(), File(linkTarget).toPath())
                            }
                            current.isLink -> {
                                out.parentFile?.mkdirs()
                                val targetName = current.linkName.removePrefix("/")
                                if (targetName.isBlank() || targetName.split('/').any { it == ".." }) throw SecurityException("Invalid hard link target")
                                val target = File(rootfs, targetName)
                                if (!target.absolutePath.startsWith(rootfs.absolutePath + File.separator)) throw SecurityException("Invalid hard link target")
                                runCatching { Files.deleteIfExists(out.toPath()) }
                                Files.createLink(out.toPath(), target.toPath())
                            }
                            else -> {
                                out.parentFile?.mkdirs(); FileOutputStream(out).use { fos -> tar.copyTo(fos) }
                                val executable = (current.mode and 0b1000000) != 0 || (current.mode and 0b1000) != 0 || (current.mode and 0b1) != 0
                                out.setExecutable(executable, false); out.setReadable(true, false)
                            }
                        }
                        entry = tar.nextTarEntry
                    }
                }
            }
        }
        marker.writeText(VERSION, Charsets.UTF_8)
        return InstalledPaths(root, rootfs, proot)
    }

    private fun openRootfsAssetStream(context: Context): InputStream {
        val names = context.assets.list("")?.filter { it.startsWith(ASSET_ROOTFS_PART_PREFIX) }?.sorted() ?: emptyList()
        return if (names.isNotEmpty()) {
            val streams = Vector<InputStream>(names.size)
            for (name in names) streams.add(context.assets.open(name))
            SequenceInputStream(streams.elements())
        } else {
            context.assets.open(ASSET_ROOTFS)
        }
    }

    private fun cliCommand(root: InstalledPaths, args: List<String>, work: File): List<String> = buildList {
        add(root.proot.absolutePath); add("-r"); add(root.rootfs.absolutePath); add("-w"); add("/work")
        add("-b"); add("${work.absolutePath}:/work"); add("--kill-on-exit"); add("/opt/droidvibe/bin/arduino-cli"); addAll(args)
    }

    private fun startProcess(command: List<String>, work: File, root: InstalledPaths): Process = ProcessBuilder(command).directory(work).redirectErrorStream(true).apply {
        environment()["HOME"] = "/root"
        environment()["PATH"] = "/opt/droidvibe/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
        environment()["ARDUINO_DATA_DIR"] = "/opt/droidvibe/data"
        // Keep Board Manager indexes, installed cores, and package configuration across CLI invocations.
        // The previous /work/user setting made every Board Manager operation disposable.
        environment()["ARDUINO_USER_DIR"] = "/opt/droidvibe/user"
        environment()["TMPDIR"] = "/work/tmp"
        environment()["LC_ALL"] = "C"
        environment()["LANG"] = "C"
        environment()["PROOT_NO_SECCOMP"] = "1"
    }.start()

    private fun extractAsset(context: Context, asset: String, target: File) { context.assets.open(asset).use { input -> FileOutputStream(target).use { output -> input.copyTo(output, 64 * 1024) } } }
    private fun findFirmware(buildDir: File, fqbn: String): File? {
        if (!buildDir.isDirectory) return null
        val files = buildDir.walkTopDown().filter { it.isFile }.toList()
        val preferred = when { fqbn.startsWith("rp2040:") -> listOf(".uf2", ".bin", ".hex"); fqbn.startsWith("esp32:") -> listOf(".bin", ".hex", ".uf2"); else -> listOf(".hex", ".bin", ".uf2") }
        return preferred.asSequence().flatMap { ext -> files.filter { it.extension.equals(ext.removePrefix("."), true) }.asSequence() }.maxByOrNull { it.length() }
    }
    private fun parseDiagnostics(output: String, defaultFile: String): List<Map<String, Any?>> {
        val out = ArrayList<Map<String, Any?>>(); val gcc = Pattern.compile("^(.+?):(\\d+):(\\d+):\\s*(fatal error|error|warning|note):\\s*(.+)$")
        output.lineSequence().forEach { line -> val m = gcc.matcher(line.trim()); if (m.find()) { val sev = when (m.group(4)) { "warning" -> "warning"; "note" -> "info"; else -> "error" }; out += diag(sev, m.group(1) ?: defaultFile, m.group(2)?.toIntOrNull() ?: 0, m.group(3)?.toIntOrNull() ?: 0, m.group(5) ?: line) } }
        return out
    }
    private fun diag(severity: String, file: String, line: Int, column: Int, message: String): Map<String, Any?> = mapOf("severity" to severity, "file" to file, "line" to line, "column" to column, "message" to message)
    private fun cleanupAsync(job: File) { Thread { try { Thread.sleep(5000); job.deleteRecursively() } catch (_: Exception) { Log.w(TAG, "Could not clean local compiler job ${job.absolutePath}") } }.start() }
}
