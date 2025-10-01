

# Lab 8 — TanStack Router (File-Based Routing, Layouts)

**Course:** COMP3330 – Practical Full‑Stack Web Dev  
**Week:** 8  
**Estimated time:** 120–150 minutes  
**Goal:** Introduce multi-page navigation using **TanStack Router**. You will build file-based routes, shared layouts, and nested routes for your Expenses app.

---

## ✅ Learning Outcomes
By the end of this lab you can:
- Install and configure TanStack Router in a Vite React app.
- Define file-based routes with a shared layout.
- Create nested routes for list, detail, and new item pages.
- Navigate between routes with `<Link>`.
- Add NotFound and error boundaries.

---

## 🛠 Prerequisites
- Lab 5 completed (frontend setup with Tailwind + ShadCN).
- Lab 6 and 7 completed (API connected with TanStack Query).
- Backend running at `http://localhost:3000/api/expenses`.

---

## 1) Install TanStack Router
From `/frontend`:
```bash
bun add @tanstack/react-router
```

---

## 2) Configure Router
Create `/frontend/src/router.tsx`:
```tsx
import { RouterProvider, createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import App from './App'

const rootRoute = createRootRoute({
  component: () => <App />,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <p>Home Page</p>,
})

const expensesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/expenses',
  component: () => <p>Expenses Layout</p>,
})

const routeTree = rootRoute.addChildren([indexRoute, expensesRoute])

export const router = createRouter({ routeTree })

export function AppRouter() {
  return <RouterProvider router={router} />
}
```

Update `/frontend/src/main.tsx` to use `<AppRouter/>` instead of `<App/>`.

---

## 3) Layout with Navbar
Update `App.tsx`:
```tsx
import { Link, Outlet } from '@tanstack/react-router'

export default function App() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-4xl p-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Expenses App</h1>
          <nav className="flex gap-4 text-sm">
            <Link to="/">Home</Link>
            <Link to="/expenses">Expenses</Link>
            <Link to="/expenses/new">New</Link>
          </nav>
        </header>
        <div className="mt-6">
          <Outlet />
        </div>
      </div>
    </main>
  )
}
```

---

## 4) Expenses List Page
Create `/frontend/src/routes/expenses.list.tsx` and fetch data with TanStack Query. Render list items linking to `/expenses/:id`.

```tsx
// /frontend/src/routes/expenses.list.tsx
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'

export type Expense = { id: number; title: string; amount: number }

// Use "/api" if you configured a Vite proxy in dev; otherwise use
// const API = 'http://localhost:3000/api'
const API = '/api'

export default function ExpensesListPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const res = await fetch(`${API}/expenses`)
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}: ${txt || res.statusText}`)
      }
      return (await res.json()) as { expenses: Expense[] }
    },
    staleTime: 5_000,
    retry: 1,
  })

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>
  if (isError)
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">Failed to fetch: {(error as Error).message}</p>
        <button className="mt-3 rounded border px-3 py-1" onClick={() => refetch()} disabled={isFetching}>
          Retry
        </button>
      </div>
    )

  const items = data?.expenses ?? []

  return (
    <section className="mx-auto max-w-3xl p-6">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Expenses</h2>
        <button className="rounded border px-3 py-1 text-sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {items.length === 0 ? (
        <div className="rounded border bg-background p-6">
          <p className="text-sm text-muted-foreground">No expenses yet.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between rounded border bg-background text-foreground p-3 shadow-sm"
            >
              <Link
                to="/expenses/$id"
                params={{ id: e.id }}
                className="font-medium underline hover:text-primary"
              >
                {e.title}
              </Link>
              <span className="tabular-nums">#{e.amount}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

---

## 5) Expense Detail Page
Create `/frontend/src/routes/expenses.detail.tsx` to fetch one expense by ID.

```tsx
// /frontend/src/routes/expenses.detail.tsx
import { useQuery } from '@tanstack/react-query'

type Expense = { id: number; title: string; amount: number }
const API = '/api' // if you’re using Vite proxy; otherwise "http://localhost:3000/api"

export default function ExpenseDetailPage({ id }: { id: number }) {
  // useQuery caches by key ['expenses', id]
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['expenses', id],
    queryFn: async () => {
      const res = await fetch(`${API}/expenses/${id}`)
      if (!res.ok) throw new Error(`Failed to fetch expense with id ${id}`)
      return res.json() as Promise<{ expense: Expense }>
    },
  })

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>
  if (isError) return <p className="p-6 text-sm text-red-600">{(error as Error).message}</p>

  const item = data?.expense

  if (!item) {
    return <p className="p-6 text-sm text-muted-foreground">Expense not found.</p>
  }

  return (
    <section className="mx-auto max-w-3xl p-6">
      <div className="rounded border bg-background text-foreground p-6">
        <h2 className="text-xl font-semibold">{item.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">Amount</p>
        <p className="text-lg tabular-nums">#{item.amount}</p>
      </div>
    </section>
  )
}
```

---

## 6) New Expense Page
Create `/frontend/src/routes/expenses.new.tsx` with a form posting to API, then navigate back to list on success.

```tsx
// /frontend/src/routes/expenses.new.tsx
import { useState, type FormEvent } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'

const API = '/api' // if no Vite proxy, use: 'http://localhost:3000/api'

export default function ExpenseNewPage() {
  const router = useRouter()
  const qc = useQueryClient()

  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState<number | ''>('')
  const [error, setError] = useState<string | null>(null)

  const createExpense = useMutation({
    mutationFn: async (payload: { title: string; amount: number }) => {
      const res = await fetch(`${API}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(txt || `HTTP ${res.status}`)
      }
      return res.json() as Promise<{ expense: { id: number; title: string; amount: number } }>
    },
    onSuccess: () => {
      // Refresh the list and go back
      qc.invalidateQueries({ queryKey: ['expenses'] })
      router.navigate({ to: '/expenses' })
    },
    onError: (e: any) => {
      setError(e.message ?? 'Failed to create expense')
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!title || typeof amount !== 'number') {
      setError('Please provide a title and a numeric amount.')
      return
    }
    createExpense.mutate({ title, amount })
  }

  return (
    <section className="mx-auto max-w-3xl p-6">
      <form onSubmit={onSubmit} className="space-y-3 rounded border bg-background p-6">
        <h2 className="text-xl font-semibold">New Expense</h2>

        <label className="block">
          <span className="text-sm text-muted-foreground">Title</span>
          <input
            className="mt-1 w-full rounded-md border border-input bg-background p-2 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            placeholder="Coffee"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-sm text-muted-foreground">Amount</span>
          <input
            className="mt-1 w-52 rounded-md border border-input bg-background p-2 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            type="number"
            placeholder="4"
            value={amount}
            onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-2">
          <button
            className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
            disabled={createExpense.isPending}
          >
            {createExpense.isPending ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            className="text-sm underline"
            onClick={() => router.navigate({ to: '/expenses' })}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  )
}
```


---

## 7) NotFound & Error Boundaries
Add defaults in `router.tsx`:
```tsx
router.update({
  defaultNotFoundComponent: () => <p>Page not found</p>,
  defaultErrorComponent: ({ error }) => <p>Error: {(error as Error).message}</p>,
})
```

---

## 🔍 Testing
- `/` → Home page.
- `/expenses` → list.
- `/expenses/1` → detail.
- `/expenses/new` → form and redirect back.
- Wrong path → NotFound.

---

## ✅ Checkpoints
- [ ] Router set up with root + nested routes.
- [ ] Navbar links navigate.
- [ ] Expenses list, detail, and new form pages work.
- [ ] NotFound shown for bad route.

---

## 📤 What to Submit
Submit `lab8-submission/` with:
- Screenshots of Home, List, Detail, New pages.
- `curl_tests.txt` showing CRUD endpoints still working.
- `git_log.txt` with Lab 8 commits.
- `notes.md` with 3–6 reflections.

Zip and upload **Lab8.zip**.

---

## 📝 Marking Guide (20 pts)
- Router configured + layout – 5 pts  
- List + Detail pages wired to API – 6 pts  
- New page mutation + redirect – 6 pts  
- Submission quality – 3 pts

---

## 🔭 Next (Week 9 Preview)
Authentication with **Kinde**: protected routes and API endpoints.