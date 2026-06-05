# ADR-0001: Normalized tag schema for QA entries

**Status:** Accepted

Replace the comma-separated `qa_entries.tags` string column with normalized `tags` + `qa_entry_tags` junction tables to support chip input UI, frequency-based autocomplete sorting, and efficient tag queries at scale.

## Considered Options

- **Keep string column** — simpler, no schema change, but `LIKE '%tag%'` queries are slow at scale and counting tag frequency requires parsing every row.
- **Normalized tables** — `tags(name UNIQUE)` + `qa_entry_tags(junction)` — enables indexed queries, accurate frequency counts, and clean FK constraints.

## Consequences

- Existing `qa_entries.tags` column will be dropped after the one-time data migration.
- New `GET /api/tags` endpoint needed to return `[{name, count}]` sorted by frequency.
- All QA entry create/update paths must write to the junction table instead of the string column.
- Tag search on the backend changes from `WHERE tags LIKE` to JOIN-based queries.
