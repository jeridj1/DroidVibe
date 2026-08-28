import { z } from 'zod';
import { procedure } from '../../rpc.js';

export interface Example {
  id: string;
  name: string;
  description: string;
  board: string;
  files: Array<{ path: string; content: string; language: string }>;
}

export const EXAMPLES: Example[] = [
  {
    id: 'blink',
    name: 'Blink',
    description: 'The classic Arduino Blink sketch \u2014 toggles the onboard LED.',
    board: 'arduino:avr:uno',
    files: [
      {
        path: 'Blink.ino',
        language: 'ino',
        content:
          '// Blink \u2014 turns the onboard LED on for 1s, off for 1s, forever.\n' +
          'void setup() {\n' +
          '  pinMode(LED_BUILTIN, OUTPUT);\n' +
          '}\n\n' +
          'void loop() {\n' +
          '  digitalWrite(LED_BUILTIN, HIGH);\n' +
          '  delay(1000);\n' +
          '  digitalWrite(LED_BUILTIN, LOW);\n' +
          '  delay(1000);\n' +
          '}\n',
      },
    ],
  },
  {
    id: 'serial-test',
    name: 'SerialTest',
    description: 'Writes an incrementing counter to the serial monitor.',
    board: 'arduino:avr:uno',
    files: [
      {
        path: 'SerialTest.ino',
        language: 'ino',
        content:
          '// SerialTest \u2014 prints a counter every second.\n' +
          'long counter = 0;\n\n' +
          'void setup() {\n' +
          '  Serial.begin(9600);\n' +
          '  while (!Serial) { ; }\n' +
          '}\n\n' +
          'void loop() {\n' +
          '  Serial.print("count=");\n' +
          '  Serial.println(counter++);\n' +
          '  delay(1000);\n' +
          '}\n',
      },
    ],
  },
  {
    id: 'analog-read',
    name: 'AnalogRead',
    description: 'Reads A0 and streams the value as a serial plotter signal.',
    board: 'arduino:avr:uno',
    files: [
      {
        path: 'AnalogRead.ino',
        language: 'ino',
        content:
          '// AnalogRead \u2014 streams A0 for the serial plotter.\n' +
          'void setup() { Serial.begin(9600); }\n\n' +
          'void loop() { Serial.println(analogRead(A0)); delay(20); }\n',
      },
    ],
  },
  {
    id: 'pico-blink',
    name: 'PicoBlink',
    description: 'Blinks the Pico onboard LED using the earlephilhower RP2040 core.',
    board: 'rp2040:rp2040:rpipico',
    files: [
      {
        path: 'PicoBlink.ino',
        language: 'ino',
        content:
          '// PicoBlink \u2014 onboard LED blink for Raspberry Pi Pico.\n' +
          '#define LED_PIN LED_BUILTIN\n\n' +
          'void setup() { pinMode(LED_PIN, OUTPUT); }\n\n' +
          'void loop() { digitalWrite(LED_PIN, HIGH); delay(500); digitalWrite(LED_PIN, LOW); delay(500); }\n',
      },
    ],
  },
];

const ListInput = z.object({ board: z.string().optional() });
export const list = procedure(ListInput, async ({ input }) => {
  const items = input.board ? EXAMPLES.filter((e) => e.board === input.board) : EXAMPLES;
  return {
    examples: items.map(({ id, name, description, board }) => ({ id, name, description, board })),
  };
});

const GetInput = z.object({ id: z.string() });
export const get = procedure(GetInput, async ({ input }) => {
  const ex = EXAMPLES.find((e) => e.id === input.id) ?? null;
  return { example: ex };
});