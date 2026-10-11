#!/usr/bin/env node
'use strict';
// Quietforge Guard hook entry point. Reads the hook event JSON on stdin.
// Never breaks a session: any internal error exits 0 with no output.
const path = require('path');
const usage = require('../lib/usage');
const { loadConfig } = require('../lib/config');

const SESS_DIR = path.join(usage.STATE_DIR, 'sessions');
const DAILY_EXTRA = path.join(usage.STATE_DIR, 'daily-extra.json');
const DAILY_CACHE = path.join(usage.STATE_DIR, 'daily-cache.json');

const fmt = (n) => '$' + n.toFixed(2);

function out(obj) { process.stdout.write(JSON.stringify(obj)); process.exit(0); }

function todayCost(today) {
  const c = usage.readJSON(DAILY_CACHE, null);
  if (c && c.day === today && Date.now() - c.at < 15000) return c.usd;
  const usd = usage.dayCost(today);
  usage.writeJSON(DAILY_CACHE, { day: today, at: Date.now(), usd });
  return usd;
}

function status(input) {
  const cfg = loadConfig(input.cwd);
  const today = usage.localDay();
  const sessFile = path.join(SESS_DIR, String(input.session_id || 'unknown').replace(/[^\w-]/g, '') + '.json');
  const sess = usage.readJSON(sessFile, { extra: 0, warned: {}, off: false });
  const dailyExtra = (usage.readJSON(DAILY_EXTRA, {})[today]) || 0;
  const s = usage.sessionCost(input.transcript_path);
  const d = todayCost(today);
  return { cfg, today, sessFile, sess, s, d, sLimit: cfg.session_usd + (sess.extra || 0), dLimit: cfg.daily_usd + dailyExtra };
}

function statusLine(st) {
  return `Quietforge Guard: this session ${fmt(st.s)} of ${fmt(st.sLimit)} · today ${fmt(st.d)} of ${fmt(st.dLimit)} (API-equivalent cost)`;
}

function handlePrompt(input) {
  const prompt = String(input.prompt || '').trim();
  const cmd = prompt.match(/^#guard-(raise|off|on|status)\b\s*([\d.]+)?/i);
  const st = status(input);
  if (cmd) {
    const action = cmd[1].toLowerCase();
    if (action === 'status') out({ decision: 'block', reason: statusLine(st) });
    if (action === 'off' || action === 'on') {
      st.sess.off = action === 'off';
      usage.writeJSON(st.sessFile, st.sess);
      out({ decision: 'block', reason: `Quietforge Guard ${st.sess.off ? 'paused' : 'resumed'} for this session.` });
    }
    const amount = Number(cmd[2]) > 0 ? Number(cmd[2]) : Math.max(1, st.cfg.session_usd * 0.5);
    st.sess.extra = (st.sess.extra || 0) + amount;
    st.sess.warned = {};
    usage.writeJSON(st.sessFile, st.sess);
    if (st.d >= st.dLimit) {
      const all = usage.readJSON(DAILY_EXTRA, {});
      all[st.today] = (all[st.today] || 0) + amount;
      usage.writeJSON(DAILY_EXTRA, all);
    }
    out({ decision: 'block', reason: `Budget raised by ${fmt(amount)}. Send your next message to continue. ${statusLine(status(input))}` });
  }
  return check(st, 'prompt');
}

function check(st, phase) {
  if (st.sess.off) process.exit(0);
  const over = st.s >= st.sLimit ? 'session' : st.d >= st.dLimit ? 'daily' : null;
  if (over && st.cfg.enforce) {
    const what = over === 'session' ? `This session has used ${fmt(st.s)} (limit ${fmt(st.sLimit)})` : `Today's total is ${fmt(st.d)} (limit ${fmt(st.dLimit)})`;
    const msg = `Quietforge Guard stopped Claude: ${what}. To continue, send "#guard-raise" (adds 50%) or "#guard-raise 20" (adds $20), or "#guard-off" for this session.`;
    if (phase === 'prompt') out({ decision: 'block', reason: msg });
    out({ continue: false, stopReason: msg });
  }
  const key = over ? 'over' : st.s >= st.sLimit * st.cfg.warn_at ? 'session' : st.d >= st.dLimit * st.cfg.warn_at ? 'daily' : null;
  if (key && !st.sess.warned[key]) {
    st.sess.warned[key] = true;
    usage.writeJSON(st.sessFile, st.sess);
    out({ systemMessage: (over ? 'Over budget (warn-only mode). ' : 'Approaching budget. ') + statusLine(st) });
  }
  process.exit(0);
}

function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { raw += c; });
  process.stdin.on('end', () => {
    try {
      if (process.env.QFG_DISABLE === '1') process.exit(0);
      const input = JSON.parse(raw || '{}');
      if (input.hook_event_name === 'UserPromptSubmit') return handlePrompt(input);
      return check(status(input), 'tool');
    } catch (e) {
      if (process.env.QFG_DEBUG) process.stderr.write(String(e && e.stack || e));
      process.exit(0);
    }
  });
}

main();
