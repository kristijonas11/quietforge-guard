---
description: Set Quietforge Guard budgets, e.g. /quietforge-guard:budget session 20 daily 100
argument-hint: session <usd> daily <usd>
---
The user wants to change their Quietforge Guard budgets. Their request: "$ARGUMENTS".
Translate it into a single command of the form `node "${CLAUDE_PLUGIN_ROOT}/bin/qfguard.js" set --session <usd> --daily <usd>` (include only the values they gave; `--enforce false` means warn-only), run it, and confirm the new settings in one sentence. If no values were given, run `node "${CLAUDE_PLUGIN_ROOT}/bin/qfguard.js" status` and explain the current settings instead.
