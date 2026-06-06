# ADR-0002: Role-Based Access Control with Three Roles

Three roles (Admin, Editor, Viewer) with clearly bounded permissions — the Contributor role was renamed to Editor and its permissions narrowed (no hard-delete, no admin page access).

## Rationale

- **Hard to reverse**: RBAC touches the entire application — server.js middleware, all routes, and the frontend's UI rendering. Changing the permission model later means auditing every guard.
- **Surprising without context**: The distinction between "archive" (status change) and "delete" (hard delete) is subtle. The Editor role's exclusion from Sub-System and User pages is deliberate, not an oversight.
- **Real trade-offs**: Considered a flatter "two-role" system (Admin + User) but rejected — the Editor role provides a safe middle ground where content contributors can work without risking data loss (no hard delete) and without access to admin functions they don't need.

## Decision

- **Roles**: Admin, Editor, Viewer
- **Admin**: Full system access, including QA hard-delete, Sub-System CRUD, User management (create, approve, disable, reset passwords), and export.
- **Editor**: QA create, read, update, and archive (set status to Archived). Cannot hard-delete. No access to User management or Sub-System admin routes. Can export CSV.
- **Viewer**: QA read-only — all statuses visible (Published, Draft, Archived). Cannot create, edit, archive, delete, or export.

## Considered Options

- **Two roles (Admin + User)**: Simpler, but forces all content contributors into Admin just to edit QA entries.
- **More granular roles (e.g., Category Admin, User Manager)**: Over-engineered for current needs — the app has only a few resources and a small user base.
