import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { checkProject, globToRegExp, parseRecord, parseYaml } from '../scripts/check-records.mjs';

const made = [];
const TODAY = { today: '2026-11-08' };

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pe-test-'));
  made.push(root);
  for (const [rel, text] of Object.entries(files)) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
  return root;
}

const codes = (root) => checkProject(root, TODAY).findings.map((f) => f.code);
const record = (body) => `---\n${body}\n---\n# Title\n`;

after(() => made.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

describe('parseYaml', () => {
  it('reads nested maps, lists and scalars', () => {
    const out = parseYaml('a: 1\nb:\n  c: true\n  d: [x, "y z"]\ne:\n  - p: 1\n    q: two\n  - r: 3\n# note\nf: text # trailing\n');
    assert.equal(out.a, 1);
    assert.equal(out.b.c, true);
    assert.deepEqual(out.b.d, ['x', 'y z']);
    assert.equal(out.e[0].q, 'two');
    assert.equal(out.e[1].r, 3);
    assert.equal(out.f, 'text');
  });

  it('reads flow maps and lists at the key indentation', () => {
    const out = parseYaml('floor: {}\nx: { a: 1 }\nl:\n- one\n- two\n');
    assert.deepEqual({ ...out.floor }, {});
    assert.equal(out.x.a, 1);
    assert.deepEqual(out.l, ['one', 'two']);
  });

  it('keeps colons and hashes inside quotes', () => {
    assert.equal(parseYaml('a: "b: c # d"').a, 'b: c # d');
  });

  it('is not vulnerable to prototype pollution', () => {
    parseYaml('__proto__:\n  polluted: true\n');
    assert.equal({}.polluted, undefined);
  });

  it('rejects unsupported syntax', () => {
    assert.throws(() => parseYaml('a: &anchor 1'));
    assert.throws(() => parseYaml('a: |\n  text'));
  });
});

describe('globToRegExp', () => {
  it('matches gitignore-like patterns', () => {
    assert.ok(globToRegExp('src/billing/**').test('src/billing/a/b.js'));
    assert.ok(!globToRegExp('src/*.js').test('src/a/b.js'));
    assert.ok(globToRegExp('**/*.sql').test('a/b/c.sql'));
    assert.ok(globToRegExp('**/*.sql').test('c.sql'));
    assert.ok(globToRegExp('src/*.{js,ts}').test('src/a.ts'));
    assert.ok(!globToRegExp('a.b').test('axb'));
  });
});

describe('parseRecord', () => {
  it('reads frontmatter and Nygard or inline status', () => {
    assert.equal(parseRecord(record('status: accepted')).status, 'accepted');
    assert.equal(parseRecord('# T\n\n## Status\n\nAccepted\n').status, 'Accepted');
    assert.equal(parseRecord('# T\n\n**Status:** Proposed\n').status, 'Proposed');
    assert.equal(parseRecord('---\r\nstatus: rejected\r\n---\r\n# T\r\n').status, 'rejected');
  });
});

describe('checkProject', () => {
  it('accepts a project without records or configuration', () => {
    assert.deepEqual(codes(project({ 'a.txt': 'x' })), ['TRIAGE_MISSING']);
  });

  it('finds records through the existing convention', () => {
    const root = project({ '.adr-dir': 'architecture/log\n', 'architecture/log/0001-a.md': record('status: accepted') });
    const out = checkProject(root, TODAY);
    assert.deepEqual(out.recordDirs, ['architecture/log']);
    assert.equal(out.recordCount, 1);
  });

  it('flags bad status, duplicates and broken supersession', () => {
    const c = codes(project({
      'docs/adr/0001-a.md': record('status: maybe'),
      'docs/adr/0001-b.md': record('status: accepted'),
      'docs/adr/0002-c.md': record('status: superseded by 0099'),
      'docs/adr/README.md': 'not a record',
    }));
    assert.ok(c.includes('BAD_STATUS'));
    assert.ok(c.includes('DUPLICATE_ID'));
    assert.ok(c.includes('BROKEN_SUPERSEDES'));
  });

  it('flags overdue reviews, expired exceptions and orphaned scopes', () => {
    const c = codes(project({
      'src/a.js': 'x',
      'docs/adr/0001-a.md': record([
        'status: accepted', 'proactive:', '  review_after: 2026-01-01', '  scope:', '    paths: ["missing/**"]',
        '  exceptions:', '    - path: "src/a.js"', '      expires: 2026-02-01',
      ].join('\n')),
    }));
    for (const code of ['REVIEW_DUE', 'EXCEPTION_EXPIRED', 'ORPHAN_SCOPE']) assert.ok(c.includes(code), code);
  });

  it('checks that enforcement has a matching permission rule', () => {
    const rec = record('status: accepted\nproactive:\n  enforcement: ask\n  scope:\n    paths: ["src/**"]');
    assert.ok(codes(project({ 'src/a.js': 'x', 'docs/adr/0001-a.md': rec })).includes('ASK_WITHOUT_RULE'));
    const settings = JSON.stringify({ permissions: { ask: ['Edit(/src/**)'] } });
    assert.ok(!codes(project({ 'src/a.js': 'x', 'docs/adr/0001-a.md': rec, '.claude/settings.json': settings })).includes('ASK_WITHOUT_RULE'));
  });

  it('validates configuration and the floor', () => {
    const c = codes(project({
      '.proactive/config.yaml': 'profile: loud\nmystery: 1\nfloor:\n  db_migration: ask\n',
      '.proactive/config.local.yaml': 'actions:\n  db_migration: silent\n',
    }));
    assert.ok(c.includes('CONFIG_VALUE'));
    assert.ok(c.includes('CONFIG_KEY'));
    assert.ok(c.includes('BELOW_FLOOR'));
  });

  it('accepts the shipped configuration template', () => {
    const setup = fs.readFileSync(new URL('../skills/setup/SKILL.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const template = /```yaml\n([\s\S]*?)```/.exec(setup)[1];
    const c = codes(project({ '.proactive/config.yaml': template }));
    assert.deepEqual(c, ['TRIAGE_MISSING']);
  });

  it('refuses a records folder outside the project', () => {
    const c = codes(project({ '.proactive/config.yaml': 'records:\n  dir: ../outside\n' }));
    assert.ok(c.includes('RECORDS_DIR'));
  });

  it('reports malformed records and keeps going', () => {
    const c = codes(project({ 'docs/adr/0001-a.md': record('status: &x y'), 'docs/adr/0002-b.md': record('status: maybe') }));
    assert.ok(c.includes('RECORD_PARSE'));
    assert.ok(c.includes('BAD_STATUS'));
  });

  it('passes on the shipped example', () => {
    const root = fileURLToDir('../examples/shop-api');
    const out = checkProject(root, TODAY);
    assert.deepEqual(out.findings, []);
    assert.equal(out.recordCount, 2);
  });
});

function fileURLToDir(rel) {
  return path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), rel);
}
