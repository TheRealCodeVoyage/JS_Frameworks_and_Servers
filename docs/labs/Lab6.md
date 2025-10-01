# Lab 6 — API → UI Bridge (Vite Proxy, Fetch, RPC)

**Course:** COMP3330 – Practical Full‑Stack Web Dev
**Week:** 6
**Estimated time:** 120–150 minutes
**Goal:** Connect your React frontend to the backend **without extra libraries**, using:

* **Vite Dev Proxy** to avoid CORS in development
* A small **typed fetch wrapper** for clean API calls
* A lightweight **RPC style** endpoint (optional) alongside your existing REST routes

> You’ll keep your REST endpoints from earlier labs. In Lab 7 we’ll add TanStack Query. Today we focus on **Vite proxy + fetch + RPC**.

---

## ✅ Learning Outcomes

By the end of this lab you can:

* Configure a **Vite dev proxy** so `fetch('/api/...')` works with no CORS errors.
* Build a **reusable fetch helper** with JSON/error handling and TypeScript types.
* Call your existing REST endpoints from React with **clean code**.
* (Optional) Add a simple **RPC** endpoint and client to consolidate calls.

---

## 🛠 Prerequisites

* Lab 5 completed (Vite React + Tailwind + ShadCN).
* Backend from Lab 3/4 running at `http://localhost:3000`.
* Confirm with curl:

```bash
curl -i http://localhost:3000/api/expenses
```

---

## 1) Configure Vite Dev Proxy (recommended for dev)

Edit **`/frontend/vite.config.ts`** and add a proxy so the browser can call `/api/...` **same-origin** via Vite:

```ts
import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
```

**Why?** The browser page runs on `5173`; the API runs on `3000`. Without a proxy you hit **CORS**. With the proxy, your frontend simply does `fetch('/api/...')` and Vite forwards it to `3000`.

> **If you don’t want a proxy**, you must enable CORS on the backend (see note at the end).

---

## 2) Create a Typed Fetch Helper

Create **`/frontend/src/lib/api.ts`**:

```ts
// /frontend/src/lib/api.ts
export type HttpError = { status: number; message: string }

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw { status: res.status, message: text || res.statusText } as HttpError
  }
  // Handle empty 204
  if (res.status === 204) return undefined as unknown as T
  return (await res.json()) as T
}

const json = (body: unknown): RequestInit => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

// Public API surface for your app
export const api = {
  getExpenses: () => request<{ expenses: { id: number; title: string; amount: number }[] }>(`/api/expenses`),
  createExpense: (payload: { title: string; amount: number }) =>
    request<{ expense: { id: number; title: string; amount: number } }>(`/api/expenses`, {
      method: 'POST',
      ...json(payload),
    }),
  deleteExpense: (id: number) => request<{ deleted: { id: number } }>(`/api/expenses/${id}`, { method: 'DELETE' }),
}
```

**Why?** Centralising `fetch` keeps components simple and gives you consistent error handling.

---

## 3) Use the Helper in Components (REST)

Create **`/frontend/src/components/ExpensesList.tsx`**:

```tsx
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

type Expense = { id: number; title: string; amount: number }

export function ExpensesList() {
  const [items, setItems] = useState<Expense[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getExpenses()
      .then((d) => setItems(d.expenses))
      .catch((e) => setError(e.message ?? 'Failed to fetch'))
  }, [])

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!items) return <p className="text-sm text-muted-foreground">Loading…</p>

  if (items.length === 0)
    return (
      <div className="rounded border bg-background p-6">
        <p className="text-sm text-muted-foreground">No expenses yet.</p>
      </div>
    )

  return (
    <ul className="mt-4 space-y-2">
      {items.map((e) => (
        <li
          key={e.id}
          className="flex items-center justify-between rounded border bg-background text-foreground p-3 shadow-sm"
        >
          <span className="font-medium">{e.title}</span>
          <span className="tabular-nums">${e.amount}</span>
        </li>
      ))}
    </ul>
  )
}
```

Create **`/frontend/src/components/AddExpenseForm.tsx`**:

```tsx
import { useState } from 'react'
import { api } from '@/lib/api'

export function AddExpenseForm({ onAdded }: { onAdded?: () => void }) {
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState<number | ''>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title || typeof amount !== 'number') return
    setSubmitting(true)
    setError(null)
    try {
      await api.createExpense({ title, amount })
      setTitle('')
      setAmount('')
      onAdded?.()
    } catch (e: any) {
      setError(e.message ?? 'Failed to add expense')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex gap-2">
      <input className="w-1/2 rounded border p-2" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input
        className="w-40 rounded border p-2"
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
      />
      <button className="rounded bg-black px-4 py-2 text-white disabled:opacity-50" disabled={submitting}>
        {submitting ? 'Adding…' : 'Add'}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </form>
  )
}
```

Use them in **`/frontend/src/App.tsx`**:

```tsx
import { useState, useEffect } from 'react'
import { ExpensesList } from '@/components/ExpensesList'
import { AddExpenseForm } from '@/components/AddExpenseForm'
import { api } from '@/lib/api'

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0)

  // Simple refresh strategy: bump a key to re-run useEffect in list
  function refresh() { setRefreshKey((k) => k + 1) }

  useEffect(() => {}, [refreshKey])

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-3xl font-bold">Expenses</h1>
        <p className="mt-1 text-sm text-muted-foreground">Vite Proxy + Fetch + RPC (no Query yet)</p>
        <AddExpenseForm onAdded={refresh} />
        {/* key forces list to refetch via its useEffect */}
        <div key={refreshKey}>
          <ExpensesList />
        </div>
      </div>
    </main>
  )
}
```

> This is intentionally minimal. In Lab 7, you’ll replace the manual refresh pattern with **TanStack Query** for caching & invalidation.

---

## 4) (Optional) Add a Simple RPC Endpoint

You already have REST routes like `/api/expenses`. RPC groups actions under a single endpoint, which can simplify clients and enable batching.

**Backend** — add an RPC route in `server/routes/rpc.ts` and mount it under `/api/rpc`:

```ts
// server/routes/rpc.ts
import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { expenses } from './expenses-data' // wherever your in-memory or DB helpers live

const rpc = new Hono()

const payloadSchema = z.object({
  method: z.enum(['listExpenses', 'createExpense', 'deleteExpense']),
  params: z.any().optional(),
})

rpc.post('/', zValidator('json', payloadSchema), async (c) => {
  const { method, params } = c.req.valid('json')
  switch (method) {
    case 'listExpenses':
      return c.json({ data: { expenses: await expenses.list() } })
    case 'createExpense': {
      const { title, amount } = params as { title: string; amount: number }
      const created = await expenses.create({ title, amount })
      return c.json({ data: { expense: created } }, 201)
    }
    case 'deleteExpense': {
      const { id } = params as { id: number }
      const deleted = await expenses.delete(id)
      return c.json({ data: { deleted } })
    }
    default:
      return c.json({ error: { message: 'Unknown method' } }, 400)
  }
})

export default rpc
```

Mount it in your app (e.g., `server/app.ts`):

```ts
import rpcRoute from './routes/rpc'
app.route('/api/rpc', rpcRoute)
```

**Frontend** — add a tiny RPC client in `src/lib/rpc.ts`:

```ts
// /frontend/src/lib/rpc.ts
export async function rpc<T>(method: string, params?: unknown): Promise<T> {
  const res = await fetch('/api/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, params }),
  })
  if (!res.ok) throw new Error(await res.text())
  const json = await res.json()
  if ('error' in json) throw new Error(json.error.message)
  return json.data as T
}
```

Usage example:

```ts
import { rpc } from '@/lib/rpc'
const data = await rpc<{ expenses: { id: number; title: string; amount: number }[] }>('listExpenses')
```

> Keep both REST **and** RPC for learning purposes. In real apps, pick one primary style.

---

## 🔍 Testing

1. **Proxy check**: restart Vite (`bun run dev`). In the browser DevTools → Network, calling `fetch('/api/expenses')` should show a `200` with no CORS warnings.
2. **curl** still works:

   ```bash
   curl -i http://localhost:3000/api/expenses
   ```
3. **UI**: load `http://localhost:5173`. Add an expense and see it render.
4. **RPC (optional)**: test with curl:

   ```bash
   curl -i -X POST http://localhost:3000/api/rpc \
     -H 'Content-Type: application/json' \
     -d '{"method":"listExpenses"}'
   ```

---

## ✅ Checkpoints

* [ ] Vite proxy set; frontend uses **relative** `/api/...` URLs.
* [ ] `src/lib/api.ts` centralises fetch + errors.
* [ ] Components load and render expenses; create works.
* [ ] (Optional) RPC endpoint responds to list/create/delete.

---

## 📤 What to Submit

Create `lab6-submission/` with:

* `screenshots/` → `proxy_ok.png`, `list_loaded.png`, `create_ok.png`
* `curl_list.txt` → output of `curl http://localhost:3000/api/expenses`
* `git_log.txt` → `git log --oneline` for Lab 6 commits
* `notes.md` → 3–6 bullets: proxy vs CORS, fetch helper, RPC takeaways

Zip and upload **Lab6.zip**.

---

## 📝 Marking Guide (20 pts)

* Vite dev proxy configured & used – 6 pts
* Fetch helper with proper error handling – 5 pts
* Components wired to REST endpoints – 6 pts
* (Optional) RPC route + client – 3 pts

---

## ℹ️ CORS (if not using proxy)

If you prefer absolute URLs (e.g., `http://localhost:3000/api/expenses`) in dev, add CORS in **`server/app.ts`**:

```ts
import { cors } from 'hono/cors'
app.use('/api/*', cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  allowMethods: ['GET','POST','PATCH','DELETE','OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))
```

> Proxy in dev is simpler and closer to production paths (relative `/api`). In Week 12 you’ll serve the frontend from the backend, removing cross-origin entirely.
