package com.droidvibe.nativeusb

import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File
import java.util.concurrent.TimeUnit

class CompileSketchInput : Record() {
    @Field val name: String = "Sketch"
    @Field val fqbn: String = "arduino:avr:uno"
    @Field val code: String = ""
}

/**
 * Local Arduino toolchain for the Android app.
 *
 * Arduino CLI is packaged as an arm64 executable in the module's jniLibs.
 * Board cores, compiler tools and libraries are downloaded into app-private
 * storage, so compilation never requires a remote build server.
 */
class DroidVibeToolchainModule : Module() {
    companion object {
        private const val CLI = "libarduino-cli.so"
        private const val CONFIG = "arduino-cli"
    }

    private val configDir: File
        get() = File(appContext.reactContext?.filesDir, CONFIG)
    private val dataDir: File
        get() = File(configDir, "data")
    private val userDir: File
        get() = File(configDir, "user")
    private val executable: File
        get() = File(appContext.reactContext?.applicationInfo?.nativeLibraryDir ?: "", CLI)

    override fun definition() = ModuleDefinition {
        Name("DroidVibeToolchain")

        AsyncFunction("status") { promise: Promise ->
            promise.resolve(mapOf(
                "available" to (executable.exists() && executable.canExecute()),
                "path" to executable.absolutePath,
                "dataDir" to dataDir.absolutePath,
                "userDir" to userDir.absolutePath,
            ))
        }

        AsyncFunction("compileSketch") { input: CompileSketchInput, promise: Promise ->
            Thread {
                val sketchName = sanitizeSketchName(input.name)
                val sketchDir = File(configDir, "work/$sketchName")
                val outputDir = File(sketchDir, "build")
                runCatching {
                    outputDir.deleteRecursively()
                    sketchDir.mkdirs()
                    outputDir.mkdirs()
                    File(sketchDir, "$sketchName.ino").writeText(input.code)
                    val core = input.fqbn.split(":").take(2).joinToString(":")
                    val coreCheck = runCli("core", "list", "--format", "json", timeoutSeconds = 30)
                    if (!coreCheck.output.contains("\"id\":\"$core\"") && !coreCheck.output.contains("\"id\": \"$core\"")) {
                        val index = runCli("core", "update-index", timeoutSeconds = 180)
                        if (!index.success) throw ToolchainException("Could not update board index.\n${index.output}")
                        val install = runCli("core", "install", core, timeoutSeconds = 900)
                        if (!install.success) throw ToolchainException("Could not install board core $core.\n${install.output}")
                    }
                    val result = runCli(
                        "compile", "--fqbn", input.fqbn,
                        "--output-dir", outputDir.absolutePath,
                        sketchDir.absolutePath,
                        timeoutSeconds = 900,
                    )
                    val artifact = if (result.success) findArtifact(outputDir) else null
                    val firmware = artifact?.readBytes()?.let { Base64.encodeToString(it, Base64.NO_WRAP) }
                    promise.resolve(mapOf(
                        "ok" to (result.success && firmware != null),
                        "firmwareBase64" to (firmware ?: ""),
                        "filename" to (artifact?.name ?: ""),
                        "output" to result.output,
                        "exitCode" to result.exitCode,
                    ))
                }.onFailure { e ->
                    promise.resolve(mapOf(
                        "ok" to false,
                        "firmwareBase64" to "",
                        "filename" to "",
                        "output" to (e.message ?: "Local compilation failed"),
                        "exitCode" to -1,
                    ))
                }
            }.start()
        }

        AsyncFunction("installCore") { packageName: String, promise: Promise ->
            Thread {
                val index = runCli("core", "update-index", timeoutSeconds = 180)
                val result = if (index.success) runCli("core", "install", packageName, timeoutSeconds = 900) else index
                promise.resolve(mapOf("ok" to result.success, "output" to result.output, "exitCode" to result.exitCode))
            }.start()
        }

        AsyncFunction("installLibrary") { libraryName: String, promise: Promise ->
            Thread {
                val result = runCli("lib", "install", libraryName, timeoutSeconds = 600)
                promise.resolve(mapOf("ok" to result.success, "output" to result.output, "exitCode" to result.exitCode))
            }.start()
        }

        AsyncFunction("searchLibraries") { query: String, promise: Promise ->
            Thread {
                val result = runCli("lib", "search", query.ifBlank { "a" }, "--format", "json", timeoutSeconds = 180)
                promise.resolve(mapOf("ok" to result.success, "output" to result.output, "exitCode" to result.exitCode))
            }.start()
        }

        AsyncFunction("listBoards") { promise: Promise ->
            Thread {
                val result = runCli("board", "listall", "--format", "json", timeoutSeconds = 180)
                promise.resolve(mapOf("ok" to result.success, "output" to result.output, "exitCode" to result.exitCode))
            }.start()
        }

        AsyncFunction("installedCores") { promise: Promise ->
            Thread {
                val result = runCli("core", "list", "--format", "json", timeoutSeconds = 60)
                promise.resolve(mapOf("ok" to result.success, "output" to result.output, "exitCode" to result.exitCode))
            }.start()
        }

        AsyncFunction("installedLibraries") { promise: Promise ->
            Thread {
                val result = runCli("lib", "list", "--format", "json", timeoutSeconds = 60)
                promise.resolve(mapOf("ok" to result.success, "output" to result.output, "exitCode" to result.exitCode))
            }.start()
        }
    }

    private data class CliResult(val exitCode: Int, val output: String) {
        val success: Boolean get() = exitCode == 0
    }

    private class ToolchainException(message: String) : Exception(message)

    private fun runCli(vararg args: String, timeoutSeconds: Long): CliResult {
        if (!executable.exists()) return CliResult(-1, "Local Arduino CLI is not bundled in this build.")
        configDir.mkdirs(); dataDir.mkdirs(); userDir.mkdirs()
        return try {
            val command = ArrayList<String>(args.size + 1)
            command += executable.absolutePath
            command += args
            val process = ProcessBuilder(command)
                .directory(configDir)
                .redirectErrorStream(true)
                .apply {
                    environment()["ARDUINO_DATA_DIR"] = dataDir.absolutePath
                    environment()["ARDUINO_USER_DIR"] = userDir.absolutePath
                    environment()["ARDUINO_DIRECTORIES_DATA"] = dataDir.absolutePath
                    environment()["ARDUINO_DIRECTORIES_USER"] = userDir.absolutePath
                    environment()["ARDUINO_DIRECTORIES_DOWNLOADS"] = File(configDir, "downloads").absolutePath
                    environment()["HOME"] = configDir.absolutePath
                }
                .start()
            val output = process.inputStream.bufferedReader().use { it.readText() }
            if (!process.waitFor(timeoutSeconds, TimeUnit.SECONDS)) {
                process.destroyForcibly()
                return CliResult(-1, output + "\n[Arduino CLI timed out after ${timeoutSeconds}s]")
            }
            CliResult(process.exitValue(), output)
        } catch (e: Exception) {
            CliResult(-1, "Failed to run Arduino CLI: ${e.message ?: "unknown error"}")
        }
    }

    private fun findArtifact(dir: File): File? {
        val candidates = dir.walkTopDown().filter { it.isFile }.filter {
            it.extension.lowercase() in setOf("hex", "bin", "uf2")
        }.toList()
        return candidates.maxByOrNull { it.length() }
    }

    private fun sanitizeSketchName(name: String): String =
        name.replace(Regex("[^A-Za-z0-9_]"), "_").ifBlank { "Sketch" }
}
