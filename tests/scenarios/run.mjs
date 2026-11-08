#!/usr/bin/env node
// Behaviour scenarios for assess and the triage rule, in throwaway copies of the example.
// Lists the plan by default. Real runs need --run because they use your Claude quota.
// `claude plugin eval` cannot be used here: it does not load a project's .claude/ rules.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const EXAMPLE = path.join(ROOT, 'examples', 'shop-api');
const SCENARIOS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/scenarios/scenarios.json'), 'utf8'));
const TIMEOUT_MS = 240000;

function parseArgs(argv) {
  const opts = { run: false, repeat: 3, concurrency: 3, only: null, model: null, allowApiKey: false, json: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--run') opts.run = true;
    else if (a === '--allow-api-key') opts.allowApiKey = true;
    else if (a === '--repeat') opts.repeat = Number(argv[++i]);
    else if (a === '--concurrency') opts.concurrency = Number(argv[++i]);
    else if (a === '--only') opts.only = argv[++i].split(',');
    else if (a === '--model') opts.model = argv[++i];
    else if (a === '--json') opts.json = argv[++i];
    else throw new Error(`unknown option: ${a}`);
  }
  if (!Number.isInteger(opts.repeat) || opts.repeat < 1) throw new Error('--repeat must be a positive integer');
  if (!Number.isInteger(opts.concurrency) || opts.concurrency < 1) throw new Error('--concurrency must be a positive integer');
  return opts;
}

function overlay(root, files = {}) {
  for (const [rel, text] of Object.entries(files)) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
}

function invoke(cwd, prompt, opts) {
  const args = [
    '-p', '--output-format', 'stream-json', '--verbose', '--no-session-persistence',
    '--setting-sources', 'project', '--strict-mcp-config', '--permission-mode', 'default',
    '--disallowedTools', 'Bash,PowerShell,WebFetch,WebSearch', '--plugin-dir', ROOT,
  ];
  if (opts.model) args.push('--model', opts.model);
  return new Promise((resolve) => {
    const child = spawn(process.env.CLAUDE_BIN || 'claude', args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => child.kill(), TIMEOUT_MS);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); resolve({ code: -1, out, err: e.message }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, out, err }); });
    child.stdin.end(prompt);
  });
}

function summarise(stream) {
  const tools = [];
  const run = { final: '', usage: {}, auth: null };
  for (const line of stream.split('\n')) {
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    if (ev.type === 'system' && ev.subtype === 'init') run.auth = ev.apiKeySource ?? null;
    if (ev.type === 'assistant') {
      for (const c of ev.message?.content ?? []) {
        if (c.type === 'tool_use') tools.push({ name: c.name, skill: c.input?.skill });
      }
    }
    if (ev.type === 'result') {
      run.final = ev.result ?? '';
      run.usage = ev.usage ?? {};
    }
  }
  const assessAt = tools.findIndex((t) => t.name === 'Skill' && /assess/.test(String(t.skill)));
  const writeAt = tools.findIndex((t) => ['Edit', 'Write', 'MultiEdit'].includes(t.name));
  return { ...run, assessed: assessAt >= 0, beforeWrite: assessAt >= 0 && (writeAt < 0 || assessAt < writeAt) };
}

async function runOne(scenario, opts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pe-scenario-'));
  try {
    fs.cpSync(EXAMPLE, dir, { recursive: true });
    overlay(dir, scenario.overlay);
    const { code, out, err } = await invoke(dir, scenario.prompt, opts);
    const r = summarise(out);
    const problems = [];
    if (code !== 0) problems.push(`exit ${code}: ${err.slice(-200)}`);
    if (scenario.expect === 'silent' && r.assessed) problems.push('assess fired on a silent case');
    if (scenario.expect === 'assess' && !r.beforeWrite) problems.push('assess did not fire before writing');
    if (scenario.replyMatches && !new RegExp(scenario.replyMatches, 'i').test(r.final)) problems.push(`reply lacks /${scenario.replyMatches}/`);
    if (scenario.forbidFile && fs.existsSync(path.join(dir, scenario.forbidFile))) problems.push(`forbidden file created: ${scenario.forbidFile}`);
    return { id: scenario.id, pass: problems.length === 0, problems, assessed: r.assessed, auth: r.auth, usage: r.usage };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const chosen = SCENARIOS.filter((s) => !opts.only || opts.only.includes(s.id));
  const total = chosen.length * opts.repeat;
  if (!opts.run) {
    for (const s of chosen) console.log(`${s.expect.padEnd(7)} ${s.id}`);
    console.log(`\nPlan: ${chosen.length} scenarios x ${opts.repeat} = ${total} runs. Nothing was run.`);
    console.log('Add --run to execute. Runs count against your Claude plan limits, or your API bill if you use a key.');
    return 0;
  }
  if (process.env.ANTHROPIC_API_KEY && !opts.allowApiKey) {
    console.error('ANTHROPIC_API_KEY is set, so these runs would be billed to the API. Unset it, or pass --allow-api-key.');
    return 2;
  }
  const queue = chosen.flatMap((s) => Array.from({ length: opts.repeat }, () => s));
  const results = [];
  await Promise.all(Array.from({ length: opts.concurrency }, async () => {
    while (queue.length) {
      const r = await runOne(queue.shift(), opts);
      results.push(r);
      console.log(`${r.pass ? 'pass' : 'FAIL'} ${r.id}${r.problems.length ? ` (${r.problems.join('; ')})` : ''}`);
    }
  }));
  const passed = results.filter((r) => r.pass).length;
  const tokens = results.reduce((sum, r) => sum + (r.usage.output_tokens ?? 0), 0);
  console.log(`\n${passed}/${results.length} passed, ${tokens} output tokens, auth: ${[...new Set(results.map((r) => r.auth))].join(', ')}`);
  if (opts.json) fs.writeFileSync(opts.json, JSON.stringify(results, null, 2));
  return passed === results.length ? 0 : 1;
}

main().then((code) => { process.exitCode = code; }, (err) => { console.error(err.message); process.exitCode = 2; });
