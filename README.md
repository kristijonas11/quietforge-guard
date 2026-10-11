# Quietforge Guard

**Hard budget limits for Claude Code.** Quietforge Guard stops a runaway session *before* it burns your money. It doesn't just report the damage afterwards.

Usage trackers tell you what you spent yesterday. Guard enforces a limit right now:

- **Per-session budget**, including every subagent the session spawns.
- **Daily budget** across all your sessions and projects.
- **Hard stop.** When a budget is hit, Claude stops before its next tool call and your next prompt is held back. Raise the limit with one message: `#guard-raise 20`.
- **Early warning** at 80% of either budget.
- **Spending reports** by day, project and model, as a table, CSV or JSON.
- **Team roll-ups:** combine every teammate's usage into one report for finance.

Costs are API-equivalent USD at Anthropic's published per-token prices, including cache reads and writes. It runs 100% locally, makes no network calls and collects no telemetry. The only dependency is Node.js 18+.

## Install (30 seconds)

Inside Claude Code:

```
/plugin marketplace add kristijonas11/quietforge-guard
/plugin install quietforge-guard@quietforge
```

That's it. Default budgets are **$15 per session** and **$75 per day**.

## Change your budgets

```
/quietforge-guard:budget session 25 daily 100
```

Or from your terminal:

```bash
npx github:kristijonas11/quietforge-guard set --session 25 --daily 100
npx github:kristijonas11/quietforge-guard set --enforce false   # warn only, never stop
```

The config lives in `~/.claude/quietforge-guard.json`. A project can override it with its own `.claude/quietforge-guard.json`, for example to give a big refactor repo a bigger budget.

## While you work

Type these as a normal message in Claude Code. They're handled locally and never sent to the model, so they cost nothing:

| Message | Effect |
|---|---|
| `#guard-status` | Shows this session's spend and today's spend against your budgets |
| `#guard-raise` | Adds 50% to the session budget (and to the daily budget if that's what stopped you) |
| `#guard-raise 20` | Adds $20 |
| `#guard-off` / `#guard-on` | Pauses or resumes the guard for this session |

## Reports

```
/quietforge-guard:report
```

Or from your terminal:

```bash
npx github:kristijonas11/quietforge-guard report --days 30 --by project
npx github:kristijonas11/quietforge-guard report --days 30 --by model --csv > claude-costs.csv
```

## Team roll-ups

Each teammate exports their usage:

```bash
npx github:kristijonas11/quietforge-guard export --days 30 > alice.json
```

Then the lead combines the exports into one report:

```bash
npx github:kristijonas11/quietforge-guard team alice.json bob.json carol.json --by user
npx github:kristijonas11/quietforge-guard team *.json --by project --csv > team-costs.csv
```

## Team license

Quietforge Guard is free for individuals, and the team features are free for teams of up to 3 people.

Teams of **4 or more** using `export` / `team` need a Team license: **$49 per seat per year**. Your receipt is your license. Stripe handles VAT and sales tax.

**Buy a Team license:** checkout opens in the next few days. Until then, team features are free for everyone.

Every license funds development of independent tooling. Thank you.

## How it works

Claude Code writes every session to `~/.claude/projects/**/*.jsonl`. Guard runs as a `PreToolUse` and `UserPromptSubmit` hook:

1. It reads only the new lines since the last check, so a check takes about 70 ms.
2. It removes duplicate log entries (Claude Code logs one entry per content block).
3. It adds in the session's subagent logs.
4. It prices every message by model and token type.

If anything goes wrong inside Guard, it fails open, so it will never break your session.

**About the numbers:** they are API-equivalent estimates from local logs. If you're on a Pro or Max subscription, they show what your usage *would* cost on the API. That's a useful way to spot runaway sessions, but it isn't your bill. Model prices are in [`lib/pricing.js`](plugins/quietforge-guard/lib/pricing.js) (checked October 2026). PRs welcome when Anthropic changes prices.

## License

Everything is [MIT](LICENSE), except the team features in `plugins/quietforge-guard/team/`, which use the [Quietforge Team License](LICENSE-TEAM.md): free for teams of up to 3 people, paid for teams of 4 or more.
