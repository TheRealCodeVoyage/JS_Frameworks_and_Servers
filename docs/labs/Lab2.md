# Lab 2 — Routes, Middleware & Validation (Hono + Zod)

**Course:** COMP3330 – Practical Full‑Stack Web Dev  
**Week:** 2  
**Estimated time:** 120–150 minutes  
**Goal:** Build real API endpoints for an **Expense Tracker** using **Hono** routes, add a custom middleware, and validate inputs with **Zod** + **@hono/zod‑validator**.

> You’ll extend your Lab 1 project. Keep the same repo/folder.

---

## ✅ Learning Outcomes
By the end of this lab you can:
- Organize Hono routes in separate files and mount them under `/api`.
- Implement **GET**, **POST**, **GET by id**, and **DELETE** endpoints.
- Validate JSON bodies using **Zod** and **@hono/zod‑validator**.
- Enforce numeric path params and return proper HTTP status codes.
- Write a simple custom middleware (request timing).

---

## 🛠 Prerequisites
- Completed **Lab 1** and can run the server with `bun run dev`.
- Project structure from Lab 1 (at minimum):

```
comp3330-expensetracker/
├─ server/
│  ├─ app.ts
│  └─ index.ts
├─ package.json
```

---

## 1) Install Dependencies
From your project root:

```bash
bun add zod @hono/zod-validator
```

> If you see type errors later, restart the dev server.

---

## 2) Create an Expenses Router
Create a new folder and file: **`server/routes/expenses.ts`**

Paste this starter:

```ts
// server/routes/expenses.ts
import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'

// In‑memory DB for Week 2 (we'll replace with Postgres in Week 4)
const expenses: Expense[] = [
  { id: 1, title: 'Coffee', amount: 4 },
  { id: 2, title: 'Groceries', amount: 35 },
]

// Zod schemas
const expenseSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(3).max(100),
  amount: z.number().int().positive(),
})

const createExpenseSchema = expenseSchema.omit({ id: true })

export type Expense = z.infer<typeof expenseSchema>

// Router
export const expensesRoute = new Hono()
  // GET /api/expenses → list
  .get('/', (c) => c.json({ expenses }))

  // GET /api/expenses/:id → single item
  // Enforce numeric id with a param regex (\\d+)
  .get('/:id{\\d+}', (c) => {
    const id = Number(c.req.param('id'))
    const item = expenses.find((e) => e.id === id)
    if (!item) return c.json({ error: 'Not found' }, 404)
    return c.json({ expense: item })
  })

  // POST /api/expenses → create (validated)
  .post('/', zValidator('json', createExpenseSchema), (c) => {
    const data = c.req.valid('json') // { title, amount }
    const nextId = (expenses.at(-1)?.id ?? 0) + 1
    const created: Expense = { id: nextId, ...data }
    expenses.push(created)
    return c.json({ expense: created }, 201)
  })

  // DELETE /api/expenses/:id → remove
  .delete('/:id{\\d+}', (c) => {
    const id = Number(c.req.param('id'))
    const idx = expenses.findIndex((e) => e.id === id)
    if (idx === -1) return c.json({ error: 'Not found' }, 404)
    const [removed] = expenses.splice(idx, 1)
    return c.json({ deleted: removed })
  })
```

---

## 3) Mount the Router under `/api`
Update **`server/app.ts`** to mount the new router and add a custom timing middleware.

Replace the file contents with:

```ts
// server/app.ts
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { expensesRoute } from './routes/expenses'

export const app = new Hono()

// Global logger (from Lab 1)
app.use('*', logger())

// Custom timing middleware
app.use('*', async (c, next) => {
  const start = Date.now()
  await next()
  const ms = Date.now() - start
  // Add a response header so we can see timings in Thunder Client
  c.header('X-Response-Time', `${ms}ms`)
})

// Health & root
app.get('/', (c) => c.json({ message: 'OK' }))
app.get('/health', (c) => c.json({ status: 'healthy' }))

// Mount API routes
app.route('/api/expenses', expensesRoute)
```

> Ensure **`server/index.ts`** still exports `{ port, fetch: app.fetch }` and logs the URL. No change required from Lab 1.

Run the server:

```bash
bun run dev
```

---

## 4) Test Endpoints (Thunder Client or curl)
Create a Thunder Client collection (or equivalent) with these requests:

1) **GET** `http://localhost:3000/api/expenses`  
   **Expect:** `{ "expenses": [ ... ] }` and header `X-Response-Time` present.

2) **GET** `http://localhost:3000/api/expenses/1`  
   **Expect:** `{ "expense": { "id": 1, ... } }`

3) **GET** `http://localhost:3000/api/expenses/9999`  
   **Expect:** 404 and `{ "error": "Not found" }`

4) **POST** `http://localhost:3000/api/expenses`  
   **Body (JSON):**
   ```json
   { "title": "Books", "amount": 50 }
   ```
   **Expect:** 201 and `{ "expense": { "id": <number>, "title": "Books", "amount": 50 } }`

5) **POST (invalid)** `http://localhost:3000/api/expenses`  
   **Body (JSON):** `{ "title": "Hi", "amount": -1 }`  
   **Expect:** 400 with Zod validation details.

6) **DELETE** `http://localhost:3000/api/expenses/2`  
   **Expect:** `{ "deleted": { "id": 2, ... } }`  
   **Then GET list:** item `2` should be gone.

**curl examples** (optional):
```bash
curl -i http://localhost:3000/api/expenses
curl -i http://localhost:3000/api/expenses/1
curl -i -X POST http://localhost:3000/api/expenses \
  -H 'Content-Type: application/json' \
  -d '{"title":"Books","amount":50}'
curl -i -X DELETE http://localhost:3000/api/expenses/2
```

---

## 5) Error Shapes & Status Codes (Quick Improvements)
Update the error payloads to follow a consistent shape:

```ts
// Example helpers (optional) — place at top of server/routes/expenses.ts
const ok = <T>(c: any, data: T, status = 200) => c.json({ data }, status)
const err = (c: any, message: string, status = 400) => c.json({ error: { message } }, status)
```

Then replace `c.json({ expenses })` with `ok(c, { expenses })`, etc., and use `err(c, 'Not found', 404)` for errors.  
*(This is optional but recommended; consistency helps clients and future tests.)*

---

## 6) Checkpoints (TA/Auto‑check)
- [ ] `GET /api/expenses` returns array with seed items.
- [ ] `GET /api/expenses/:id` returns 200 when exists, **404** when not.
- [ ] `POST /api/expenses` validates body with Zod and returns **201** when valid; **400** when invalid.
- [ ] `DELETE /api/expenses/:id` removes an item and returns deleted object.
- [ ] `X-Response-Time` header appears on responses (custom middleware works).

---

## 🧯 Troubleshooting
- **400 on valid POST** → Ensure body type is **JSON** and you used `zValidator('json', createExpenseSchema)` and `c.req.valid('json')`.
- **Route not matching `:id`** → Confirm the path uses `/:id{\\d+}` with backslashes escaped in TypeScript strings.
- **Type errors after install** → Stop and restart `bun run dev`.
- **Thunder Client not hitting server** → Confirm URL/port and that `bun run dev` is running without errors.

---

## 📤 What to Submit
Create a `lab2-submission/` folder containing:
- `collection_export.json` – Your Thunder Client collection (or Postman) covering the 6 requests above.
- `screenshots/` –
  - `get_list.png`, `get_one.png`, `post_created.png`, `post_invalid.png`, `delete_one.png` (show status codes and bodies)
  - `headers_timing.png` – response headers including `X-Response-Time`.
- `git_log.txt` – output of `git log --oneline` showing meaningful commits for Lab 2.
- `notes.md` – 3–6 short bullets on what you learned or struggled with.

Zip and upload as **Lab2.zip**. Include your repo link if public.

---

## 📝 Marking Guide (15 pts)
- **Routes implemented (GET list, GET by id, POST, DELETE)** – 6 pts
- **Zod validation via @hono/zod‑validator** – 3 pts
- **Custom timing middleware (header visible)** – 2 pts
- **Thunder/Postman evidence (collection + screenshots)** – 3 pts
- **Notes.md reflection** – 1 pt

> Late submissions may receive reduced credit per course policy.

---

## 🔭 Next (Week 3 Preview)
We’ll refine CRUD, add update (`PUT/PATCH`) and improve error handling. Then we’ll prepare the API for a real database in Week 4.
