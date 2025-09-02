# Lab 4 — Database Integration (Neon Postgres + Drizzle ORM)

**Course:** COMP3330 – Practical Full‑Stack Web Dev  
**Week:** 4  
**Estimated time:** 120–180 minutes  
**Goal:** Replace the in‑memory array with a real **PostgreSQL** database on **Neon**, using **Drizzle ORM** for schema, queries, and migrations.

> You will extend your Lab 2/3 server. Keep the same repo.

---

## ✅ Learning Outcomes
By the end of this lab you can:
- Provision a **Neon** Postgres database and connect via a secure URL.
- Define a **Drizzle ORM** schema and generate migrations.
- Run migrations and **persist** expenses.
- Rewrite your routes to use the database for **GET/POST/PUT/PATCH/DELETE**.
- Test the DB‑backed API with **curl**.

---

## 🛠 Prerequisites
- Completed Labs **1–3** with `server/routes/expenses.ts` implemented.
- Neon account (free) and a project ready to create a new database.

---

## 1) Install Dependencies
From project root:

```bash
bun add drizzle-orm @neondatabase/serverless
bun add -d drizzle-kit dotenv
```

- `drizzle-orm`: the ORM.  
- `@neondatabase/serverless`: HTTP driver for Neon (works great with Bun).  
- `drizzle-kit`: CLI for generating migrations.  
- `dotenv`: load env variables in scripts.

---

## 2) Configure Drizzle Kit
Create **`drizzle.config.ts`** in the project root:

```ts
// drizzle.config.ts
import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

Update **`package.json`** scripts (add these):

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

> `push` will create/update tables directly. If your environment blocks `push`, use `generate` and run migrations with a script (optional path described later).

---

## 3) Create .env and Connect to Neon
Create **`.env`** (and commit a safe **`.env.example`** without credentials):

```
# .env
DATABASE_URL="https://<YOUR-NEON-USER>:<PASSWORD>@<NEON_HOST>/<DB_NAME>?sslmode=require"
```

> In Neon, copy the **HTTP** connection string (not the pooled driver). It often looks like:  
> `https://user:password@ep-xxxx-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require`

Create **`.env.example`**:

```
DATABASE_URL=""
```

---

## 4) Define Drizzle Schema
Create **`server/db/schema.ts`**:

```ts
// server/db/schema.ts
import { pgTable, serial, varchar, integer } from 'drizzle-orm/pg-core'

export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 100 }).notNull(),
  amount: integer('amount').notNull(), // store cents or whole units (we use int here)
})
```

> We’ll keep it simple: `id`, `title`, `amount` (int). You can switch to cents later.

---

## 5) Drizzle DB Client
Create **`server/db/client.ts`**:

```ts
// server/db/client.ts
import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql, { schema })
export { schema }
```

---

## 6) Create Tables (Run Migrations)
With schema in place, create tables with **push** (simplest path):

```bash
bun run db:push
```

> If you prefer migrations files: `bun run db:generate` to create SQL in `server/db/migrations/`, then run them using `drizzle-kit push` or a migrator script. For this lab, `db:push` is acceptable.

Confirm table creation using Drizzle Studio (optional):

```bash
bun run db:studio
```

---

## 7) Rewrite Routes to Use the DB
Open **`server/routes/expenses.ts`** and replace in‑memory operations with Drizzle calls. Suggested implementation (adapt to your file):

```ts
// server/routes/expenses.ts (excerpt)
import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { db, schema } from '../db/client'
import { eq } from 'drizzle-orm'

const { expenses } = schema

const expenseSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(3).max(100),
  amount: z.number().int().positive(),
})
const createExpenseSchema = expenseSchema.omit({ id: true })
const updateExpenseSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  amount: z.number().int().positive().optional(),
})

export const expensesRoute = new Hono()
  .get('/', async (c) => {
    const rows = await db.select().from(expenses)
    return c.json({ expenses: rows })
  })
  .get('/:id{\\d+}', async (c) => {
    const id = Number(c.req.param('id'))
    const [row] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1)
    if (!row) return c.json({ error: 'Not found' }, 404)
    return c.json({ expense: row })
  })
  .post('/', zValidator('json', createExpenseSchema), async (c) => {
    const data = c.req.valid('json')
    const [created] = await db.insert(expenses).values(data).returning()
    return c.json({ expense: created }, 201)
  })
  .put('/:id{\\d+}', zValidator('json', createExpenseSchema), async (c) => {
    const id = Number(c.req.param('id'))
    const [updated] = await db.update(expenses).set({ ...c.req.valid('json') }).where(eq(expenses.id, id)).returning()
    if (!updated) return c.json({ error: 'Not found' }, 404)
    return c.json({ expense: updated })
  })
  .patch('/:id{\\d+}', zValidator('json', updateExpenseSchema), async (c) => {
    const id = Number(c.req.param('id'))
    const patch = c.req.valid('json')
    if (Object.keys(patch).length === 0) return c.json({ error: 'Empty patch' }, 400)
    const [updated] = await db.update(expenses).set(patch).where(eq(expenses.id, id)).returning()
    if (!updated) return c.json({ error: 'Not found' }, 404)
    return c.json({ expense: updated })
  })
  .delete('/:id{\\d+}', async (c) => {
    const id = Number(c.req.param('id'))
    const [deletedRow] = await db.delete(expenses).where(eq(expenses.id, id)).returning()
    if (!deletedRow) return c.json({ error: 'Not found' }, 404)
    return c.json({ deleted: deletedRow })
  })
```

> If you implemented `ok/err` helpers in Lab 2/3, you can use them instead of `c.json(...)` to keep shapes consistent.

---

## 8) Test with curl
Start the server: `bun run dev` and run:

```bash
# Create
curl -i -X POST http://localhost:3000/api/expenses \
  -H 'Content-Type: application/json' \
  -d '{"title":"Books","amount":50}'

# List
curl -i http://localhost:3000/api/expenses

# Get one
curl -i http://localhost:3000/api/expenses/1

# Update (PUT)
curl -i -X PUT http://localhost:3000/api/expenses/1 \
  -H 'Content-Type: application/json' \
  -d '{"title":"Books (2nd Edition)","amount":60}'

# Patch (partial)
curl -i -X PATCH http://localhost:3000/api/expenses/1 \
  -H 'Content-Type: application/json' \
  -d '{"amount":75}'

# Delete
curl -i -X DELETE http://localhost:3000/api/expenses/1
```

Expected:
- 201 on create with returned row.
- 200 with arrays/objects for reads/updates.
- 404 for missing ids, 400 for invalid/empty payloads.

---

## 9) Checkpoints (TA/Auto‑check)
- [ ] `.env` contains a working `DATABASE_URL` (Neon) and the app boots without errors.
- [ ] `drizzle.config.ts` present; `bun run db:push` created the `expenses` table.
- [ ] All routes use DB reads/writes (no in‑memory array remains).
- [ ] `POST/PUT/PATCH` validate via Zod.
- [ ] `GET/POST/PUT/PATCH/DELETE` work via curl.

---

## 🧯 Troubleshooting
- **TLS/SSL errors**: ensure the URL includes `?sslmode=require`.
- **Auth errors**: rotate Neon password and update `.env`.
- **Push blocked**: run `bun run db:generate` and then `bun run db:studio` to inspect; if needed, create a tiny migration runner, or use the Neon SQL console to execute the generated SQL.
- **CORS/ports**: you’re testing with curl to the backend; no CORS issues expected yet.

---

## 📤 What to Submit
Create a `lab4-submission/` folder containing:
- `screenshots/` – `create.png`, `list.png`, `get_one.png`, `put.png`, `patch.png`, `delete.png` (curl outputs)
- `git_log.txt` – output of `git log --oneline` for Lab 4 commits
- `notes.md` – 3–6 bullets: what changed from in‑memory to DB, any gotchas

Zip and upload as **Lab4.zip**. Include your public demo URL if you already deployed.

---

## 📝 Marking Guide (20 pts)
- **Drizzle schema + config** – 4 pts  
- **DB created via push/generate** – 3 pts  
- **Routes rewritten to use DB** – 7 pts  
- **curl evidence for all operations** – 4 pts  
- **Notes.md reflection** – 2 pts

---

## 🔭 Next (Week 5 Preview)
We’ll scaffold the **frontend** with **Vite React + Tailwind + ShadCN** and render real data from your API.
