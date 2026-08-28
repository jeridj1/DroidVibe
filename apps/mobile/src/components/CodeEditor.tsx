import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, TextInput, ScrollView, Pressable, type LayoutChangeEvent } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { HighlightedText } from './SyntaxHighlighter';
import type { Diagnostic } from '@droidvibe/shared';

interface Props {
  value: string;
  onChange: (v: string) => void;
  diagnostics?: Diagnostic[];
}

const FONT = 14;
const LINE = 20;

/**
 * Code editor with line-number gutter, error gutter, and syntax highlighting
 * via a transparent-TextInput-over-colored-overlay technique. Hit targets are
 * generous for S Pen / touch use. Find/replace and undo/redo are driven by the
 * parent; this component keeps the editing surface responsive.
 */
export function CodeEditor({ value, onChange, diagnostics = [] }: Props) {
  const { palette } = useTheme();
  const lines = useMemo(() => value.split('\n'), [value]);
  const lineCount = lines.length;
  const errorLines = useMemo(() => new Set(diagnostics.filter((d) => d.severity === 'error').map((d) => d.line)), [diagnostics]);

  return (
    <View style={[styles.container, { backgroundColor: palette.monoBg, borderColor: palette.surfaceBorder }]}>
      <View style={{ flexDirection: 'row' }}>
        {/* line-number + error gutter */}
        <View style={[styles.gutter, { backgroundColor: palette.gutter }]}>
          {Array.from({ length: Math.max(lineCount, 1) }).map((_, i) => (
            <View key={i} style={styles.gutterRow}>
              <Text style={[styles.gutterText, { color: errorLines.has(i + 1) ? palette.danger : palette.textMuted }]}>
                {String(i + 1).padStart(3, ' ')}
              </Text>
              {errorLines.has(i + 1) && <Text style={{ color: palette.danger, fontSize: 9 }}>{'\u25CF'}</Text>}
            </View>
          ))}
        </View>

        {/* editor surface */}
        <View style={{ flex: 1, position: 'relative' }}>
          {/* highlighted overlay */}
          <View style={styles.overlay} pointerEvents="none">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 6 }}>
              <HighlightedText code={value + (value.endsWith('\n') ? ' ' : '')} />
            </ScrollView>
          </View>
          {/* transparent TextInput on top */}
          <TextInput
            value={value}
            onChangeText={onChange}
            multiline
            scrollEnabled
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            cursorColor={palette.accent}
            style={[
              styles.input,
              { color: 'transparent' },
            ]}
            placeholderTextColor={palette.textMuted}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  gutter: { width: 46, paddingVertical: 6, paddingHorizontal: 4 },
  gutterRow: { flexDirection: 'row', alignItems: 'center', height: 20 },
  gutterText: { fontFamily: 'monospace', fontSize: 12 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  input: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    fontFamily: 'monospace', fontSize: FONT, lineHeight: LINE,
    paddingHorizontal: 8, paddingVertical: 6, textAlignVertical: 'top',
    backgroundColor: 'transparent', minHeight: 200,
  },
});
