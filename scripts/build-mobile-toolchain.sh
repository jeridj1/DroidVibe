#!/usr/bin/env bash
set -euo pipefail

OUT="${1:-apps/mobile/android/app/src/main/assets}"
OUT="$(realpath -m "$OUT")"
WORK="${RUNNER_TEMP:-/tmp}/droidvibe-toolchain"
ROOTFS="${WORK}/rootfs"
ARCHIVE="${OUT}/droidvibe-toolchain-rootfs.tar.gz"
PROOT="${OUT}/droidvibe-toolchain-proot"
ARDUINO_CLI_VERSION="1.5.1"
PICO_INDEX="https://github.com/earlephilhower/arduino-pico/releases/download/global/package_rp2040_index.json"

rm -rf "$WORK"
mkdir -p "$ROOTFS/opt/droidvibe/bin" "$OUT"

docker pull --platform linux/arm64 debian:bookworm-slim >/dev/null
cid="$(docker create --platform linux/arm64 debian:bookworm-slim)"
docker export "$cid" | tar -xpf - -C "$ROOTFS"
docker rm "$cid" >/dev/null

rm -rf "$ROOTFS/var/cache/apt" "$ROOTFS/usr/share/doc" "$ROOTFS/usr/share/man" "$ROOTFS/usr/share/locale" "$ROOTFS/proc" "$ROOTFS/sys" "$ROOTFS/run" "$ROOTFS/tmp"/*
mkdir -p "$ROOTFS/tmp" "$ROOTFS/work"

curl -fsSL "https://github.com/arduino/arduino-cli/releases/download/v${ARDUINO_CLI_VERSION}/arduino-cli_${ARDUINO_CLI_VERSION}_Linux_ARM64.tar.gz" \
  | tar -xzf - -C "$ROOTFS/opt/droidvibe/bin"
chmod 0755 "$ROOTFS/opt/droidvibe/bin/arduino-cli"

docker run --platform linux/arm64 --rm \
  -e PICO_INDEX="$PICO_INDEX" \
  -v "$ROOTFS:/mnt/rootfs" \
  debian:bookworm-slim \
  bash -lc '
    set -euo pipefail
    export DEBIAN_FRONTEND=noninteractive
    apt-get update >/dev/null
    apt-get install -y --no-install-recommends ca-certificates curl git unzip xz-utils bzip2 >/dev/null
    rm -f /mnt/rootfs/etc/resolv.conf
    cp /etc/resolv.conf /mnt/rootfs/etc/resolv.conf
    mkdir -p /mnt/rootfs/dev /mnt/rootfs/dev/pts /mnt/rootfs/run
    [ -e /mnt/rootfs/dev/null ] || mknod -m 666 /mnt/rootfs/dev/null c 1 3
    [ -e /mnt/rootfs/dev/zero ] || mknod -m 666 /mnt/rootfs/dev/zero c 1 5
    [ -e /mnt/rootfs/dev/random ] || mknod -m 666 /mnt/rootfs/dev/random c 1 8
    [ -e /mnt/rootfs/dev/urandom ] || mknod -m 666 /mnt/rootfs/dev/urandom c 1 9
    chroot /mnt/rootfs /bin/bash -lc "
      set -euo pipefail
      export DEBIAN_FRONTEND=noninteractive
      apt-get update >/dev/null
      apt-get install -y --no-install-recommends python3 ca-certificates curl git unzip xz-utils bzip2 >/dev/null
      rm -rf /var/lib/apt/lists/* /var/cache/apt/* /usr/share/doc/* /usr/share/man/* /usr/share/locale/*
      test -x /usr/bin/python3
      /usr/bin/python3 --version
    "
    mkdir -p /mnt/rootfs/opt/droidvibe/data /mnt/rootfs/opt/droidvibe/user /mnt/rootfs/work /mnt/rootfs/etc/ssl/certs
    export HOME=/root
    export ARDUINO_DATA_DIR=/mnt/rootfs/opt/droidvibe/data
    export ARDUINO_USER_DIR=/mnt/rootfs/opt/droidvibe/user
    CLI=/mnt/rootfs/opt/droidvibe/bin/arduino-cli
    "$CLI" config init --dest-file /mnt/rootfs/opt/droidvibe/arduino-cli.yaml >/dev/null 2>&1 || true
    "$CLI" config add board_manager.additional_urls "$PICO_INDEX"
    "$CLI" core update-index
    "$CLI" core install arduino:avr
    "$CLI" core install arduino:megaavr
    "$CLI" core install rp2040:rp2040
    "$CLI" core list
  '

PROOT_URL="https://sourceforge.net/projects/proot.mirror/files/v5.3.0/proot-v5.3.0-aarch64-static/download"
curl -fsSL "$PROOT_URL" -o "$PROOT"
chmod 0755 "$PROOT"
file "$PROOT" | tee "${WORK}/proot-file.txt"
grep -Eiq 'aarch64|ARM aarch64' "${WORK}/proot-file.txt"

mkdir -p "$ROOTFS/work/FinalUno" "$ROOTFS/work/FinalMega" "$ROOTFS/work/FinalPico" "$ROOTFS/work/final-uno" "$ROOTFS/work/final-mega" "$ROOTFS/work/final-pico" "$ROOTFS/work/user"
cat > "$ROOTFS/work/FinalUno/FinalUno.ino" <<'INO'
void setup(){ pinMode(LED_BUILTIN, OUTPUT); }
void loop(){ digitalWrite(LED_BUILTIN, HIGH); delay(1); digitalWrite(LED_BUILTIN, LOW); delay(1); }
INO
cat > "$ROOTFS/work/FinalMega/FinalMega.ino" <<'INO'
void setup(){ pinMode(LED_BUILTIN, OUTPUT); }
void loop(){ digitalWrite(LED_BUILTIN, HIGH); delay(1); digitalWrite(LED_BUILTIN, LOW); delay(1); }
INO
cat > "$ROOTFS/work/FinalPico/FinalPico.ino" <<'INO'
void setup(){ pinMode(LED_BUILTIN, OUTPUT); }
void loop(){ digitalWrite(LED_BUILTIN, HIGH); delay(1); digitalWrite(LED_BUILTIN, LOW); delay(1); }
INO
cat > "$ROOTFS/work/selftest-run.sh" <<'EOF'
#!/bin/sh
set -eu
CLI=/opt/droidvibe/bin/arduino-cli
PATH=/opt/droidvibe/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export PATH
export HOME=/root
export ARDUINO_DATA_DIR=/opt/droidvibe/data
export ARDUINO_USER_DIR=/work/user
python3 --version
"$CLI" version
"$CLI" core list
"$CLI" compile --fqbn arduino:avr:uno --build-path /work/final-uno /work/FinalUno
test -s /work/final-uno/FinalUno.ino.hex
"$CLI" compile --fqbn arduino:megaavr:nona4809 --build-path /work/final-mega /work/FinalMega
test -s /work/final-mega/FinalMega.ino.hex
"$CLI" compile --fqbn rp2040:rp2040:rpipico --build-path /work/final-pico /work/FinalPico
test -n "$(find /work/final-pico -type f -name '*.uf2' -print -quit)"
echo LOCAL_TOOLCHAIN_PRROOT_TEST_OK
EOF
chmod 0755 "$ROOTFS/work/selftest-run.sh"

docker run --platform linux/arm64 --rm \
  --cap-add=SYS_PTRACE \
  --security-opt seccomp=unconfined \
  -v "$ROOTFS:/rootfs" \
  -v "$(realpath "$PROOT"):/proot:ro" \
  debian:bookworm-slim \
  bash -lc '/proot -r /rootfs -w /work -b /rootfs/work:/work --kill-on-exit /work/selftest-run.sh'

printf '%s\n' "arduino-cli=${ARDUINO_CLI_VERSION}" "pico-index=${PICO_INDEX}" "proot-sha256=$(sha256sum "$PROOT" | awk '{print $1}')" > "${WORK}/manifest.txt"
cat "${WORK}/manifest.txt"

rm -rf "$ROOTFS/root/.cache" "$ROOTFS/var/log" "$ROOTFS/var/tmp"/* "$ROOTFS/work/FinalUno" "$ROOTFS/work/FinalMega" "$ROOTFS/work/FinalPico" "$ROOTFS/work/final-uno" "$ROOTFS/work/final-mega" "$ROOTFS/work/final-pico" "$ROOTFS/work/selftest-run.sh"

tar -C "$ROOTFS" --sort=name --mtime='UTC 2020-01-01' -czf "$ARCHIVE" .
test -s "$ARCHIVE"
test -s "$PROOT"
ls -lh "$ARCHIVE" "$PROOT"
