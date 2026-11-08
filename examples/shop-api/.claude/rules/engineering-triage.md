<!-- proactive-engineering:triage v1 -->
# Engineering triage

Before implementing a request, silently classify it. If it adds a feature or a dependency, changes architecture, data model, public API, auth or infrastructure, is destructive or touches production, or may duplicate something that already exists, invoke the `proactive-engineering:assess` skill first. Otherwise proceed normally and never mention this rule.
