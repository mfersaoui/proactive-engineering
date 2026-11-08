# Cost and token use

**Proactive Engineering needs no API key and no paid service.** It runs on your Claude Code subscription and uses your normal Claude quota. The plugin makes no network or model calls of its own.

## What it adds to your usage

Figures for version 1.0.0-rc.1. Check the current version with `claude plugin details proactive-engineering`.

| When | What loads | Tokens (approximate) |
|---|---|---|
| Every session | Skill names and descriptions | ~258 as reported by `plugin details` |
| Every session, after `setup` | The triage rule | ~100, estimated from its length |
| `assess` fires | The skill body | ~1,500, then it stays in the conversation |
| `assess` needs more | One reference file, only when relevant | A few hundred each |
| You run `setup` or `audit` | That skill | ~1,500 or ~550 |

The `plugin details` figure includes about 100 tokens for `setup` and `audit`. Claude Code's documentation says the descriptions of skills with `disable-model-invocation` are not placed in context, so actual always-on use may be lower.

When `assess` intervenes, Claude also reads the relevant code and writes its analysis, which uses your quota like any other work. In early testing, a typical analysis produced 1,500 to 1,800 output tokens. A task where it stays silent showed no measurable difference, on a small sample.

## What can cost money

| Situation | Effect |
|---|---|
| Normal use with a subscription | Your plan's usage limits. No separate bill. |
| `ANTHROPIC_API_KEY` set in your environment | Claude Code may bill the API instead, with or without this plugin. `setup` warns you. |
| You enabled usage credits | Work beyond your plan's limit may be billed under your own settings |
| Claude Code in your CI | Needs its own credentials. The `check-records` script makes no model calls and needs none. |

## Dollar figures

Claude Code's cost displays and `--max-budget-usd` are client-side estimates at list price. For a subscriber they are not charges. Anthropic does not publish how tokens convert into a percentage of plan limits.

## Keeping it low

- Only `assess` is automatic, and its description is the only sizeable always-on text.
- Level 0 stops immediately, before reading any file.
- Detail lives in `references/`, loaded only when a level needs it.
- There are no hooks, so nothing runs on each message.

Behaviour scenarios (`tests/scenarios/run.mjs --run`) are real sessions and use your quota. Listing them without `--run` costs nothing.
