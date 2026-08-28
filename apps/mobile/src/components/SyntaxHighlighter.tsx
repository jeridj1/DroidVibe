import React from 'react';
import { Text } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

/**
 * Lightweight Arduino/C++ tokenizer for read-only syntax coloring. Renders a
 * sequence of colored <Text> spans. Designed to mirror the editing TextInput
 * exactly (same font family/size/line height) so it can be used as an overlay.
 */

const KEYWORDS = new Set([
  'void', 'int', 'char', 'float', 'double', 'bool', 'boolean', 'byte', 'long',
  'short', 'unsigned', 'const', 'static', 'return', 'if', 'else', 'for', 'while',
  'do', 'switch', 'case', 'break', 'continue', 'default', 'struct', 'class',
  'public', 'private', 'protected', 'enum', 'namespace', 'using', 'new', 'delete',
  'true', 'false', 'nullptr', 'sizeof', 'typedef', 'template', 'typename',
  'auto', 'inline', 'virtual', 'override', 'this',
]);

const ARDUINO = new Set([
  'setup', 'loop', 'pinMode', 'digitalWrite', 'digitalRead', 'analogRead',
  'analogWrite', 'delay', 'delayMicroseconds', 'millis', 'micros', 'Serial',
  'begin', 'print', 'println', 'available', 'read', 'write', 'map', 'constrain',
  'attachInterrupt', 'detachInterrupt', 'Wire', 'SPI', 'HIGH', 'LOW', 'INPUT',
  'OUTPUT', 'INPUT_PULLUP', 'LED_BUILTIN', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5',
]);

type Token = { type: string; value: string };

export function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = code.length;
  while (i < n) {
    const c = code[i];
    // line comment
    if (c === '/' && code[i + 1] === '/') {
      let j = i;
      while (j < n && code[j] !== '\n') j++;
      tokens.push({ type: 'comment', value: code.slice(i, j) });
      i = j;
      continue;
    }
    // block comment
    if (c === '/' && code[i + 1] === '*') {
      let j = i + 2;
      while (j < n && !(code[j] === '*' && code[j + 1] === '/')) j++;
      j = Math.min(j + 2, n);
      tokens.push({ type: 'comment', value: code.slice(i, j) });
      i = j;
      continue;
    }
    // preprocessor
    if (c === '#' && (i === 0 || code[i - 1] === '\n')) {
      let j = i;
      while (j < n && code[j] !== '\n' && code[j] !== '\r') j++;
      tokens.push({ type: 'preproc', value: code.slice(i, j) });
      i = j;
      continue;
    }
    // string / char
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      while (j < n && code[j] !== quote) {
        if (code[j] === '\\') j++;
        j++;
      }
      j = Math.min(j + 1, n);
      tokens.push({ type: 'string', value: code.slice(i, j) });
      i = j;
      continue;
    }
    // number
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < n && /[0-9a-fA-FxX._]/.test(code[j])) j++;
      tokens.push({ type: 'number', value: code.slice(i, j) });
      i = j;
      continue;
    }
    // identifier / keyword
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_]/.test(code[j])) j++;
      const word = code.slice(i, j);
      let type = 'ident';
      if (KEYWORDS.has(word)) type = 'keyword';
      else if (ARDUINO.has(word)) type = 'arduino';
      tokens.push({ type, value: word });
      i = j;
      continue;
    }
    // whitespace / punctuation / newlines — emit raw
    let j = i;
    while (j < n && !/[A-Za-z0-9_"'#/]/.test(code[j])) j++;
    if (j === i) j = i + 1;
    tokens.push({ type: 'punct', value: code.slice(i, j) });
    i = j;
  }
  return tokens;
}

export function HighlightedText({ code }: { code: string }) {
  const { palette } = useTheme();
  const tokens = tokenize(code);
  return (
    <Text style={{ fontFamily: 'monospace', fontSize: 14, lineHeight: 20 }}>
      {tokens.map((t, idx) => {
        const color =
          t.type === 'comment' ? palette.commentColor :
          t.type === 'string' ? palette.stringColor :
          t.type === 'number' ? palette.numberColor :
          t.type === 'keyword' ? palette.highlight :
          t.type === 'arduino' ? palette.typeColor :
          t.type === 'preproc' ? palette.accent :
          palette.monoText;
        return (
          <Text key={idx} style={{ color }}>
            {t.value}
          </Text>
        );
      })}
    </Text>
  );
}
