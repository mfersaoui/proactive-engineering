# Proactive Engineering

**Proportionate engineering judgment for Claude Code.** It surfaces the decisions, risks and existing solutions that matter, and stays quiet otherwise.

Claude Code is good at doing what you ask. Sometimes the valuable move comes earlier: noticing that a request is really an architecture decision, that the utility already exists, that the team ruled this out last spring, or that the current code is fine.

Proactive Engineering adds that judgment without adding a process. It is not a workflow framework, and it does not replace your planning, review or security tools. It decides what deserves attention, then hands off to whichever tools you already have.

## How it behaves

| Level | Example | What happens |
|---|---|---|
| 0 | Fix a typo, rename a variable | Nothing. It stays silent. |
| 1 | Routine edit under an accepted decision | One line citing the decision, if it matters |
| 2 | Add a dependency, new feature with a real choice | Short options and one recommendation |
| 3 | Destructive migration, new project, change of database | Analysis axes you can edit, options, then it waits for you |

Before recommending new code, it checks the repository, then existing external solutions, and reads the actual LICENSE file of anything it recommends. "Change nothing" is always a valid answer.

## Install

In Claude Code:

```text
/plugin marketplace add mfersaoui/proactive-engineering
/plugin install proactive-engineering@proactive-engineering
```

Then, **in each project**:

```text
/proactive-engineering:setup
```

`setup` shows everything before writing it. It installs a small triage rule, which is required for reliable automatic triggering because plugins cannot ship rules themselves. It can also propose permission rules for sensitive actions. Restart the session afterwards.

To try it from a local clone without installing: `claude --plugin-dir /path/to/proactive-engineering`.

Third-party marketplaces do not auto-update by default. Run `/plugin update proactive-engineering@proactive-engineering`, or turn auto-update on in `/plugin`.

## Skills

| Skill | Triggered | Purpose |
|---|---|---|
| `assess` | Automatically, or `/proactive-engineering:assess <request>` | Judges a request and intervenes proportionately |
| `setup` | Manually | Detects your conventions and configures the project |
| `audit` | Manually, add `--deep` for code checks | Finds stale, orphaned or conflicting decisions. Read-only. |

There are no hooks, MCP servers or background processes.

## Your project stays yours

Decisions stay in the format and folder you already use (`docs/adr`, `docs/decisions`, `.adr-dir` and others). Without a convention, it proposes [MADR](https://adr.github.io/madr/). Nothing is created unless it would change future work, and only you can accept a decision.

Autonomy is configurable by profile (`observer`, `balanced`, `driver`) and by action category. See [docs/configuration.md](docs/configuration.md) and [docs/decisions.md](docs/decisions.md).

## Cost

**Proactive Engineering works entirely with your Claude Code subscription.** It requires no API key and no paid service, and it calls nothing external by itself. It uses your normal Claude quota, a small always-on amount and more when `assess` actually intervenes. See [docs/costs.md](docs/costs.md).

If `ANTHROPIC_API_KEY` is set in your environment, Claude Code may bill the API instead, with or without this plugin. `setup` warns you about it.

## When not to use it

- You want a complete, opinionated development methodology. Look at [Superpowers](https://github.com/obra/superpowers), [Compound Engineering](https://github.com/EveryInc/compound-engineering-plugin) or [agent-skills](https://github.com/addyosmani/agent-skills).
- You need hard security guarantees. This plugin advises. Enforcement comes from Claude Code permissions, sandboxing and least privilege.
- You work mostly on short-lived throwaway code.

Superpowers strongly encourages its own skills, so its brainstorming may repeat questions from `assess`.

## Status and limits

This is a release candidate. Early testing on a small synthetic project, with Sonnet 5.5 only, gave these results:

| Configuration | `assess` fired when it should | Stayed silent on a typo |
|---|---|---|
| Plugin alone | 4 of 12 | 3 of 3 |
| Plugin and triage rule | 12 of 12 | 3 of 3 |

That is encouraging but small. False alarms on ambiguous requests, other models and real projects still need measuring. Other limits:

- Triggering depends on the model following the skill description and the rule. Only `permissions.ask` rules are enforced.
- The interruption budget is an instruction, not a guarantee.
- Path-scoped rules may arrive after a new file's first write.
- Permission rules match command text and are not a security boundary.

Requirements: Claude Code with plugin support (developed on 2.1.319). Node.js 18 or later is optional and only used by `audit` and CI. See [docs/compatibility.md](docs/compatibility.md).

## Development

```bash
npm test                      # structure and script tests, no model calls
npm run check:example
node tests/scenarios/run.mjs  # lists behaviour scenarios; add --run to execute them
claude plugin validate . --strict
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
