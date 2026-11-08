# Security

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting on this repository rather than a public issue. Include the affected version, steps to reproduce and the impact.

## Design principles

- **No hooks, MCP servers or background processes.** The plugin runs no code on its own.
- **No render-time shell commands** in skills.
- **No network calls, telemetry or dependencies** in the plugin. `scripts/check-records.mjs` only reads files and never writes.
- **Writes need your agreement.** `setup` shows changes first and never adds `allow` rules. `audit` is instructed to stay read-only, and Claude Code permissions still apply to any write.
- **Project content is data.** Decision records, documents and external pages are cited, never followed as instructions.
- **Secrets stay out.** Records must not contain secrets. `setup` only tests whether `ANTHROPIC_API_KEY` is present and never prints it.

## What this plugin does not protect against

Proactive Engineering is advisory. It is not a security boundary.

- Skills and rules are instructions that a model can fail to follow.
- `permissions.ask` and `deny` rules match command text and can be bypassed by indirect commands.
- A malicious decision record may still influence the model, despite the instructions above. Review changes to these files.
- Claude Code has no sandbox on native Windows.

For real protection, combine Claude Code permissions, sandboxing (WSL2 on Windows), least-privilege credentials, separate production access and backups. Never leave production credentials reachable from an autonomous session.

## Supply chain

Install from a source you trust and pin a version where possible. Changes to `skills/`, `scripts/` and the manifests deserve the closest review.
