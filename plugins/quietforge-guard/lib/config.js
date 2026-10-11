'use strict';
const path = require('path');
const os = require('os');
const { readJSON, writeJSON } = require('./usage');

const USER_CONFIG = process.env.QFG_CONFIG || path.join(os.homedir(), '.claude', 'quietforge-guard.json');

const DEFAULTS = {
  session_usd: 15,   // stop a single session (incl. its subagents) at this API-equivalent cost
  daily_usd: 75,     // stop all sessions once today's total reaches this
  warn_at: 0.8,      // warn once a budget is 80% used
  enforce: true,     // false = warn only, never stop
};

function loadConfig(cwd) {
  const user = readJSON(USER_CONFIG, {});
  const project = cwd ? readJSON(path.join(cwd, '.claude', 'quietforge-guard.json'), {}) : {};
  const cfg = Object.assign({}, DEFAULTS, user, project);
  for (const k of ['session_usd', 'daily_usd', 'warn_at']) {
    const v = Number(cfg[k]);
    cfg[k] = Number.isFinite(v) && v > 0 ? v : DEFAULTS[k];
  }
  if (process.env.QFG_SESSION_USD) cfg.session_usd = Number(process.env.QFG_SESSION_USD) || cfg.session_usd;
  if (process.env.QFG_DAILY_USD) cfg.daily_usd = Number(process.env.QFG_DAILY_USD) || cfg.daily_usd;
  if (process.env.QFG_ENFORCE === '0') cfg.enforce = false;
  return cfg;
}

function writeUserConfig(patch) {
  const cur = readJSON(USER_CONFIG, {});
  const next = Object.assign({}, DEFAULTS, cur, patch);
  writeJSON(USER_CONFIG, next);
  return next;
}

module.exports = { loadConfig, writeUserConfig, DEFAULTS, USER_CONFIG };
