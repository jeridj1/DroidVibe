#!/usr/bin/env bash
set -euo pipefail

OUT="${1:-apps/mobile/android/app/src/main/assets}"
WORK="${RUNNER_TEMP:-/tmp}/droidvibe-toolchain"
ROOTFS="${WORK}/rootfs"
ARCHIVE="${OUT}/droidvibe-toolchain-rootfs.tar.gz"
PROOT="${OUT}/droidvibe-toolchain-proot"
ARDUINO_CLI_VERSION="1.5.1"
PICO_INDEX="https://github.com/earlephilhower/arduino-pico/releases/download/global/package_rp2040_index.json"

rm -rf "$WORK"
mkdir -p "$ROOTFS/opt/droidvibe/bin" "$OUT"

# A real glibc ARM64 userland lets the phone execute the same aarch64 Linux
# host tools that Arduino publishes for Boards Manager. PRoot provides the
# rootless filesystem view from the Android process.
docker pull --platform linux/arm64 debian:bookworm-slim >/dev/null
cid="$(docker create --platform linux/arm64 debian:bookworm-slim)"
docker export "$cid" | tar -xpf - -C "$ROOTFS"
docker rm "$cid" >/dev/null

# The Android process does not need package-manager caches, documentation,
# locale catalogs, or runtime pseudo-filesystems from the base image.
rm -rf "$ROOTFS/var/cache/apt" "$ROOTFS/var/lib/apt/lists"/* "$ROOTFS/usr/share/doc" "$ROOTFS/usr/share/man" "$ROOTFS/usr/share/locale" "$ROOTFS/proc" "$ROOTFS/sys" "$ROOTFS/dev" "$ROOTFS/run" "$ROOTFS/tmp"/*
mkdir -p "$ROOTFS/tmp" "$ROOTFS/work"

curl -fsSL "https://github.com/arduino/arduino-cli/releases/download/v${ARDUINO_CLI_VERSION}/arduino-cli_${ARDUINO_CLI_VERSION}_Linux_ARM64.tar.gz" \
  | tar -xzf - -C "$ROOTFS/opt/droidvibe/bin"
chmod 0755 "$ROOTFS/opt/droidvibe/bin/arduino-cli"

# Run the ARM64 CLI inside an ARM64 Debian container so it selects and installs
# ARM64 host tool flavours for the AVR and RP2040 cores. This is the same
# Boards-Manager mechanism Arduino documents for package/tool dependencies.
docker run --platform linux/arm64 --rm \
  -v "$ROOTFS:/mnt/rootfs" \
  debian:bookworm-slim \
  bash -lc '
    set -euo pipefail
    apt-get update >/dev/null
    apt-get install -y --no-install-recommends ca-certificates curl git unzip xz-utils bzip2 >/dev/null
    mkdir -p /mnt/rootfs/opt/droidvibe/data /mnt/rootfs/opt/droidvibe/user
    export HOME=/root
    export ARDUINO_DATA_DIR=/mnt/rootfs/opt/droidvibe/data
    export ARDUINO_USER_DIR=/mnt/rootfs/opt/droidvibe/user
    CLI=/mnt/rootfs/opt/droidvibe/bin/arduino-cli
    "$CLI" config init --dest-file /mnt/rootfs/opt/droidvibe/arduino-cli.yaml >/dev/null 2>&1 || true
    "$CLI" config add board_manager.additional_urls "'"${PICO_INDEX}"'"
    "$CLI" core update-index
    "$CLI" core install arduino:avr
    "$CLI" core install rp2040:rp2040
    "$CLI" core list
    "$CLI" board listall | grep -E "Arduino Uno|Arduino Nano|Arduino Mega|Arduino Leonardo|Raspberry Pi Pico|Pico W" | head -30 || true
  '

# Keep the shipped userland focused on compilation. The app still maintains a
# writable build directory outside the immutable toolchain archive.
rm -rf "$ROOTFS/root/.cache" "$ROOTFS/var/log" "$ROOTFS/var/tmp"/*

PROOT_URL="https://sourceforge.net/projects/proot.mirror/files/v5.3.0/proot-v5.3.0-aarch64-static/download"
curl -fsSL "$PROOT_URL" -o "$PROOT"
chmod 0755 "$PROOT"
file "$PROOT" | tee "${WORK}/proot-file.txt"
grep -Eiq 'aarch64|ARM aarch64' "${WORK}/proot-file.txt"

# Record exact inputs so a build log can be audited later.
printf '%s\n' "arduino-cli=${ARDUINO_CLI_VERSION}" "pico-index=${PICO_INDEX}" "proot-sha256=$(sha256sum "$PROOT" | awk '{print $1}')" > "${WORK}/manifest.txt"
cat "${WORK}/manifest.txt"

# gzip is intentionally created after installation so the APK contains a
# single extractable rootfs asset. The uncompressed rootfs is not committed.
tar -C "$ROOTFS" --sort=name --mtime='UTC 2020-01-01' -czf "$ARCHIVE" .

test -s "$ARCHIVE"
test -s "$PROOT"
ls -lh "$ARCHIVE" "$PROOT"
