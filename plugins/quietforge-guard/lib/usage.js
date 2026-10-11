'use strict';
// Reads Claude Code session logs (~/.claude/projects/**/*.jsonl) incrementally and prices them.
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { costOf } = require('./pricing');

const HOME = os.homedir();
const PROJECTS_DIR = process.env.QFG_PROJECTS_DIR || path.join(process.env.CLAUDE_CONFIG_DIR || path.join(HOME, '.claude'), 'projects');
const STATE_DIR = process.env.QFG_STATE_DIR || process.env.CLAUDE_PLUGIN_DATA || path.join(HOME, '.claude', 'quietforge-guard');
const CACHE_DIR = path.join(STATE_DIR, 'cache');

function localDay(ts) {
  const d = ts ? new Date(ts) : new Date();
  if (isNaN(d)) return localDay();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJSON(file, data) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, file);
  } catch { /* cache is best-effort */ }
}

function cacheFileFor(file) {
  return path.join(CACHE_DIR, crypto.createHash('sha1').update(file).digest('hex') + '.json');
}

// Parse one log file, reusing cached results for bytes already read.
// Returns { msgs: { [messageId]: {d, m, p, s, c, t:[in,out,cw5,cw1,cr,ws]} } }
function scanFile(file) {
  let st;
  try { st = fs.statSync(file); } catch { return { msgs: {} }; }
  const cf = cacheFileFor(file);
  let cache = readJSON(cf, null);
  if (!cache || cache.v !== 2 || st.size < cache.offset) cache = { v: 2, offset: 0, msgs: {} };
  if (st.size === cache.offset) return cache;

  const fd = fs.openSync(file, 'r');
  const len = st.size - cache.offset;
  const buf = Buffer.alloc(len);
  fs.readSync(fd, buf, 0, len, cache.offset);
  fs.closeSync(fd);
  const text = buf.toString('utf8');
  const lastNl = text.lastIndexOf('\n');
  if (lastNl === -1) return cache; // no complete line yet
  const complete = text.slice(0, lastNl);
  cache.offset += Buffer.byteLength(complete, 'utf8') + 1;

  for (const line of complete.split('\n')) {
    if (!line || line.indexOf('"usage"') === -1) continue;
    let d;
    try { d = JSON.parse(line); } catch { continue; }
    if (d.type !== 'assistant' || !d.message || !d.message.usage) continue;
    const m = d.message;
    if (!m.model || m.model === '<synthetic>') continue;
    const u = m.usage;
    const cc = u.cache_creation || {};
    let cw5 = cc.ephemeral_5m_input_tokens, cw1 = cc.ephemeral_1h_input_tokens;
    if (cw5 == null && cw1 == null) { cw5 = u.cache_creation_input_tokens || 0; cw1 = 0; }
    const t = [u.input_tokens || 0, u.output_tokens || 0, cw5 || 0, cw1 || 0, u.cache_read_input_tokens || 0,
      (u.server_tool_use && u.server_tool_use.web_search_requests) || 0];
    const c = costOf(m.model, { input: t[0], output: t[1], cw5: t[2], cw1: t[3], cacheRead: t[4], webSearch: t[5] });
    const id = m.id || d.requestId || d.uuid;
    // The same message is logged once per content block; keep the latest (largest) usage.
    const prev = cache.msgs[id];
    if (prev && prev.c > c) continue;
    cache.msgs[id] = { d: localDay(d.timestamp), m: m.model, p: d.cwd || '', s: d.sessionId || '', c, t };
  }
  writeJSON(cf, cache);
  return cache;
}

// All log files belonging to a session: the main transcript plus its subagent logs.
function sessionFiles(transcriptPath) {
  if (!transcriptPath) return [];
  let main = transcriptPath;
  const sub = main.indexOf(path.sep + 'subagents' + path.sep);
  if (sub !== -1) main = main.slice(0, sub) + '.jsonl';
  const files = [main];
  const subDir = path.join(main.replace(/\.jsonl$/, ''), 'subagents');
  try { for (const f of fs.readdirSync(subDir)) if (f.endsWith('.jsonl')) files.push(path.join(subDir, f)); } catch { /* none */ }
  return files;
}

function sessionCost(transcriptPath) {
  let usd = 0;
  for (const f of sessionFiles(transcriptPath)) for (const r of Object.values(scanFile(f).msgs)) usd += r.c;
  return usd;
}

function allLogFiles(sinceMs) {
  const out = [];
  const walk = (dir, depth) => {
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (depth < 4) walk(p, depth + 1); }
      else if (e.name.endsWith('.jsonl')) {
        if (sinceMs) { try { if (fs.statSync(p).mtimeMs < sinceMs) continue; } catch { continue; } }
        out.push(p);
      }
    }
  };
  walk(PROJECTS_DIR, 0);
  return out;
}

// Every priced message (deduplicated) from logs touched since `sinceMs`.
function records(sinceMs) {
  const seen = new Set();
  const out = [];
  for (const f of allLogFiles(sinceMs)) {
    for (const [id, r] of Object.entries(scanFile(f).msgs)) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(r);
    }
  }
  return out;
}

function dayCost(day) {
  day = day || localDay();
  const start = new Date(day + 'T00:00:00').getTime();
  let usd = 0;
  for (const r of records(start)) if (r.d === day) usd += r.c;
  return usd;
}

module.exports = { scanFile, sessionCost, sessionFiles, dayCost, records, localDay, readJSON, writeJSON, STATE_DIR, PROJECTS_DIR };
