#include "pico/stdlib.h"
#include "pico/bootrom.h"
#include "hardware/pio.h"
#include "hardware/dma.h"
#include "hardware/clocks.h"
#include <stdint.h>
#include <stdbool.h>

#define CAPTURE_BASE_PIN 2
#define CAPTURE_CHANNELS 8
#define MAX_SAMPLES 8192
#define MAX_WORDS ((MAX_SAMPLES + 3) / 4)

extern uint odt_capture_program_add(PIO pio);
extern uint odt_capture_program_init(PIO pio, uint sm, uint offset, uint pin, float clkdiv);

static uint32_t capture_words[MAX_WORDS];
static uint configured_rate = 1000000;
static uint configured_channels = CAPTURE_CHANNELS;
static int dma_chan = -1;
static PIO capture_pio = pio0;
static uint capture_sm = 0;
static int configured_offset = -1;

static void send_u32_le(uint32_t value) {
    putchar_raw((int)(value & 0xff));
    putchar_raw((int)((value >> 8) & 0xff));
    putchar_raw((int)((value >> 16) & 0xff));
    putchar_raw((int)((value >> 24) & 0xff));
}

static void capture_samples(uint samples) {
    if (samples == 0 || samples > MAX_SAMPLES) samples = MAX_SAMPLES;
    uint channels = configured_channels;
    if (channels == 0 || channels > CAPTURE_CHANNELS) channels = CAPTURE_CHANNELS;

    if (configured_offset < 0) {
        configured_offset = (int)odt_capture_program_add(capture_pio);
    }

    float div = (float)clock_get_hz(clk_sys) / (2.0f * (float)configured_rate);
    if (div < 1.0f) div = 1.0f;
    odt_capture_program_init(capture_pio, capture_sm, (uint)configured_offset,
                             CAPTURE_BASE_PIN, div);

    if (dma_chan < 0) dma_chan = dma_claim_unused_channel(true);
    uint words = (samples + 3u) / 4u;
    dma_channel_config dc = dma_channel_get_default_config(dma_chan);
    channel_config_set_transfer_data_size(&dc, DMA_SIZE_32);
    channel_config_set_read_increment(&dc, false);
    channel_config_set_write_increment(&dc, true);
    channel_config_set_dreq(&dc, pio_get_dreq(capture_pio, capture_sm, false));

    dma_channel_configure(dma_chan, &dc, capture_words,
                          &capture_pio->rxf[capture_sm], words, false);
    dma_channel_start(dma_chan);
    pio_sm_set_enabled(capture_pio, capture_sm, true);
    dma_channel_wait_for_finish_blocking(dma_chan);
    pio_sm_set_enabled(capture_pio, capture_sm, false);
    pio_sm_clear_fifos(capture_pio, capture_sm);

    send_u32_le(samples);
    uint emitted = 0;
    for (uint w = 0; w < words && emitted < samples; ++w) {
        uint32_t packed = capture_words[w];
        for (uint i = 0; i < 4 && emitted < samples; ++i) {
            uint8_t sample = (uint8_t)((packed >> (i * 8)) & 0xffu);
            if (channels < 8) sample &= (uint8_t)((1u << channels) - 1u);
            putchar_raw(sample);
            ++emitted;
        }
    }
}

static void handle_command(uint8_t cmd) {
    if (cmd == 0x00 || cmd == 0x01) {
        sleep_ms(10);
        reset_usb_boot(0, 0);
        return;
    }

    if (cmd == 0x02) {
        int b0 = getchar_timeout_us(500000);
        int b1 = getchar_timeout_us(500000);
        int b2 = getchar_timeout_us(500000);
        int ch = getchar_timeout_us(500000);
        if (b0 < 0 || b1 < 0 || b2 < 0 || ch < 0) return;
        configured_rate = (uint)b0 | ((uint)b1 << 8) | ((uint)b2 << 16);
        if (configured_rate == 0) configured_rate = 1000000;
        configured_channels = (uint)ch;
        if (configured_channels == 0 || configured_channels > CAPTURE_CHANNELS) {
            configured_channels = CAPTURE_CHANNELS;
        }
        return;
    }

    if (cmd == 0x04) {
        capture_samples(MAX_SAMPLES);
        return;
    }

    if (cmd == 0x05) return;
}

int main(void) {
    stdio_init_all();
    sleep_ms(1500);
    while (true) {
        int c = getchar_timeout_us(1000);
        if (c >= 0) handle_command((uint8_t)c);
    }
}
