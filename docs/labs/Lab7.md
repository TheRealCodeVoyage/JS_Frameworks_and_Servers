# Lab 7 — TanStack Query (Async State, Caching, Errors)

**Course:** COMP3330 – Practical Full‑Stack Web Dev  
**Week:** 7  
**Estimated time:** 120–150 minutes  
**Goal:** Use **TanStack Query** to manage server state in React: fetching, caching, error handling, and mutations for expenses.

---

## ✅ Learning Outcomes
By the end of this lab you can:
- Configure `QueryClientProvider` in a Vite React app.
- Fetch expenses with `useQuery` and display them.
- Handle loading and error states.
- Mutate data with `useMutation` and invalidate queries.
- (Optional) Add optimistic updates with rollback.

---

## 🛠 Prerequisites
- Lab 5 completed (frontend setup).
- Lab 6 completed (API endpoints wired).
- Backend running at `http://localhost:3000/api/expenses`.

---

## 1) Install TanStack Query
From `/frontend`:
```bash
bun add @tanstack/react-query
```

---

## 2) Configure QueryClientProvider
Edit `/frontend/src/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
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

---

## 3) Fetch Expenses with useQuery
Create `/frontend/src/components/ExpensesList.tsx`:
```tsx
import { useQuery } from '@tanstack/react-query'

export function ExpensesList() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3000/api/expenses')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json() as Promise<{ expenses: { id: number; title: string; amount: number }[] }>
    }
  })

  if (isLoading) return <p>Loading…</p>
  if (isError) return <p>Error: {(error as Error).message}</p>

  return (
    <ul className="mt-4 space-y-2">
      {data!.expenses.map(e => (
        <li key={e.id} className="flex justify-between rounded border p-2 bg-white">
          <span>{e.title}</span>
          <span>${e.amount}</span>
        </li>
      ))}
    </ul>
  )
}
```

Add it in `App.tsx`:
```tsx
import { ExpensesList } from './components/ExpensesList'

export default function App() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <h1 className="text-2xl font-bold">Expenses</h1>
      <ExpensesList />
    </main>
  )
}
```

---

## 4) Add Expense with useMutation
Create `/frontend/src/components/AddExpenseForm.tsx`:
```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

export function AddExpenseForm() {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState<number | ''>('')

  const mutation = useMutation({
    mutationFn: async (payload: { title: string; amount: number }) => {
      const res = await fetch('http://localhost:3000/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to add')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      setTitle('')
      setAmount('')
    }
  })

  return (
    <form onSubmit={e => {
      e.preventDefault()
      if (title && typeof amount === 'number') {
        mutation.mutate({ title, amount })
      }
    }} className="flex gap-2 mt-4">
      <input className="border p-2" value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" />
      <input className="border p-2" type="number" value={amount} onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Amount" />
      <button className="bg-black text-white px-3 py-1 rounded" disabled={mutation.isPending}>
        {mutation.isPending ? 'Adding…' : 'Add'}
      </button>
    </form>
  )
}
```

Update `App.tsx`:
```tsx
import { AddExpenseForm } from './components/AddExpenseForm'
import { ExpensesList } from './components/ExpensesList'

export default function App() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <h1 className="text-2xl font-bold">Expenses</h1>
      <AddExpenseForm />
      <ExpensesList />
    </main>
  )
}
```

---

## 5) Optional: Optimistic Updates
Show how to add `onMutate`/`onError` for rollback. (See docs for advanced setup.)

---

## 🔍 Testing
- Start backend and confirm `curl http://localhost:3000/api/expenses` works.
- Run frontend and test:
  - List loads with expenses.
  - Add form creates new expense and refreshes list.
  - Errors appear if API is down.

---

## ✅ Checkpoints
- [ ] QueryClientProvider wraps app.
- [ ] useQuery fetches expenses with loading/error states.
- [ ] useMutation adds new expense and updates cache.
- [ ] UI renders correct list and form.

---

## 📤 What to Submit
Submit `lab7-submission/` with:
- `screenshots/` → list loaded + add expense working
- `curl_tests.txt` → curl output for list endpoint
- `git_log.txt` → commits for Lab 7
- `notes.md` → 3–6 bullets about caching, invalidation, or issues

Zip and upload **Lab7.zip**.

---

## 📝 Marking Guide (20 pts)
- Query setup (provider + defaults) – 4 pts  
- useQuery list with loading/error – 5 pts  
- useMutation add + cache invalidation – 6 pts  
- Submission quality (screenshots + notes) – 5 pts

---

## 🔭 Next (Week 8 Preview)
Next lab: **TanStack Router** – file-based routing and layouts.
