# CLAUDE.md

**Read [AGENTS.md](./AGENTS.md) first — it is the single source of truth for this repo.**

All coding rules (stack, layer architecture, file templates, naming, error handling,
soft delete, Vietnamese-UI / English-code, formatting, git) live in `AGENTS.md`.
Follow it exactly. When unsure, copy the nearest existing file of the same kind.

For frontend layout/design consistency, also follow [sorak-web/UI_PATTERNS.md](./sorak-web/UI_PATTERNS.md):
copy its standard page skeleton, use only theme tokens (no hex), reuse the shared component catalog.

Do not introduce new libraries, folders, response shapes, or error patterns without
team agreement. Put business logic in the service layer — never in controllers or routes.
