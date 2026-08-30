# Architecture

## Overview

Describe the high-level system: what our side is responsible for, what the other
side owns, and where the boundary sits.

```
┌───────────┐        events         ┌───────────┐       ┌────────────┐
│    SDK     │ ───────────────────▶ │    API     │ ────▶ │  Database  │
└───────────┘                       └───────────┘       └────────────┘
      │                                   │
      │            other side  ◀──────────┘
```

## Components

### SDK (`sdk/`)
- Language / runtime targets
- Responsibilities: event capture, batching, transport, retries
- Public surface consumed by integrators

### API (`api/`)
- Framework / runtime
- Responsibilities: authentication, validation, ingestion, query endpoints
- Scaling and deployment model

### Database (`database/`)
- Engine and version
- Responsibilities: durable storage, indexing, retention

## Data flow

1. SDK collects an event and validates it against the [event schema](event-schema.md).
2. SDK sends a batch to the API.
3. API authenticates, validates, and persists to the database.
4. Consumers read via the [API spec](api-spec.md).

## Cross-cutting concerns

- **Auth:** how clients and services authenticate
- **Observability:** logging, metrics, tracing
- **Error handling:** retry, dead-letter, backpressure
- **Versioning:** how schema and API versions evolve

## Open questions

- [ ] TBD
