/*
 * DroidVibe JTAG Programmer Helper Firmware
 * Target: Raspberry Pi Pico (RP2040)
 *
 * Bit-bangs JTAG TCK/TMS/TDI/TDO on GP2-GP5 to program and debug
 * various JTAG targets. Communicates with the Android app over CDC serial.
 *
 * Protocol (must match RP2040Controller.kt):
 *   0x23 + 2-byte LE bit_count + TMS bytes + TDI bytes  -> TDO bytes
 *   0x22 + 2-byte LE bit_count + TMS bytes              -> ACK
 *   0x20 + ...                                         -> JTAG write (future)
 *   0x21 + ...                                         -> JTAG read (future)
 *   0x00                                               -> reboot to BOOTSEL
 *
 * Pin assignments (must match firmware/README.md):
 *   GP2: TCK
 *   GP3: TMS
 *   GP4: TDI
 *   GP5: TDO
 *   GND: Ground
 *   3V3: Target VCC (optional)
 */

#include <stdio.h>
#include <string.h>
#include "pico/stdlib.h"
#include "hardware/gpio.h"
#include "tusb.h"

/* ---- Command bytes ---- */
#define CMD_ENTER_BOOTLOADER     0x00
#define CMD_JTAG_WRITE           0x20
#define CMD_JTAG_READ             0x21
#define CMD_JTAG_TMS_SEQ         0x22
#define CMD_JTAG_TDI_TDO_SEQ     0x23
#define ACK                      0x06

/* ---- Pin assignments ---- */
#define JTAG_TCK_PIN  2
#define JTAG_TMS_PIN  3
#define JTAG_TDI_PIN  4
#define JTAG_TDO_PIN  5

#define MAX_JTAG_PAYLOAD  512

static void init_jtag_pins(void) {
    gpio_init(JTAG_TCK_PIN);
    gpio_set_dir(JTAG_TCK_PIN, GPIO_OUT);
    gpio_put(JTAG_TCK_PIN, 0);

    gpio_init(JTAG_TMS_PIN);
    gpio_set_dir(JTAG_TMS_PIN, GPIO_OUT);
    gpio_put(JTAG_TMS_PIN, 0);

    gpio_init(JTAG_TDI_PIN);
    gpio_set_dir(JTAG_TDI_PIN, GPIO_OUT);
    gpio_put(JTAG_TDI_PIN, 0);

    gpio_init(JTAG_TDO_PIN);
    gpio_set_dir(JTAG_TDO_PIN, GPIO_IN);
    gpio_pull_down(JTAG_TDO_PIN);
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

/* ---- JTAG bit-bang ---- */
static inline void jtag_set_tms(uint8_t val) {
    gpio_put(JTAG_TMS_PIN, val & 1);
}

static inline void jtag_set_tdi(uint8_t val) {
    gpio_put(JTAG_TDI_PIN, val & 1);
}

static inline void jtag_clock_low(void) {
    gpio_put(JTAG_TCK_PIN, 0);
}

static inline void jtag_clock_high(void) {
    gpio_put(JTAG_TCK_PIN, 1);
}

static inline uint8_t jtag_read_tdo(void) {
    return gpio_get(JTAG_TDO_PIN) ? 1 : 0;
}

/* Shift one bit: set TMS/TDI, clock TCK, capture TDO on rising edge */
static inline uint8_t jtag_shift_bit(uint8_t tms, uint8_t tdi) {
    jtag_set_tms(tms);
    jtag_set_tdi(tdi);
    jtag_clock_low();
    tight_loop_contents();
    jtag_clock_high();
    uint8_t tdo = jtag_read_tdo();
    return tdo;
}

/* Clock TMS only (no TDO capture needed) */
static inline void jtag_clock_tms(uint8_t tms) {
    jtag_set_tms(tms);
    jtag_set_tdi(0);
    jtag_clock_low();
    tight_loop_contents();
    jtag_clock_high();
}

/* ---- Command handlers ---- */

/* CMD_JTAG_TDI_TDO_SEQ (0x23): shift bit_count bits, return TDO */
static void handle_tdi_tdo_seq(uint16_t bit_count,
                                const uint8_t *tms_data,
                                const uint8_t *tdi_data) {
    uint16_t byte_count = (bit_count + 7) / 8;
    static uint8_t tdo_data[MAX_JTAG_PAYLOAD];
    memset(tdo_data, 0, sizeof(tdo_data));

    for (uint16_t i = 0; i < bit_count; i++) {
        uint8_t tms_bit = (tms_data[i / 8] >> (i % 8)) & 1;
        uint8_t tdi_bit = (tdi_data[i / 8] >> (i % 8)) & 1;
        uint8_t tdo_bit = jtag_shift_bit(tms_bit, tdi_bit);
        if (tdo_bit) {
            tdo_data[i / 8] |= (1 << (i % 8));
        }
    }

    /* Leave TCK low after shifting */
    jtag_clock_low();

    cdc_write_bytes(tdo_data, byte_count);
}

/* CMD_JTAG_TMS_SEQ (0x22): clock TMS sequence, no TDO capture */
static void handle_tms_seq(uint16_t bit_count, const uint8_t *tms_data) {
    for (uint16_t i = 0; i < bit_count; i++) {
        uint8_t tms_bit = (tms_data[i / 8] >> (i % 8)) & 1;
        jtag_clock_tms(tms_bit);
    }
    jtag_clock_low();

    uint8_t ack = ACK;
    cdc_write_bytes(&ack, 1);
}

static void enter_bootloader(void) {
    reset_usb_boot(0, 0);
}

/* ---- Main loop ---- */
int main(void) {
    stdio_init_all();
    init_jtag_pins();

    uint8_t cmd;

    while (true) {
        tud_task();

        if (!tud_cdc_available()) {
            sleep_ms(1);
            continue;
        }

        if (tud_cdc_read(&cmd, 1) > 0) {
            switch (cmd) {
            case CMD_JTAG_TDI_TDO_SEQ: {
                /* Read 2-byte LE bit count */
                uint8_t len_buf[2];
                if (cdc_read_bytes(len_buf, 2, 1000) < 2) break;
                uint16_t bit_count = (uint16_t)(len_buf[0] | (len_buf[1] << 8));
                uint16_t byte_count = (bit_count + 7) / 8;

                static uint8_t tms_buf[MAX_JTAG_PAYLOAD];
                static uint8_t tdi_buf[MAX_JTAG_PAYLOAD];

                if (cdc_read_bytes(tms_buf, byte_count, 2000) < byte_count) break;
                if (cdc_read_bytes(tdi_buf, byte_count, 2000) < byte_count) break;

                handle_tdi_tdo_seq(bit_count, tms_buf, tdi_buf);
                break;
            }
            case CMD_JTAG_TMS_SEQ: {
                uint8_t len_buf[2];
                if (cdc_read_bytes(len_buf, 2, 1000) < 2) break;
                uint16_t bit_count = (uint16_t)(len_buf[0] | (len_buf[1] << 8));
                uint16_t byte_count = (bit_count + 7) / 8;

                static uint8_t tms_buf[MAX_JTAG_PAYLOAD];
                if (cdc_read_bytes(tms_buf, byte_count, 2000) < byte_count) break;

                handle_tms_seq(bit_count, tms_buf);
                break;
            }
            case CMD_JTAG_WRITE:
            case CMD_JTAG_READ: {
                /* Future: direct register access. ACK for now. */
                uint8_t ack = ACK;
                cdc_write_bytes(&ack, 1);
                break;
            }
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
