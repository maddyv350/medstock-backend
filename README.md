# MedStore Backend

Node.js + Express REST API backed by SQLite (via `better-sqlite3`).

## Run

```bash
npm install
cp .env.example .env   # optional; sane defaults are committed in .env
npm run seed           # create schema + sample data (run once)
npm start              # or: npm run dev  (watch mode)
```

Server: `http://localhost:4000`

> The server also **auto-seeds on boot if the database is empty**, so a fresh
> clone or a cloud deploy always has a working admin login without running the
> seed manually.

## Deploy to Render

This repo includes a [`render.yaml`](render.yaml) blueprint.

1. Push to GitHub (already done: `maddyv350/medstock-backend`).
2. Render Dashboard → **New → Blueprint** → select this repo → **Apply**.
   - Render reads `render.yaml`: builds with `npm install`, starts with
     `npm start`, health-checks `/api/health`, and generates a random
     `JWT_SECRET`.
3. When it goes live you'll get a URL like `https://medstock-backend.onrender.com`.
   Verify: open `…/api/health`.

Then point the clients at it:
- **Flutter app:** `flutter run --dart-define=API_URL=https://medstock-backend.onrender.com`
- **Admin panel:** build with `VITE_API_URL=https://medstock-backend.onrender.com/api`

### ⚠️ Data persistence
The **free** plan's disk is **ephemeral** — the SQLite file is wiped on every
deploy/restart (and the service spins down after ~15 min idle, so the first
request after a cold start is slow). Demo data is re-seeded automatically, but
anything added via the admin panel is **lost**.

To keep data, edit `render.yaml`: set `plan: starter` (paid), then uncomment the
`disk:` block and the `DATA_DIR=/var/data` env var, and redeploy. `DATA_DIR`
moves the SQLite file onto the mounted persistent disk. (For higher write
volume, migrating to Render Postgres is the longer-term option.)

## Demo accounts (created by the seed)

| Role  | Email             | Password   |
|-------|-------------------|------------|
| Admin | admin@medical.com | admin123   |
| Staff | staff@medical.com | staff123   |

## Data

SQLite file lives at `data/medical.db` (git-ignored). Delete it and re-run
`npm run seed` to reset to a clean sample dataset.

## API

All `/api/*` routes (except `/api/auth/login` and `/api/public/*`) require a
`Authorization: Bearer <token>` header.

### Auth
| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/auth/login` | `{ email, password }` → `{ token, user }` |
| GET  | `/api/auth/me` | current user |

### Products (auth)
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/products` | query: `search, category, status(low\|out\|expiring), sort, order` |
| GET | `/api/products/:id` | |
| POST | `/api/products` | create |
| PUT | `/api/products/:id` | update |
| PATCH | `/api/products/:id/stock` | `{ delta }` quick adjust |
| DELETE | `/api/products/:id` | |

### Categories / Shortages / Users (auth)
Standard REST CRUD at `/api/categories`, `/api/shortages`, `/api/users`
(user management is **admin-only**). Shortages support `status` and `priority`
filters.

### Dashboard (auth)
| GET | `/api/dashboard/stats` | totals, low-stock, expiring, by-category |

### Public (no auth — used by the Flutter app)
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/public/categories` | with product counts |
| GET | `/api/public/products` | query: `search, category`; returns `availability` (`in\|low\|out`), no cost price |
| GET | `/api/public/products/:id` | |
| GET | `/api/public/shortages` | unresolved shortages |

## Config (`.env`)
```
PORT=4000             # set automatically by Render
JWT_SECRET=...        # change in production
JWT_EXPIRES_IN=7d
CORS_ORIGIN=*         # or comma-separated origins
DATA_DIR=             # optional: dir for the SQLite file (e.g. /var/data on a Render disk)
```
