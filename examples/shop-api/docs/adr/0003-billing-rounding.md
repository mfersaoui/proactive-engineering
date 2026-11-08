---
status: accepted
date: 2026-05-10
decision-makers: [billing-team]
proactive:
  scope:
    paths: ["src/billing/**"]
  enforcement: ask
---
# Round invoice totals only at the end

## Context and Problem Statement
Rounding each line produced totals that did not match the accounting system.

## Decision Outcome
Chosen option: "Round the final total only", because it matches the accounting system.
