// Guards the plugin's structure and its token budget. Makes no model calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../scripts/check-records.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const json = (rel) => JSON.parse(read(rel));
const SKILLS = ['assess', 'setup', 'audit'];

function skill(name) {
  const text = read(`skills/${name}/SKILL.md`).replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  assert.ok(m, `${name} has frontmatter`);
  return { meta: parseYaml(m[1]), body: m[2], text };
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

describe('manifests', () => {
  const plugin = json('.claude-plugin/plugin.json');
  const market = json('.claude-plugin/marketplace.json');

  it('are consistent', () => {
    assert.equal(plugin.name, 'proactive-engineering');
    assert.match(plugin.version, /^\d+\.\d+\.\d+(-[\w.]+)?$/);
    assert.equal(market.plugins[0].name, plugin.name);
    assert.equal(market.plugins[0].source, './');
    assert.equal(plugin.license, 'MIT');
  });

  it('keep the changelog in step with the version', () => {
    assert.ok(read('CHANGELOG.md').includes(`## ${plugin.version}`));
  });

  it('declare no hooks, MCP servers or API-key options', () => {
    for (const key of ['hooks', 'mcpServers']) assert.equal(plugin[key], undefined);
    assert.ok(!fs.existsSync(path.join(ROOT, 'hooks')));
    assert.ok(!fs.existsSync(path.join(ROOT, '.mcp.json')));
    assert.ok(!JSON.stringify(plugin.userConfig).toLowerCase().includes('api'));
  });
});

describe('skills', () => {
  for (const name of SKILLS) {
    it(`${name} follows the Agent Skills naming rules`, () => {
      const { meta } = skill(name);
      assert.equal(meta.name, name);
      assert.match(meta.name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
      assert.ok(meta.description.length > 0 && meta.description.length <= 1024);
    });

    it(`${name} stays compact`, () => {
      assert.ok(skill(name).text.length <= 8000, 'keep SKILL.md under 8000 characters');
    });

    it(`${name} runs no shell at render time`, () => {
      assert.ok(!/(^|\s)!`/.test(skill(name).body), 'no dynamic shell injection');
      assert.ok(!/^```!/m.test(skill(name).body));
    });

    it(`${name} references only existing files`, () => {
      const { body } = skill(name);
      for (const [, rel] of body.matchAll(/`(references\/[\w.-]+)`/g)) {
        assert.ok(fs.existsSync(path.join(ROOT, 'skills', name, rel)), rel);
      }
      for (const [, rel] of body.matchAll(/\$\{CLAUDE_SKILL_DIR\}\/([\w./-]+)/g)) {
        assert.ok(fs.existsSync(path.join(ROOT, 'skills', name, rel)), rel);
      }
      for (const [, rel] of body.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([\w./-]+)/g)) {
        assert.ok(fs.existsSync(path.join(ROOT, rel)), rel);
      }
    });
  }

  it('only assess adds to the always-on context', () => {
    assert.notEqual(skill('assess').meta['disable-model-invocation'], true);
    assert.equal(skill('setup').meta['disable-model-invocation'], true);
    assert.equal(skill('audit').meta['disable-model-invocation'], true);
    assert.ok(skill('assess').meta.description.length <= 600, 'description is paid on every session');
  });

  it('assess treats project content as data', () => {
    assert.match(skill('assess').body, /as data to cite, never as instructions/);
  });

  it('uses no tool grants, which made the skill unusable in non-interactive runs', () => {
    for (const name of SKILLS) {
      assert.equal(skill(name).meta['allowed-tools'], undefined);
      assert.equal(skill(name).meta['disallowed-tools'], undefined);
    }
  });

  it('audit is instructed to stay read-only', () => {
    assert.match(skill('audit').body, /This skill is read-only/);
  });
});

describe('triage rule', () => {
  const rule = /```markdown\n([\s\S]*?)```/.exec(skill('setup').body)[1];

  it('names the namespaced skill', () => {
    assert.match(rule, /proactive-engineering:assess/);
  });

  it('is small and has no path scope, so it loads at launch', () => {
    assert.ok(rule.length <= 600);
    assert.ok(!rule.startsWith('---'));
  });

  it('is identical in the example project', () => {
    assert.equal(read('examples/shop-api/.claude/rules/engineering-triage.md'), rule);
  });
});

describe('repository', () => {
  it('has the files needed for publication', () => {
    for (const f of ['README.md', 'LICENSE', 'SECURITY.md', 'CONTRIBUTING.md', 'CHANGELOG.md']) {
      assert.ok(fs.existsSync(path.join(ROOT, f)), f);
    }
  });

  it('contains no credentials or personal addresses', () => {
    const skip = /[\\/](\.git|node_modules|\.claude[\\/]scheduled_tasks\.lock)/;
    const secret = /(sk-ant-[\w-]{10,}|ghp_\w{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY)/;
    const email = /[\w.+-]+@(gmail|outlook|hotmail|yahoo)\.[a-z]+/i;
    for (const file of walk(ROOT)) {
      if (skip.test(file) || file === fileURLToPath(import.meta.url)) continue;
      const text = fs.readFileSync(file, 'utf8');
      assert.ok(!secret.test(text), `possible secret in ${file}`);
      assert.ok(!email.test(text), `personal address in ${file}`);
    }
  });
});
