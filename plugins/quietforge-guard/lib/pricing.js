'use strict';
// USD per million tokens: [input, output, cacheWrite5m, cacheWrite1h, cacheRead]
// Source: https://platform.claude.com/docs/en/about-claude/pricing (checked 2026-10-11)
const TABLE = [
  ['fable-5-1', [10, 50, 12.5, 20, 0.25]],
  ['mythos-5-1', [10, 50, 12.5, 20, 0.25]],
  ['fable-5', [10, 50, 12.5, 20, 1]],
  ['mythos-5', [10, 50, 12.5, 20, 1]],
  ['opus-5-5', [4, 20, 5, 8, 0.2]],
  ['opus-5', [5, 25, 6.25, 10, 0.5]],
  ['opus-4-8', [5, 25, 6.25, 10, 0.5]],
  ['opus-4-7', [5, 25, 6.25, 10, 0.5]],
  ['opus-4-6', [5, 25, 6.25, 10, 0.5]],
  ['opus-4-5', [5, 25, 6.25, 10, 0.5]],
  ['opus-4-1', [15, 75, 18.75, 30, 1.5]],
  ['opus-4', [15, 75, 18.75, 30, 1.5]],
  ['sonnet-5-5', [2, 10, 2.5, 4, 0.1]],
  ['sonnet-5', [2, 10, 2.5, 4, 0.2]],
  ['sonnet-4-6', [3, 15, 3.75, 6, 0.3]],
  ['sonnet-4-5', [3, 15, 3.75, 6, 0.3]],
  ['sonnet-4', [3, 15, 3.75, 6, 0.3]],
  ['sonnet-3-7', [3, 15, 3.75, 6, 0.3]],
  ['haiku-4-5', [1, 5, 1.25, 2, 0.1]],
  ['haiku-3-5', [0.8, 4, 1, 1.6, 0.08]],
];
const HAIKU_55_SMALL = [0.1, 0.5, 0.125, 0.2, 0.01];
const HAIKU_55_LARGE = [0.5, 2.5, 0.625, 1, 0.05];
const FAMILY_FALLBACK = { opus: [5, 25, 6.25, 10, 0.5], sonnet: [3, 15, 3.75, 6, 0.3], haiku: [1, 5, 1.25, 2, 0.1] };
const UNKNOWN = [10, 50, 12.5, 20, 1]; // conservative: over-estimate rather than under-estimate
const WEB_SEARCH_USD = 0.01; // $10 per 1,000 searches

function normalize(model) {
  return String(model || '').toLowerCase().replace(/^.*claude-/, '').replace(/\./g, '-');
}

function ratesFor(model, promptTokens) {
  const m = normalize(model);
  if (/haiku-5-5/.test(m)) return promptTokens > 100000 ? HAIKU_55_LARGE : HAIKU_55_SMALL;
  for (const [key, rates] of TABLE) {
    if (new RegExp('(^|-)' + key + '($|-)').test(m)) return rates;
  }
  for (const fam of Object.keys(FAMILY_FALLBACK)) if (m.includes(fam)) return FAMILY_FALLBACK[fam];
  return UNKNOWN;
}

// tokens: {input, output, cw5, cw1, cacheRead, webSearch}
function costOf(model, t) {
  const prompt = t.input + t.cw5 + t.cw1 + t.cacheRead;
  const r = ratesFor(model, prompt);
  return (t.input * r[0] + t.output * r[1] + t.cw5 * r[2] + t.cw1 * r[3] + t.cacheRead * r[4]) / 1e6 +
    (t.webSearch || 0) * WEB_SEARCH_USD;
}

module.exports = { ratesFor, costOf, normalize };
