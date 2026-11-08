# shop-api (example)

A tiny fictional API that shows what Proactive Engineering adds to a project. It is also the fixture for the behaviour scenarios. The typo in `src/orders/orders.js` is deliberate.

| Path | Purpose |
|---|---|
| `.claude/rules/engineering-triage.md` | Triage rule installed by `setup` |
| `.claude/settings.json` | Example `permissions.ask` rules |
| `.proactive/config.yaml` | Only the settings that differ from the defaults |
| `docs/adr/` | Decision records, in the format the project already used |

Run `node ../../scripts/check-records.mjs --root .` to check it.
