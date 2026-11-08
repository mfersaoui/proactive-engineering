# Analysis axes

Pick only the axes this project needs. This list is a prompt, not a checklist. Add any axis it misses.

| Axis | Include when |
|---|---|
| Goal and non-goals | The real outcome or the success measure is unclear |
| Users and experience | People use it directly, or several surfaces must stay consistent |
| Data model | Durable data, concurrency, or a schema that is costly to change |
| Architecture and boundaries | New services, modules, or a change in who owns what |
| Technology choice | A new language, framework, or major dependency is on the table |
| Integrations | External systems, contracts, or webhooks are involved |
| Security and privacy | Auth, personal data, secrets, payments, or multi-tenant access |
| Reliability and operations | Uptime, deployment, rollback, monitoring, or on-call matter |
| Performance and scale | A credible load target exists, or known volumes are high |
| Migration and compatibility | Existing users, data, or API clients must keep working |
| Delivery and team | Deadlines, skills, or ownership constrain the options |
| Cost | Infrastructure, licences, or usage fees could be significant |
| Regulation | A legal or sector requirement applies |

For each proposed axis, give one sentence on why it matters here. Name the blocking unknowns. Rule out what does not apply, briefly, so the user can bring it back.
