# sorak-api

Express.js backend. Same DB, same endpoints, same response shape as legacy `sorak-api-nestjs`.

## Stack

- **Express 4** (JavaScript ESM)
- **Prisma 6** (shared schema with sorak-api)
- **Joi** validation
- **JWT** auth (`jsonwebtoken`)
- **multer** + **exceljs** for Excel import/export
- **pino** structured logger

## Setup

```bash
npm install
npx prisma generate
npm run db:seed   # creates BGH admin from SEED_ADMIN_* env
npm run dev       # http://localhost:3000 (or PORT env)
```

> Default port `3000` (matches frontend `VITE_API_URL=http://localhost:3000/api`). Stop legacy `sorak-api-nestjs` before running to avoid port clash.

## Folder structure

```
src/
├── server.js              # bootstrap + graceful shutdown
├── app.js                 # express factory + middleware chain
├── config/
│   ├── env.js             # Joi-validated env loader
│   └── prisma.js          # singleton PrismaClient
├── middlewares/
│   ├── auth.js            # JWT verify → req.user
│   ├── roles.js           # requireRoles('BGH'|'GV')
│   ├── validate.js        # Joi schema runner
│   ├── upload.js          # multer .xlsx
│   ├── error-handler.js   # global error → {success:false, code, message}
│   ├── response-wrapper.js # res.success() / res.paginated()
│   └── request-id.js      # X-Request-Id for traceId
├── routes/                # one file per module
├── controllers/           # thin — parse req → call service → respond
├── services/              # business logic (1:1 with Nest services)
├── validators/            # Joi schemas
└── utils/                 # paginate, async-handler, http-error, logger
```

## Endpoints (under `/api`)

| Module         | Endpoints                                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Auth           | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `GET /auth/me` |
| Accounts       | full CRUD + `PATCH /:id/role` + `POST /:id/restore` (BGH only)                                                                           |
| Academic Years | full CRUD + `PATCH /:id/activate`                                                                                                        |
| Classes        | full CRUD + `POST /import` + `GET /export/excel`                                                                                         |
| Teachers       | full CRUD + `PATCH /:id/restore` + `POST /import` + `GET /export/excel`                                                                  |
| Students       | full CRUD + `POST /:id/parents` + `PATCH /:id/restore` + `POST /import` + `GET /export/excel`                                            |

## Response shape

```json
// success
{ "success": true, "data": ..., "meta": { ... } }

// error
{ "success": false, "code": "CONFLICT", "message": "...", "traceId": "...", "timestamp": "...", "path": "/api/..." }
```

## Roles

- `BGH` — admin (all writes)
- `GV` — teacher (read-only on most modules)
