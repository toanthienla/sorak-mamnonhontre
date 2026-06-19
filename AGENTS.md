# AGENTS.md — Sorak Project Rulebook (read before writing any code)

> This is the **single source of truth** for how code is written in this repo.
> Every developer **and every AI assistant** (Claude Code, Cursor, Copilot, etc.) must follow it.
> Goal: one consistent codebase — not "mỗi người code một kiểu".
> When unsure: **copy the nearest existing file of the same kind.** Consistency beats cleverness.

---

## 0. Golden rules (the 10 that matter most)

1. **Match existing patterns.** Before writing a feature, open a similar one and mirror its structure, naming, and style.
2. **Strict layers** (backend): Route → Controller → Service → Prisma. Never skip or mix.
3. **No logic in controllers.** Controllers only read `req`, call a service, send a response.
4. **All validation via Joi** in `validators/`. Controllers/services never re-validate shapes.
5. **Soft delete only**: set `deleted_at`, never hard-delete. Always filter `deleted_at: null`.
6. **User-facing text = Vietnamese. Code, comments, commits, logs = English.**
7. **Named exports only** (services + controllers). No `export default` except routers.
8. **One response shape**: `res.success(data)` / `res.paginated(result)` — never `res.json` raw.
9. **Run `npm run format` before commit** (Prettier). The pre-commit hook enforces it.
10. **Don't invent new top-level folders, libraries, or response shapes** without team agreement.

---

## 1. Stack (do not swap libraries)

**Backend (`sorak-api`)** — Node 22, Express 4, Prisma 6 + PostgreSQL 16, Joi, JWT (httpOnly cookies), bcrypt, Multer + Cloudinary/MinIO (S3), Nodemailer, Pino, ExcelJS, node-cron.

**Frontend (`sorak-web`)** — React 19 + Vite, TanStack Query v5, react-hook-form + zod, Tailwind + shadcn/ui (Radix), Zustand, axios, Recharts, sonner, date-fns.

Use what's already installed. Need a new dependency → ask the team first.

---

## 2. Repo layout

```
sorak-mamnonhontre/
  sorak-api/                 Express backend
    src/
      routes/        <feature>.routes.js     — mount path + middleware, no logic
      controllers/   <feature>.controller.js — thin: req → service → res
      services/      <feature>.service.js     — business logic + Prisma
      validators/    <feature>.schema.js      — Joi schemas only
      middlewares/   auth, roles, validate, upload, error-handler, ...
      utils/         http-error, paginate, async-handler, search, logger
      config/        prisma, env
      data/          static data (e.g. who-lms.json)
    prisma/          schema.prisma + migrations/
  sorak-web/                 React frontend
    src/
      features/<domain>/     <Domain>Page.jsx, tabs, modals, <domain>-shared.js
      shared/                api/, hooks/, components/, stores/, utils/, lib/
      components/ui/         shadcn primitives (do not edit by hand)
      app/                   router.jsx, layouts/, providers.jsx
```

One feature = one folder/file set on each side. Name them the same domain word on both ends.

---

## 3. Backend conventions

### 3.1 Layer responsibilities (strict)

| Layer      | DOES                                                                                    | NEVER                                   |
| ---------- | --------------------------------------------------------------------------------------- | --------------------------------------- |
| Route      | mount path, attach `authMiddleware`, `requireRoles`, `validate`, wrap in `asyncHandler` | business logic, DB calls                |
| Controller | read from `req`, call service, `res.success()` / `res.paginated()`                      | validation, Prisma, cookies-in-service  |
| Service    | business rules, Prisma queries, throw `HttpError`                                       | parse `req`, set cookies, send response |
| Validator  | Joi schema only, named `<verb><Noun>Schema`                                             | any logic                               |
| Middleware | cross-cutting (auth, roles, validate, upload)                                           | feature logic                           |

### 3.2 File templates — copy these exactly

**Validator** — `validators/<feature>.schema.js`

```js
import Joi from 'joi';
import { paginationSchema } from './common.schema.js';

export const createThingSchema = Joi.object({
  name: Joi.string().max(150).required(),
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .optional(),
});

export const updateThingSchema = Joi.object({
  name: Joi.string().max(150),
}).min(1);

export const queryThingSchema = paginationSchema.keys({
  search: Joi.string().optional(),
  is_active: Joi.string().valid('true', 'false').optional(),
});
```

**Service** — `services/<feature>.service.js`

```js
import prisma from '../config/prisma.js';
import { paginate } from '../utils/paginate.js';
import { NotFound, BadRequest } from '../utils/http-error.js';

const SELECT = { thing_id: true, name: true, is_active: true };

export async function assertExists(id) {
  const row = await prisma.thing.findFirst({ where: { thing_id: id, deleted_at: null } });
  if (!row) throw NotFound('Không tìm thấy mục này');
  return row;
}

export async function findAll(query, user) {
  const { page, pageSize, search } = query;
  const where = { deleted_at: null };
  if (search) where.name = { contains: search, mode: 'insensitive' };
  const [rows, total] = await Promise.all([
    prisma.thing.findMany({ where, select: SELECT, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.thing.count({ where }),
  ]);
  return paginate(rows, total, page, pageSize);
}

export async function findOne(id) {
  return assertExists(id);
}

export async function create(dto, actorId) {
  return prisma.thing.create({ data: { ...dto, created_by: actorId } });
}

export async function update(id, dto) {
  await assertExists(id);
  return prisma.thing.update({ where: { thing_id: id }, data: dto });
}

export async function softDelete(id) {
  await assertExists(id);
  return prisma.thing.update({ where: { thing_id: id }, data: { deleted_at: new Date() } });
}
```

**Controller** — `controllers/<feature>.controller.js` (one line per handler)

```js
import * as svc from '../services/<feature>.service.js';

export async function findAll(req, res) {
  res.paginated(await svc.findAll(req.query, req.user));
}
export async function findOne(req, res) {
  res.success(await svc.findOne(Number(req.params.id)));
}
export async function create(req, res) {
  res.success(await svc.create(req.body, req.user.sub));
}
export async function update(req, res) {
  res.success(await svc.update(Number(req.params.id), req.body));
}
export async function remove(req, res) {
  res.success(await svc.softDelete(Number(req.params.id)));
}
```

**Routes** — `routes/<feature>.routes.js`

```js
import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRoles } from '../middlewares/roles.js';
import {
  createThingSchema,
  updateThingSchema,
  queryThingSchema,
} from '../validators/<feature>.schema.js';
import * as ctrl from '../controllers/<feature>.controller.js';

const router = Router();
router.use(authMiddleware);

router.get('/', validate(queryThingSchema, 'query'), asyncHandler(ctrl.findAll));
router.get('/:id', asyncHandler(ctrl.findOne));
router.post('/', requireRoles('PRINCIPAL'), validate(createThingSchema), asyncHandler(ctrl.create));
router.patch(
  '/:id',
  requireRoles('PRINCIPAL', 'TEACHER'),
  validate(updateThingSchema),
  asyncHandler(ctrl.update),
);
router.delete('/:id', requireRoles('PRINCIPAL'), asyncHandler(ctrl.remove));

export default router;
```

Then register it in `routes/index.js`: `router.use('/things', thingsRoutes);`

### 3.3 Errors — always `HttpError`, Vietnamese message

```js
import { BadRequest, NotFound, Conflict, Forbidden, Unauthorized } from '../utils/http-error.js';
throw NotFound('Không tìm thấy học sinh');
throw Conflict(`Năm học ${name} đã tồn tại`);
throw BadRequest('Ngày kết thúc phải sau ngày bắt đầu');
```

Never `return res.status(...).json(...)` from a service. Never leak raw Prisma errors — the global error handler maps them.

### 3.4 Prisma rules

- Always filter `deleted_at: null` (except explicit "archived" views).
- `findFirst` for one-by-condition (soft-delete safe); `findUnique` only for true unique keys.
- Smallest `select`/`include` that satisfies the response — never return whole rows blindly.
- Single write → no transaction. Multiple writes → `prisma.$transaction([...])` or `(tx) => {}`. Never nest transactions.
- Field names are `snake_case` (match DB): `student_id`, `school_year_id`, `deleted_at`.

### 3.5 Roles

`PRINCIPAL` (full admin) · `TEACHER` (own classes/students only — scope by `teacher_classes`) · `PARENT` (self-view, logs in by student card number). Enforce with `requireRoles(...)` on routes AND data-scope inside services for TEACHER.

---

## 4. Frontend conventions

> **For visual/layout consistency (same page look across all features), follow [`sorak-web/UI_PATTERNS.md`](./sorak-web/UI_PATTERNS.md).** It has the exact page skeleton, design tokens, and component catalog every page must copy. This section covers the code side; UI_PATTERNS covers the design side.

### 4.1 Feature folder

```
features/<domain>/
  <Domain>Page.jsx        main page (or a Tabs container)
  <Domain>Tab.jsx         one tab if the page has tabs
  <Domain>Modal.jsx       heavy modal
  <domain>-shared.js(x)   constants, column defs, small shared bits
```

### 4.2 Data fetching — TanStack Query via shared hooks

```js
import { useList, useCreate, useUpdate, useDelete } from '@/shared/hooks/use-crud';

const { data } = useList('things', '/things', { page, pageSize: 20, search });
const create = useCreate('things', '/things');
await create.mutateAsync(payload); // invalidation handled by the hook
```

Never create per-feature axios instances or interceptors — use `@/shared/api/client`.

### 4.3 Forms — react-hook-form + zod

```js
const form = useForm({ resolver: zodResolver(schema) });
form.reset({ name: '' });                    // reset on open
// submit button disabled when nothing changed:
disabled={!form.formState.isDirty && !extraDirty}
```

### 4.4 UI

- All user-facing strings **Vietnamese**. Variable/function names English.
- Toasts via `sonner`: `toast.success(...)` / `toast.error(...)`; generic fallback for unknown backend errors.
- Use `@/components/ui/*` (shadcn) — don't hand-roll buttons/dialogs.
- Tables/pagination/headers via existing `@/shared/components/*` (`data-pagination`, `page-header`, `confirm-dialog`, `column-toggle`, `detail-sheet`).
- Persist per-tab UI state with a Zustand store when it must survive navigation.

---

## 5. Naming & response shape (cheat sheet)

| Topic                      | Rule                                                                             |
| -------------------------- | -------------------------------------------------------------------------------- |
| API base URL               | `/api` (relative, same origin)                                                   |
| Success response           | `res.success(data)` → `{ success, data }`                                        |
| List response              | `res.paginated(result)` → `{ success, data, meta }`                              |
| Validator name             | `<verb><Noun>Schema` (`createStudentSchema`)                                     |
| Service/Controller exports | named, mirror handler names (`create`, `findAll`, `findOne`, `update`, `remove`) |
| Route params               | `:id` numeric; `:parentId` for non-PK FK                                         |
| DB fields                  | `snake_case` matching Prisma/DB                                                  |
| Dates                      | store `DateTime`; parse `new Date(dto.field)`; empty string → `null`             |
| Files                      | `kebab-case.js` backend utils; `PascalCase.jsx` React components                 |

---

## 6. Git, commits, PRs

- Branch: `<type>/<short-desc>` — `feat`, `fix`, `refactor`, `chore`, `docs`.
- Commit: `<type>(<scope>): <imperative summary ≤72 chars>` — e.g. `feat(students): add export to excel`.
- One commit = one coherent change. Each commit should build and run.
- Before push: `npm run format`, `npm run lint`, no `console.log`, no commented-out blocks.
- PR description states **what changed + why** and lists endpoints/pages touched. Squash on merge.

---

## 7. Formatting (auto — no debate)

Prettier config + EditorConfig live at repo root. `.gitattributes` forces LF.

- Run once: `npm install` at repo root (activates the husky pre-commit hook) and in each app.
- Install the **Prettier - Code formatter** VS Code extension + enable **Format On Save**.
- `npm run format` formats everything; the pre-commit hook formats staged files automatically.
- Never override formatting per-file. Settings are shared, not personal.

---

## 8. For AI assistants specifically

- **Read this file first.** Then open the nearest existing feature and mirror it.
- **Do not introduce** new libraries, folders, response shapes, or error patterns.
- **Do not refactor** unrelated code in a feature PR.
- Keep the layer split; put logic in the **service**, not the controller or route.
- Use Vietnamese only for user-facing strings; everything else English.
- Prefer the smallest change that fits the existing pattern over a "better" rewrite.
- If a requirement conflicts with this file, **flag it** instead of silently diverging.

---

## 9. Definition of done (check before PR)

- [ ] Route → Controller → Service → Validator split respected
- [ ] Joi schema added/updated; controller stays thin
- [ ] `deleted_at: null` filters in place; soft delete used
- [ ] Vietnamese user messages, English code/logs
- [ ] Response via `res.success` / `res.paginated`
- [ ] TEACHER data-scoping applied where relevant
- [ ] `npm run format` + `npm run lint` clean, no `console.log`
- [ ] Matches the nearest existing feature's structure

> When in doubt: **match the nearest existing pattern, not a textbook one.** This repo values consistency over novelty.
