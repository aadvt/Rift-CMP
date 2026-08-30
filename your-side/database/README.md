# Database

Schema definitions, migrations, and seed data for the store backing the API.

## Responsibilities

- Own the migration history (forward-only).
- Match [`../docs/database-schema.md`](../docs/database-schema.md).
- Provide seed/fixture data for local development and tests.

## Structure

```
database/
├── migrations/   # ordered migration files (up/down)
├── seeds/        # development seed data
└── README.md
```

## Conventions

- One logical change per migration.
- Never edit a migration that has been merged/applied — add a new one.

## Status

Not yet implemented — scaffold only.
