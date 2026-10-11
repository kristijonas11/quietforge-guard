#!/usr/bin/env node
'use strict';
// qfguard — Claude Code spending reports and budget settings.
const fs = require('fs');
const os = require('os');
const path = require('path');
const usage = require('../lib/usage');
const { loadConfig, writeUserConfig, USER_CONFIG } = require('../lib/config');

const args = process.argv.slice(2);
const cmd = args[0] || 'status';
const flag = (name, def) => {
  const i = args.indexOf('--' + name);
  if (i === -1) return def;
  const v = args[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const fmt = (n) => '$' + n.toFixed(2);

function projectName(cwd) { return cwd ? path.basename(cwd) || cwd : '(unknown)'; }

function aggregate(rows, by) {
  const map = new Map();
  for (const r of rows) {
    const key = by === 'project' ? projectName(r.p) : by === 'model' ? r.m : by === 'user' ? (r.user || os.userInfo().username) : r.d;
    const a = map.get(key) || { key, usd: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, messages: 0 };
    a.usd += r.c; a.input += r.t[0]; a.output += r.t[1]; a.cacheWrite += r.t[2] + r.t[3]; a.cacheRead += r.t[4]; a.messages += 1;
    map.set(key, a);
  }
  return [...map.values()].sort((x, y) => (by === 'day' ? x.key.localeCompare(y.key) : y.usd - x.usd));
}

function rowsSince(days) {
  const startDay = new Date(); startDay.setHours(0, 0, 0, 0); startDay.setDate(startDay.getDate() - (days - 1));
  const first = usage.localDay(startDay);
  return usage.records(startDay.getTime()).filter((r) => r.d >= first);
}

function printTable(list, by) {
  const total = list.reduce((s, a) => s + a.usd, 0);
  const w = Math.max(by.length, ...list.map((a) => String(a.key).length), 5);
  console.log(by.padEnd(w) + '  ' + 'cost'.padStart(10) + '  ' + 'output tok'.padStart(11) + '  ' + 'messages'.padStart(8));
  for (const a of list) console.log(String(a.key).padEnd(w) + '  ' + fmt(a.usd).padStart(10) + '  ' + String(a.output).padStart(11) + '  ' + String(a.messages).padStart(8));
  console.log('TOTAL'.padEnd(w) + '  ' + fmt(total).padStart(10));
}

function toCSV(list, by) {
  const head = [by, 'usd', 'input_tokens', 'output_tokens', 'cache_write_tokens', 'cache_read_tokens', 'messages'];
  return [head.join(',')].concat(list.map((a) => [JSON.stringify(String(a.key)), a.usd.toFixed(4), a.input, a.output, a.cacheWrite, a.cacheRead, a.messages].join(','))).join('\n');
}

function help() {
  console.log(`qfguard — Claude Code budget guard and spending reports

  qfguard status                          today's spend vs your budgets
  qfguard report [--days 7] [--by day|project|model] [--csv|--json]
  qfguard set --session 20 --daily 100    change budgets (USD, API-equivalent)
  qfguard set --enforce false             warn only, never stop sessions
  qfguard export [--days 30] > me.json    export your usage to share with your team
  qfguard team <a.json> <b.json> ... [--by user|day|project|model] [--csv]
                                          combine teammates' exports (Team feature)

Inside Claude Code: "#guard-status", "#guard-raise [usd]", "#guard-off", "#guard-on".
Config: ${USER_CONFIG} (a project can override with .claude/quietforge-guard.json)`);
}

switch (cmd) {
  case 'status': {
    const cfg = loadConfig(process.cwd());
    const d = usage.dayCost();
    console.log(`Today: ${fmt(d)} of ${fmt(cfg.daily_usd)} daily budget (${Math.round((d / cfg.daily_usd) * 100)}%)`);
    console.log(`Per-session budget: ${fmt(cfg.session_usd)} · enforcement: ${cfg.enforce ? 'on (stops Claude)' : 'warn only'}`);
    break;
  }
  case 'report': {
    const by = flag('by', 'day');
    const list = aggregate(rowsSince(Number(flag('days', 7)) || 7), by);
    if (flag('json', false)) console.log(JSON.stringify(list, null, 2));
    else if (flag('csv', false)) console.log(toCSV(list, by));
    else printTable(list, by);
    break;
  }
  case 'set': {
    const patch = {};
    if (flag('session')) patch.session_usd = Number(flag('session'));
    if (flag('daily')) patch.daily_usd = Number(flag('daily'));
    if (flag('warn-at')) patch.warn_at = Number(flag('warn-at'));
    if (flag('enforce') !== undefined && flag('enforce') !== true) patch.enforce = String(flag('enforce')) !== 'false';
    console.log(JSON.stringify(writeUserConfig(patch), null, 2));
    break;
  }
  case 'export':
  case 'team':
    require('../team/team.js').run(cmd, args, { usage, aggregate, rowsSince, printTable, toCSV, projectName, flag, help });
    break;
  default:
    help();
}
