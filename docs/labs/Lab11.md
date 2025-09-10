

# Lab 11 — Optimistic Updates & UX Polish

**Course:** COMP3330 – Practical Full-Stack Web Dev  
**Week:** 11  
**Estimated time:** 120–150 minutes  
**Goal:** Improve your app’s **user experience (UX)** by adding **optimistic UI updates**, polished loading/error states, and better form interactions. These techniques make your app feel faster and more professional.

---

## ✅ Learning Outcomes
By the end of this lab you can:
- Implement **optimistic updates** with TanStack Query for create/update/delete.
- Roll back state when a mutation fails.
- Add loading spinners and disabled states for buttons.
- Improve error messages and empty states.
- Polish form UX (validation, reset, inline feedback).

---

## 🛠 Prerequisites
- Lab 7 completed (TanStack Query basic fetching/mutations).
- Lab 8 and 9 completed (Router and Auth).
- Backend API supports CRUD.

---

## 1) Optimistic Updates for AddExpense
Edit `/frontend/src/components/AddExpenseForm.tsx`:

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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (title && typeof amount === 'number') {
          mutation.mutate({ title, amount })
          setTitle('')
          setAmount('')
        }
      }}
      className="mt-4 flex gap-2"
    >
      <input
        className="border p-2"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
      />
      <input
        className="border p-2"
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
        placeholder="Amount"
      />
      <button
        type="submit"
        className="rounded bg-black px-3 py-1 text-white disabled:opacity-50"
        disabled={mutation.isPending}
      >
        {mutation.isPending ? 'Adding…' : 'Add'}
      </button>
    </form>
  )
}
```

---

## 2) Delete Expense with Optimistic Rollback
Add a delete button to each list item in `/frontend/src/components/ExpensesList.tsx`:

```tsx
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'

export function ExpensesList() {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3000/api/expenses')
      return res.json()
    },
  })

  const delMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`http://localhost:3000/api/expenses/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      return id
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['expenses'] })
      const prev = qc.getQueryData<{ expenses: any[] }>(['expenses'])
      if (prev) {
        qc.setQueryData(['expenses'], {
          expenses: prev.expenses.filter((e) => e.id !== id),
        })
      }
      return { prev }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['expenses'], ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
    },
  })

  return (
    <ul className="mt-4 space-y-2">
      {data?.expenses.map((e) => (
        <li key={e.id} className="flex justify-between border p-2 rounded bg-white">
          <span>{e.title} – ${e.amount}</span>
          <button
            className="text-red-600 hover:underline"
            onClick={() => delMutation.mutate(e.id)}
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  )
}
```

---

## 3) UX Polish
- Add **loading spinners** with Tailwind (e.g., `animate-spin` on an SVG).
- Show **empty state** when no expenses exist.
- Show **inline error messages** in forms.
- Disable submit buttons while pending.
- Reset form fields on success.

---

## 🔍 Testing
1. Add an expense → it appears instantly before server confirms.
2. Refresh page → item is still present (server persisted).
3. Delete an expense → it disappears instantly.
4. Force an error (e.g., stop backend) → optimistic update rolls back.
5. Empty DB → “No expenses yet” message appears.

---

## ✅ Checkpoints
- [ ] Optimistic add works with rollback on error.
- [ ] Optimistic delete works with rollback on error.
- [ ] Loading indicators and disabled states are added.
- [ ] Empty state and error messages are polished.

---

## 📤 What to Submit
Submit `lab11-submission/` with:
- `screenshots/` → `optimistic_add.png`, `optimistic_delete.png`, `empty_state.png`
- `git_log.txt` → commits for Lab 11
- `notes.md` → 3–6 bullets: UX polish choices and issues

Zip and upload **Lab11.zip**.

---

## 📝 Marking Guide (20 pts)
- Optimistic add mutation – 6 pts  
- Optimistic delete mutation – 6 pts  
- UX polish (loading, empty, error) – 5 pts  
- Submission quality – 3 pts  

---

## 🔭 Next (Week 12 Preview)
We’ll deploy the app to production, serving the frontend from Hono and hosting on **Fly.io**.