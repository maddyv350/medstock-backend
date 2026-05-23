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
PORT=4000
JWT_SECRET=...        # change in production
JWT_EXPIRES_IN=7d
CORS_ORIGIN=*         # or comma-separated origins
```
