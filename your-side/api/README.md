# API

Service that ingests events from the SDK and exposes the public query API.

## Responsibilities

- Authenticate clients (bearer tokens / API keys).
- Validate incoming events against [`../docs/event-schema.md`](../docs/event-schema.md).
- Persist events to the database idempotently.
- Serve query endpoints per [`../docs/api-spec.md`](../docs/api-spec.md).
- Emit metrics, logs, and traces.

## Structure

```
api/
├── src/           # implementation
├── migrations/    # (or delegate to ../database)
└── tests/
```

## Status

Not yet implemented — scaffold only.
