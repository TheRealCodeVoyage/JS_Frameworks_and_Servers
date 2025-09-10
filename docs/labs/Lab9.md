# Lab 9 — Authentication with Kinde (Protected Routes & API)

**Course:** COMP3330 – Practical Full‑Stack Web Dev  
**Week:** 9  
**Estimated time:** 120–180 minutes  
**Goal:** Add authentication using **Kinde**. You will wire a React login/logout flow, read the user profile, and protect both **frontend routes** and **backend API endpoints** with JWT verification.

> Continue in the same repo. Frontend at `http://localhost:5173`, backend at `http://localhost:3000`.

---

## ✅ Learning Outcomes
By the end of this lab you can:
- Configure **Kinde** for a SPA + API.
- Implement React **login/logout** and read the **current user**.
- Protect UI routes/components for **authenticated users**.
- Verify **JWT** on the backend and protect API endpoints.
- Call a **protected API** from the frontend with a Bearer token.

---

## 🛠 Prerequisites
- Lab 8 finished (TanStack Router pages working).
- Lab 7 (TanStack Query) fetching your expenses from the API.
- A Kinde account (free tier is fine).

---

## 1) Create a Kinde App & Gather Env Vars
In your Kinde dashboard, create a **SPA application** and an **API**. Note these values (we’ll put them in `.env` files):

- `KINDE_ISSUER_URL` – your Kinde domain URL (e.g., `https://<your-subdomain>.kinde.com`)
- `KINDE_CLIENT_ID` – SPA client id
- `KINDE_AUDIENCE` – your API’s audience identifier (e.g., `api://default` or what you set)
- `KINDE_REDIRECT_URI` – `http://localhost:5173/callback`
- `KINDE_LOGOUT_REDIRECT_URI` – `http://localhost:5173/`

> If you just installed Node recently, **open a new terminal** so PATH is recognized for any CLIs.

---

## 2) Frontend: Install Kinde React SDK & Configure Provider
From **`/frontend`**:

```bash
bun add @kinde-oss/kinde-auth-react
```

Create **`/frontend/src/env.ts`** and export your vars (Vite exposes `import.meta.env` only if prefixed with `VITE_`):

```ts
// /frontend/src/env.ts
export const env = {
  VITE_KINDE_ISSUER_URL: import.meta.env.VITE_KINDE_ISSUER_URL!,
  VITE_KINDE_CLIENT_ID: import.meta.env.VITE_KINDE_CLIENT_ID!,
  VITE_KINDE_AUDIENCE: import.meta.env.VITE_KINDE_AUDIENCE!,
  VITE_KINDE_REDIRECT_URI: import.meta.env.VITE_KINDE_REDIRECT_URI!,
  VITE_KINDE_LOGOUT_REDIRECT_URI: import.meta.env.VITE_KINDE_LOGOUT_REDIRECT_URI!,
}
```

Create **`/frontend/.env.local`**:

```
VITE_KINDE_ISSUER_URL=
VITE_KINDE_CLIENT_ID=
VITE_KINDE_AUDIENCE=
VITE_KINDE_REDIRECT_URI=http://localhost:5173/callback
VITE_KINDE_LOGOUT_REDIRECT_URI=http://localhost:5173/
```

Wrap your app with the **KindeProvider** in **`/frontend/src/main.tsx`**:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { KindeProvider } from '@kinde-oss/kinde-auth-react'
import { env } from './env'
import { AppRouter } from './router' // from Lab 8

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <KindeProvider
        authUrl={env.VITE_KINDE_ISSUER_URL}
        clientId={env.VITE_KINDE_CLIENT_ID}
        audience={env.VITE_KINDE_AUDIENCE}
        redirectUri={env.VITE_KINDE_REDIRECT_URI}
        logoutUri={env.VITE_KINDE_LOGOUT_REDIRECT_URI}
      >
        <AppRouter />
      </KindeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
```

---

## 3) Frontend: Login/Logout Buttons & User Badge
Create **`/frontend/src/components/AuthBar.tsx`**:

```tsx
import { useKindeAuth } from '@kinde-oss/kinde-auth-react'

export function AuthBar() {
  const { isAuthenticated, login, logout, user, getToken } = useKindeAuth()

  return (
    <div className="flex items-center gap-3 text-sm">
      {isAuthenticated ? (
        <>
          <span className="text-gray-600">{user?.given_name ?? user?.email}</span>
          <button className="rounded bg-black px-3 py-1 text-white" onClick={() => logout()}>Logout</button>
        </>
      ) : (
        <button className="rounded bg-black px-3 py-1 text-white" onClick={() => login()}>Login</button>
      )}
    </div>
  )
}
```

Add it to your layout header in **`/frontend/src/App.tsx`**:

```tsx
import { Link, Outlet } from '@tanstack/react-router'
import { AuthBar } from './components/AuthBar'

export default function App() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-4xl p-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Expenses App</h1>
          <nav className="flex items-center gap-6 text-sm">
            <Link to="/">Home</Link>
            <Link to="/expenses">Expenses</Link>
            <Link to="/expenses/new">New</Link>
            <AuthBar />
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

> The Kinde SDK will handle redirects for you.

---

## 4) Backend: Verify JWT with JOSE & Protect API
Install **JOSE** in the backend (for JWT + JWKS verification):

```bash
bun add jose
```

Create **`/server/auth/jwt.ts`**:

```ts
// /server/auth/jwt.ts
import { Context } from 'hono'
import { createRemoteJWKSet, jwtVerify } from 'jose'

const ISSUER = process.env.KINDE_ISSUER_URL!
const AUDIENCE = process.env.KINDE_AUDIENCE!

const jwks = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`))

export async function requireAuth(c: Context) {
  try {
    const auth = c.req.header('authorization') || ''
    const [, token] = auth.split(' ')
    if (!token) return c.json({ error: 'Missing Bearer token' }, 401)

    const { payload } = await jwtVerify(token, jwks, {
      issuer: ISSUER,
      audience: AUDIENCE,
    })

    // attach user to context (sub, email, etc.)
    // @ts-ignore - add a type if you like
    c.set('user', payload)
    return null // means OK, continue
  } catch (err) {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }
}
```

Add envs to **`.env`** (backend root):

```
KINDE_ISSUER_URL=
KINDE_AUDIENCE=
```

Use the middleware in **`server/routes/expenses.ts`** and/or create a secure route:

```ts
// server/routes/secure.ts
import { Hono } from 'hono'
import { requireAuth } from '../auth/jwt'

export const secureRoute = new Hono()
  .get('/profile', async (c) => {
    const err = await requireAuth(c)
    if (err) return err
    const user = c.get('user')
    return c.json({ user })
  })
```

Mount it in **`server/app.ts`**:

```ts
import { secureRoute } from './routes/secure'
app.route('/api/secure', secureRoute)
```

Now `GET /api/secure/profile` requires a valid **Bearer** token.

---

## 5) Frontend: Call a Protected API
Create **`/frontend/src/components/Profile.tsx`**:

```tsx
import { useKindeAuth } from '@kinde-oss/kinde-auth-react'
import { useState } from 'react'

export function Profile() {
  const { isAuthenticated, getToken, user } = useKindeAuth()
  const [resp, setResp] = useState<string>('')

  async function loadProfile() {
    const token = await getToken()
    const res = await fetch('http://localhost:3000/api/secure/profile', {
      headers: { Authorization: `Bearer ${token}` },
    })
    setResp(await res.text())
  }

  if (!isAuthenticated) return <p className="text-sm text-gray-600">Login to view profile.</p>

  return (
    <div className="mt-6 space-y-2">
      <p className="text-sm text-gray-700">Signed in as: {user?.email}</p>
      <button className="rounded bg-black px-3 py-1 text-white" onClick={loadProfile}>Load Protected Profile</button>
      <pre className="rounded bg-gray-100 p-3 text-xs">{resp}</pre>
    </div>
  )
}
```

Use it on the Home page (or a new `/profile` route):

```tsx
// e.g. inside Home page component
import { Profile } from '../components/Profile'

export default function HomePage() {
  return (
    <section>
      <h2 className="text-xl font-semibold">Home</h2>
      <Profile />
    </section>
  )
}
```

---

## 🔍 Testing
1) **Frontend login**: Start frontend & backend. Click **Login** in the navbar. Complete the hosted Kinde login → you return to `/callback` then back to the app.
2) **User badge**: You should see your name/email in the header.
3) **Protected call**: Click **Load Protected Profile**. Expect a JSON payload with user claims from the decoded token.
4) **curl (optional)**: You can copy your access token and test the API directly:

```bash
curl -i http://localhost:3000/api/secure/profile \
  -H "Authorization: Bearer <PASTE_ACCESS_TOKEN>"
```

---

## ✅ Checkpoints
- [ ] KindeProvider wraps the app; `.env.local` set with SPA credentials.
- [ ] Login/logout buttons work; user info displays when authenticated.
- [ ] Backend verifies JWT using JOSE + Kinde JWKS.
- [ ] `/api/secure/profile` requires Bearer token; works from the frontend.

---

## 🧯 Troubleshooting
- **Invalid token / 401** → Verify `KINDE_ISSUER_URL`, `KINDE_AUDIENCE`, and that you’re sending `Authorization: Bearer <token>`.
- **CORS** → If calling from the browser, ensure your backend includes CORS middleware for `http://localhost:5173` (if needed).
- **Callback loop** → Check `VITE_KINDE_REDIRECT_URI` matches the Kinde app settings exactly.
- **PATH issues** → After installing Node, open a new terminal so `npm`/CLIs are recognized.

---

## 📤 What to Submit
Create `lab9-submission/` with:
- `screenshots/` → `login.png`, `user_badge.png`, `protected_call.png`
- `curl_profile.txt` → output of calling `/api/secure/profile` with a Bearer token
- `git_log.txt` → `git log --oneline` for Lab 9 commits
- `notes.md` → 3–6 bullets: what you learned, any issues

Zip and upload **Lab9.zip**.

---

## 📝 Marking Guide (20 pts)
- Kinde React SDK configured; login/logout working – 6 pts  
- JWT verification on backend; protected route – 6 pts  
- Frontend calls protected API with Bearer token – 5 pts  
- Submission quality (screenshots + notes) – 3 pts

---

## 🔭 Next (Week 10 Preview)
We’ll add **file uploads** to S3‑compatible storage and link them to DB records.
