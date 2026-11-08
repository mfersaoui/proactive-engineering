---
status: accepted
date: 2026-03-02
---
# Use PostgreSQL as the system of record

## Context and Problem Statement
Orders need transactions across customers, orders and invoices.

## Decision Outcome
Chosen option: PostgreSQL, because accounting requires multi-table ACID transactions and the team already operates it.

### Consequences
Any move to another primary database requires a superseding ADR.
