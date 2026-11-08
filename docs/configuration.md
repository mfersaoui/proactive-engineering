# Configuration

Everything has a default. With no configuration file, the plugin uses the `balanced` profile.

## Layers

| Layer | Where | Purpose |
|---|---|---|
| Plugin | Defaults below | No project facts |
| User | `/plugin configure proactive-engineering@proactive-engineering` | Your default profile |
| Project | `.proactive/config.yaml`, committed | Team policy. Keep only what differs. |
| Local | `.proactive/config.local.yaml`, git-ignored | Your own adjustments in this checkout |

Precedence, strongest first: your explicit instruction in the conversation, local, project, user, defaults. Your instruction can change a preference, but it cannot go below the project's `floor` or bypass Claude Code permissions.

## Keys

```yaml
profile: balanced             # observer | balanced | driver
intensity:
  max: 3                      # 1 to 3, limits analysis depth only
interruptions:
  per_session: 3              # level 2 notes before batching them
  timing: boundaries          # boundaries | immediate
research:
  web: ask                    # allow | ask | never
records:
  dir: auto                   # auto, or a path inside the project
journal: false                # local log of level 2 and 3 interventions
actions:
  add_dependency: ask
  change_public_api: ask
  change_data_model: ask
  change_auth: ask
  change_infrastructure: ask
  db_migration: propose_only
  destructive: ask
  production: forbid
floor: {}                     # same categories; local settings cannot go below these
```

## Profiles

| Profile | Levels 1 and 2 | Level 3 |
|---|---|---|
| `observer` | Silent unless an accepted decision would be violated | Stops for you |
| `balanced` | Level 1 cites, level 2 stops before writing | Stops for you |
| `driver` | Level 2 states its reasoning, then continues with the recommendation | Stops for you |

## Action categories

| Value | Meaning |
|---|---|
| `silent` | No comment |
| `inform` | One line, then continue |
| `ask` | Asks before doing it |
| `propose_only` | Prepares the change for you and does not apply it |
| `forbid` | Refuses and explains |

## What is enforced

Configuration tells Claude how to behave. It is guidance, and the model could fail to follow it. For a real guarantee, use `permissions.ask` or `deny` rules in `.claude/settings.json`, which Claude Code applies itself. `setup` can propose them.

`node scripts/check-records.mjs` validates these files, and `audit` reports the result.
