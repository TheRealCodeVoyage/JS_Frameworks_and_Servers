

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

---

## 5) Expense Detail Page
Create `/frontend/src/routes/expenses.detail.tsx` to fetch one expense by ID.

---

## 6) New Expense Page
Create `/frontend/src/routes/expenses.new.tsx` with a form posting to API, then navigate back to list on success.

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