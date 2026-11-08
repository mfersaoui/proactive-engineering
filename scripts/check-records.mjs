#!/usr/bin/env node
// Checks decision records and Proactive Engineering configuration.
// Zero dependencies, makes no network or model calls, and never writes files.
// Exit codes: 0 no errors, 1 errors found, 2 usage or environment problem.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_FILE_BYTES = 1024 * 1024;
const MAX_WALK_FILES = 200000;
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'vendor', 'target', '.venv', '__pycache__']);
const RECORD_DIRS = ['docs/adr', 'docs/decisions', 'doc/adr', 'docs/architecture/decisions', 'adr'];
const NON_RECORDS = /^(readme|index|template|adr-template)(\..*)?\.md$/i;
const STATUSES = new Set(['proposed', 'accepted', 'rejected', 'deprecated', 'superseded']);
const STRICTNESS = ['silent', 'inform', 'ask', 'propose_only', 'forbid'];
const ACTIONS = new Set([
  'add_dependency', 'change_public_api', 'change_data_model', 'change_auth',
  'change_infrastructure', 'db_migration', 'destructive', 'production',
]);
const TRIAGE_FILE = '.claude/rules/engineering-triage.md';
const TRIAGE_MARKER = 'proactive-engineering:triage v1';

export class YamlError extends Error {}

function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

function splitFlow(body) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let cur = '';
  for (const c of body) {
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if ('[{'.includes(c)) {
      depth++;
    } else if (']}'.includes(c)) {
      depth--;
    } else if (c === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((p) => p.trim());
}

function findColon(text) {
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === ':' && (i + 1 === text.length || text[i + 1] === ' ')) {
      return i;
    }
  }
  return -1;
}

function parseScalar(raw) {
  const v = raw.trim();
  if (/^[&*|>!]/.test(v)) throw new YamlError(`unsupported YAML syntax: ${v.slice(0, 20)}`);
  if (v.startsWith('[') && v.endsWith(']')) return splitFlow(v.slice(1, -1)).map(parseScalar);
  if (v.startsWith('{') && v.endsWith('}')) {
    const out = Object.create(null);
    for (const part of splitFlow(v.slice(1, -1))) {
      const at = findColon(part);
      if (at < 0) throw new YamlError(`bad flow mapping entry: ${part.slice(0, 20)}`);
      out[parseScalar(part.slice(0, at))] = parseScalar(part.slice(at + 1));
    }
    return out;
  }
  if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v.at(-1) === v[0]) return v.slice(1, -1);
  if (v === '' || v === 'null' || v === '~') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

/** Parses the small YAML subset used by records and configuration. */
export function parseYaml(text) {
  const lines = [];
  text.replace(/\r\n/g, '\n').split('\n').forEach((raw) => {
    if (/^\t| \t/.test(raw)) throw new YamlError('tabs are not allowed for indentation');
    const line = stripComment(raw).trimEnd();
    if (line.trim()) lines.push({ indent: line.length - line.trimStart().length, text: line.trim() });
  });
  let pos = 0;

  function parseValue(rest, indent) {
    if (rest.trim() !== '') return parseScalar(rest);
    const next = lines[pos];
    const isList = next && next.text.startsWith('- ') && next.indent >= indent;
    if (next && (next.indent > indent || isList)) return parseBlock(next.indent);
    return null;
  }

  function parseMapEntry(target, text, indent) {
    const at = findColon(text);
    if (at < 0) throw new YamlError(`expected "key: value": ${text.slice(0, 30)}`);
    const key = String(parseScalar(text.slice(0, at)));
    target[key] = parseValue(text.slice(at + 1), indent);
  }

  function parseBlock(indent) {
    if (lines[pos].text.startsWith('- ') || lines[pos].text === '-') {
      const list = [];
      while (pos < lines.length && lines[pos].indent === indent && lines[pos].text.startsWith('-')) {
        const item = lines[pos].text.slice(1).trimStart();
        pos++;
        const isMap = findColon(item) > 0 && !/^["'[{]/.test(item);
        if (!isMap) {
          list.push(parseScalar(item));
          continue;
        }
        const entry = Object.create(null);
        const inner = indent + 2;
        parseMapEntry(entry, item, inner);
        while (pos < lines.length && lines[pos].indent === inner && !lines[pos].text.startsWith('- ')) {
          const { text } = lines[pos];
          pos++;
          parseMapEntry(entry, text, inner);
        }
        list.push(entry);
      }
      return list;
    }
    const map = Object.create(null);
    while (pos < lines.length && lines[pos].indent === indent && !lines[pos].text.startsWith('- ')) {
      const { text } = lines[pos];
      pos++;
      parseMapEntry(map, text, indent);
    }
    return map;
  }

  if (lines.length === 0) return Object.create(null);
  const out = parseBlock(lines[0].indent);
  if (pos < lines.length) throw new YamlError(`unexpected indentation: ${lines[pos].text.slice(0, 30)}`);
  return out;
}

/** Converts a gitignore-like glob to a regular expression. */
export function globToRegExp(glob) {
  let g = glob.replace(/\\/g, '/').replace(/^\.?\//, '');
  if (g.endsWith('/')) g += '**';
  let re = '';
  let braces = 0;
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') {
        i++;
        if (g[i + 1] === '/') {
          i++;
          re += '(?:[^/]+/)*';
        } else {
          re += '.*';
        }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if (c === '{') {
      braces++;
      re += '(?:';
    } else if (c === '}' && braces > 0) {
      braces--;
      re += ')';
    } else if (c === ',' && braces > 0) {
      re += '|';
    } else {
      re += c.replace(/[.+^$()|[\]\\{}]/g, '\\$&');
    }
  }
  if (braces !== 0) throw new Error(`unbalanced braces in glob: ${glob}`);
  return new RegExp(`^${re}$`);
}

function readText(file) {
  if (fs.statSync(file).size > MAX_FILE_BYTES) throw new Error('file too large');
  return fs.readFileSync(file, 'utf8');
}

function listFiles(root) {
  const out = [];
  const stack = [''];
  while (stack.length && out.length < MAX_WALK_FILES) {
    const rel = stack.pop();
    for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const child = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory() && !SKIP_DIRS.has(e.name)) stack.push(child);
      else if (e.isFile()) out.push(child);
    }
  }
  return out;
}

function inside(root, rel) {
  const abs = path.resolve(root, rel);
  const back = path.relative(root, abs);
  return back === '' || (!back.startsWith('..') && !path.isAbsolute(back));
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function loadConfigFile(root, rel, report) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return null;
  try {
    const cfg = parseYaml(readText(file));
    if (Array.isArray(cfg)) throw new YamlError('configuration must be a mapping');
    return cfg;
  } catch (err) {
    report('error', 'CONFIG_PARSE', rel, err.message);
    return null;
  }
}

function checkEnum(report, rel, name, value, allowed) {
  if (value !== undefined && value !== null && !allowed.includes(value)) {
    report('error', 'CONFIG_VALUE', rel, `${name} must be one of: ${allowed.join(', ')}`);
  }
}

function checkConfig(cfg, rel, report) {
  const known = new Set(['profile', 'intensity', 'interruptions', 'research', 'records', 'journal', 'actions', 'floor']);
  for (const key of Object.keys(cfg)) if (!known.has(key)) report('warning', 'CONFIG_KEY', rel, `unknown key: ${key}`);
  checkEnum(report, rel, 'profile', cfg.profile, ['observer', 'balanced', 'driver']);
  checkEnum(report, rel, 'intensity.max', cfg.intensity?.max, [1, 2, 3]);
  checkEnum(report, rel, 'interruptions.timing', cfg.interruptions?.timing, ['boundaries', 'immediate']);
  checkEnum(report, rel, 'research.web', cfg.research?.web, ['allow', 'ask', 'never']);
  const perSession = cfg.interruptions?.per_session;
  if (perSession !== undefined && perSession !== null && !(Number.isInteger(perSession) && perSession >= 0)) {
    report('error', 'CONFIG_VALUE', rel, 'interruptions.per_session must be a non-negative integer');
  }
  if (cfg.journal !== undefined && typeof cfg.journal !== 'boolean') {
    report('error', 'CONFIG_VALUE', rel, 'journal must be true or false');
  }
  for (const section of ['actions', 'floor']) {
    for (const [action, level] of Object.entries(cfg[section] ?? {})) {
      if (!ACTIONS.has(action)) report('warning', 'CONFIG_KEY', rel, `unknown action category: ${action}`);
      checkEnum(report, rel, `${section}.${action}`, level, STRICTNESS);
    }
  }
}

function checkFloor(project, local, report) {
  const floor = project?.floor ?? {};
  const below = (rel, actions) => {
    for (const [action, level] of Object.entries(actions ?? {})) {
      if (floor[action] && STRICTNESS.indexOf(level) < STRICTNESS.indexOf(floor[action])) {
        report('error', 'BELOW_FLOOR', rel, `actions.${action} (${level}) is below the floor (${floor[action]})`);
      }
    }
  };
  below('.proactive/config.yaml', project?.actions);
  below('.proactive/config.local.yaml', local?.actions);
}

/** Locates the record folders, honouring existing conventions first. */
export function findRecordDirs(root, config, report) {
  const configured = config?.records?.dir;
  if (configured && configured !== 'auto') {
    if (!inside(root, configured)) {
      report('error', 'RECORDS_DIR', '.proactive/config.yaml', 'records.dir must stay inside the project');
      return [];
    }
    if (isDir(path.join(root, configured))) return [configured];
    report('error', 'RECORDS_DIR', '.proactive/config.yaml', `records.dir not found: ${configured}`);
    return [];
  }
  const marker = path.join(root, '.adr-dir');
  if (fs.existsSync(marker)) {
    const dir = readText(marker).trim();
    if (inside(root, dir) && isDir(path.join(root, dir))) return [dir];
  }
  const found = RECORD_DIRS.find((d) => isDir(path.join(root, d)));
  return found ? [found] : [];
}

/** Reads metadata from YAML frontmatter, or from a Status section. */
export function parseRecord(text) {
  const src = text.replace(/\r\n/g, '\n');
  const fm = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(src);
  if (fm) return parseYaml(fm[1]);
  const section = /^##+\s*Status\s*\n+\s*([^\n]+)/im.exec(src);
  const inline = /^\s*\**Status\**\s*:\s*\**\s*([^\n*]+)/im.exec(src);
  const status = (section?.[1] ?? inline?.[1] ?? '').trim();
  return Object.assign(Object.create(null), status ? { status } : {});
}

function recordNumber(name) {
  const m = /^(?:adr[-_]?)?(\d+)/i.exec(name);
  return m ? Number(m[1]) : null;
}

function checkRecord(rec, ctx, report) {
  const { rel, meta } = rec;
  const raw = meta.status;
  if (raw === undefined || raw === null || raw === '') {
    report('warning', 'NO_STATUS', rel, 'no status found');
  } else {
    const status = String(raw).toLowerCase();
    const word = status.split(/\s+/)[0];
    if (!STATUSES.has(word)) report('error', 'BAD_STATUS', rel, `unknown status: ${raw}`);
    const target = /superseded by\s+(?:adr[-_ ]?)?(\d+)/i.exec(status);
    if (word === 'superseded' && target && !ctx.numbers.has(Number(target[1]))) {
      report('error', 'BROKEN_SUPERSEDES', rel, `superseding record not found: ${target[1]}`);
    }
  }
  const extra = meta.proactive;
  if (!extra) return;
  const active = String(raw ?? '').toLowerCase() === 'accepted';
  if (extra.review_after && String(extra.review_after) < ctx.today && active) {
    report('warning', 'REVIEW_DUE', rel, `review was due on ${extra.review_after}`);
  }
  for (const ex of extra.exceptions ?? []) {
    if (ex?.expires && String(ex.expires) < ctx.today) {
      report('warning', 'EXCEPTION_EXPIRED', rel, `exception on ${ex.path ?? '?'} expired on ${ex.expires}`);
    }
  }
  const paths = extra.scope?.paths;
  if (paths === undefined || paths === null) return;
  if (!Array.isArray(paths)) {
    report('error', 'BAD_SCOPE', rel, 'proactive.scope.paths must be a list');
    return;
  }
  if (!active) return;
  for (const glob of paths) {
    let re;
    try {
      re = globToRegExp(String(glob));
    } catch (err) {
      report('error', 'BAD_SCOPE', rel, err.message);
      continue;
    }
    if (!ctx.files().some((f) => re.test(f))) report('warning', 'ORPHAN_SCOPE', rel, `no file matches ${glob}`);
    const clean = String(glob).replace(/^\.?\//, '');
    if (extra.enforcement === 'ask' && !ctx.askRules.has(clean)) {
      report('warning', 'ASK_WITHOUT_RULE', rel, `no permissions.ask rule for Edit(/${clean})`);
    }
  }
}

function loadAskRules(root, report) {
  const rules = new Set();
  const rel = '.claude/settings.json';
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return rules;
  try {
    for (const rule of JSON.parse(readText(file)).permissions?.ask ?? []) {
      const m = /^Edit\(\.?\/?(.+)\)$/.exec(rule);
      if (m) rules.add(m[1]);
    }
  } catch (err) {
    report('warning', 'SETTINGS_PARSE', rel, err.message);
  }
  return rules;
}

function checkTriage(root, report) {
  const file = path.join(root, TRIAGE_FILE);
  if (!fs.existsSync(file)) {
    report('info', 'TRIAGE_MISSING', TRIAGE_FILE, 'automatic triggering needs this rule; run /proactive-engineering:setup');
  } else if (!readText(file).includes(TRIAGE_MARKER)) {
    report('warning', 'TRIAGE_OUTDATED', TRIAGE_FILE, 'rule differs from the current version; run /proactive-engineering:setup');
  }
}

/** Runs every check on a project and returns its findings. */
export function checkProject(root, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const findings = [];
  const report = (level, code, file, message) => findings.push({ level, code, file, message });
  const project = loadConfigFile(root, '.proactive/config.yaml', report);
  const local = loadConfigFile(root, '.proactive/config.local.yaml', report);
  if (project) checkConfig(project, '.proactive/config.yaml', report);
  if (local) checkConfig(local, '.proactive/config.local.yaml', report);
  checkFloor(project, local, report);
  checkTriage(root, report);

  const records = [];
  const dirs = findRecordDirs(root, project, report);
  for (const dir of dirs) {
    for (const name of fs.readdirSync(path.join(root, dir)).sort()) {
      if (!name.toLowerCase().endsWith('.md') || NON_RECORDS.test(name)) continue;
      const rel = `${dir}/${name}`.replace(/\\/g, '/');
      try {
        records.push({ rel, name, meta: parseRecord(readText(path.join(root, rel))) });
      } catch (err) {
        report('error', 'RECORD_PARSE', rel, err.message);
      }
    }
  }
  const seen = new Map();
  for (const rec of records) {
    const n = recordNumber(rec.name);
    if (n === null) continue;
    if (seen.has(n)) report('error', 'DUPLICATE_ID', rec.rel, `same number as ${seen.get(n)}`);
    else seen.set(n, rec.rel);
  }
  let cached;
  const ctx = {
    today,
    numbers: new Set(seen.keys()),
    askRules: loadAskRules(root, report),
    files: () => (cached ??= listFiles(root)),
  };
  for (const rec of records) checkRecord(rec, ctx, report);
  return { recordDirs: dirs, recordCount: records.length, findings };
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), json: false, strict: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') opts.root = argv[++i];
    else if (a === '--today') opts.today = argv[++i];
    else if (a === '--json') opts.json = true;
    else if (a === '--strict') opts.strict = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else throw new Error(`unknown option: ${a}`);
  }
  if (!opts.root) throw new Error('--root needs a path');
  return opts;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    return 2;
  }
  if (opts.help) {
    console.log('Usage: check-records.mjs [--root DIR] [--json] [--strict] [--today YYYY-MM-DD]');
    return 0;
  }
  const root = path.resolve(opts.root);
  if (!isDir(root)) {
    console.error(`not a directory: ${root}`);
    return 2;
  }
  const result = checkProject(root, opts.today ? { today: opts.today } : {});
  const count = (level) => result.findings.filter((f) => f.level === level).length;
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const f of result.findings) console.log(`${f.level.toUpperCase()} ${f.code} ${f.file}: ${f.message}`);
    console.log(`${result.recordCount} record(s), ${count('error')} error(s), ${count('warning')} warning(s)`);
  }
  return count('error') > 0 || (opts.strict && count('warning') > 0) ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main();
}
