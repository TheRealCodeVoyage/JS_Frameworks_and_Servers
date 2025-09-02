

# Lab 3 — Full CRUD & Error Handling Improvements

**Course:** COMP3330 – Practical Full‑Stack Web Dev  
**Week:** 3  
**Estimated time:** 120–150 minutes  
**Goal:** Extend the Expense Tracker API to support **update operations (PUT/PATCH)**, refine error handling, and enforce consistent response shapes.

---

## ✅ Learning Outcomes
By the end of this lab you can:
- Implement **PUT** and **PATCH** routes to update expenses.
- Differentiate between full update (PUT) and partial update (PATCH).
- Standardize response format for success and error cases.
- Add extra validation to avoid duplicate IDs or invalid updates.

---

## 🛠 Prerequisites
- Completed **Lab 2** with working GET, POST, DELETE routes and Zod validation.
- Project structure should already have `server/routes/expenses.ts`.

---

## 1) Update Zod Schemas
Open **`server/routes/expenses.ts`**. Extend schemas for updates:

```ts
// Allow updating title and/or amount, but not id
const updateExpenseSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  amount: z.number().int().positive().optional(),
})
```

---

## 2) Add PUT and PATCH Endpoints
Append to the router in **expenses.ts**:

```ts
// PUT /api/expenses/:id → full replace
expensesRoute.put('/:id{\\d+}', zValidator('json', createExpenseSchema), (c) => {
  const id = Number(c.req.param('id'))
  const idx = expenses.findIndex((e) => e.id === id)
  if (idx === -1) return c.json({ error: 'Not found' }, 404)

  const data = c.req.valid('json')
  const updated: Expense = { id, ...data }
  expenses[idx] = updated
  return c.json({ expense: updated })
})

// PATCH /api/expenses/:id → partial update
expensesRoute.patch('/:id{\\d+}', zValidator('json', updateExpenseSchema), (c) => {
  const id = Number(c.req.param('id'))
  const idx = expenses.findIndex((e) => e.id === id)
  if (idx === -1) return c.json({ error: 'Not found' }, 404)

  const data = c.req.valid('json')
  const current = expenses[idx]
  const updated: Expense = { ...current, ...data }
  expenses[idx] = updated
  return c.json({ expense: updated })
})
```

---

## 3) Standardize Response Helpers
At the top of **expenses.ts**, add reusable helpers:

```ts
const ok = <T>(c: any, data: T, status = 200) => c.json({ data }, status)
const err = (c: any, message: string, status = 400) => c.json({ error: { message } }, status)
```

Then replace previous `c.json(...)` calls with `ok(...)` or `err(...)` for consistency.

---

## 4) Test with curl
Run your server with `bun run dev`, then in another terminal test:

1. **PUT full update:**
```bash
curl -i -X PUT http://localhost:3000/api/expenses/1 \
  -H 'Content-Type: application/json' \
  -d '{"title":"Groceries (weekly)","amount":40}'
```

2. **PATCH partial update (title only):**
```bash
curl -i -X PATCH http://localhost:3000/api/expenses/1 \
  -H 'Content-Type: application/json' \
  -d '{"title":"Coffee beans"}'
```

3. **PATCH partial update (amount only):**
```bash
curl -i -X PATCH http://localhost:3000/api/expenses/1 \
  -H 'Content-Type: application/json' \
  -d '{"amount":99}'
```

4. **Invalid PATCH (empty body):**
```bash
curl -i -X PATCH http://localhost:3000/api/expenses/1 \
  -H 'Content-Type: application/json' \
  -d '{}'
```
Expect a 400 error.

5. **PUT non‑existent id:**
```bash
curl -i -X PUT http://localhost:3000/api/expenses/999 \
  -H 'Content-Type: application/json' \
  -d '{"title":"X","amount":1}'
```
Expect a 404 error.

---

## 5) Checkpoints
- [ ] PUT replaces an entire expense correctly.
- [ ] PATCH updates only provided fields.
- [ ] Error responses follow `{ "error": { "message": "..." } }` format.
- [ ] Status codes: 200 for success, 201 for creation, 400 for validation, 404 for not found.

---

## 📤 What to Submit
Create a `lab3-submission/` folder containing:
- `curl_tests.txt` – a text file with your curl commands and outputs pasted in.
- `git_log.txt` – output of `git log --oneline` for Lab 3 commits.
- `notes.md` – 3–6 bullets reflecting on PUT vs PATCH, error handling, and what you learned.

Zip and upload as **Lab3.zip**.

---

## 📝 Marking Guide (15 pts)
- **PUT route working** – 4 pts
- **PATCH route working** – 4 pts
- **Consistent response helpers** – 3 pts
- **Evidence via curl outputs** – 3 pts
- **Notes.md reflection** – 1 pt

---

## 🔭 Next (Week 4 Preview)
We’ll connect to a real **Postgres database (Neon)** and use **Drizzle ORM** to replace the in‑memory array.