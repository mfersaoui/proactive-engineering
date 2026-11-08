---
name: setup
description: Configure Proactive Engineering for this project, install its triage rule, and propose permission rules. Run manually.
argument-hint: "[--remove]"
disable-model-invocation: true
---

# Setup

Adapt Proactive Engineering to this project without adding a second documentation system. Every write needs the user's agreement. Show what you will write first. Files under `.claude/` are protected, so Claude Code may ask for confirmation.

If the arguments contain `--remove`, go to "Remove".

## 1. Detect, without changing anything

Use Glob and Read for detection. Report briefly:
- Decision records: `.adr-dir`, `docs/adr`, `docs/decisions`, `doc/adr`, `docs/architecture/decisions`, `adr`, and their format.
- Project instructions: `CLAUDE.md`, `AGENTS.md`, `CONSTRAINTS.md`, `.claude/rules/`.
- Stack: package manifests, migration folders, infrastructure and CI paths.
- Other workflow plugins visible in this session. If Superpowers is present, warn that its brainstorming may repeat `assess` questions.
- Whether an API key would change billing. Run only a presence test, such as `test -n "$ANTHROPIC_API_KEY" && echo set || echo unset`, or `[bool]$env:ANTHROPIC_API_KEY` in PowerShell. **Never print the value.** If it is set, warn that Claude Code may bill the API instead of the subscription.

## 2. Ask once

Use AskUserQuestion for: the profile (`observer`, `balanced` recommended, `driver`), and the sensitive actions that must require validation. Keep anything not chosen at its default.

## 3. Propose, then write what the user accepts

**a. Triage rule (required for automatic triggering).** Write exactly this text to `.claude/rules/engineering-triage.md`. A plugin cannot ship this rule itself. Without it, `assess` triggers far less often.

```markdown
<!-- proactive-engineering:triage v1 -->
# Engineering triage

Before implementing a request, silently classify it. If it adds a feature or a dependency, changes architecture, data model, public API, auth or infrastructure, is destructive or touches production, or may duplicate something that already exists, invoke the `proactive-engineering:assess` skill first. Otherwise proceed normally and never mention this rule.
```

**b. Configuration (only if something differs from the defaults).** Write `.proactive/config.yaml` with only the keys that differ from these defaults. If existing records are in a non-standard folder, set `records.dir`. With no differences, create no file. Add `.proactive/local/` and `.proactive/config.local.yaml` to `.gitignore` if either will be used.

```yaml
profile: balanced             # observer | balanced | driver
intensity:
  max: 3                      # 1 to 3
interruptions:
  per_session: 3
  timing: boundaries          # boundaries | immediate
research:
  web: ask                    # allow | ask | never
records:
  dir: auto                   # auto, or a path inside the project
journal: false
actions:                      # silent | inform | ask | propose_only | forbid
  add_dependency: ask
  change_public_api: ask
  change_data_model: ask
  change_auth: ask
  change_infrastructure: ask
  db_migration: propose_only
  destructive: ask
  production: forbid
floor: {}                     # minimum strictness config.local.yaml cannot lower
```

**c. Permission rules (the real enforcement).** A plugin cannot ship permissions, so propose a diff for `.claude/settings.json`, merged with existing content and matching the detected stack. Offer only what applies, for example:

```json
{ "permissions": { "ask": [
  "Bash(npm install *)", "Bash(pnpm add *)", "Bash(yarn add *)",
  "Bash(pip install *)", "Bash(poetry add *)", "Bash(cargo add *)", "Bash(go get *)",
  "Edit(/migrations/**)", "Edit(/docs/adr/**)", "Edit(/.proactive/config.yaml)"
] } }
```

Say plainly that these rules match command text and are not a security boundary. Never add `allow` rules.

## 4. Finish

Summarise what was created and what was declined. Tell the user that `/proactive-engineering:audit` checks this setup, and to restart the session so the rule loads.

## Remove

List what setup created: the triage rule, `.proactive/` and the proposed permission entries. Remove only what the user confirms. Never delete decision records.
