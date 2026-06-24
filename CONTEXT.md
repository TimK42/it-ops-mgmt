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

- **New entries default to Draft** — users create entries as Draft, then an Admin explicitly publishes them
- **Edit preserves status** — editing a Published entry keeps it Published; editing a Draft entry keeps it Draft
- **Published → Draft** is NOT allowed via edit — only Archive is the reverse operation for Published entries

### Unarchive

The inverse operation of Archive (Issue #134). Sets an Archived QA entry's status back to Draft. **Admin-only** (Issue #146) — only the Admin role sees the Unarchive button in the detail modal footer (replaces the Archive button when status is Archived, same position). No confirmation dialog. Implemented via existing PUT /api/qa/:id with status='Draft'.

### Role

A named authorization level assigned to every user, determining what resources they can access and what operations they can perform.

### Admin

A privileged role with full system access. The only role that can manage **Users** and **Sub-Systems**, hard-delete QA entries, approve pending registrations, and **publish** QA entries (Draft → Published).

### Editor

A role focused on content contribution. Can create, read, update, and archive QA entries, but **cannot** unarchive or hard-delete them. Unarchive is Admin-only (Issue #146). Has no access to User management or Sub-System administration.

- Can create new QA entries (always Draft)
- Can edit Draft entries (stays Draft)
- Can edit Published entries (stays Published — cannot un-publish via edit)
- **Cannot publish** — only Admin can promote Draft → Published
- **Cannot unarchive** — only Admin can restore Archived → Draft

### Viewer

A read-only role. Can view only Published QA entries. Cannot see Draft or Archived entries. Cannot create, edit, archive, delete, or export QA entries.

> **Note:** The UI currently does not enforce Viewer-only-Published filtering on the backend. Viewers can see Draft/Archived entries if they know the URL or use the API directly. This should be enforced server-side in a future change.

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
- **Special character**: At least 1 special character (!@#$%^&\*()\_+-=[]{}|;':",./<>?`~)

## Resolved Decisions

- **Role-based access control**: Three roles — Admin (full access), Editor (QA CRUD+Archive, no delete, no admin pages), Viewer (read-only). See ADR-0002.
- **Tag input approach**: Chip input + autocomplete dropdown with frequency-based sorting (Issue #96).
- **Schema**: Normalized `tags` + `qa_entry_tags` junction tables (approved, not yet implemented — see #96).
- **Free-form tag creation**: Approved design — users may type and create tags not yet in the database.
- **Migration strategy**: Drop old `qa_entries.tags` column after migrating existing data (see #96 for timeline).
- **Search behavior**: Post-migration, tag search will use `LIKE` on the normalized tag name via JOIN.
- **Password complexity rules**: Min 8 chars, uppercase + lowercase + digit + special character. Applied to register, admin create, and change password (Issue #99).
- **Change password endpoint**: New endpoint at `POST /api/user/change-password` requiring current password verification + new password complexity check.
- **QA Draft-as-default workflow**: New entries always created as Draft. Only Admin can Publish (Draft → Published). Editing preserves the current status (Editor can edit Published but it stays Published). Admin-only publish prevents Editors from accidentally un-publishing content. **Viewer only sees Published** — Draft and Archived entries are hidden from Viewer role.

### Forced Password Reset

An Admin-initiated password reset that sets a new password for a user and marks their account so they must change it on next login. All existing sessions are invalidated.

- Admin provides the new password (must satisfy Password Complexity rules).
- `must_change_password` flag is set to `1` on the user record.
- All sessions for that user are deleted from the database.
- On login, the server checks the flag and returns a special response; the frontend redirects to the change-password form.
- After successful change-password, the flag is cleared.

## Resolved Decisions

- **Mobile search box behavior** (Issue #231): Remove global `.search-box { width: 100%; }` from `@media (max-width: 768px)`. Use `flex: 1 1 150px` for search boxes in QA toolbar and Users page (minimum 150px, grows to fill remaining space). QA toolbar mobile layout: two rows — filters row (tabs) + controls row (search + sort + actions), controls right-aligned, Export/New Entry may wrap.
- **Sort select labels**: Changed from "By Popularity" / "By Newest" to "Popular" / "Newest" across all screen sizes.

- **Password reset approach**: Admin-mediated direct password set (no email, no security questions). Admin provides the new password directly.
- **Force change on login**: After admin reset, user must change password on next login.
- **Session invalidation**: All existing sessions for the user are deleted on admin reset.
