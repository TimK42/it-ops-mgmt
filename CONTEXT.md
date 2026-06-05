# CONTEXT.md — IT Operations Management

## Domain Glossary

### Tag

A user-defined label attached to a QA (Knowledge Base) entry for categorization and search.

- **Planned**: Tags will be stored in normalized `tags` + `qa_entry_tags` tables (replacing current comma-separated string).
- Each tag has a unique `name`, an `id`, and a usage `count` (number of QA entries linked).
- Tags are **case-sensitive** (displayed as-entered).

### Tag Frequency

The number of QA entries a tag is attached to, used for sorting autocomplete suggestions (most-used first).

### Chip Input

UI pattern where a typed tag becomes a removable chip/badge element after entry (Enter/comma). The chip shows the tag name and an ✕ button to remove it.

### Autocomplete Dropdown

When typing in the tag input field, a dropdown shows matching existing tags sorted by frequency (descending), filtered by the current input text (substring match).

### QA Entry

A knowledge-base record with `title`, `question`, `answer`, `category`, `tags`, and `status` (Published / Draft / Archived).

### Sub-System (Category)

A named group for organizing QA entries (e.g., "Network", "Password", "Account").

### Password

A credential used for user authentication. Stored as bcrypt hash in the `users` table. All passwords must comply with the Password Complexity rules.

### Password Complexity

A set of validation rules applied to all password creation and modification operations:

- **Minimum length**: 8 characters
- **Uppercase**: At least 1 letter (A–Z)
- **Lowercase**: At least 1 letter (a–z)
- **Digit**: At least 1 digit (0–9)
- **Special character**: At least 1 special character (!@#$%^&*()_+-=[]{}|;':",./<>?`~)

## Resolved Decisions

- **Tag input approach**: Chip input + autocomplete dropdown with frequency-based sorting (Issue #96).
- **Schema**: Normalized `tags` + `qa_entry_tags` junction tables (approved, not yet implemented — see #96).
- **Free-form tag creation**: Approved design — users may type and create tags not yet in the database.
- **Migration strategy**: Drop old `qa_entries.tags` column after migrating existing data (see #96 for timeline).
- **Search behavior**: Post-migration, tag search will use `LIKE` on the normalized tag name via JOIN.
- **Password complexity rules**: Min 8 chars, uppercase + lowercase + digit + special character. Applied to register, admin create, and change password (Issue #99).
- **Change password endpoint**: New endpoint at `POST /api/user/change-password` requiring current password verification + new password complexity check.
