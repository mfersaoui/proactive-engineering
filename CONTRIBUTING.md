# Contributing

Thank you for helping. This project stays useful by staying small.

## Before proposing a feature

Apply the project's own rule: **reuse before building**. Explain which user problem it solves, why Claude Code or an existing tool does not already solve it, and what it costs in always-on tokens.

Features that rebuild code review, security scanning, planning or test workflows will generally be declined. Integrating with those tools is welcome.

## Rules for changes

- Keep `assess` compact. Move detail to `references/`, which loads only when needed.
- Only `assess` may add to the always-on context. Other skills use `disable-model-invocation: true`.
- Add no runtime dependencies, hooks, MCP servers, telemetry or network calls without an agreed issue first.
- Never add a requirement for an API key.
- Keep project-specific facts out of the plugin.
- A behaviour change needs at least one scenario in `tests/scenarios/scenarios.json`, including a case where it must stay silent.

## Checks

```bash
npm test
npm run check:example
claude plugin validate . --strict
```

`node tests/scenarios/run.mjs --run` runs real sessions and uses your Claude quota. Run the relevant cases with `--only` and share the results in your pull request when you change `assess` or the triage rule.

## Releases

Versions follow SemVer in `.claude-plugin/plugin.json`, and users only get an update when that value changes. Update `package.json` and `CHANGELOG.md` at the same time.

Changing the triage rule means bumping its `v1` marker in `skills/setup/SKILL.md`, the check in `scripts/check-records.mjs`, and the copy in `examples/shop-api`.
