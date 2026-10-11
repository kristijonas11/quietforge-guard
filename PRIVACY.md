# Privacy Policy — Quietforge Guard

Last updated: 2026-10-11

**Quietforge Guard collects no data.** It runs entirely on your own computer.

- **What it reads:** Claude Code's local session logs (`~/.claude/projects/**/*.jsonl`), only to count tokens and compute cost.
- **What it stores:** small cache and budget files on your machine (`~/.claude/quietforge-guard*` and the plugin data folder). Nothing leaves your computer.
- **Network:** the plugin makes no network requests, has no telemetry, no analytics and no accounts.
- **Prompt content:** it never sends, copies or logs the text of your prompts or Claude's replies. It only reads token counts and model names.
- **Team exports:** `qfguard export` writes a file only when you run it. Sharing that file is entirely up to you. It contains usage counts, costs, model names and project folder names, not prompt text.
- **Purchases:** Team licenses are sold through Stripe. Stripe, not Quietforge, processes and stores payment details under Stripe's own privacy policy.

Questions: open an issue at https://github.com/kristijonas11/quietforge-guard/issues
