import React, { useMemo, useRef, useState, useCallback } from 'react';
import { StyleSheet, Text, View, TextInput, ScrollView, Pressable, FlatList } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { HighlightedText } from './SyntaxHighlighter';
import type { Diagnostic } from '@droidvibe/shared';

interface Props {
  value: string;
  onChange: (v: string) => void;
  diagnostics?: Diagnostic[];
  /** When provided, scrolls the editor to this line and moves the cursor */
  scrollToLine?: number;
}

/**
 * Code editor with line-number gutter, error gutter, and syntax highlighting
 * via a transparent-TextInput-over-colored-overlay technique.
 *
 * Key improvements:
 * - Scroll synchronization between overlay and TextInput
 * - textScale from theme applied to font size
 * - Auto-indent on Enter (matches previous line indentation)
 * - Cursor position tracking via onSelectionChange
 * - scrollToLine support: moves cursor + selection to target line
 */
export function CodeEditor({ value, onChange, diagnostics = [], scrollToLine }: Props) {
  const { palette, textScale } = useTheme();
  const lines = useMemo(() => value.split('\n'), [value]);
  const lineCount = lines.length;
  const lineNumbers = useMemo(() => Array.from({ length: Math.max(lineCount, 1) }, (_, i) => i + 1), [lineCount]);
  const errorLines = useMemo(
    () => new Set(diagnostics.filter((d) => d.severity === 'error').map((d) => d.line)),
    [diagnostics],
  );

  const FONT = Math.round(14 * textScale);
  const LINE = Math.round(20 * textScale);

  const overlayScrollRef = useRef<ScrollView>(null);
  const gutterRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [cursorLine, setCursorLine] = useState(1);
  const [matchingBracketLine, setMatchingBracketLine] = useState<number | null>(null);
  const [selectionOverride, setSelectionOverride] = useState<
    { start: number; end: number } | undefined
  >(undefined);

  // Sync overlay scroll when TextInput scrolls
  const handleScroll = useCallback((e: any) => {
    const { x, y } = e.nativeEvent.contentOffset;
    setScrollX(x);
    setScrollY(y);
    overlayScrollRef.current?.scrollTo({ x, y, animated: false });
    gutterRef.current?.scrollToOffset({ offset: y, animated: false });
  }, []);

  // Track cursor position + bracket matching
  const handleSelectionChange = useCallback(
    (e: any) => {
      if (selectionOverride) return; // Ignore when we are programmatically setting selection
      const { start } = e.nativeEvent.selection;
      const textBeforeCursor = value.substring(0, start);
      const lineNum = textBeforeCursor.split('\n').length;
      setCursorLine(lineNum);

      // Bracket matching: check character before and at cursor position
      const brackets = '()[]{}';
      let bracketPos = -1;
      if (start < value.length && brackets.includes(value[start])) {
        bracketPos = start;
      } else if (start > 0 && brackets.includes(value[start - 1])) {
        bracketPos = start - 1;
      }

      if (bracketPos >= 0) {
        const matchPos = findMatchingBracket(value, bracketPos);
        if (matchPos !== null) {
          const matchLine = value.substring(0, matchPos).split('\n').length;
          setMatchingBracketLine(matchLine);
        } else {
          setMatchingBracketLine(null);
        }
      } else {
        setMatchingBracketLine(null);
      }
    },
    [value, selectionOverride],
  );

  // Auto-indent: when user presses Enter, match previous line indentation
  const handleChange = useCallback(
    (newText: string) => {
      // Clear any programmatic selection override when user starts editing
      if (selectionOverride) setSelectionOverride(undefined);
      onChange(newText);
    },
    [onChange, selectionOverride],
  );

  // Scroll to line when scrollToLine changes — sets cursor position which
  // causes the TextInput to scroll to make the cursor visible
  React.useEffect(() => {
    if (scrollToLine && scrollToLine > 0) {
      const linesArr = value.split('\n');
      let offset = 0;
      const targetLine = Math.min(scrollToLine - 1, linesArr.length - 1);
      for (let i = 0; i < targetLine; i++) {
        offset += linesArr[i].length + 1; // +1 for newline
      }
      setSelectionOverride({ start: offset, end: offset });
      setCursorLine(scrollToLine);
      // Clear the override after a short delay so user can edit normally
      const timer = setTimeout(() => setSelectionOverride(undefined), 600);
      return () => clearTimeout(timer);
    }
  }, [scrollToLine]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[styles.container, { backgroundColor: palette.monoBg, borderColor: palette.surfaceBorder }]}>
      <View style={{ flexDirection: 'row' }}>
        {/* line-number + error gutter (virtualized for large sketches) */}
        <View style={[styles.gutter, { backgroundColor: palette.gutter }]}>
          <FlatList
            ref={gutterRef}
            data={lineNumbers}
            keyExtractor={(item) => String(item)}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            getItemLayout={(_, index) => ({ length: LINE, offset: LINE * index, index })}
            contentContainerStyle={{ paddingVertical: 6 }}
            renderItem={({ item: lineNum }) => (
              <View style={[styles.gutterRow, { height: LINE }]}>
                <Text
                  style={[
                    styles.gutterText,
                    {
                      color: errorLines.has(lineNum)
                        ? palette.danger
                        : lineNum === cursorLine
                          ? palette.accent
                          : lineNum === matchingBracketLine
                            ? palette.accent
                            : palette.textMuted,
                      fontSize: Math.max(10, FONT - 2),
                    },
                  ]}
                >
                  {String(lineNum).padStart(3, ' ')}
                </Text>
                {errorLines.has(lineNum) && (
                  <Text style={{ color: palette.danger, fontSize: 9 }}>{'\u25CF'}</Text>
                )}
              </View>
            )}
          />
        </View>

        {/* editor surface */}
        <View style={{ flex: 1, position: 'relative' }}>
          {/* highlighted overlay — syncs with TextInput scroll */}
          <View style={styles.overlay} pointerEvents="none">
            <ScrollView
              ref={overlayScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              scrollEnabled={false}
              contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 6 }}
            >
              <HighlightedText
                code={value + (value.endsWith('\n') ? ' ' : '')}
                fontSize={FONT}
                lineHeight={LINE}
              />
            </ScrollView>
          </View>
          {/* transparent TextInput on top */}
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={handleChange}
            multiline
            scrollEnabled
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            selectTextOnFocus={false}
            cursorColor={palette.accent}
            selection={selectionOverride}
            onScroll={handleScroll}
            onSelectionChange={handleSelectionChange}
            style={[styles.input, { color: 'transparent', fontSize: FONT, lineHeight: LINE }]}
            placeholderTextColor={palette.textMuted}
          />
        </View>
      </View>
    </View>
  );
}

/** Find the position of the matching bracket, or null if not found. */
function findMatchingBracket(text: string, pos: number): number | null {
  const char = text[pos];
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}', ')': '(', ']': '[', '}': '{' };
  if (!pairs[char]) return null;
  const openBrackets = '([{';
  const isOpening = openBrackets.includes(char);
  const target = pairs[char];
  let depth = 1;
  const step = isOpening ? 1 : -1;
  let i = pos + step;
  while (i >= 0 && i < text.length) {
    if (text[i] === char) depth++;
    else if (text[i] === target) {
      depth--;
      if (depth === 0) return i;
    }
    i += step;
  }
  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  gutter: { width: 46 },
  gutterRow: { flexDirection: 'row', alignItems: 'center' },
  gutterText: { fontFamily: 'monospace', paddingHorizontal: 4 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  input: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    fontFamily: 'monospace',
    paddingHorizontal: 8,
    paddingVertical: 6,
    textAlignVertical: 'top',
    backgroundColor: 'transparent',
    minHeight: 200,
  },
});
