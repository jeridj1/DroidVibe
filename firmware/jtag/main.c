/* DroidVibe JTAG Programmer Helper Firmware */
#include <stdio.h>
#include <string.h>
#include "pico/stdlib.h"
#include "pico/bootrom.h"
#include "hardware/gpio.h"
#include "tusb.h"
#define CMD_ENTER_BOOTLOADER 0x00
#define CMD_JTAG_WRITE 0x20
#define CMD_JTAG_READ 0x21
#define CMD_JTAG_TMS_SEQ 0x22
#define CMD_JTAG_TDI_TDO_SEQ 0x23
#define ACK 0x06
#define JTAG_TCK_PIN 2
#define JTAG_TMS_PIN 3
#define JTAG_TDI_PIN 4
#define JTAG_TDO_PIN 5
#define MAX_JTAG_PAYLOAD 512
static void init_jtag_pins(void){gpio_init(JTAG_TCK_PIN);gpio_set_dir(JTAG_TCK_PIN,GPIO_OUT);gpio_put(JTAG_TCK_PIN,0);gpio_init(JTAG_TMS_PIN);gpio_set_dir(JTAG_TMS_PIN,GPIO_OUT);gpio_put(JTAG_TMS_PIN,0);gpio_init(JTAG_TDI_PIN);gpio_set_dir(JTAG_TDI_PIN,GPIO_OUT);gpio_put(JTAG_TDI_PIN,0);gpio_init(JTAG_TDO_PIN);gpio_set_dir(JTAG_TDO_PIN,GPIO_IN);gpio_pull_down(JTAG_TDO_PIN);}
static void cdc_write_bytes(const uint8_t *data,uint32_t len){uint32_t offset=0;while(offset<len){uint32_t space=tud_cdc_write_available();if(!space){tud_cdc_write_flush();tud_task();sleep_us(10);continue;}uint32_t n=(len-offset<space)?len-offset:space;offset+=tud_cdc_write(data+offset,n);}tud_cdc_write_flush();}
static int cdc_read_bytes(uint8_t *buf,uint32_t len,uint32_t timeout_ms){uint32_t total=0;absolute_time_t deadline=make_timeout_time_ms(timeout_ms);while(total<len&&!time_reached(deadline)){if(tud_cdc_available())total+=tud_cdc_read(buf+total,len-total);tud_task();if(total<len)sleep_us(100);}return (int)total;}
static inline void jtag_shift_clock(uint8_t tms,uint8_t tdi){gpio_put(JTAG_TMS_PIN,tms&1);gpio_put(JTAG_TDI_PIN,tdi&1);gpio_put(JTAG_TCK_PIN,0);tight_loop_contents();gpio_put(JTAG_TCK_PIN,1);}
static inline uint8_t jtag_shift_bit(uint8_t tms,uint8_t tdi){jtag_shift_clock(tms,tdi);return gpio_get(JTAG_TDO_PIN)?1:0;}
static void handle_tdi_tdo_seq(uint16_t bit_count,const uint8_t *tms_data,const uint8_t *tdi_data){uint16_t byte_count=(bit_count+7)/8;static uint8_t tdo_data[MAX_JTAG_PAYLOAD];memset(tdo_data,0,sizeof(tdo_data));for(uint16_t i=0;i<bit_count;i++){uint8_t tms=(tms_data[i/8]>>(i%8))&1;uint8_t tdi=(tdi_data[i/8]>>(i%8))&1;if(jtag_shift_bit(tms,tdi))tdo_data[i/8]|=(1<<(i%8));}gpio_put(JTAG_TCK_PIN,0);cdc_write_bytes(tdo_data,byte_count);}
static void handle_tms_seq(uint16_t bit_count,const uint8_t *tms_data){for(uint16_t i=0;i<bit_count;i++){gpio_put(JTAG_TMS_PIN,(tms_data[i/8]>>(i%8))&1);gpio_put(JTAG_TDI_PIN,0);gpio_put(JTAG_TCK_PIN,0);tight_loop_contents();gpio_put(JTAG_TCK_PIN,1);}gpio_put(JTAG_TCK_PIN,0);uint8_t ack=ACK;cdc_write_bytes(&ack,1);}
int main(void){stdio_init_all();init_jtag_pins();uint8_t cmd;while(true){tud_task();if(!tud_cdc_available()){sleep_ms(1);continue;}if(tud_cdc_read(&cmd,1)>0){switch(cmd){case CMD_JTAG_TDI_TDO_SEQ:{uint8_t len_buf[2];if(cdc_read_bytes(len_buf,2,1000)<2)break;uint16_t bits=(uint16_t)(len_buf[0]|(len_buf[1]<<8));uint16_t bytes=(bits+7)/8;static uint8_t tms[MAX_JTAG_PAYLOAD],tdi[MAX_JTAG_PAYLOAD];if(bytes>MAX_JTAG_PAYLOAD||cdc_read_bytes(tms,bytes,2000)<bytes||cdc_read_bytes(tdi,bytes,2000)<bytes)break;handle_tdi_tdo_seq(bits,tms,tdi);break;}case CMD_JTAG_TMS_SEQ:{uint8_t len_buf[2];if(cdc_read_bytes(len_buf,2,1000)<2)break;uint16_t bits=(uint16_t)(len_buf[0]|(len_buf[1]<<8));uint16_t bytes=(bits+7)/8;static uint8_t tms[MAX_JTAG_PAYLOAD];if(bytes>MAX_JTAG_PAYLOAD||cdc_read_bytes(tms,bytes,2000)<bytes)break;handle_tms_seq(bits,tms);break;}case CMD_JTAG_WRITE:case CMD_JTAG_READ:{uint8_t ack=ACK;cdc_write_bytes(&ack,1);break;}case CMD_ENTER_BOOTLOADER:reset_usb_boot(0,0);break;default:break;}}}return 0;}
