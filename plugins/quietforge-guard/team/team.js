// Copyright (c) 2026 Quietforge. Licensed under the Quietforge Team License (see LICENSE-TEAM.md),
// NOT under MIT: free for teams of up to 3 people; larger teams need a paid Team license.
'use strict';
const fs = require('fs');
const os = require('os');

function teamNotice() {
  process.stderr.write('\nQuietforge Guard Team features are free for teams of up to 3 people.\n' +
    'Teams of 4+ need a Team license ($49/seat/year): https://github.com/kristijonas11/quietforge-guard#team-license\n');
}

function run(cmd, args, h) {
  if (cmd === 'export') {
    const user = h.flag('user', os.userInfo().username);
    const rows = h.rowsSince(Number(h.flag('days', 30)) || 30).map((r) => ({ user, d: r.d, m: r.m, p: h.projectName(r.p), c: r.c, t: r.t }));
    console.log(JSON.stringify({ quietforge: 1, user, exported: new Date().toISOString(), rows }));
    return;
  }
  const files = args.slice(1).filter((a, i, all) => !a.startsWith('--') && !(i > 0 && all[i - 1].startsWith('--')));
  if (!files.length) { h.help(); process.exit(1); }
  const rows = [];
  const users = new Set();
  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const r of data.rows || []) { rows.push(Object.assign({ user: data.user }, r)); users.add(data.user); }
  }
  const by = h.flag('by', 'user');
  const list = h.aggregate(rows, by);
  if (h.flag('csv', false)) console.log(h.toCSV(list, by)); else h.printTable(list, by);
  if (users.size > 3) teamNotice();
}

module.exports = { run };
