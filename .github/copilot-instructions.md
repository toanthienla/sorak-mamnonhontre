# GitHub Copilot instructions

**Follow [`AGENTS.md`](../AGENTS.md) at the repo root — it is the single source of truth.**

Key rules (full detail in AGENTS.md):

- Backend layers are strict: Route → Controller → Service → Prisma. No logic in controllers.
- All input validation via Joi in `validators/`. Named exports only; routers use `export default`.
- Soft delete only (`deleted_at`), always filter `deleted_at: null`. Use `findFirst`, not `findUnique`, for soft-delete-aware queries.
- Responses via `res.success(data)` / `res.paginated(result)`. Errors via `HttpError` factories.
- User-facing text in Vietnamese; code, comments, commits, logs in English.
- Frontend: feature folders, TanStack Query via `@/shared/hooks/use-crud`, react-hook-form + zod, shadcn `@/components/ui/*`, sonner toasts.
- **Frontend layout/design: follow `sorak-web/UI_PATTERNS.md`** — copy its page skeleton, use only theme tokens (no hex), reuse the shared component catalog so every page looks identical.
- Match the nearest existing feature. Do not add new libraries, folders, or response shapes.
- Run Prettier before commit; formatting is shared, not personal.
