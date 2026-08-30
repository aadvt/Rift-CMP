# SDK

Client SDK that captures events, batches them, and delivers them to the
ingestion API.

## Responsibilities

- Provide an ergonomic API for integrators to record events.
- Validate events against [`../docs/event-schema.md`](../docs/event-schema.md).
- Batch, compress, and transmit events with retry and backoff.
- Buffer during outages; drop or spill according to configured limits.

## Structure

```
sdk/
├── src/         # implementation
├── tests/       # unit and integration tests
└── examples/    # usage samples
```

## Status

Not yet implemented — scaffold only.
