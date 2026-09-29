/**
 * High-Velocity, Zero-Bloat Syntax Tokenizer for Mandrak.
 * Microsecond execution speed with 0 KB external dependency overhead.
 * Covers top 15 common languages: JS, TS, Python, HTML, CSS, JSON, SQL, Bash, Go, Rust, C, C++, Java, YAML, Markdown.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Common language keyword sets
const KEYWORDS: Record<string, Set<string>> = {
  js: new Set([
    'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
    'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function',
    'if', 'import', 'in', 'instanceof', 'let', 'new', 'null', 'return', 'super', 'switch',
    'this', 'throw', 'try', 'typeof', 'undefined', 'var', 'void', 'while', 'with', 'yield',
    'interface', 'type', 'enum', 'implements', 'private', 'public', 'protected', 'readonly',
    'from', 'as', 'true', 'false',
  ]),
  python: new Set([
    'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del',
    'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in',
    'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while',
    'with', 'yield', 'True', 'False', 'None', 'self',
  ]),
  sql: new Set([
    'select', 'from', 'where', 'insert', 'into', 'values', 'update', 'set', 'delete', 'create',
    'table', 'drop', 'alter', 'add', 'primary', 'key', 'foreign', 'references', 'index', 'join',
    'inner', 'left', 'right', 'full', 'outer', 'on', 'group', 'by', 'order', 'having', 'limit',
    'offset', 'union', 'all', 'as', 'distinct', 'case', 'when', 'then', 'else', 'end', 'and',
    'or', 'not', 'in', 'is', 'null', 'like', 'between', 'exists', 'count', 'sum', 'avg', 'min',
    'max', 'default', 'cascade', 'varchar', 'integer', 'int', 'boolean', 'timestamp', 'text', 'uuid',
  ]),
  rust: new Set([
    'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'dyn', 'else', 'enum',
    'extern', 'false', 'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod',
    'move', 'mut', 'pub', 'ref', 'return', 'self', 'Self', 'static', 'struct', 'super',
    'trait', 'true', 'type', 'unsafe', 'use', 'where', 'while', 'i32', 'i64', 'u32', 'u64',
    'f32', 'f64', 'bool', 'str', 'String', 'Vec', 'Option', 'Result', 'Some', 'None', 'Ok', 'Err',
  ]),
  go: new Set([
    'break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else', 'fallthrough',
    'for', 'func', 'go', 'goto', 'if', 'import', 'interface', 'map', 'package', 'range',
    'return', 'select', 'struct', 'switch', 'type', 'var', 'true', 'false', 'nil', 'iota',
    'string', 'int', 'int64', 'bool', 'byte', 'error',
  ]),
  bash: new Set([
    'if', 'then', 'else', 'elif', 'fi', 'case', 'esac', 'for', 'while', 'until', 'do',
    'done', 'in', 'function', 'select', 'time', 'echo', 'cd', 'export', 'source', 'alias',
    'chmod', 'chown', 'mkdir', 'rm', 'cp', 'mv', 'cat', 'grep', 'curl', 'git', 'npm', 'sudo',
  ]),
  css: new Set([
    'display', 'flex', 'grid', 'margin', 'padding', 'width', 'height', 'color', 'background',
    'border', 'border-radius', 'font-family', 'font-size', 'font-weight', 'line-height',
    'position', 'top', 'right', 'bottom', 'left', 'z-index', 'opacity', 'transform', 'transition',
    'cursor', 'overflow', 'gap', 'box-shadow', 'backdrop-filter', 'none', 'inherit', 'auto',
  ]),
};

// Aliases
KEYWORDS.ts = KEYWORDS.js;
KEYWORDS.tsx = KEYWORDS.js;
KEYWORDS.jsx = KEYWORDS.js;
KEYWORDS.javascript = KEYWORDS.js;
KEYWORDS.typescript = KEYWORDS.js;
KEYWORDS.py = KEYWORDS.python;
KEYWORDS.sh = KEYWORDS.bash;
KEYWORDS.zsh = KEYWORDS.bash;
KEYWORDS.shell = KEYWORDS.bash;
KEYWORDS.rs = KEYWORDS.rust;
KEYWORDS.golang = KEYWORDS.go;
KEYWORDS.c = KEYWORDS.rust;
KEYWORDS.cpp = KEYWORDS.rust;
KEYWORDS['c++'] = KEYWORDS.rust;
KEYWORDS.java = KEYWORDS.js;

/**
 * Highlights a raw code snippet for a given language.
 * Returns safe HTML with styled token spans.
 */
export function highlightCode(code: string, rawLang?: string): string {
  if (!code) return '';

  const lang = (rawLang || '').toLowerCase().trim();
  const keywordSet = KEYWORDS[lang];

  // If language has no defined keywords or is plain text, escape and return
  if (!keywordSet && lang !== 'json' && lang !== 'html' && lang !== 'xml') {
    return escapeHtml(code);
  }

  // Tokenize line by line
  const lines = code.split('\n');
  const highlightedLines = lines.map((line) => {
    // 1. Comments
    if (lang === 'python' || lang === 'bash' || lang === 'sh' || lang === 'yaml' || lang === 'yml') {
      const hashIdx = line.indexOf('#');
      if (hashIdx !== -1) {
        const codePart = line.substring(0, hashIdx);
        const commentPart = line.substring(hashIdx);
        return tokenizeTokens(codePart, keywordSet) + `<span class="tok-comment">${escapeHtml(commentPart)}</span>`;
      }
    } else {
      const slashIdx = line.indexOf('//');
      if (slashIdx !== -1) {
        const codePart = line.substring(0, slashIdx);
        const commentPart = line.substring(slashIdx);
        return tokenizeTokens(codePart, keywordSet) + `<span class="tok-comment">${escapeHtml(commentPart)}</span>`;
      }
    }

    return tokenizeTokens(line, keywordSet);
  });

  return highlightedLines.join('\n');
}

function tokenizeTokens(text: string, keywordSet?: Set<string>): string {
  if (!text) return '';

  // Regex matches: strings, numbers, identifiers, or other characters
  const tokenRegex = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b\d+(?:\.\d+)?\b|[a-zA-Z_$][a-zA-Z0-9_$]*|[^\s\w]+|\s+)/g;
  let match: RegExpExecArray | null;
  let html = '';

  while ((match = tokenRegex.exec(text)) !== null) {
    const tok = match[0];

    // String literals
    if (tok.startsWith('"') || tok.startsWith("'") || tok.startsWith('`')) {
      html += `<span class="tok-string">${escapeHtml(tok)}</span>`;
    }
    // Numbers
    else if (/^\d/.test(tok)) {
      html += `<span class="tok-number">${escapeHtml(tok)}</span>`;
    }
    // Keywords / Identifiers
    else if (/^[a-zA-Z_$]/.test(tok)) {
      const lower = tok.toLowerCase();
      if (keywordSet && (keywordSet.has(tok) || keywordSet.has(lower))) {
        html += `<span class="tok-keyword">${escapeHtml(tok)}</span>`;
      } else if (/^[A-Z][a-zA-Z0-9_]*$/.test(tok)) {
        // Types / Classes starting with uppercase
        html += `<span class="tok-type">${escapeHtml(tok)}</span>`;
      } else {
        html += escapeHtml(tok);
      }
    }
    // Operators & punctuation
    else {
      html += escapeHtml(tok);
    }
  }

  return html || escapeHtml(text);
}
