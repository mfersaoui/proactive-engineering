# Compatibility

| Item | Status |
|---|---|
| Claude Code | Developed and validated on 2.1.319. Path-scoped rule timing has varied between versions. |
| Windows, macOS, Linux | No hooks or render-time shell, so the skills are platform-independent. Node.js checks run on all three in CI. |
| Node.js | Optional, 18 or later for `audit` and CI. Development uses 20 or later. |
| Sandbox | Claude Code has none on native Windows. Use WSL2 for autonomous work. |
| Non-interactive mode | `assess` presents options and stops when it cannot ask questions. |

## With other plugins

`assess` hands off to tools present in the session and does not depend on any of them.

| Plugin | Notes |
|---|---|
| agent-skills | Compatible file conventions (`docs/decisions`, `CONSTRAINTS.md`) |
| Compound Engineering | Complementary. Its learnings stay in `docs/solutions`. |
| Superpowers | May repeat questions, since it strongly encourages its own brainstorming |

Coexistence has not been measured yet.

## Portability

| Layer | Portability |
|---|---|
| Decision records and configuration | Plain Markdown and YAML, usable by any tool |
| Skills | Follow the [Agent Skills](https://agentskills.io/specification) format. `disable-model-invocation` and `${user_config.*}` are specific to Claude Code. |
| Triage rule | `.claude/rules/` is specific to Claude Code. The same text can go in `AGENTS.md` for other agents. |
| Permission rules | Specific to Claude Code |
