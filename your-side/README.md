# Your Side

This directory contains our side of the Rift-CMP integration: the SDK, API, and
database components, along with the shared contracts that define how the two
sides communicate.

## Layout

| Path         | Purpose                                                        |
|--------------|---------------------------------------------------------------|
| `docs/`      | Architecture, schemas, and the cross-team integration contract |
| `sdk/`       | Client SDK that emits events and talks to the API              |
| `api/`       | Service that ingests events and exposes the public API         |
| `database/`  | Schema definitions, migrations, and seed data                  |

## Documentation

- [Architecture](docs/architecture.md)
- [Event Schema](docs/event-schema.md)
- [API Spec](docs/api-spec.md)
- [Database Schema](docs/database-schema.md)
- [Integration Contract](docs/integration-contract.md)

## Getting started

1. Read [`docs/architecture.md`](docs/architecture.md) for the big picture.
2. Review [`docs/integration-contract.md`](docs/integration-contract.md) before
   changing anything that crosses the team boundary.
3. See the per-component READMEs in `sdk/`, `api/`, and `database/`.
