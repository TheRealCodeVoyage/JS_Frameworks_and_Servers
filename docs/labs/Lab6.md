# Lab 6 — API → UI Bridge with TanStack Query

**Course:** COMP3330 – Practical Full‑Stack Web Dev  
**Week:** 6  
**Estimated time:** 120–150 minutes  
**Goal:** Connect your React frontend to the backend API using **TanStack Query**. You will fetch, cache, and mutate expense data, with clear loading/error states and automatic UI updates.

> Build on the same repo. Backend should be running on `http://localhost:3000` and frontend on `http://localhost:5173`.

---

## ✅ Learning Outcomes
By the end of this lab you can:
- Configure **QueryClientProvider** and set sensible defaults.
- Use **useQuery** to fetch and cache expenses.
- Use **useMutation** to create a new expense and refresh the list.
- Show **loading** and **error** states.
- (Optional) Implement **optimistic updates** and rollbacks.

---

## 🛠 Prerequisites
- Lab 5 completed (Vite React + Tailwind + ShadCN set up).
- Lab 3 completed (backend + DB routes working at `/api/expenses`).
- Confirm with curl that the API works before starting:

```bash
curl -i http://localhost:3000/api/expenses
```

---

## 1) Install TanStack Query
From **/frontend**:

```bash
bun add @tanstack/react-query
```

---

## 2) Wrap App with QueryClientProvider
Edit **`/frontend/src/main.tsx`**:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
```

(Optional) Set defaults like `staleTime` or retry policy:

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      retry: 1,
    },
  },
})
```

---

## 3) Read: List Expenses with useQuery
Create **`/frontend/src/components/ExpensesList.tsx`**:

```tsx
import { useQuery } from '@tanstack/react-query'

export function ExpensesList() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3000/api/expenses')
      if (!res.ok) throw new Error('Failed to fetch expenses')
      return res.json() as Promise<{ expenses: { id: number; title: string; amount: number }[] }>
    },
  })

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>
  if (isError) return <p className="text-sm text-red-600">{(error as Error).message}</p>

  return (
    <ul className="mt-4 space-y-2">
      {data!.expenses.map((e) => (
        <li key={e.id} className="flex items-center justify-between rounded border bg-white p-3 shadow-sm">
          <span className="font-medium">{e.title}</span>
          <span className="tabular-nums">${e.amount}</span>
        </li>
      ))}
    </ul>
  )
}
```

Add it to **`/frontend/src/App.tsx`**:

```tsx
import { ExpensesList } from './components/ExpensesList'

export default function App() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-3xl font-bold">Expenses</h1>
        <p className="mt-1 text-sm text-gray-600">Powered by TanStack Query</p>
        <ExpensesList />
      </div>
    </main>
  )
}
```

---

## 4) Create: Add Expense with useMutation
Create **`/frontend/src/components/AddExpenseForm.tsx`**:

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

export function AddExpenseForm() {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState<number | ''>('')

  const createExpense = useMutation({
    mutationFn: async (payload: { title: string; amount: number }) => {
      const res = await fetch('http://localhost:3000/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to add expense')
      return res.json() as Promise<{ expense: { id: number; title: string; amount: number } }>
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      setTitle('')
      setAmount('')
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (title && typeof amount === 'number') {
          createExpense.mutate({ title, amount })
        }
      }}
      className="mt-6 flex gap-2"
    >
      <input
        className="w-1/2 rounded border p-2"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <input
        className="w-40 rounded border p-2"
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
        required
      />
      <button className="rounded bg-black px-4 py-2 text-white disabled:opacity-50" disabled={createExpense.isPending}>
        {createExpense.isPending ? 'Adding…' : 'Add'}
      </button>
    </form>
  )
}
```

Use it in **`/frontend/src/App.tsx`** (above the list):

```tsx
import { AddExpenseForm } from './components/AddExpenseForm'

export default function App() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-3xl font-bold">Expenses</h1>
        <p className="mt-1 text-sm text-gray-600">Powered by TanStack Query</p>
        <AddExpenseForm />
        <ExpensesList />
      </div>
    </main>
  )
}
```

---

## 5) (Optional) Optimistic Update
Replace `onSuccess` with an **optimistic update** strategy:

```ts
const createExpense = useMutation({
  mutationFn: async (payload: { title: string; amount: number }) => {
    const res = await fetch('http://localhost:3000/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('Failed to add expense')
    return res.json()
  },
  onMutate: async (newItem) => {
    await qc.cancelQueries({ queryKey: ['expenses'] })
    const prev = qc.getQueryData<{ expenses: any[] }>(['expenses'])
    if (prev) {
      qc.setQueryData(['expenses'], {
        expenses: [...prev.expenses, { id: Date.now(), ...newItem }],
      })
    }
    return { prev }
  },
  onError: (_err, _newItem, ctx) => {
    if (ctx?.prev) qc.setQueryData(['expenses'], ctx.prev)
  },
  onSettled: () => {
    qc.invalidateQueries({ queryKey: ['expenses'] })
  },
})
```

---

## 🔍 Testing
1) Start backend and verify with curl:
```bash
curl -i http://localhost:3000/api/expenses
```
2) Start frontend (`bun run dev` in `/frontend`).  
3) Load `http://localhost:5173`, confirm list renders.  
4) Add a new expense via the form → list updates automatically.  
5) Refresh page → item is persisted (DB-backed).

---

## ✅ Checkpoints
- [ ] QueryClientProvider wraps the app.
- [ ] `useQuery` fetches and displays expenses with loading/error states.
- [ ] `useMutation` creates an expense and invalidates the list.
- [ ] (Optional) Optimistic update works and rolls back on error.

---

## 📤 What to Submit
Create `lab6-submission/` with:
- `screenshots/` → `list_loaded.png`, `add_success.png`
- `curl_list.txt` → output of `curl http://localhost:3000/api/expenses`
- `git_log.txt` → `git log --oneline` for Lab 6 commits
- `notes.md` → 3–6 bullets: caching, invalidation, any issues

Zip and upload **Lab6.zip**.

---

## 📝 Marking Guide (20 pts)
- Query setup (provider + defaults) – 4 pts  
- useQuery list with loading/error – 5 pts  
- useMutation creation + invalidation – 6 pts  
- Submission quality (screenshots + notes) – 5 pts

---

## 🔭 Next (Week 7 Preview)
We’ll integrate **TanStack Router** for multiple pages (list/detail/form), and organize routes/layouts for a better UX.
