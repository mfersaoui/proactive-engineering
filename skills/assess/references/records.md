# Recording a decision

**Durability test.** Write a record only if it will change future work: a choice that is costly to reverse, or a refusal worth not reopening. If not, write nothing.

## Where and how

Use the project's existing decision folder, numbering and template. Do not create a parallel system. If there is none, ask once, then use `docs/decisions/NNNN-short-title.md` with MADR headings.

```markdown
---
status: accepted            # proposed | accepted | rejected | deprecated | superseded by 0012
date: YYYY-MM-DD
decision-makers: [names]
proactive:                  # optional, only when useful
  scope:
    paths: ["src/billing/**"]
  enforcement: inform       # inform | ask
  review_after: YYYY-MM-DD
  exceptions:
    - path: "src/billing/legacy/**"
      reason: Short reason
      owner: name
      expires: YYYY-MM-DD
---
# Short title

## Context and Problem Statement
## Considered Options
## Decision Outcome
Chosen option: "...", because ...
### Consequences
```

Keep it short. Do not restate what the code already shows.

## Rules

- `accepted` requires the user's explicit choice. Otherwise use `proposed`.
- A refused structural proposal becomes `status: rejected`, so it is not reopened without a new fact.
- Never delete an old decision. Write a new one and mark the old one `superseded by NNNN`.
- `enforcement: ask` is only real when a matching `permissions.ask` rule exists. Suggest that the user runs `setup` to add it.
- Add a path-scoped rule only for a critical zone, and only if the user agrees. Most decisions need none.
- Never put secrets or personal data in a record.
