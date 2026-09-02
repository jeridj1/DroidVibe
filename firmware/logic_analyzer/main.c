/* DroidVibe RP2040 PIO + DMA logic analyzer helper. */
#include <stdio.h>
#include <string.h>
#include "pico/stdlib.h"
#include "pico/bootrom.h"
#include "hardware/clocks.h"
#include "hardware/dma.h"
#include "hardware/pio.h"
#include "hardware/gpio.h"
#include "logic_analyzer.pio.h"
#include "tusb.h"

#define CMD_ENTER_BOOTLOADER 0x00
#define CMD_ENTER_LA_MODE    0x02
#define CMD_EXIT_LA_MODE    0x03
#define CMD_START_CAPTURE    0x04
#define CMD_STOP_CAPTURE     0x05
#define ACK                   0x06

#define BASE_PIN 2
#define CHANNELS 8
#define MAX_SAMPLES 32768

static uint8_t sample_buffer[MAX_SAMPLES];
static uint32_t sample_rate = 100000;
static uint8_t configured_channels = 8;
static int dma_chan = -1;
static PIO pio = pio0;
static uint sm = 0;

static void cdc_write_bytes(const uint8_t *data, uint32_t len) {
    uint32_t off = 0;
    while (off < len) {
        tud_task();
        uint32_t space = tud_cdc_write_available();
        if (!space) { tud_cdc_write_flush(); sleep_us(20); continue; }
        uint32_t n = len - off < space ? len - off : space;
        off += tud_cdc_write(data + off, n);
    }
    tud_cdc_write_flush();
}

static int cdc_read_bytes(uint8_t *buf, uint32_t len, uint32_t timeout_ms) {
    uint32_t total = 0;
    absolute_time_t deadline = make_timeout_time_ms(timeout_ms);
    while (total < len && !time_reached(deadline)) {
        tud_task();
        if (tud_cdc_available()) total += tud_cdc_read(buf + total, len - total);
        else sleep_us(50);
    }
    return (int)total;
}

static void init_pio(void) {
    uint offset = pio_add_program(pio, &logic_analyzer_program);
    pio_sm_config c = logic_analyzer_program_get_default_config(offset);
    sm_config_set_in_pins(&c, BASE_PIN);
    sm_config_set_in_shift(&c, true, true, 8); /* right shift, autopush every 8 bits */
    sm_config_set_fifo_join(&c, PIO_FIFO_JOIN_RX);
    for (uint pin = BASE_PIN; pin < BASE_PIN + CHANNELS; ++pin) {
        pio_gpio_init(pio, pin);
        gpio_set_dir(pin, GPIO_IN);
        gpio_disable_pulls(pin);
    }
    pio_sm_init(pio, sm, offset, &c);
}

static void configure_rate(void) {
    if (sample_rate < 1) sample_rate = 1;
    if (sample_rate > clock_get_hz(clk_sys)) sample_rate = clock_get_hz(clk_sys);
    pio_sm_set_clkdiv(pio, sm, (float)clock_get_hz(clk_sys) / (float)sample_rate);
}

static uint32_t capture_samples(uint32_t requested) {
    if (requested > MAX_SAMPLES) requested = MAX_SAMPLES;
    configure_rate();
    pio_sm_set_enabled(pio, sm, false);
    pio_sm_clear_fifos(pio, sm);
    pio_sm_restart(pio, sm);

    dma_channel_config dc = dma_channel_get_default_config(dma_chan);
    channel_config_set_transfer_data_size(&dc, DMA_SIZE_8);
    channel_config_set_read_increment(&dc, false);
    channel_config_set_write_increment(&dc, true);
    channel_config_set_dreq(&dc, pio_get_dreq(pio, sm, false));

    dma_channel_configure(
        dma_chan, &dc,
        sample_buffer,
        &pio->rxf[sm],
        requested,
        false
    );
    dma_start_channel_mask(1u << dma_chan);
    pio_sm_set_enabled(pio, sm, true);

    while (dma_channel_is_busy(dma_chan)) {
        tud_task();
        tight_loop_contents();
    }
    pio_sm_set_enabled(pio, sm, false);
    return requested;
}

static void do_capture(void) {
    uint8_t header[4];
    uint32_t count = capture_samples(MAX_SAMPLES);
    header[0] = count & 0xff;
    header[1] = (count >> 8) & 0xff;
    header[2] = (count >> 16) & 0xff;
    header[3] = (count >> 24) & 0xff;
    cdc_write_bytes(header, 4);
    cdc_write_bytes(sample_buffer, count);
}

int main(void) {
    stdio_init_all();
    init_pio();
    dma_chan = dma_claim_unused_channel(true);

    while (true) {
        tud_task();
        if (!tud_cdc_available()) { sleep_ms(1); continue; }
        uint8_t cmd;
        if (!tud_cdc_read(&cmd, 1)) continue;
        switch (cmd) {
        case CMD_ENTER_LA_MODE: {
            uint8_t config[4];
            if (cdc_read_bytes(config, 4, 1000) == 4) {
                sample_rate = (uint32_t)config[0] | ((uint32_t)config[1] << 8) | ((uint32_t)config[2] << 16);
                configured_channels = config[3];
                if (configured_channels == 0 || configured_channels > 8) configured_channels = 8;
            }
            uint8_t ack = ACK;
            cdc_write_bytes(&ack, 1);
            break;
        }
        case CMD_EXIT_LA_MODE: {
            uint8_t ack = ACK;
            cdc_write_bytes(&ack, 1);
            break;
        }
        case CMD_START_CAPTURE:
            do_capture();
            break;
        case CMD_STOP_CAPTURE:
            dma_channel_abort(dma_chan);
            pio_sm_set_enabled(pio, sm, false);
            break;
        case CMD_ENTER_BOOTLOADER:
            dma_channel_abort(dma_chan);
            reset_usb_boot(0, 0);
            break;
        default:
            break;
        }
    }
}
