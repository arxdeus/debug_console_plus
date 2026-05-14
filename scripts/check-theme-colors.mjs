/**
 * Fails if webview / extension sources contain hardcoded CSS colors
 * (#rgb / #rrggbb / rgba / hsla) outside HTML numeric character references (e.g. &#039;).
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const HEX_LINE = /(?<!&)\b#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
const FUNC_COLOR = /\brgba?\s*\(|\bhsla?\s*\(/i;
const INLINE_STYLE_COLOR =
  /\.style\.(?:color|background(?:Color)?|fill|stroke)\s*=\s*['"`][^'"`]*(?:#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\()/i;

/** @param {string} dir */
function walkTs(dir, out) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'out') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkTs(p, out);
    else if (extname(p) === '.ts') out.push(p);
  }
}

function checkFile(relPath) {
  const abs = join(ROOT, relPath);
  const text = readFileSync(abs, 'utf8');
  const lines = text.split(/\r?\n/);
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (HEX_LINE.test(line) || FUNC_COLOR.test(line)) {
      hits.push({ line: i + 1, text: line.trimEnd() });
    }
    if (INLINE_STYLE_COLOR.test(line)) {
      hits.push({ line: i + 1, text: line.trimEnd(), note: 'inline style color' });
    }
  }
  return hits;
}

const files = ['src/webview/styles.css', 'src/webview/main.js'];
const tsFiles = [];
walkTs(join(ROOT, 'src'), tsFiles);

let failed = false;
for (const rel of files) {
  const hits = checkFile(rel);
  if (hits.length) {
    failed = true;
    for (const h of hits) {
      console.error(`${rel}:${h.line}: ${h.note ?? 'hardcoded color'}: ${h.text}`);
    }
  }
}
for (const abs of tsFiles) {
  const rel = abs.slice(ROOT.length + 1);
  const hits = checkFile(rel);
  if (hits.length) {
    failed = true;
    for (const h of hits) {
      console.error(`${rel}:${h.line}: ${h.note ?? 'hardcoded color'}: ${h.text}`);
    }
  }
}

if (failed) {
  console.error('\ncheck-theme-colors: failed (use only var(--vscode-*) theme tokens for colors).');
  process.exit(1);
}

console.log('check-theme-colors: ok (no #hex / rgb() / hsl() color literals in audited sources).');
console.log(
  'Manual (optional): in VS Code switch Dark+ / Light+ / High Contrast and tweak workbench.colorCustomizations for debugConsole.* and terminal.ansi* to confirm the webview tracks the active theme.'
);
