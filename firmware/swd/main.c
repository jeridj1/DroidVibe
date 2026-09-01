/*
 * DroidVibe SWD Programmer Helper Firmware
 * Target: Raspberry Pi Pico (RP2040)
 *
 * Bit-bangs SWDIO/SWCLK on GP2/GP3 to program and debug ARM Cortex-M
 * targets via Serial Wire Debug. Communicates with the Android app over
 * CDC serial at 115200 baud.
 *
 * Protocol (must match RP2040Controller.kt):
 *   0x10 + 1-byte AP/DP + 4-byte LE addr + 4-byte LE data -> SWD write, 4-byte ack
 *   0x11 + 1-byte AP/DP + 4-byte LE addr + 4-byte LE data -> SWD read, 4-byte data
 *   0x00                                                     -> reboot to BOOTSEL
 *
 * Pin assignments (must match firmware/README.md):
 *   GP2: SWDIO
 *   GP3: SWCLK
 *   GND: Ground
 *   3V3: Target VCC (optional)
 */

#include <stdio.h>
#include <string.h>
#include "pico/stdlib.h"
#include "hardware/gpio.h"
#include "tusb.h"

/* ---- Command bytes ---- */
#define CMD_ENTER_BOOTLOADER   0x00
#define CMD_SWD_WRITE          0x10
#define CMD_SWD_READ           0x11
#define ACK                   0x06

/* ---- Pin assignments ---- */
#define SWDIO_PIN  2
#define SWCLK_PIN  3

/* SWD protocol constants */
#define SWD_DP     0
#define SWD_AP     1

static void init_swd_pins(void) {
    gpio_init(SWDIO_PIN);
    gpio_init(SWCLK_PIN);
    gpio_set_dir(SWDIO_PIN, GPIO_OUT);
    gpio_set_dir(SWCLK_PIN, GPIO_OUT);
    gpio_put(SWDIO_PIN, 0);
    gpio_put(SWCLK_PIN, 0);
}

/* ---- CDC helpers ---- */
static void cdc_write_bytes(const uint8_t *data, uint32_t len) {
    uint32_t offset = 0;
    while (offset < len) {
        uint32_t remaining = len - offset;
        uint32_t space = tud_cdc_write_available();
        if (space == 0) {
            tud_cdc_write_flush();
            tud_task();
            space = tud_cdc_write_available();
            if (space == 0) {
                sleep_us(10);
                continue;
            }
        }
        uint32_t to_write = (remaining < space) ? remaining : space;
        uint32_t written = tud_cdc_write(data + offset, to_write);
        offset += written;
    }
    tud_cdc_write_flush();
}

static int cdc_read_bytes(uint8_t *buf, uint32_t len, uint32_t timeout_ms) {
    uint32_t total = 0;
    absolute_time_t deadline = make_timeout_time_ms(timeout_ms);
    while (total < len) {
        if (time_reached(deadline)) break;
        if (tud_cdc_available()) {
            uint32_t count = tud_cdc_read(buf + total, len - total);
            total += count;
        }
        tud_task();
        if (total < len) sleep_us(100);
    }
    return (int)total;
}

/* ---- SWD bit-bang ---- */

/* SWDIO is bidirectional: switch between output and input */
static inline void swdio_drive(uint8_t val) {
    gpio_set_dir(SWDIO_PIN, GPIO_OUT);
    gpio_put(SWDIO_PIN, val & 1);
}

static inline void swdio_listen(void) {
    gpio_set_dir(SWDIO_PIN, GPIO_IN);
    gpio_pull_up(SWDIO_PIN);
}

static inline void swclk_pulse(void) {
    gpio_put(SWCLK_PIN, 0);
    tight_loop_contents();
    gpio_put(SWCLK_PIN, 1);
    tight_loop_contents();
    gpio_put(SWCLK_PIN, 0);
}

/* Write one bit on SWDIO and clock SWCLK */
static inline void swd_write_bit(uint8_t bit) {
    swdio_drive(bit);
    swclk_pulse();
}

/* Read one bit from SWDIO after clocking SWCLK */
static inline uint8_t swd_read_bit(void) {
    swdio_listen();
    gpio_put(SWCLK_PIN, 0);
    tight_loop_contents();
    uint8_t val = gpio_get(SWDIO_PIN) ? 1 : 0;
    gpio_put(SWCLK_PIN, 1);
    tight_loop_contents();
    gpio_put(SWCLK_PIN, 0);
    return val;
}

/* SWD turnaround (idle cycle) */
static inline void swd_turnaround(void) {
    swdio_listen();
    swclk_pulse();
}

/* ---- SWD protocol ---- */

/* Calculate parity of a 32-bit value */
static uint8_t parity32(uint32_t val) {
    val ^= val >> 16;
    val ^= val >> 8;
    val ^= val >> 4;
    val ^= val >> 2;
    val ^= val >> 1;
    return (uint8_t)(val & 1);
}

/* Perform a single SWD transfer.
 * is_read: 1 = read, 0 = write
 * ap_dp:   1 = AP, 0 = DP
 * addr:    register address (only A[3:2] used)
 * data:    for write: data to send; for read: receives data
 * Returns: 3-bit ACK (0b100 = OK, 0b001 = WAIT, 0b010 = FAULT)
 */
static uint8_t swd_transfer(uint8_t is_read, uint8_t ap_dp,
                           uint8_t addr, uint32_t *data) {
    uint8_t a2 = (addr >> 2) & 1;
    uint8_t a3 = (addr >> 3) & 1;
    uint8_t parity = ap_dp ^ is_read ^ a2 ^ a3;

    /* Write request phase */
    swd_write_bit(1);         /* Start */
    swd_write_bit(ap_dp);     /* APnDP */
    swd_write_bit(is_read);   /* RnW */
    swd_write_bit(a2);         /* Addr bit 2 */
    swd_write_bit(a3);         /* Addr bit 3 */
    swd_write_bit(parity);     /* Parity */
    swd_write_bit(0);          /* Stop */
    swd_write_bit(1);          /* Park */

    /* Turnaround */
    swd_turnaround();

    /* Read 3-bit ACK */
    uint8_t ack = 0;
    ack |= (swd_read_bit() << 0);
    ack |= (swd_read_bit() << 1);
    ack |= (swd_read_bit() << 2);

    if (ack != 0b100) {
        /* Not OK -- do turnaround and return */
        swd_turnaround();
        return ack;
    }

    if (is_read) {
        /* Read 32-bit data (LSB first) */
        uint32_t val = 0;
        for (int i = 0; i < 32; i++) {
            val |= ((uint32_t)swd_read_bit() << i);
        }
        /* Read parity bit */
        uint8_t read_parity = swd_read_bit();

        /* Turnaround back to host */
        swd_turnaround();

        /* Drive idle cycles (8) */
        for (int i = 0; i < 8; i++) {
            swd_write_bit(0);
        }

        *data = val;
        (void)read_parity;
    } else {
        /* Turnaround to write data */
        swd_turnaround();

        /* 8 idle/write cycles */
        for (int i = 0; i < 8; i++) {
            swd_write_bit(0);
        }

        /* Write 32-bit data (LSB first) */
        uint32_t val = *data;
        for (int i = 0; i < 32; i++) {
            swd_write_bit((val >> i) & 1);
        }

        /* Write parity */
        swd_write_bit(parity32(val));
    }

    return ack;
}

/* Initialize SWD line reset (50+ SWCLK with SWDIO=1) */
static void swd_line_reset(void) {
    swdio_drive(1);
    for (int i = 0; i < 64; i++) {
        swclk_pulse();
    }
}

/* Send JTAG-to-SWD switch sequence */
static void swd_jtag_to_swd(void) {
    static const uint8_t jtag2swd[] = {
        0x9E, 0xE7, 0x9E, 0xE7,
        0x9E, 0xE7, 0x9E, 0xE7,
        0x9E, 0xE7, 0x9E, 0xE7,
        0x9E, 0xE7, 0x9E, 0xE7,
    };
    for (int byte = 0; byte < 16; byte++) {
        for (int bit = 0; bit < 8; bit++) {
            swd_write_bit((jtag2swd[byte] >> bit) & 1);
        }
    }
    swd_line_reset();
}

/* ---- Command handlers ---- */
static void handle_swd_transfer(uint8_t is_read) {
    /* Read 9 bytes: 1-byte AP/DP + 4-byte LE addr + 4-byte LE data */
    uint8_t req[9];
    if (cdc_read_bytes(req, 9, 1000) < 9) {
        uint8_t err[4] = {0, 0, 0, 0};
        cdc_write_bytes(err, 4);
        return;
    }

    uint8_t ap_dp = req[0] & 1;
    uint32_t addr = (uint32_t)req[1]
        | ((uint32_t)req[2] << 8)
        | ((uint32_t)req[3] << 16)
        | ((uint32_t)req[4] << 24);
    uint32_t data = (uint32_t)req[5]
        | ((uint32_t)req[6] << 8)
        | ((uint32_t)req[7] << 16)
        | ((uint32_t)req[8] << 24);

    uint32_t result = 0;
    uint8_t ack = swd_transfer(is_read, ap_dp, (uint8_t)addr, &data);

    if (is_read) {
        result = data;
    } else {
        result = (ack == 0b100) ? 0 : 0xFFFFFFFF;
    }

    /* Send 4-byte LE response */
    uint8_t resp[4];
    resp[0] = (uint8_t)(result & 0xFF);
    resp[1] = (uint8_t)((result >> 8) & 0xFF);
    resp[2] = (uint8_t)((result >> 16) & 0xFF);
    resp[3] = (uint8_t)((result >> 24) & 0xFF);
    cdc_write_bytes(resp, 4);
}

static void enter_bootloader(void) {
    reset_usb_boot(0, 0);
}

/* ---- Main loop ---- */
int main(void) {
    stdio_init_all();
    init_swd_pins();

    /* Initialize SWD connection */
    swd_jtag_to_swd();

    uint8_t cmd;

    while (true) {
        tud_task();

        if (!tud_cdc_available()) {
            sleep_ms(1);
            continue;
        }

        if (tud_cdc_read(&cmd, 1) > 0) {
            switch (cmd) {
            case CMD_SWD_WRITE:
                handle_swd_transfer(0);
                break;
            case CMD_SWD_READ:
                handle_swd_transfer(1);
                break;
            case CMD_ENTER_BOOTLOADER:
                enter_bootloader();
                break;
            default:
                break;
            }
        }
    }

    return 0;
}
