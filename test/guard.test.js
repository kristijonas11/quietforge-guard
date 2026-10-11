'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qfg-'));
process.env.QFG_STATE_DIR = path.join(tmp, 'state');
process.env.QFG_PROJECTS_DIR = path.join(tmp, 'projects');
process.env.QFG_CONFIG = path.join(tmp, 'config.json');

const { costOf, ratesFor } = require('../plugins/quietforge-guard/lib/pricing');
const usage = require('../plugins/quietforge-guard/lib/usage');
const GUARD = path.join(__dirname, '../plugins/quietforge-guard/scripts/guard.js');

const line = (id, model, usageObj, ts) => JSON.stringify({ type: 'assistant', timestamp: ts || new Date().toISOString(), cwd: '/work/app', sessionId: 's', message: { id, model, usage: usageObj } });

test('pricing picks the most specific model', () => {
  assert.deepStrictEqual(ratesFor('claude-opus-5-5'), [4, 20, 5, 8, 0.2]);
  assert.deepStrictEqual(ratesFor('claude-opus-5'), [5, 25, 6.25, 10, 0.5]);
  assert.deepStrictEqual(ratesFor('claude-opus-4-1-20250805'), [15, 75, 18.75, 30, 1.5]);
  assert.deepStrictEqual(ratesFor('claude-sonnet-4-6'), [3, 15, 3.75, 6, 0.3]);
  assert.deepStrictEqual(ratesFor('claude-haiku-5-5', 50000), [0.1, 0.5, 0.125, 0.2, 0.01]);
  assert.deepStrictEqual(ratesFor('claude-haiku-5-5', 150000), [0.5, 2.5, 0.625, 1, 0.05]);
  assert.strictEqual(costOf('claude-opus-5-5', { input: 1e6, output: 1e6, cw5: 0, cw1: 0, cacheRead: 0 }), 24);
});

test('session cost dedupes repeated message lines and includes subagents', () => {
  const dir = path.join(process.env.QFG_PROJECTS_DIR, '-work-app');
  fs.mkdirSync(path.join(dir, 'sess1', 'subagents'), { recursive: true });
  const u = { input_tokens: 0, output_tokens: 100000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
  const main = path.join(dir, 'sess1.jsonl');
  fs.writeFileSync(main, [line('m1', 'claude-opus-5-5', u), line('m1', 'claude-opus-5-5', u), line('m2', 'claude-opus-5-5', u)].join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'sess1', 'subagents', 'agent-x.jsonl'), line('m3', 'claude-opus-5-5', u) + '\n');
  // 3 unique messages × 100k output × $20/M = $6
  assert.strictEqual(Number(usage.sessionCost(main).toFixed(4)), 6);
  // incremental append is picked up
  fs.appendFileSync(main, line('m4', 'claude-opus-5-5', u) + '\n');
  assert.strictEqual(Number(usage.sessionCost(main).toFixed(4)), 8);
  assert.strictEqual(Number(usage.dayCost().toFixed(4)), 8);
});

function runGuard(input, env) {
  const out = execFileSync('node', [GUARD], { input: JSON.stringify(input), env: Object.assign({}, process.env, env) }).toString();
  return out ? JSON.parse(out) : null;
}

test('guard stops over budget, allows raise, and fails open', () => {
  const tp = path.join(process.env.QFG_PROJECTS_DIR, '-work-app', 'sess1.jsonl');
  const base = { session_id: 'sess1', transcript_path: tp, cwd: '/work/app' };
  assert.strictEqual(runGuard(Object.assign({ hook_event_name: 'PreToolUse' }, base), { QFG_SESSION_USD: '100' }), null);
  const stopped = runGuard(Object.assign({ hook_event_name: 'PreToolUse' }, base), { QFG_SESSION_USD: '5' });
  assert.strictEqual(stopped.continue, false);
  const raised = runGuard(Object.assign({ hook_event_name: 'UserPromptSubmit', prompt: '#guard-raise 10' }, base), { QFG_SESSION_USD: '5' });
  assert.strictEqual(raised.decision, 'block');
  // limit is now $15 vs $8 spent; 8/15 < 80% so no output
  assert.strictEqual(runGuard(Object.assign({ hook_event_name: 'PreToolUse' }, base), { QFG_SESSION_USD: '5' }), null);
  const warnOnly = runGuard(Object.assign({ hook_event_name: 'PreToolUse' }, base, { session_id: 'other' }), { QFG_SESSION_USD: '5', QFG_ENFORCE: '0' });
  assert.ok(warnOnly.systemMessage);
  const out = execFileSync('node', [GUARD], { input: 'garbage' }).toString();
  assert.strictEqual(out, '');
});
