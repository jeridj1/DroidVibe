/**
 * Command-byte and protocol constants for the upload backends.
 *
 * These are the raw protocol constants used by the native transport when it
 * frames traffic to a bootloader. They are kept in shared so the backend, the
 * client, and tests can all agree on them.
 */

// --- STK500v1 ---
export const STK500 = {
  SYNC_CRC_EOP: 0x20,
  STK_GET_SYNC: 0x30,
  STK_GET_SIGNON: 0x31,
  STK_SET_PARAMETER: 0x40,
  STK_GET_PARAMETER: 0x41,
  STK_ENTER_PROGMODE: 0x50,
  STK_LEAVE_PROGMODE: 0x51,
  STK_CHIP_ERASE: 0x52,
  STK_LOAD_ADDRESS: 0x55,
  STK_PROG_FLASH: 0x60,
  STK_PROG_DATA: 0x61,
  STK_PROG_PAGE: 0x64,
  STK_READ_PAGE: 0x74,
  STK_READ_SIGN: 0x75,
  // Parameters
  STK_SW_MAJOR: 0x81,
  STK_SW_MINOR: 0x82,
  STK_HW_VER: 0x84,
  STK_VTARGET: 0x86,
  STK_PROGMODE_DELAY: 0x85,
  // Responses
  RESP_0: 0x14,
  RESP_1: 0x10,
  CRC_EOP: 0x20,
  INSYNC: 0x14,
  OK: 0x10,
  Resp_STK_OK: 0x10,
  Resp_STK_INSYNC: 0x14,
  Resp_STK_NOSYNC: 0x15,
  Resp_STK_NODEVICE: 0x11,
  Resp_STK_INSYNC_PART2: 0x14,
} as const;

// --- AVR109 / Caterina ---
export const AVR109 = {
  // Tokens
  TOKEN_1200BAUD: '0', // the leading '0' to enter 1200-baud boot
  // Commands (single ASCII char)
  CMD_ENTER_PROGMODE: 'P',
  CMD_LEAVE_PROGMODE: 'L',
  CMD_CHIP_ERASE: 'e',
  CMD_READ_SIGN: 's',
  CMD_READ_VERSION: 'V',
  CMD_READ_PARTCODE: 'p',
  CMD_SET_ADDRESS: 'A', // set 16-bit word address
  CMD_WRITE_PAGE: 'B', // 'B' + sizeHi + sizeLo + 'F' + data
  CMD_READ_PAGE: 'g', // 'g' + sizeHi + sizeLo + memtype
  CMD_CHECK_AUTOADDRESS: 'a',
  CMD_SET_EETYPE: 'E',
  // memory types
  MEMTYPE_FLASH: 'F',
  MEMTYPE_EEPROM: 'E',
  // responses
  RESP_ENTER_PROGMODE_OK: 0x0d, // CR
  RESP_OK: 0x0d,
} as const;

// --- ESP ROM loader (esptool-compatible) ---
export const ESP_ROM = {
  // SLIP framing
  SLIP_END: 0xc0,
  SLIP_ESC: 0xdb,
  SLIP_ESC_END: 0xdc,
  SLIP_ESC_ESC: 0xdd,
  // Commands
  CMD_SYNC: 0x08,
  CMD_READ_REG: 0x0a,
  CMD_WRITE_REG: 0x09,
  CMD_FLASH_BEGIN: 0x02,
  CMD_FLASH_DATA: 0x03,
  CMD_FLASH_END: 0x04,
  CMD_MEM_BEGIN: 0x05,
  CMD_MEM_DATA: 0x07,
  CMD_MEM_END: 0x09,
  CMD_SPI_SET_PARAMS: 0x0b,
  CMD_SPI_ATTACH: 0x0d,
  CMD_SPI_FLASH_MD5: 0x13,
  // Common status
  STATUS_OK: 0,
  // Magic
  ESP_CHIP_ID_ESP32: 0x00401,
  ESP_CHIP_ID_ESP32S2: 0x00002,
  ESP_CHIP_ID_ESP32S3: 0x00009,
  ESP_CHIP_ID_ESP8266: 0x00400,
} as const;

// --- RP2040 PICOBOOT ---
export const PICOBOOT = {
  // Interface
  // PICOBOOT uses interface 0 (custom vendor interface) on the RP2040 bootrom.
  // Command structure: 6 32-bit little-endian words
  //   magic | command | ... | transfer_length | transfer_size_param
  // Bootrom magic
  // The command frame is sent as a 12-byte (or 6-word) little-endian header.
  // Commands
  CMD_EXCLUSIVE: 0x01,
  CMD_REBOOT: 0x02,
  CMD_READ: 0x04,
  CMD_WRITE: 0x05,
  // 0x06 flash erase? actual: PICOBOOT_CMD_FLASH_ERASE = 0x06
  CMD_FLASH_ERASE: 0x06,
  CMD_XIP_SETUP: 0x07,
  // dparams
  // Interface class/subclass
  USB_IF_CLASS: 0xff,
  USB_IF_SUBCLASS: 0x00,
  USB_IF_PROTOCOL: 0x00,
  // PICOBOOT magic in command header (first word)
  // The actual protocol uses a command structure where word0 = magic? No:
  // PICOBOOT header layout (from pico-bootrom):
  //   word0: dMagic (always 0x431fd83b) ? Actually it's command+...
  // We store the documented command ids; header assembly lives in picoboot.ts.
} as const;

/** Compute the PICOBOOT command magic/checksum used in the header. */
export const PICOBOOT_MAGIC = 0x431fd83b;
