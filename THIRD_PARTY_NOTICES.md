# Third-party notices

## Arduino CLI

DroidVibe's on-device compiler is based on Arduino CLI, which is licensed under the GNU General Public License version 3.0.

The Android ARM64 build used by the playground is produced from the public Android compatibility fork:

https://github.com/ipodvideo87/arduino-cli-android

The upstream Arduino CLI project and license information are available at:

https://github.com/arduino/arduino-cli

https://www.gnu.org/licenses/gpl-3.0.html

The CI workflow builds the ARM64 executable from source rather than storing a prebuilt executable in this repository. The resulting executable is packaged into the Android APK under the native library directory.

This notice is intentionally kept separate from DroidVibe application code so the licensing boundary remains clear.
