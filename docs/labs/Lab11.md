# Lab 11 — Optimistic UX & Interface Polish

**Course:** COMP3330 – Practical Full‑Stack Web Dev  
**Week:** 11  
**Estimated time:** 120–150 minutes  
**Goal:** Make the expense tracker feel fast and professional by layering optimistic UI patterns, resilient error handling, and thoughtful feedback on top of the CRUD + file upload foundation from Lab 10.

---

## ✅ Learning Outcomes
By the end of this lab you will be able to:
- Add optimistic create/delete mutations with TanStack Query and roll back cleanly on failure.
- Keep the cache in sync with server state after optimistic mutations (refetching or updating in place).
- Communicate progress with loading/disabled states and spinners.
- Improve empty/error states and form UX so users understand what is happening.
- (Optional) Introduce extra polish such as skeletons, inline validation, and accessible toasts.

---

## 🧰 Prerequisites
- Lab 10 is complete: your API returns signed download links and expects authenticated requests with cookies (`credentials: 'include'`).
- TanStack Query is set up at the app root (QueryClientProvider) and used for list/detail pages.
- Backend exposes `/api/expenses` CRUD endpoints and requires auth.
- Expense objects have the shape `{ id, title, amount, fileUrl }`, where `fileUrl` may be `null`.

> If any of these are missing, revisit the earlier labs before continuing.

---

## 🧭 Overview of Today’s Changes
1. Optimistically add expenses so they appear immediately while the server works.
2. Optimistically delete expenses with rollback safety.
3. Polish interactions: clearer loading/errors, helpful empty states, and better forms.
4. (Optional) Layer additional UX improvements for bonus credit.

Keep your dev servers running and open both the list page and devtools network tab to observe behaviour as you go.

---

## 🪜 Step 1 – Optimistic Add Expense Mutation
File: `frontend/src/components/AddExpenseForm.tsx`

1. **Track form state** with local React state (`title`, `amount` as string, `error` message).
2. **Create a mutation** that posts to `/api/expenses`:
   ```ts
   const mutation = useMutation({
     mutationFn: async (payload: { title: string; amount: number }) => {
       const res = await fetch('/api/expenses', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         credentials: 'include',
         body: JSON.stringify(payload),
       })
       if (!res.ok) {
         const message = await res.text().catch(() => '')
         throw new Error(message || 'Failed to add expense')
       }
       return (await res.json()) as { expense: Expense }
     },
     onMutate: async (newItem) => {
       await qc.cancelQueries({ queryKey: ['expenses'] })
       const previous = qc.getQueryData<{ expenses: Expense[] }>(['expenses'])
       if (previous) {
         const optimistic: Expense = {
           id: Date.now(),
           title: newItem.title,
           amount: newItem.amount,
           fileUrl: null,
         }
         qc.setQueryData(['expenses'], {
           expenses: [...previous.expenses, optimistic],
         })
       }
       return { previous }
     },
     onError: (_err, _newItem, ctx) => {
       if (ctx?.previous) qc.setQueryData(['expenses'], ctx.previous)
     },
     onSettled: () => {
       qc.invalidateQueries({ queryKey: ['expenses'] })
     },
   })
   ```
3. **Handle form submission**:
   - Validate inputs (non-empty title, positive amount).
   - Clear any previous error.
   - Call `mutation.mutate`. After success, reset the fields.

   ```tsx
   const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
     e.preventDefault()
     setFormError(null)
     if (!title.trim()) return setFormError('Title is required')
     if (typeof amount !== 'number' || Number.isNaN(amount) || amount <= 0) {
       return setFormError('Amount must be greater than 0')
     }
     mutation.mutate({ title: title.trim(), amount })
   }

   return (
     <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-start gap-2">
       {/* inputs + button go here */}
     </form>
   )
   ```

4. **Improve button state**:
   - Disable the submit button when `mutation.isPending`.
   - Show `Adding…` text or a small spinner.

   ```tsx
   <button
     type="submit"
     className="rounded bg-black px-3 py-2 text-white transition disabled:cursor-not-allowed disabled:opacity-50"
     disabled={mutation.isPending}
   >
     {mutation.isPending ? (
       <span className="flex items-center gap-2">
         <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
         </svg>
         Adding…
       </span>
     ) : (
       'Add Expense'
     )}
   </button>
   ```

5. **Show errors**: render `mutation.error?.message` (or your own message) under the form so the user sees failures.

   ```tsx
   {formError && <p className="text-sm text-red-600">{formError}</p>}
   {mutation.isError && (
     <p className="text-sm text-red-600">{mutation.error?.message ?? 'Could not add expense.'}</p>
   )}
   ```

Test by adding an expense; it should appear instantly. Stop the API server temporarily to confirm rollback works (the placeholder item disappears and the error message renders).

---

## 🗑️ Step 2 – Optimistic Delete with Rollback
File: `frontend/src/components/ExpensesList.tsx`

1. Ensure the list query already uses `/api/expenses` with `credentials: 'include'` and returns `{ expenses: Expense[] }`.
2. Add a delete mutation:
   ```ts
   const deleteExpense = useMutation({
     mutationFn: async (id: number) => {
       const res = await fetch(`/api/expenses/${id}`, {
         method: 'DELETE',
         credentials: 'include',
       })
       if (!res.ok) throw new Error('Failed to delete expense')
       return id
     },
     onMutate: async (id) => {
       await qc.cancelQueries({ queryKey: ['expenses'] })
       const previous = qc.getQueryData<{ expenses: Expense[] }>(['expenses'])
       if (previous) {
         qc.setQueryData(['expenses'], {
           expenses: previous.expenses.filter((item) => item.id !== id),
         })
       }
       return { previous }
     },
     onError: (_err, _id, ctx) => {
       if (ctx?.previous) qc.setQueryData(['expenses'], ctx.previous)
     },
     onSettled: () => {
       qc.invalidateQueries({ queryKey: ['expenses'] })
     },
   })
   ```
3. Add a delete button/link per row. Disable it while the mutation targeting that row is pending to prevent double clicks.

   ```tsx
   return (
     <ul className="mt-4 space-y-2">
       {data?.expenses.map((expense) => (
         <li
           key={expense.id}
           className="flex items-center justify-between rounded border bg-background p-3 shadow-sm"
         >
           <div className="flex flex-col">
             <span className="font-medium">{expense.title}</span>
             <span className="text-sm text-muted-foreground">${expense.amount}</span>
           </div>
           <div className="flex items-center gap-3">
             {expense.fileUrl && (
               <a
                 href={expense.fileUrl}
                 target="_blank"
                 rel="noopener noreferrer"
                 className="text-sm text-blue-600 underline"
               >
                 Download
               </a>
             )}
             <button
               type="button"
               onClick={() => deleteExpense.mutate(expense.id)}
               disabled={deleteExpense.isPending}
               className="text-sm text-red-600 underline disabled:cursor-not-allowed disabled:opacity-50"
             >
               {deleteExpense.isPending ? 'Removing…' : 'Delete'}
             </button>
           </div>
         </li>
       ))}
     </ul>
   )
   ```
4. Optionally show a confirmation dialog to avoid accidental deletes (even a simple `confirm()` works for now).
5. Display an inline error message if deletion fails (for example, above the list or within a toast).

Test by deleting an expense. It should vanish instantly and reappear only if the server call fails.

---

## 🎨 Step 3 – Core UX Polish (Required)
Apply these improvements across the form and list components:

1. **Loading indicators**
   - Replace plain “Loading…” text with a Tailwind spinner (`<svg className="h-4 w-4 animate-spin" ... />`).
   - For list pages, consider a skeleton placeholder instead of blank space.

   ```tsx
   if (isLoading) {
     return (
       <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
         <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
         </svg>
         Loading expenses…
       </div>
     )
   }
   ```

2. **Disabled & Pending States**
   - Disable buttons while requests are pending (`isPending` / `isFetching`).
   - Use `.disabled:opacity-50` or `.cursor-not-allowed` to signal unavailable actions.

   ```tsx
   <button
     className="rounded border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-40"
     onClick={() => refetch()}
     disabled={isFetching}
   >
     {isFetching ? 'Refreshing…' : 'Refresh'}
   </button>
   ```

3. **Empty State**
   - When `expenses.length === 0`, show a friendly panel explaining that no expenses have been added yet and invite the user to add one.

   ```tsx
   if (items.length === 0) {
     return (
       <div className="rounded border bg-background p-6 text-center">
         <h3 className="text-lg font-semibold">No expenses yet</h3>
         <p className="mt-2 text-sm text-muted-foreground">
           Start by adding your first expense using the form above.
         </p>
       </div>
     )
   }
   ```

4. **Inline Errors**
   - Display API errors near the offending form/button using neutral language (e.g., “Could not add expense. Try again.”).
   - Reset the message when the user edits the form or retry succeeds.

   ```tsx
   {isError && (
     <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
       <p>Could not load expenses. Please try again.</p>
       <button
         className="mt-2 rounded border border-red-300 px-3 py-1 text-xs text-red-700"
         onClick={() => refetch()}
       >
         Retry
       </button>
     </div>
   )}
   ```

5. **Form Reset**
   - After successful adds, call `setTitle('')` and `setAmount('')` so the form is ready for the next entry.

   ```tsx
   onSettled: () => {
     qc.invalidateQueries({ queryKey: ['expenses'] })
     setTitle('')
     setAmount('')
   },
   ```

Make sure the overall styling matches the rest of your app (cards, spacing, typography).

---

## ✨ Optional – UX Polish Extras (Pick Two or More)
These enhancements stretch your skills and earn extra credit. Implement them as separate commits and mention them in `notes.md`.

1. **Skeleton Rows**
   - While the expenses query is loading, render 3–4 gray placeholder rows using Tailwind classes (`animate-pulse`, `bg-slate-200`).

2. **Inline Validation**
   - Prevent submitting negative or zero amounts.
   - Show a helper message under the input with real-time feedback (e.g., “Amount must be greater than 0”).

3. **Accessible Toast Notifications**
   - Use a simple toast hook or library (e.g., shadcn/ui toast) to show success/failure for adds and deletes.
   - Ensure the toast auto-dismisses but remains keyboard accessible.

4. **Retry Buttons**
   - When the expenses query errors, show a styled error panel with a “Try again” button that calls `refetch()`.

5. **Progress Indicator for Uploads**
   - Extend the existing `UploadExpenseForm` to show a determinate progress bar by listening to the `fetch` request using `XMLHttpRequest` or `axios` (optional advanced challenge).

Document which options you chose in the submission notes.

---

## 🔍 Testing Checklist
1. **Add Optimistically** – Item appears immediately, persists after refresh, and rolls back on failure.
2. **Delete Optimistically** – Row disappears instantly, reappears if server rejects the delete.
3. **Loading States** – Spinners/skeletons are visible instead of abrupt blank UI.
4. **Errors & Empty States** – Clear messages guide the user.
5. **Optional Polish** – Demonstrate at least two optional enhancements if you opted in.

Take screenshots along the way; you will submit them.

---

## ✅ Submission Package
Submit `lab11-submission/` containing:
- `screenshots/`
  - `optimistic_add.png`
  - `optimistic_delete.png`
  - `empty_state.png`
  - `polish_bonus.png` (show one of your optional features)
- `git_log.txt` – commits relevant to Lab 11.
- `notes.md` – 3–6 bullets summarising UX choices, optional polish implemented, and any issues encountered.

Zip the folder as `Lab11.zip` and upload it to Brightspace.

---

## 🔭 Up Next
In Week 12 we will focus on deployment considerations (env configs, build pipelines, and monitoring) so the polished app can ship confidently.
