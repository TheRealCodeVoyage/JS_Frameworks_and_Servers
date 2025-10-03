# Lab 9 — Backend‑Managed Authentication with Kinde (TypeScript SDK + Hono)

**Course:** COMP3330 – Practical Full‑Stack Web Dev  
**Week:** 9  
**Estimated time:** 150–210 minutes  
**Goal:** Define authentication **out of React**(frontend) and into the **backend**, while now using Kinde’s **TypeScript SDK**. Your Hono server will handle login, callback, token storage in HttpOnly cookies, logout, and user/profile lookup. The frontend only renders **Login/Logout** links and calls `/api/auth/me`.

> Architecture change: **No Kinde React SDK**. We use Kinde’s **TypeScript Backend SDK** to handle the OAuth 2.0 / OIDC flow on the server and protect API routes.

---

## ✅ Learning Outcomes
By the end of this lab you can:
- Install and configure Kinde’s **TypeScript SDK** on a Node/Hono backend.
- Implement a minimal **SessionManager** using Hono cookies.
- Create backend routes for **/login**, **/callback**, **/logout**, and **/me** using SDK helpers.
- Protect API routes using the SDK’s **`isAuthenticated`** and **profile** helpers.
- Keep the frontend simple (server‑driven auth UI, no frontend SDK).

---

## 🛠 Prerequisites
- Lab 8 done (TanStack Router pages).
- Vite proxy to `/api` configured so the frontend and backend look same‑origin in dev (cookies work).
- Node (>= 18), Bun, backend at `http://localhost:3000`.

---

## 0) Install Kinde **TypeScript SDK**
From the backend project root:

```bash
bun add @kinde-oss/kinde-typescript-sdk
```

---

## 1) Create a Kinde **Backend** App
In your Kinde dashboard:
1. **Settings → Applications → Add application** → choose *Back‑end web application* (server‑side).
2. Note the values:
   - **Domain / Issuer**: `https://<your-subdomain>.kinde.com`
   - **Client ID** & **Client Secret**
3. **Allowed callback URLs** (redirect URIs):
   - `http://localhost:3000/api/auth/callback`
4. **Allowed logout redirect URLs**:
   - `http://localhost:5173/`

> You can always verify endpoints via your tenant discovery: `https://<your-subdomain>.kinde.com/.well-known/openid-configuration`.

---

## 2) Backend Environment Config
Create **`.env`** in the server root:

```ini
# Kinde
KINDE_ISSUER_URL=https://<your-subdomain>.kinde.com
KINDE_CLIENT_ID=<from Kinde>
KINDE_CLIENT_SECRET=<from Kinde>
KINDE_REDIRECT_URI=http://localhost:3000/api/auth/callback

# App
FRONTEND_URL=http://localhost:5173
PORT=3000
```

Restart the backend after adding env vars.

---

## 3) Initialize Kinde client + SessionManager
Create **`server/auth/kinde.ts`**:

```ts
// server/auth/kinde.ts
import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import type { SessionManager } from '@kinde-oss/kinde-typescript-sdk'
import { createKindeServerClient, GrantType } from '@kinde-oss/kinde-typescript-sdk'

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

export const kindeClient = createKindeServerClient(GrantType.AUTHORIZATION_CODE, {
  authDomain: process.env.KINDE_ISSUER_URL!,
  clientId: process.env.KINDE_CLIENT_ID!,
  clientSecret: process.env.KINDE_CLIENT_SECRET!,
  redirectURL: process.env.KINDE_REDIRECT_URI!,
  logoutRedirectURL: FRONTEND_URL,
})

// Minimal cookie-backed SessionManager for Hono.
// The SDK will call these to persist state/tokens per session.
export function sessionFromHono(c: any): SessionManager {
  return {
    async getSessionItem(key: string) {
      return c.req.cookie(key) ?? null
    },
    async setSessionItem(key: string, value: unknown) {
      setCookie(c, key, String(value), { httpOnly: true, sameSite: 'lax', path: '/' })
    },
    async removeSessionItem(key: string) {
      deleteCookie(c, key)
    },
    async destroySession() {
      for (const k of ['access_token', 'id_token', 'refresh_token', 'session']) {
        deleteCookie(c, k)
      }
    },
  }
}

export const authRoute = new Hono()
  // 1) Start login: get hosted login URL from SDK and redirect
  .get('/login', async (c) => {
    const session = sessionFromHono(c)
    const url = await kindeClient.login(session)
    return c.redirect(url.toString())
  })

  // 2) OAuth callback: hand the full URL to the SDK to validate and store tokens
  .get('/callback', async (c) => {
    const session = sessionFromHono(c)
    await kindeClient.handleRedirectToApp(session, new URL(c.req.url))
    return c.redirect(`${FRONTEND_URL}/expenses`)
  })

  // 3) Logout via SDK: clears SDK-managed session and redirects
  .get('/logout', async (c) => {
    const session = sessionFromHono(c)
    await kindeClient.logout(session)
    return c.redirect(FRONTEND_URL)
  })

  // 4) Current user (profile)
  .get('/me', async (c) => {
    const session = sessionFromHono(c)
    try {
      const profile = await kindeClient.getUserProfile(session)
      return c.json({ user: profile })
    } catch {
      return c.json({ user: null })
    }
  })
```

Mount the auth routes in **`server/app.ts`**:

```ts
// server/app.ts
import { Hono } from 'hono'
import { authRoute } from './auth/kinde'
// ... other imports

const app = new Hono()

app.route('/api/auth', authRoute)
// app.route('/api/expenses', expensesRoute) // existing

export default app
```

> **Cookie note (dev)**: With the Vite proxy (`/api` → `http://localhost:3000`), cookies are sent as same‑origin. If you skip the proxy and call the backend cross‑origin, add `credentials: 'include'` to `fetch` **and** set cookies with `SameSite=None; Secure`.

---

## 4) Protect API routes with the SDK
Create **`server/auth/requireAuth.ts`**:

```ts
// server/auth/requireAuth.ts
import type { Context } from 'hono'
import { kindeClient, sessionFromHono } from './kinde'

export async function requireAuth(c: Context) {
  const session = sessionFromHono(c)
  const authed = await kindeClient.isAuthenticated(session)
  if (!authed) return c.json({ error: 'Unauthorized' }, 401)
  const user = await kindeClient.getUserProfile(session)
  c.set('user', user)
  return null
}
```

Use it in a secure route, e.g. **`server/routes/secure.ts`**:

```ts
// server/routes/secure.ts
import { Hono } from 'hono'
import { requireAuth } from '../auth/requireAuth'

export const secureRoute = new Hono()
  .get('/profile', async (c) => {
    const err = await requireAuth(c)
    if (err) return err
    const user = c.get('user')
    return c.json({ user })
  })
```

Mount it:

```ts
// server/app.ts
import { secureRoute } from './routes/secure'
app.route('/api/secure', secureRoute)
```

> **Note:** With the SDK, you **don’t** manually verify tokens with `jose`. Audience checks are not required here—`isAuthenticated`/`getUserProfile` handle the session/token details (and they in turn validate as needed).

---

## 5) Frontend Auth Bar (server‑driven)
Use the same simple React component from earlier labs—just links and one call to `/api/auth/me`:

```tsx
// /frontend/src/components/AuthBar.tsx
import * as React from 'react'

export function AuthBar() {
  const [user, setUser] = React.useState<any>(null)

  React.useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
  }, [])

  return (
    <div className="flex items-center gap-3 text-sm">
      {user ? (
        <>
          <span className="text-muted-foreground">{user.email ?? user.sub}</span>
          <a className="rounded bg-primary px-3 py-1 text-primary-foreground" href="/api/auth/logout">Logout</a>
        </>
      ) : (
        <a className="rounded bg-primary px-3 py-1 text-primary-foreground" href="/api/auth/login">Login</a>
      )}
    </div>
  )
}
```

Ensure `<AuthBar />` renders in your app header.

---

## 6) Testing

### Browser flow
1. Start backend and frontend (with Vite proxy enabled).
2. Click **Login** → Kinde hosted page → complete sign in.
3. Kinde redirects to `/api/auth/callback` → SDK stores session in HttpOnly cookies and redirects back to the app.
4. Navbar shows your email from `/api/auth/me`. Navigate to `/expenses` and use the app.
5. Call `GET /api/secure/profile` from the UI or curl; it should return your user claims.

### curl
```bash
# Unauthenticated
curl -i http://localhost:3000/api/secure/profile

# After login, with dev proxy you can test via the browser.
# Or copy the access token from cookies if you need to call without the browser.
```

---

## ✅ Checkpoints
- [ ] SDK installed and configured with your Kinde tenant values.
- [ ] `/api/auth/login`, `/api/auth/callback`, `/api/auth/logout`, `/api/auth/me` working.
- [ ] Protected routes check `isAuthenticated` and return profile data.
- [ ] Frontend uses server routes; cookies flow via Vite proxy.

---

## 🧯 Troubleshooting
- **Invalid callback URL** — Ensure `KINDE_REDIRECT_URI` exactly matches an **Allowed callback URL** in the Kinde app (scheme/host/port/path).
- **Issuer / domain mismatch** — `KINDE_ISSUER_URL` must match the token `iss`. Use your tenant discovery doc to confirm.
- **Cookies not sent** — Use the Vite proxy to make `/api` same‑origin. If calling cross‑origin, add `credentials: 'include'` and set cookies with `SameSite=None; Secure`.
- **Multiple sessions / stores** — The provided `SessionManager` is minimal. In production, back it with your framework’s session store (e.g., Redis) so it scales and works across instances.

---

## 📤 What to Submit
Create `lab9-submission/` with:
- `screenshots/` → `login.png`, `callback_done.png`, `profile_api.png`
- `curl_profile.txt` → output of calling `/api/secure/profile`
- `git_log.txt` → `git log --oneline` for Lab 9 commits
- `notes.md` → 3–6 bullets: moving auth to the server with the SDK, cookie vs localStorage, what the SDK simplified

Zip and upload **Lab9.zip**.

---

## 📝 Marking Guide (20 pts)
- Server‑side auth flow implemented with the SDK (login/callback/logout) – 6 pts  
- Protected API uses SDK auth checks; `/me` returns profile – 6 pts  
- Frontend uses server routes; cookies via proxy – 5 pts  
- Submission quality (screenshots + notes) – 3 pts

---

## 🔭 Next (Week 10 Preview)
We’ll add **file uploads** to S3‑compatible storage and link them to DB records.
