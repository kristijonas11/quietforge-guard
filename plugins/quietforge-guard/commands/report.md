---
description: Show Claude Code spending for the last 7 days (by day, project and model)
---
Run these commands and show the output to the user as compact tables, then give a one-line summary of where most of the money went:

!`node "${CLAUDE_PLUGIN_ROOT}/bin/qfguard.js" report --days 7 --by day`
!`node "${CLAUDE_PLUGIN_ROOT}/bin/qfguard.js" report --days 7 --by project`
!`node "${CLAUDE_PLUGIN_ROOT}/bin/qfguard.js" report --days 7 --by model`
