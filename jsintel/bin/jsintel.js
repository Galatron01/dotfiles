#!/usr/bin/env node
/**
 * jsintel — JavaScript Intelligence Tool
 * - Outdated JS patterns
 * - Library version checking
 * - Vulnerable comment detection
 * - Site crawling with cookie support
 */

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, extname, relative, resolve, basename } from 'path';
import { homedir } from 'os';
import { get as httpsGet } from 'https';
import { get as httpGet } from 'http';

// ─── ANSI Colors ─────────────────────────────────────────────────────────────

const USE_COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const C = {
  reset:   USE_COLOR ? '\x1b[0m'  : '',
  bold:    USE_COLOR ? '\x1b[1m'  : '',
  dim:     USE_COLOR ? '\x1b[2m'  : '',
  red:     USE_COLOR ? '\x1b[31m' : '',
  green:   USE_COLOR ? '\x1b[32m' : '',
  yellow:  USE_COLOR ? '\x1b[33m' : '',
  magenta: USE_COLOR ? '\x1b[35m' : '',
  cyan:    USE_COLOR ? '\x1b[36m' : '',
  gray:    USE_COLOR ? '\x1b[90m' : '',
  bRed:    USE_COLOR ? '\x1b[91m' : '',
  bMag:    USE_COLOR ? '\x1b[95m' : '',
};

const bold    = (s) => `${C.bold}${s}${C.reset}`;
const dim     = (s) => `${C.dim}${s}${C.reset}`;
const red     = (s) => `${C.red}${s}${C.reset}`;
const yellow  = (s) => `${C.yellow}${s}${C.reset}`;
const green   = (s) => `${C.green}${s}${C.reset}`;
const cyan    = (s) => `${C.cyan}${s}${C.reset}`;
const magenta = (s) => `${C.magenta}${s}${C.reset}`;
const gray    = (s) => `${C.gray}${s}${C.reset}`;
const bRed    = (s) => `${C.bRed}${s}${C.reset}`;
const bMag    = (s) => `${C.bMag}${s}${C.reset}`;

// ─── Semver ───────────────────────────────────────────────────────────────────

function semverParse(v) {
  const m = String(v).match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [+m[1], +m[2], +m[3]] : null;
}

function semverLt(a, b) {
  const pa = semverParse(a), pb = semverParse(b);
  if (!pa || !pb) return false;
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return true;
    if (pa[i] > pb[i]) return false;
  }
  return false;
}

function semverMajor(v) { const p = semverParse(v); return p ? p[0] : 0; }

// ─── Library Database ─────────────────────────────────────────────────────────

const LIBRARY_DB = [
  {
    name: 'jQuery',
    patterns: [/jQuery JavaScript Library v(\d+\.\d+\.\d+)/, /jQuery v(\d+\.\d+\.\d+)/, /jquery[_-](\d+\.\d+\.\d+)/i],
    minSafe: '3.7.0',
    severity: 'error',
    notes: 'Versions < 3.5.0 have XSS vulnerabilities (CVE-2020-11022, CVE-2020-11023)',
  },
  {
    name: 'jQuery UI',
    patterns: [/jQuery UI - v(\d+\.\d+\.\d+)/, /jquery-ui[_-](\d+\.\d+\.\d+)/i],
    minSafe: '1.13.2',
    severity: 'warn',
    notes: 'Older versions have XSS vulnerabilities in several widgets',
  },
  {
    name: 'jQuery Mobile',
    patterns: [/jQuery Mobile (\d+\.\d+\.\d+)/, /jquery\.mobile[_-](\d+\.\d+\.\d+)/i],
    minSafe: null,
    eol: true,
    severity: 'error',
    notes: 'jQuery Mobile is end-of-life (2021). Migrate to a modern mobile framework',
  },
  {
    name: 'lodash',
    patterns: [/lodash v(\d+\.\d+\.\d+)/, /Lodash <https:\/\/lodash\.com\/> (\d+\.\d+\.\d+)/, /lodash[_-](\d+\.\d+\.\d+)/i],
    minSafe: '4.17.21',
    severity: 'error',
    notes: 'CVE-2021-23337 (command injection) and CVE-2020-8203 (prototype pollution)',
  },
  {
    name: 'Underscore.js',
    patterns: [/Underscore\.js (\d+\.\d+\.\d+)/, /underscore[_-](\d+\.\d+\.\d+)/i],
    minSafe: '1.13.0',
    severity: 'warn',
    notes: 'Versions < 1.13.0 have prototype pollution vulnerability (CVE-2021-23358)',
  },
  {
    name: 'Moment.js',
    patterns: [/moment\.js.*?(\d+\.\d+\.\d+)/i, /moment[_-](\d+\.\d+\.\d+)/i],
    minSafe: null,
    eol: true,
    severity: 'warn',
    notes: 'Moment.js is end-of-life. Migrate to date-fns, Day.js, or Luxon',
  },
  {
    name: 'AngularJS',
    patterns: [/AngularJS v(\d+\.\d+\.\d+)/, /angular\.js.*?(\d+\.\d+\.\d+)/i, /angular[_-](\d+\.\d+\.\d+)/i],
    minSafe: null,
    eol: true,
    severity: 'error',
    notes: 'AngularJS reached end-of-life December 31, 2021. Migrate to Angular (v2+)',
    eolCheck: (v) => semverMajor(v) < 2,
  },
  {
    name: 'Bootstrap JS',
    patterns: [/Bootstrap v(\d+\.\d+\.\d+)/, /bootstrap[_-](\d+\.\d+\.\d+)/i],
    minSafe: '5.3.2',
    severity: 'warn',
    notes: 'Versions < 3.4.1 have XSS vulnerabilities; v4 lacks security backports',
  },
  {
    name: 'Handlebars.js',
    patterns: [/Handlebars\.js v(\d+\.\d+\.\d+)/, /handlebars[_-](\d+\.\d+\.\d+)/i],
    minSafe: '4.7.7',
    severity: 'error',
    notes: 'CVE-2021-23369, CVE-2021-23383: prototype pollution and possible RCE',
  },
  {
    name: 'Mustache.js',
    patterns: [/mustache\.js - Logic-less.*?(\d+\.\d+\.\d+)/i, /mustache[_-](\d+\.\d+\.\d+)/i],
    minSafe: '4.2.0',
    severity: 'warn',
    notes: 'Older versions have ReDoS and XSS issues',
  },
  {
    name: 'highlight.js',
    patterns: [/highlight\.js v(\d+\.\d+\.\d+)/i, /highlight[_-](\d+\.\d+\.\d+)/i],
    minSafe: '11.0.0',
    severity: 'error',
    notes: 'Versions < 10.4.1 have ReDoS vulnerability (CVE-2021-23346)',
  },
  {
    name: 'marked',
    patterns: [/marked v(\d+\.\d+\.\d+)/i, /marked[_-](\d+\.\d+\.\d+)/i],
    minSafe: '4.3.0',
    severity: 'error',
    notes: 'Multiple XSS vulnerabilities in versions < 4.0. Always sanitize output.',
  },
  {
    name: 'Axios',
    patterns: [/axios\/(\d+\.\d+\.\d+)/, /axios[_-](\d+\.\d+\.\d+)/i],
    minSafe: '1.6.8',
    severity: 'warn',
    notes: 'CVE-2023-45857: credentials leak in cross-origin requests (versions < 1.6.0)',
  },
  {
    name: 'Vue.js',
    patterns: [/Vue\.js v(\d+\.\d+\.\d+)/, /vue[_-](\d+\.\d+\.\d+)/i, /__VUE_VERSION__ = ['"](\d+\.\d+\.\d+)['"]/],
    minSafe: '3.4.0',
    severity: 'warn',
    notes: 'Vue 2 reached end-of-life December 31, 2023. Migrate to Vue 3',
    eolCheck: (v) => semverMajor(v) < 3,
  },
  {
    name: 'React',
    patterns: [/react[_-](\d+\.\d+\.\d+)/i, /React\.version\s*=\s*['"](\d+\.\d+\.\d+)['"]/],
    minSafe: '18.0.0',
    severity: 'info',
    notes: 'React 17 and earlier are missing security patches available in v18+',
  },
  {
    name: 'CryptoJS',
    patterns: [/CryptoJS v(\d+\.\d+\.\d+)/, /crypto-js[_-](\d+\.\d+\.\d+)/i],
    minSafe: '4.2.0',
    severity: 'warn',
    notes: 'Older CryptoJS versions use a weak PRNG. Use the Web Crypto API for security-critical operations',
  },
  {
    name: 'DOMPurify',
    patterns: [/DOMPurify (\d+\.\d+\.\d+)/, /dompurify[_-](\d+\.\d+\.\d+)/i],
    minSafe: '3.0.8',
    severity: 'error',
    notes: 'DOMPurify bypass vulnerabilities in older versions. Always keep sanitizers up to date',
  },
  {
    name: 'Prototype.js',
    patterns: [/Prototype JavaScript framework, version (\d+\.\d+\.\d+)/, /prototype[_-](\d+\.\d+\.\d+)/i],
    minSafe: null,
    eol: true,
    severity: 'error',
    notes: 'Prototype.js is abandoned. Migrate to modern ES6+ or a maintained library',
  },
  {
    name: 'MooTools',
    patterns: [/MooTools.*?(\d+\.\d+\.\d+)/i, /mootools[_-](\d+\.\d+\.\d+)/i],
    minSafe: null,
    eol: true,
    severity: 'error',
    notes: 'MooTools is end-of-life. Migrate to a modern framework',
  },
  {
    name: 'YUI',
    patterns: [/YUI (\d+\.\d+\.\d+)/, /yui[_-](\d+\.\d+\.\d+)/i],
    minSafe: null,
    eol: true,
    severity: 'error',
    notes: 'YUI is end-of-life since 2014. Migrate to modern alternatives',
  },
  {
    name: 'Dojo Toolkit',
    patterns: [/dojo version[:\s]+(\d+\.\d+\.\d+)/i, /dojo[_-](\d+\.\d+\.\d+)/i],
    minSafe: '1.17.0',
    severity: 'warn',
    notes: 'Dojo < 1.17 has known XSS and prototype pollution issues',
  },
  {
    name: 'Backbone.js',
    patterns: [/Backbone\.js (\d+\.\d+\.\d+)/, /backbone[_-](\d+\.\d+\.\d+)/i],
    minSafe: '1.4.1',
    severity: 'info',
    notes: 'Backbone.js is in maintenance mode. Consider a modern framework for new projects',
  },
  {
    name: 'Socket.io',
    patterns: [/socket\.io-(\d+\.\d+\.\d+)/i, /socket\.io@(\d+\.\d+\.\d+)/i],
    minSafe: '4.6.2',
    severity: 'warn',
    notes: 'Older Socket.io versions have ReDoS and authentication bypass vulnerabilities',
  },
];

function detectLibraries(content, filename) {
  const found = [];
  const fname = basename(filename || '');

  for (const lib of LIBRARY_DB) {
    let version = null;
    for (const pat of lib.patterns) {
      const m = content.match(pat) || fname.match(pat);
      if (m) { version = m[1]; break; }
    }
    if (!version) continue;

    const isEol      = lib.eol && (!lib.eolCheck || lib.eolCheck(version));
    const isOutdated = !lib.eol && lib.minSafe && semverLt(version, lib.minSafe);

    if (isEol) {
      found.push({ library: lib.name, version, status: 'eol', severity: lib.severity,
        message: `${lib.name} v${version} — ${lib.notes}` });
    } else if (isOutdated) {
      found.push({ library: lib.name, version, status: 'outdated', severity: lib.severity,
        message: `${lib.name} v${version} is outdated (safe: ≥${lib.minSafe}) — ${lib.notes}` });
    } else {
      // Detected and current — still record it so the summary is accurate
      found.push({ library: lib.name, version, status: 'ok', severity: 'ok',
        message: `${lib.name} v${version}${lib.minSafe ? `  (safe: ≥${lib.minSafe})` : '  (no minimum enforced)'}` });
    }
  }
  return found;
}

// ─── Code Rules ───────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();

const CODE_RULES = [
  { id: 'no-var',             category: 'modernize',  severity: 'warn',
    message: "Replace 'var' with 'let' or 'const'",
    test: (l) => /\bvar\s+\w/.test(l) },
  { id: 'loose-equality',     category: 'modernize',  severity: 'warn',
    message: "Loose equality '==' / '!=' — prefer '===' / '!=='",
    test: (l) => /[^=!<>=]==(?!=)/.test(l) || /(?<![!<>=])!=(?!=)/.test(l) },
  { id: 'eval',               category: 'security',   severity: 'error',
    message: "'eval()' — disables optimizations and is a security risk",
    test: (l) => /\beval\s*\(/.test(l) },
  { id: 'new-function',       category: 'security',   severity: 'error',
    message: "'new Function()' — dynamic code execution, same risks as eval",
    test: (l) => /\bnew\s+Function\s*\(/.test(l) },
  { id: 'with-statement',     category: 'deprecated', severity: 'error',
    message: "'with' statement — deprecated and forbidden in strict mode",
    test: (l) => /\bwith\s*\(/.test(l) },
  { id: 'document-write',     category: 'deprecated', severity: 'error',
    message: "'document.write()' — deprecated, blocks HTML parsing",
    test: (l) => /\bdocument\.write\s*\(/.test(l) },
  { id: 'innerhtml-assign',   category: 'security',   severity: 'warn',
    message: "'innerHTML' assignment — XSS risk if value is user-controlled",
    test: (l) => /\.innerHTML\s*\+?=(?!=)/.test(l) },
  { id: 'xmlhttprequest',     category: 'outdated',   severity: 'warn',
    message: "'XMLHttpRequest' — outdated, use fetch() instead",
    test: (l) => /\bXMLHttpRequest\b/.test(l) },
  { id: 'prototype-method',   category: 'modernize',  severity: 'info',
    message: "Prototype method assignment — consider ES6 class syntax",
    test: (l) => /\.\s*prototype\s*\.\s*\w+\s*=\s*function/.test(l) },
  { id: 'arguments-object',   category: 'modernize',  severity: 'info',
    message: "'arguments' object — use rest parameters (...args) instead",
    test: (l) => /[^.\w]arguments\b/.test(l) },
  { id: 'escape-unescape',    category: 'deprecated', severity: 'warn',
    message: "'escape()'/'unescape()' — use encodeURIComponent/decodeURIComponent",
    test: (l) => /\b(?:escape|unescape)\s*\(/.test(l) },
  { id: 'settimeout-string',  category: 'deprecated', severity: 'warn',
    message: "'setTimeout'/'setInterval' with string arg — behaves like eval",
    test: (l) => /\b(?:setTimeout|setInterval)\s*\(\s*['"`]/.test(l) },
  { id: 'jquery-ajax',        category: 'outdated',   severity: 'info',
    message: "jQuery AJAX ($.ajax/$.get/$.post) — consider native fetch()",
    test: (l) => /\$\s*\.\s*(?:ajax|get|post|getJSON|getScript)\s*\(/.test(l) },
  { id: 'new-array-object',   category: 'modernize',  severity: 'info',
    message: "'new Array()'/'new Object()' — prefer array/object literals",
    test: (l) => /\bnew\s+(?:Array|Object)\s*\(\s*\)/.test(l) },
  { id: 'object-assign-spread', category: 'modernize', severity: 'info',
    message: "'Object.assign({}, ...)' — consider object spread: { ...src }",
    test: (l) => /Object\.assign\s*\(\s*\{\s*\}/.test(l) },
  { id: 'define-getter-setter', category: 'deprecated', severity: 'error',
    message: "'__defineGetter__'/'__defineSetter__' — use Object.defineProperty",
    test: (l) => /\.__define(?:G|S)etter__\s*\(/.test(l) },
  { id: 'typeof-undefined',   category: 'modernize',  severity: 'info',
    message: "'typeof x === \"undefined\"' — prefer 'x === undefined'",
    test: (l) => /typeof\s+\w+\s*===?\s*['"]undefined['"]/.test(l) },
  { id: 'debugger',           category: 'quality',    severity: 'warn',
    message: "'debugger' statement — remove before committing",
    test: (l) => /\bdebugger\b/.test(l) },
  { id: 'alert-prompt',       category: 'outdated',   severity: 'info',
    message: "'alert()'/'confirm()'/'prompt()' — use custom UI dialogs in production",
    test: (l) => /\b(?:alert|confirm|prompt)\s*\(/.test(l) },
  { id: 'console-log',        category: 'quality',    severity: 'info',
    message: "'console.log()' — debug statement, remove before production",
    test: (l) => /\bconsole\.log\s*\(/.test(l) },
  { id: 'require-cjs',        category: 'modernize',  severity: 'info',
    message: "CommonJS 'require()' — consider ES module 'import' syntax",
    test: (l) => /\brequire\s*\(\s*['"`]/.test(l) },
  { id: 'sync-xhr',           category: 'deprecated', severity: 'error',
    message: "Synchronous XHR ('false' as 3rd arg) — freezes the browser",
    test: (l) => /\.open\s*\([^)]+,\s*false\s*\)/.test(l) },
  { id: 'hardcoded-creds',    category: 'security',   severity: 'error',
    message: "Possible hardcoded credential — move to environment variables",
    test: (l) => /(?:password|passwd|secret|api_?key|auth_?token)\s*[:=]\s*['"`][^'"`]{4,}/i.test(l) },
  { id: 'iife',               category: 'modernize',  severity: 'info',
    message: "IIFE pattern — prefer ES modules for encapsulation",
    test: (l) => /\(\s*function\s*\(.*\)\s*\{/.test(l) && /\}\s*\)\s*\(/.test(l) },
];

// ─── Comment Rules (general) ──────────────────────────────────────────────────

const COMMENT_RULES = [
  { id: 'todo',         category: 'comment', severity: 'info',
    extract: (t) => { const m = t.match(/\bTODO\b[:\s-]*(.*)/i); return m ? `TODO: ${m[1].trim().slice(0, 70)}` : null; } },
  { id: 'fixme',        category: 'comment', severity: 'warn',
    extract: (t) => { const m = t.match(/\bFIXME\b[:\s-]*(.*)/i); return m ? `FIXME: ${m[1].trim().slice(0, 70)}` : null; } },
  { id: 'hack-xxx',     category: 'comment', severity: 'warn',
    extract: (t) => { const m = t.match(/\b(HACK|XXX)\b[:\s-]*(.*)/); return m ? `${m[1]}: ${m[2].trim().slice(0, 70)}` : null; } },
  { id: 'bug-marker',   category: 'comment', severity: 'error',
    extract: (t) => { const m = t.match(/\bBUG\b[:\s]/); return m ? 'BUG marker in comment' : null; } },
  { id: 'old-year',     category: 'comment', severity: 'info',
    extract: (t) => {
      const m = t.match(/\b(20[0-1]\d|199\d)\b/);
      return (m && parseInt(m[1]) < CURRENT_YEAR - 2) ? `Outdated year ${m[1]} — may need updating` : null;
    } },
  { id: 'deprecated-ref', category: 'comment', severity: 'warn',
    extract: (t) => { const m = t.match(/\b(@deprecated|deprecated|obsolete)\b/i); return m ? `Deprecated reference: "${m[1]}"` : null; } },
  { id: 'commented-code', category: 'comment', severity: 'info',
    extract: (t) => {
      const p = [/\b(?:var|let|const)\s+\w+\s*=/, /function\s+\w+\s*\(/, /\w+\s*\([^)]{0,40}\)\s*;/, /if\s*\(.+\)\s*[{]/, /=>\s*[{(]/, /\breturn\b.+;/];
      return p.some(r => r.test(t)) ? 'Possible commented-out code — use version control instead' : null;
    } },
  { id: 'empty-comment', category: 'comment', severity: 'info',
    extract: (t) => /^\/\/\s*$/.test(t.trim()) ? 'Empty comment — remove or add content' : null },
];

// ─── Vulnerable Comment Rules ─────────────────────────────────────────────────

const VULN_COMMENT_RULES = [
  {
    id: 'cred-in-comment',
    message: 'Possible credential in comment',
    test: (t) => /(?:password|passwd|pwd|secret|api[-_]?key|auth[-_]?token|access[-_]?token|private[-_]?key)\s*[=:]\s*\S{4,}/i.test(t),
  },
  {
    id: 'token-in-comment',
    message: 'Possible API key or token value in comment',
    test: (t) => /(?:key|token|secret|bearer)\s*[=:]\s*[a-zA-Z0-9+/=_\-]{20,}/i.test(t),
  },
  {
    id: 'private-key-fragment',
    message: 'Private key block in comment — never commit keys to source',
    test: (t) => /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(t),
  },
  {
    id: 'conn-string',
    message: 'Database/service connection string in comment',
    test: (t) => /(?:mongodb|mysql|postgres|mssql|redis|amqp):\/\/[^\s*]+/i.test(t),
  },
  {
    id: 'security-bypass',
    message: 'Comment indicates authentication or validation was bypassed',
    test: (t) => /(?:skip|bypass|disable|disabled|no|removed?)\s+(?:auth(?:entication|orization|enti[cs]ation)?|login\s+check|csrf|validation|sanitiz|security\s+check)/i.test(t),
  },
  {
    id: 'todo-auth',
    message: 'TODO comment about missing authentication/authorization',
    test: (t) => /\b(?:TODO|FIXME)\b.*(?:add|implement|fix|check)\s+(?:auth|login|permission|access\s+control|csrf|validation)/i.test(t),
  },
  {
    id: 'internal-ip',
    message: 'Internal IP address in comment — may expose network topology',
    test: (t) => /\b(?:10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/.test(t),
  },
  {
    id: 'no-sanitize',
    message: "Comment indicates input is not sanitized — verify this is intentional",
    test: (t) => /(?:no|not|without|skip|don'?t)\s+(?:sanitize|sanitise|escape|encode|validate)/i.test(t),
  },
  {
    id: 'insecure-flag',
    message: 'Comment explicitly marks this code as insecure',
    test: (t) => /\b(?:insecure|vulnerable|unsafe|not\s+safe|dangerous|exploitable|attack\s+vector)\b/i.test(t),
  },
  {
    id: 'hardcoded-url-creds',
    message: 'URL with embedded credentials in comment',
    test: (t) => /https?:\/\/[^:@\s]+:[^@\s]+@/.test(t),
  },
];

// ─── Line parsers ─────────────────────────────────────────────────────────────

function findLineCommentStart(line) {
  let inStr = false, strChar = null;
  for (let i = 0; i < line.length - 1; i++) {
    const ch = line[i];
    if (inStr) { if (ch === '\\') { i++; continue; } if (ch === strChar) inStr = false; }
    else {
      if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strChar = ch; }
      else if (ch === '/' && line[i + 1] === '/') return i;
    }
  }
  return -1;
}

function findBlockCommentStart(line, from = 0) {
  let inStr = false, strChar = null;
  for (let i = from; i < line.length - 1; i++) {
    const ch = line[i];
    if (inStr) { if (ch === '\\') { i++; continue; } if (ch === strChar) inStr = false; }
    else {
      if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strChar = ch; }
      else if (ch === '/' && line[i + 1] === '*') return i;
    }
  }
  return -1;
}

// ─── Severity helpers ─────────────────────────────────────────────────────────

function sevLevel(s) { return s === 'error' ? 3 : s === 'warn' ? 2 : 1; }

function sevTag(s) {
  const lbl = s === 'error' ? 'ERROR' : s === 'warn' ? ' WARN' : ' INFO';
  return s === 'error' ? red(lbl) : s === 'warn' ? yellow(lbl) : cyan(lbl);
}

const VULN_TAG = bMag(' VULN');
const LIB_TAG  = {
  error: bRed(' LIB!'),
  warn:  yellow(' LIB '),
  info:  cyan('  LIB'),
};

// ─── Minified / bundled file detection ───────────────────────────────────────

// Rules that produce near-certain false positives in bundled/minified output
const MINIFIED_SKIP = new Set([
  'new-function',     // webpack/rollup use new Function() for module wrappers
  'hardcoded-creds',  // minifiers reuse names like 'secret', 'password' as locals
  'no-var',           // transpilers emit var in legacy bundles
  'loose-equality',   // too noisy on line 1 of a bundle
  'require-cjs',      // bundlers inline require() stubs
  'iife',             // every UMD bundle is an IIFE
  'arguments-object', // babel transpiles arrow fns back to arguments
  'typeof-undefined', // standard bundler guard pattern
  'console-log',      // minified code still has console calls
  'alert-prompt',     // too many false positives in UI code on one line
]);

function isMinified(content, filename) {
  const fname = basename(filename || '');
  // webpack / vite hash filenames: main.a4ffc839.js, chunk.ab12cd34.js
  if (/\.[a-f0-9]{7,}\.(m?js|cjs)$/i.test(fname)) return true;
  // explicit .min.js already caught by IGNORE_RE for local files, but handle URLs
  if (/\.min\.(m?js|cjs)$/i.test(fname)) return true;
  // very long first line = content all on one line = minified
  const firstNl = content.indexOf('\n');
  const firstLineLen = firstNl === -1 ? content.length : firstNl;
  return firstLineLen > 500;
}

// ─── Analyzer ─────────────────────────────────────────────────────────────────

function checkCode(code, lineNum, opts, skip = null) {
  return CODE_RULES
    .filter(r => !(skip && skip.has(r.id)))
    .filter(r => sevLevel(r.severity) >= sevLevel(opts.minSev || 'info') && r.test(code))
    .map(r => ({ line: lineNum, severity: r.severity, category: r.category, message: r.message, ruleId: r.id, type: 'code' }));
}

function checkComment(text, lineNum, opts) {
  const out = [];

  // General comment rules
  for (const rule of COMMENT_RULES) {
    if (sevLevel(rule.severity) < sevLevel(opts.minSev || 'info')) continue;
    const msg = rule.extract(text);
    if (msg) out.push({ line: lineNum, severity: rule.severity, category: rule.category, message: msg, ruleId: rule.id, type: 'comment' });
  }

  // Vulnerable comment rules (always shown at warn level or above)
  if (!opts.noVuln) {
    for (const rule of VULN_COMMENT_RULES) {
      if (sevLevel('warn') < sevLevel(opts.minSev || 'info')) continue;
      if (rule.test(text)) {
        out.push({ line: lineNum, severity: 'vuln', category: 'vuln-comment', message: rule.message, ruleId: rule.id, type: 'vuln' });
      }
    }
  }

  return out;
}

function analyzeContent(content, opts = {}, filename = '') {
  const minified = isMinified(content, filename);
  const skip     = minified ? MINIFIED_SKIP : null;

  const issues = [];
  const lines = content.split('\n');
  let inBlock = false, blockText = '', blockLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    let line = lines[i];

    if (inBlock) {
      const end = line.indexOf('*/');
      if (end !== -1) {
        blockText += '\n' + line.substring(0, end);
        inBlock = false;
        if (!opts.noComments) issues.push(...checkComment(blockText, blockLine, opts));
        blockText = '';
        line = line.substring(end + 2);
      } else { blockText += '\n' + line; continue; }
    }

    const bcStart = findBlockCommentStart(line);
    if (bcStart !== -1) {
      const bcEnd = line.indexOf('*/', bcStart + 2);
      if (bcEnd !== -1) {
        if (!opts.noComments) issues.push(...checkComment(line.substring(bcStart + 2, bcEnd), lineNum, opts));
        const code = line.substring(0, bcStart) + line.substring(bcEnd + 2);
        if (!opts.noOutdated && code.trim()) issues.push(...checkCode(code, lineNum, opts, skip));
      } else {
        blockText = line.substring(bcStart + 2); blockLine = lineNum; inBlock = true;
        const before = line.substring(0, bcStart);
        if (!opts.noOutdated && before.trim()) issues.push(...checkCode(before, lineNum, opts, skip));
      }
      continue;
    }

    const lcStart = findLineCommentStart(line);
    if (lcStart !== -1) {
      if (!opts.noOutdated && line.substring(0, lcStart).trim()) issues.push(...checkCode(line.substring(0, lcStart), lineNum, opts, skip));
      if (!opts.noComments) issues.push(...checkComment(line.substring(lcStart), lineNum, opts));
    } else {
      if (!opts.noOutdated && line.trim()) issues.push(...checkCode(line, lineNum, opts, skip));
    }
  }

  const libraries = opts.noLibraries ? [] : detectLibraries(content, filename);
  return { issues, libraries, minified };
}

// ─── Local file scanner ───────────────────────────────────────────────────────

const JS_EXTS     = new Set(['.js', '.mjs', '.cjs', '.jsx']);
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt', 'vendor', 'out', '.cache']);
const IGNORE_RE   = [/\.min\.[cm]?js$/, /\.bundle\.[cm]?js$/];

function scanFiles(dir, opts = {}) {
  const exts = opts.extensions || JS_EXTS;
  const results = [];
  function walk(cur) {
    let entries; try { entries = readdirSync(cur); } catch { return; }
    for (const e of entries) {
      if (e.startsWith('.')) continue;
      const full = join(cur, e);
      let stat; try { stat = statSync(full); } catch { continue; }
      if (stat.isDirectory()) { if (!IGNORE_DIRS.has(e)) walk(full); }
      else if (exts.has(extname(full)) && !IGNORE_RE.some(r => r.test(full))) results.push(full);
    }
  }
  const abs = resolve(dir);
  if (statSync(abs).isFile()) return [abs];
  walk(abs);
  return results.sort();
}

// ─── HTTP fetch ───────────────────────────────────────────────────────────────

function fetchRaw(url, cookieStr, redirects = 0) {
  return new Promise((res, rej) => {
    if (redirects > 5) return rej(new Error('Too many redirects'));
    let parsed; try { parsed = new URL(url); } catch { return rej(new Error(`Invalid URL: ${url}`)); }
    const lib = parsed.protocol === 'https:' ? httpsGet : httpGet;
    const headers = { 'User-Agent': 'jsintel/1.0.0', Accept: '*/*' };
    if (cookieStr) headers['Cookie'] = cookieStr;
    const req = lib({ hostname: parsed.hostname, path: parsed.pathname + parsed.search, headers }, (resp) => {
      if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
        fetchRaw(new URL(resp.headers.location, url).href, cookieStr, redirects + 1).then(res).catch(rej);
        return;
      }
      if (resp.statusCode !== 200) return rej(new Error(`HTTP ${resp.statusCode}`));
      let body = ''; resp.setEncoding('utf8');
      resp.on('data', c => body += c);
      resp.on('end', () => res(body));
    });
    req.on('error', rej);
    req.setTimeout(15000, () => { req.destroy(); rej(new Error('Timeout')); });
  });
}

// ─── Site crawler ─────────────────────────────────────────────────────────────

function extractScriptUrls(html, baseUrl) {
  const urls = new Set();
  const re = /<script[^>]+\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const src = (m[1] || m[2] || m[3]).trim();
    if (!src || src.startsWith('data:')) continue;
    try { urls.add(new URL(src, baseUrl).href); } catch { /* skip */ }
  }
  return [...urls];
}

function normalizeUrl(raw) {
  if (/^https?:\/\//i.test(raw)) return raw;
  return 'https://' + raw.replace(/^\/\//, '');
}

// Returns the registrable root domain (e.g. "example.co.uk" from "www.example.co.uk")
function rootDomain(hostname) {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return hostname;
  const parts = hostname.replace(/^www\./, '').split('.');
  const last = parts[parts.length - 1];
  const prev = parts[parts.length - 2] || '';
  // Two-part ccTLD heuristic: .co.uk, .com.au, .org.uk, etc.
  if (last.length <= 3 && prev.length <= 4 && parts.length > 2) return parts.slice(-3).join('.');
  return parts.slice(-2).join('.');
}

function isSameDomain(url, targetHostname) {
  try { return rootDomain(new URL(url).hostname) === rootDomain(targetHostname); }
  catch { return false; }
}

// ─── Cookie store ─────────────────────────────────────────────────────────────

const COOKIE_FILE = join(homedir(), '.jsintel', 'cookies.json');
function loadCookies() { try { return JSON.parse(readFileSync(COOKIE_FILE, 'utf8')); } catch { return {}; } }
function saveCookies(c) { mkdirSync(join(homedir(), '.jsintel'), { recursive: true }); writeFileSync(COOKIE_FILE, JSON.stringify(c, null, 2)); }
function cookieHeader(stored, domain) {
  const all = { ...(stored['*'] || {}), ...(stored[domain] || {}) };
  return Object.entries(all).map(([k, v]) => `${k}=${v}`).join('; ');
}

function cmdCookieSet(args) {
  let domain = '*', pair = args[0];
  if (args.length >= 2 && !args[0].includes('=')) { domain = args[0]; pair = args[1]; }
  const eq = pair?.indexOf('=');
  if (!pair || eq < 1) { console.error(red('Usage: jsintel cookie set [domain] name=value')); process.exit(1); }
  const c = loadCookies();
  (c[domain] = c[domain] || {})[pair.substring(0, eq)] = pair.substring(eq + 1);
  saveCookies(c);
  console.log(green(`Cookie set: ${bold(pair.substring(0, eq))} for ${bold(domain === '*' ? 'all domains' : domain)}`));
}

function cmdCookieList() {
  const c = loadCookies();
  if (!Object.keys(c).length) { console.log(gray('No cookies stored.  jsintel cookie set [domain] name=value')); return; }
  console.log(bold('\nStored cookies:'));
  for (const [d, p] of Object.entries(c)) {
    console.log(cyan(`  ${d === '*' ? '(all domains)' : d}`));
    for (const [k, v] of Object.entries(p)) console.log(`    ${bold(k)} = ${gray(v.length > 50 ? v.slice(0,47)+'...' : v)}`);
  }
  console.log();
}

function cmdCookieClear(args) {
  const c = loadCookies();
  if (!args.length) { saveCookies({}); console.log(green('All cookies cleared.')); return; }
  if (args[1]) { if (c[args[0]]) delete c[args[0]][args[1]]; }
  else delete c[args[0]];
  saveCookies(c);
  console.log(green(`Cleared cookies for ${args[0]}${args[1] ? ' → '+args[1] : ''}`));
}

// ─── Output ───────────────────────────────────────────────────────────────────

function printResult(label, libraries, issues, opts, minified = false) {
  const hasAnything = libraries.length > 0 || issues.length > 0;
  if (!hasAnything) return;

  const note = minified ? gray(' [bundled/minified — noisy rules skipped]') : '';
  console.log(bold(cyan('  ') + label) + note);

  // Library findings
  if (libraries.length) {
    console.log(`  ${bold('Libraries detected:')}`);
    for (const lib of libraries) {
      if (lib.status === 'ok') {
        console.log(`         ${green('   OK')}  ${green('✓')} ${lib.message}`);
      } else {
        const tag = LIB_TAG[lib.severity] || LIB_TAG.info;
        console.log(`         ${tag}  ${lib.message}`);
      }
    }
  }

  // Per-line issues
  for (const iss of issues) {
    const line = String(iss.line).padStart(5);
    const tag  = iss.type === 'vuln' ? VULN_TAG : sevTag(iss.severity);
    const cat  = opts.verbose ? gray(`[${iss.category}] `) : '';
    const rule = opts.verbose ? dim(` (${iss.ruleId})`) : '';
    console.log(`  ${gray(line)}  ${tag}  ${cat}${iss.message}${rule}`);
  }

  console.log();
}

function shortLabel(source) {
  if (/^https?:\/\//.test(source)) {
    try {
      const u = new URL(source);
      const parts = u.pathname.split('/').filter(Boolean);
      return parts.slice(-2).join('/') || u.hostname;
    } catch { return source; }
  }
  return source;
}

function printFinalSummary(stats, siteReports, allResults) {
  const W = 60;
  const line  = '═'.repeat(W);
  const dline = '─'.repeat(W);

  console.log('\n' + bold(cyan(line)));
  console.log(bold(cyan('  SCAN COMPLETE')));
  console.log(bold(cyan(line)));

  // ── Per-site breakdown ──
  for (const site of siteReports) {
    console.log();
    console.log(`  ${bold('Site:')}  ${cyan(site.url)}`);
    console.log(`  ${bold('Domain JS scanned:')}   ${bold(String(site.ownCount))}`);
    if (site.externalCount > 0) {
      const hosts = [...site.externalHosts].slice(0, 4).join(', ');
      const extra = site.externalHosts.size > 4 ? ` +${site.externalHosts.size - 4} more` : '';
      console.log(`  ${bold('External JS skipped:')} ${gray(String(site.externalCount))}  ${gray('(' + hosts + extra + ')')}`);
    }
  }

  // ── Collect issues grouped by severity ──
  const vulns  = [];
  const errors = [];
  const warns  = [];
  const infos  = [];

  for (const { source, issues } of allResults) {
    const label = shortLabel(source);
    for (const iss of issues) {
      const loc = `${label}:${iss.line}`;
      if (iss.type === 'vuln')           vulns.push({ loc, message: iss.message });
      else if (iss.severity === 'error') errors.push({ loc, message: iss.message });
      else if (iss.severity === 'warn')  warns.push({ loc, message: iss.message });
      else                               infos.push({ loc, message: iss.message });
    }
  }

  const maxLoc = (arr) => arr.reduce((m, e) => Math.max(m, e.loc.length), 0);

  function printGroup(arr, tag, colorFn) {
    const pad = maxLoc(arr);
    for (const { loc, message } of arr)
      console.log(`  ${gray(loc.padEnd(pad))}  ${tag}  ${colorFn(message)}`);
  }

  // ── Libraries (always shown) ──
  console.log('\n' + gray(dline));
  const detected = stats.libDetected;
  const badLibs  = stats.libDetails;

  if (detected.length > 0) {
    const okCount  = detected.filter(l => l.status === 'ok').length;
    const badCount = badLibs.length;
    const heading  = badCount > 0
      ? bold(`  Libraries — ${badCount} outdated / EOL, ${okCount} current`)
      : bold(`  Libraries — ${okCount} detected, all current`);
    console.log(heading);
    console.log(gray(dline));
    // Show problematic first, then ok
    for (const lib of [...badLibs, ...detected.filter(l => l.status === 'ok')]) {
      if (lib.status === 'ok') {
        console.log(`  ${green('   OK')}  ${green('✓')} ${gray(lib.message)}`);
      } else {
        const tag = lib.severity === 'error' ? bRed(' LIB!') : yellow('  LIB');
        console.log(`  ${tag}  ${lib.severity === 'error' ? bRed(lib.message) : yellow(lib.message)}`);
      }
    }
  } else {
    console.log(bold('  Libraries'));
    console.log(gray(dline));
    console.log(`  ${yellow('!')}  ${yellow('No library version signatures found in scanned files')}`);
    console.log(gray('     Detection relies on version banners inside JS comments'));
    console.log(gray('     e.g.  /*! jQuery v3.7.1 */  or  lodash v4.17.21'));
    console.log(gray('     Minified/bundled files with stripped comments will not be detected'));
  }

  // ── Vulnerable comments ──
  if (vulns.length > 0) {
    console.log('\n' + gray(dline));
    console.log(bold(`  ${bMag('VULN')} — Vulnerable Comments  (${vulns.length})`));
    console.log(gray(dline));
    printGroup(vulns, bMag('VULN'), bMag);
  }

  // ── Errors ──
  if (errors.length > 0) {
    console.log('\n' + gray(dline));
    console.log(bold(`  ${red('ERROR')} — Dangerous Code Patterns  (${errors.length})`));
    console.log(gray(dline));
    printGroup(errors, red('ERR '), red);
  }

  // ── Warnings ──
  if (warns.length > 0) {
    console.log('\n' + gray(dline));
    console.log(bold(`  ${yellow('WARN')} — Outdated Patterns  (${warns.length})`));
    console.log(gray(dline));
    printGroup(warns, yellow('WARN'), (s) => s);
  }

  // ── Info ──
  if (infos.length > 0) {
    console.log('\n' + gray(dline));
    console.log(bold(`  ${cyan('INFO')} — Modernisation Suggestions  (${infos.length})`));
    console.log(gray(dline));
    printGroup(infos, cyan('INFO'), cyan);
  }

  // ── Counts ──
  console.log('\n' + gray(dline));
  console.log(`  JS files scanned:    ${bold(String(stats.filesScanned))}`);
  console.log(`  Files with issues:   ${stats.filesWithIssues > 0 ? yellow(String(stats.filesWithIssues)) : green('0')}`);

  // ── Verdict ──
  const critical = stats.vulns + stats.errors + stats.libDetails.filter(l => l.severity === 'error').length;
  const clean    = stats.total === 0 && stats.libDetails.length === 0;
  console.log(gray(dline));
  if (clean) {
    console.log(bold(green('  ✓  No issues found — all clear!')));
  } else if (critical > 0) {
    console.log(bold(bRed(`  ✗  ${critical} critical issue${critical !== 1 ? 's' : ''} found — action required`)));
  } else {
    console.log(bold(yellow('  ⚠  Issues found — review recommended')));
  }
  console.log(bold(cyan(line)) + '\n');
}

function tallyResult(stats, libraries, issues) {
  const badLibs = libraries.filter(l => l.status !== 'ok');
  if (badLibs.length || issues.length) stats.filesWithIssues++;
  for (const lib of libraries) {
    stats.libDetected.push(lib);
    if (lib.status !== 'ok') {
      if (lib.severity === 'error') stats.libErrors++;
      else if (lib.severity === 'warn') stats.libWarns++;
      stats.libDetails.push(lib);
    }
  }
  for (const i of issues) {
    stats.total++;
    if (i.type === 'vuln')           stats.vulns++;
    else if (i.severity === 'error') stats.errors++;
    else if (i.severity === 'warn')  stats.warnings++;
    else                             stats.infos++;
  }
}

// ─── Help ─────────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
${bold(cyan('jsintel'))} v1.2.0 — JavaScript Intelligence Tool

${bold('Scan a website:')}
  jsintel ${cyan('-u')} example.com
  jsintel ${cyan('-u')} example.com ${cyan('-c')} "session=abc; token=xyz"

${bold('Scan local files:')}
  jsintel              current directory
  jsintel src/         a folder
  jsintel app.js       a single file

${bold('Options:')}
  ${cyan('-u, --url <url>')}         Crawl site, find & scan all JS files
  ${cyan('-c, --cookie <str>')}      Cookie for this run  (e.g. "k=v; k2=v2")
  ${cyan('--no-outdated')}           Skip outdated-pattern checks
  ${cyan('--no-comments')}           Skip comment analysis
  ${cyan('--no-vuln')}               Skip vulnerable-comment checks
  ${cyan('--no-libraries')}          Skip library version checks
  ${cyan('--severity <level>')}      info | warn | error  (default: info)
  ${cyan('--ext <exts>')}            File extensions  (default: js,mjs,cjs,jsx)
  ${cyan('--json')}                  JSON output
  ${cyan('-v, --verbose')}           Show rule IDs and categories
  ${cyan('-h, --help')}              Show this help

${bold('Checks performed:')}
  ${bRed(' LIB!')}  Outdated or end-of-life library detected (22 libraries)
  ${bMag(' VULN')}  Vulnerable comment (credentials, bypass, internal IPs…)
  ${red('ERROR')}  Dangerous code pattern (eval, document.write, hardcoded creds…)
  ${yellow(' WARN')}  Outdated code pattern (var, XMLHttpRequest, loose equality…)
  ${cyan(' INFO')}  Modernization suggestion

${bold('Saved cookies (persist across runs):')}
  jsintel cookie set example.com session=abc123
  jsintel cookie set TOKEN=xyz        applies to all domains
  jsintel cookie list
  jsintel cookie clear [domain] [name]
`);
}

// ─── Arg parser ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = {
    paths: [], siteUrls: [], noOutdated: false, noComments: false, noVuln: false,
    noLibraries: false, json: false, minSev: 'info', verbose: false,
    extensions: JS_EXTS, inlineCookie: null,
  };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    switch (arg) {
      case '-u': case '--url':       i++; if (argv[i]) opts.siteUrls.push(normalizeUrl(argv[i])); break;
      case '-c': case '--cookie':    i++; opts.inlineCookie = argv[i] || null; break;
      case '--no-outdated':          opts.noOutdated = true; break;
      case '--no-comments':          opts.noComments = true; break;
      case '--no-vuln':              opts.noVuln = true; break;
      case '--no-libraries':         opts.noLibraries = true; break;
      case '--json':                 opts.json = true; break;
      case '-v': case '--verbose':   opts.verbose = true; break;
      case '-h': case '--help':      printHelp(); process.exit(0); break;
      case '--severity':
        i++; if (['info','warn','error'].includes(argv[i])) opts.minSev = argv[i]; break;
      case '--ext':
        i++; opts.extensions = new Set((argv[i]||'').split(',').map(e => e.startsWith('.') ? e : '.'+e)); break;
      default:
        if (!arg.startsWith('-')) opts.paths.push(arg);
    }
    i++;
  }
  if (!opts.paths.length && !opts.siteUrls.length) opts.paths.push('.');
  return opts;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2);

  if (argv[0] === 'cookie') {
    const sub = argv[1], rest = argv.slice(2);
    if (sub === 'set')   { cmdCookieSet(rest); return; }
    if (sub === 'list')  { cmdCookieList();    return; }
    if (sub === 'clear') { cmdCookieClear(rest); return; }
    console.error(red(`Unknown cookie command: ${sub || '(none)'}`));
    process.exit(1);
  }

  const opts = parseArgs(argv);
  const stored = loadCookies();
  const allResults = [];
  const siteReports = [];
  const stats = { filesScanned: 0, filesWithIssues: 0, total: 0, vulns: 0, errors: 0, warnings: 0, infos: 0, libErrors: 0, libWarns: 0, libDetails: [], libDetected: [] };

  if (!opts.json) {
    console.log(bold(`\n${cyan('jsintel')} v1.2.0 — JavaScript Intelligence Tool`));
    console.log(gray('─'.repeat(56)));
  }

  // ── Site crawl mode (-u) ──
  for (const siteUrl of opts.siteUrls) {
    let domain; try { domain = new URL(siteUrl).hostname; } catch { domain = '*'; }
    const cookieStr = opts.inlineCookie ?? (cookieHeader(stored, domain) || undefined);

    if (!opts.json) {
      process.stdout.write(gray(`Crawling ${bold(siteUrl)}...`));
      if (cookieStr) process.stdout.write(gray(` [cookie: ${cookieStr.slice(0, 40)}${cookieStr.length > 40 ? '…' : ''}]`));
      process.stdout.write('\n');
    }

    let html;
    try { html = await fetchRaw(siteUrl, cookieStr); }
    catch (err) { console.error(red(`  Failed: ${err.message}`)); continue; }

    const allScripts = extractScriptUrls(html, siteUrl);

    // Split into domain-owned and external
    const ownScripts = allScripts.filter(u => isSameDomain(u, domain));
    const extScripts = allScripts.filter(u => !isSameDomain(u, domain));
    const externalHosts = new Set(extScripts.map(u => { try { return new URL(u).hostname; } catch { return u; } }));

    const siteReport = { url: siteUrl, ownCount: ownScripts.length, externalCount: extScripts.length, externalHosts };
    siteReports.push(siteReport);

    if (!opts.json) {
      console.log(gray(`  Domain JS:   ${bold(String(ownScripts.length))} file${ownScripts.length !== 1 ? 's' : ''} (scanning)`));
      if (extScripts.length) console.log(gray(`  External JS: ${extScripts.length} file${extScripts.length !== 1 ? 's' : ''} skipped  (${[...externalHosts].slice(0, 3).join(', ')}${externalHosts.size > 3 ? '…' : ''})`));
      console.log();
    }

    for (const jsUrl of ownScripts) {
      let content;
      try { content = await fetchRaw(jsUrl, cookieStr); }
      catch (err) { console.error(red(`  Skipping ${jsUrl} — ${err.message}`)); continue; }

      stats.filesScanned++;
      const { issues: raw, libraries, minified } = analyzeContent(content, opts, jsUrl);
      const issues = raw.filter(i => i.type === 'vuln' || sevLevel(i.severity) >= sevLevel(opts.minSev));
      tallyResult(stats, libraries, issues);
      allResults.push({ source: jsUrl, libraries, issues, minified });
      if (!opts.json) printResult(jsUrl, libraries, issues, opts, minified);
    }
  }

  // ── Local files ──
  const localFiles = [];
  for (const p of opts.paths) {
    if (!existsSync(p)) { console.error(red(`Path not found: ${p}`)); process.exit(1); }
    localFiles.push(...scanFiles(p, { extensions: opts.extensions }));
  }
  if (!opts.json && localFiles.length) console.log(gray(`Scanning ${localFiles.length} local file${localFiles.length !== 1 ? 's' : ''}...\n`));

  const cwd = resolve('.');
  for (const filePath of localFiles) {
    let content; try { content = readFileSync(filePath, 'utf8'); } catch { continue; }
    stats.filesScanned++;
    const { issues: raw, libraries, minified } = analyzeContent(content, opts, filePath);
    const issues = raw.filter(i => i.type === 'vuln' || sevLevel(i.severity) >= sevLevel(opts.minSev));
    tallyResult(stats, libraries, issues);
    allResults.push({ source: filePath, libraries, issues, minified });
    if (!opts.json) printResult(relative(cwd, filePath), libraries, issues, opts, minified);
  }

  // ── Output ──
  if (opts.json) {
    console.log(JSON.stringify({
      stats,
      siteReports: siteReports.map(s => ({ ...s, externalHosts: [...s.externalHosts] })),
      results: allResults.map(r => ({
        file: r.source.startsWith('/') ? relative(cwd, r.source) : r.source,
        libraries: r.libraries,
        issues: r.issues,
      })),
    }, null, 2));
  } else {
    printFinalSummary(stats, siteReports, allResults);
  }

  process.exit((stats.errors > 0 || stats.libErrors > 0 || stats.vulns > 0) ? 1 : 0);
}

main().catch(err => { console.error(red(`Fatal: ${err.message}`)); process.exit(1); });
