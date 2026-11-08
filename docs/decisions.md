# Decisions and project memory

Proactive Engineering does not add a second documentation system. It reads what you already have.

## What it uses

| Information | Source |
|---|---|
| Decisions | `records.dir`, `.adr-dir`, `docs/adr`, `docs/decisions`, `doc/adr`, `docs/architecture/decisions`, `adr` |
| Instructions and constraints | `CLAUDE.md`, `AGENTS.md`, `CONSTRAINTS.md` |
| Personal preferences | Claude Code auto memory, which stays on your machine |
| Facts the code already shows | The code. They are never copied into documents. |

## What gets written

A decision is recorded only if it would change future work. That means a choice that is costly to reverse, or a refusal worth not reopening. Most interventions write nothing.

Records keep the project's existing format. If there is no convention, `assess` proposes MADR headings in `docs/decisions/`. An optional `proactive:` frontmatter block adds machine-readable details:

```yaml
---
status: accepted
date: 2026-05-10
proactive:
  scope:
    paths: ["src/billing/**"]
  enforcement: ask            # inform | ask
  review_after: 2027-06-01
  exceptions:
    - path: "src/billing/legacy/**"
      reason: Pending the ledger migration
      owner: billing-team
      expires: 2027-01-31
---
```

## Life of a decision

- Claude can write `proposed`. `accepted` requires your explicit choice.
- Refused structural proposals become `rejected`, so they are not reopened without a new fact.
- Old decisions are never deleted. They become `superseded by NNNN`.
- If a request conflicts with an accepted decision, Claude cites it. You can respect it, supersede it or add a dated exception.

## Making a decision harder to miss

From softest to strongest:

1. **Nothing extra.** `assess` finds relevant records when it runs. This suits most decisions.
2. **Path-scoped rule** in `.claude/rules/`, for a critical zone. Claude sees it when it touches those files, though possibly only after the first write of a new file.
3. **`permissions.ask` rule.** Claude Code asks you before the edit. This is the only one of the three that is enforced.
4. **An automated test or linter in CI.** The strongest form, and it costs no tokens.

## Security

Record contents are treated as data to cite, never as instructions. Review changes to decision records in pull requests as you would code, and consider CODEOWNERS for the folder.
