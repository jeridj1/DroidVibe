/**
 * Human-readable compiler diagnostic translation.
 *
 * Takes raw avr-g++ / arduino-cli diagnostics and produces plain-English
 * explanations aimed at a beginner-to-intermediate Arduino developer. The
 * goal is to turn cryptic compiler text into actionable guidance without
 * hiding the original message.
 */
import type { Diagnostic } from './types.js';

interface Rule {
  /** Matches against the lowercased compiler message. */
  test: RegExp;
  explain: (d: Diagnostic, m: RegExpMatchArray) => string;
}

const RULES: Rule[] = [
  {
    test: /expected ';'/,
    explain: () =>
      'The compiler reached the end of a statement but did not find a semicolon. ' +
      'Add a semicolon ";" at the end of the previous line.',
  },
  {
    test: /expected '\)'/,
    explain: () =>
      'A closing parenthesis ")" is missing. Check that every "(" has a matching ")".',
  },
  {
    test: /expected '\}'/,
    explain: () =>
      'A closing brace "}" is missing. Make sure every "{" has a matching "}".',
  },
  {
    test: /undeclared identifier '([^']+)'/,
    explain: (_d, m) =>
      `${m[1]} is not recognized. Check the spelling, and make sure the variable, ' +
      'function, or library that defines it is declared above this line and that the ' +
      'library is installed and #included.`,
  },
  {
    test: /'\w+' was not declared in this scope/,
    explain: (_d, m) =>
      `${m[0].match(/'([^']+)'/)?.[1] ?? 'This symbol'} is used before it is declared, or it is ' +
      'spelled wrong, or its library has not been #included. Define it earlier in the file or ' +
      'install and include the required library.`,
  },
  {
    test: /no matching function for call to '([^']+)'/,
    explain: (_d, m) =>
      `No overload of ${m[1]} matches the argument types you passed. Check the number, order, ' +
      'and types of the arguments against the function's declaration.`,
  },
  {
    test: /invalid conversion from '([^']+)' to '([^']+)'/,
    explain: (_d, m) =>
      `The code tried to use a ${m[1]} where a ${m[2]} is required. Add an explicit cast, or ' +
      'change the variable type to match.`,
  },
  {
    test: /no '([^']+)' in '([^']+)'/,
    explain: (_d, m) => `${m[1]} is not a member of ${m[2]}. Check the library docs for the correct member name.`,
  },
  {
    test: /'class ([^']+)' has no member named '([^']+)'/,
    explain: (_d, m) => `The type ${m[1]} has no member called ${m[2]}. Verify the API name or the library version.`,
  },
  {
    test: /stray '\\([0-9]+)' in program/,
    explain: () =>
      'There is an invisible/non-ASCII character in the source (often from copy-paste). ' +
      'Delete the line and retype it with plain ASCII characters.',
  },
  {
    test: /expected unqualified-id before '([^']+)'/,
    explain: (_d, m) =>
      `The compiler did not expect "${m[1]}" here. A common cause is a stray semicolon before a ' +
      'function or class definition, or an unclosed block above this line.`,
  },
  {
    test: /'main' must return 'int'/,
    explain: () => 'Arduino sketches do not declare main(); they use setup() and loop(). Remove any main() function.',
  },
  {
    test: /No such file or directory|fatal error: ([^:]+): No such file or directory/,
    explain: (_d, m) =>
      `The header ${m[1] ?? 'this file'} was not found. Make sure the library is installed via Library ' +
      'Manager and that the #include spelling matches the installed library name exactly.`,
  },
  {
    test: /multiple definition of '([^']+)'/,
    explain: (_d, m) =>
      `${m[1]} is defined more than once. Move the definition into a single .cpp file and keep only the ' +
      'declaration in the header, or wrap the header with #pragma once / include guards.`,
  },
  {
    test: /conflicting (?:return |specifiers )?types? for '([^']+)'/,
    explain: (_d, m) => `The return type of ${m[1]} does not match its earlier declaration. Make them identical.`,
  },
  {
    test: /too few arguments to function|too many arguments to function/,
    explain: () =>
      'The number of arguments does not match the function signature. Count the parameters in the declaration.',
  },
  {
    test: /has not been declared in this scope|out-of-line definition for '([^']+)' does not match/,
    explain: () => 'The definition does not match any declaration. Check the signature spelling and types.',
  },
];

/** Add a plain-English explanation to a single diagnostic. */
export function explainDiagnostic(d: Diagnostic): Diagnostic {
  if (d.explanation) return d;
  const msg = d.message.toLowerCase();
  for (const rule of RULES) {
    const m = msg.match(rule.test);
    if (m) {
      return { ...d, explanation: rule.explain(d, m) };
    }
  }
  // Generic, severity-aware fallback that does not invent specifics.
  if (d.severity === 'warning') {
    return { ...d, explanation: 'The compiler emitted a warning. Warnings do not block the build but may hide a real bug; review the line carefully.' };
  }
  if (d.severity === 'info') {
    return { ...d, explanation: 'Compiler informational note — usually extra context for a previous error or warning.' };
  }
  return { ...d, explanation: 'This is a compiler error that stopped the build. Fix the indicated line; the original message above is the authoritative source.' };
}

/** Annotate a list of diagnostics with plain-English explanations. */
export function explainDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.map(explainDiagnostic);
}

/**
 * Parse arduino-cli's "--format json" compile output into structured
 * diagnostics. The JSON shape is: { compiler_out, compiler_err, builder_result,
 * ... } where compiler_err/stderr holds the gcc-style lines.
 */
export function parseArduinoCliJson(json: string): Diagnostic[] {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(json);
  } catch {
    return [];
  }
  const stdout = String(obj.compiler_out ?? '');
  const stderr = String(obj.compiler_err ?? obj.builder_result ?? '');
  const text = [stdout, stderr].join('\n');
  const out: Diagnostic[] = [];
  // gcc/clang style: path:line:col: severity: message [code]
  const re = /^(.*?):(\d+):(\d+):\s*(error|warning|note|fatal error):\s*(.+?)(?:\s+\[(-?\w+)\])?$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const severity: Diagnostic['severity'] =
      m[4].includes('error') ? 'error' : m[4] === 'warning' ? 'warning' : 'info';
    out.push({
      severity,
      file: m[1],
      line: parseInt(m[2], 10),
      column: parseInt(m[3], 10),
      message: m[5].trim(),
      code: m[6],
    });
  }
  return out;
}
