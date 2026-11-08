# Hand-off map

Proactive Engineering decides what deserves attention. Other tools do the work. Suggest a tool only if it is available in this session, and suggest at most one or two.

| Need | Built in | If installed |
|---|---|---|
| Plan a change | Plan mode | `feature-dev`, `ce-plan`, `writing-plans`, `/plan` |
| Interview the user for a spec | Direct questions | `interview-me`, `grill-me`, `brainstorming` |
| Review a diff | `/code-review` | `pr-review-toolkit`, `coderabbit` |
| Security review | `/security-review` | `security-guidance`, `semgrep`, `sonarqube` |
| Confirm the change works | `/verify`, project tests | `verification-before-completion` |
| Simplify code | `/simplify` | `code-simplifier` |
| Large mechanical change | `/batch` | |
| Dependency and supply-chain risk | | `socket`, the project's scanners |

Do not repeat an analysis that the chosen tool will do. Pass it the goal, the constraints, the decision taken and the decisions to respect.
