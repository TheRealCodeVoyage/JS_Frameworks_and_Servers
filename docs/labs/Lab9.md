# Lab 9 — Backend‑Managed Authentication with Kinde (Node.js + Server Routes)

**Course:** COMP3330 – Practical Full‑Stack Web Dev  
**Week:** 9  
**Estimated time:** 150–210 minutes  
**Goal:** Move authentication **out of React** and into the **backend**. Your server (Node.js) will handle login, callback, token exchange, session cookies, logout, and JWT verification. The frontend will just show **Login/Logout** links and read `/api/auth/me`.

> Architecture change: **No Kinde React SDK**. We use standard OAuth 2.0 / OIDC on the server and protect API routes with JWT verification.

---

## ✅ Learning Outcomes
By the end of this lab you can:
- Create a **server‑side** Kinde application and configure **Allowed Callback** and **Logout** URLs.
- Implement backend routes for **/login**, **/callback**, **/logout**, and **/me**.
- Store tokens in **HttpOnly cookies** and protect API routes with a **JWT verify** middleware.
- Drive the UI with a simple **AuthBar** that calls backend routes (no frontend SDK).

---

## 🛠 Prerequisites
- Lab 8 done (TanStack Router pages).  
- Vite proxy to `/api` is configured so the frontend and backend look same‑origin in dev (cookies work).  
- Node (>= 18), Bun, and your backend running at `http://localhost:3000`.

---

## 1) Create a Kinde **Backend** App (Server‑side)

In your Kinde dashboard:
1. Go to **Settings → Applications → Add application**.
2. Choose a server‑side app (Regular Web / Backend) and note the values:
   - **Domain / Issuer**: `https://<your-subdomain>.kinde.com`
   - **Client ID** & **Client Secret**
3. **Callback URLs** (a.k.a. Redirect URIs): add
   - `http://localhost:3000/api/auth/callback`
4. **Allowed logout redirect URLs**: add
   - `http://localhost:5173/` *(or your preferred landing page)*

> You can always find endpoints and capabilities in your tenant’s OIDC discovery doc: `https://<your-subdomain>.kinde.com/.well-known/openid-configuration`.

---

## 2) Backend Environment Config
Create **`.env`** in your project root (server) and fill in your tenant details:

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

Restart your backend after adding env vars.

---

## 3) Backend Auth Routes (Hono, Node)
Create **`server/auth/kinde.ts`**:

```ts
// server/auth/kinde.ts
import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { createRemoteJWKSet, jwtVerify, decodeJwt } from 'jose'

const ISSUER = process.env.KINDE_ISSUER_URL!
const CLIENT_ID = process.env.KINDE_CLIENT_ID!
const CLIENT_SECRET = process.env.KINDE_CLIENT_SECRET!
const REDIRECT_URI = process.env.KINDE_REDIRECT_URI! // http://localhost:3000/api/auth/callback
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

const AUTH_URL = `${ISSUER}/oauth2/auth`
const TOKEN_URL = `${ISSUER}/oauth2/token`
const LOGOUT_URL = `${ISSUER}/logout`

const jwks = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`))

export const authRoute = new Hono()
  // 1) Redirect to Kinde Hosted Login
  .get('/login', async (c) => {
    const state = crypto.randomUUID()
    setCookie(c, 'oauth_state', state, { httpOnly: true, sameSite: 'lax', path: '/' })

    const url = new URL(AUTH_URL)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', CLIENT_ID)
    url.searchParams.set('redirect_uri', REDIRECT_URI)
    url.searchParams.set('scope', 'openid profile email offline')
    url.searchParams.set('state', state)
    return c.redirect(url.toString())
  })

  // 2) Handle Kinde callback → exchange code for tokens
  .get('/callback', async (c) => {
    const currentUrl = new URL(c.req.url)
    const code = currentUrl.searchParams.get('code')
    const state = currentUrl.searchParams.get('state')
    const expectedState = c.req.cookie('oauth_state')

    if (!code) return c.text('Missing authorization code', 400)
    if (!state || state !== expectedState) return c.text('Invalid state', 400)

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    })

    const resp = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })

    if (!resp.ok) {
      const txt = await resp.text()
      return c.text(`Token exchange failed: ${txt}`, 401)
    }

    const tokens = await resp.json() as {
      access_token: string
      id_token?: string
      refresh_token?: string
      expires_in: number
      token_type: string
      scope?: string
    }

    // Optional: verify access_token now (good practice in dev to catch misconfig)
    try {
      await jwtVerify(tokens.access_token, jwks, { issuer: ISSUER })
    } catch (e) {
      console.warn('Access token verify warning:', e)
    }

    // Store tokens in HttpOnly cookies (dev: SameSite=Lax)
    setCookie(c, 'access_token', tokens.access_token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: tokens.expires_in,
    })
    if (tokens.id_token) setCookie(c, 'id_token', tokens.id_token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: tokens.expires_in })
    if (tokens.refresh_token) setCookie(c, 'refresh_token', tokens.refresh_token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })

    // Success → back to app
    return c.redirect(`${FRONTEND_URL}/expenses`)
  })

  // 3) Logout: clear cookies, end Kinde session, redirect back
  .get('/logout', async (c) => {
    deleteCookie(c, 'access_token')
    deleteCookie(c, 'id_token')
    deleteCookie(c, 'refresh_token')
    deleteCookie(c, 'oauth_state')
    const out = new URL(LOGOUT_URL)
    out.searchParams.set('redirect', FRONTEND_URL)
    return c.redirect(out.toString())
  })

  // 4) Me: read id_token (or decode access token) and return basic profile
  .get('/me', async (c) => {
    const id = c.req.cookie('id_token')
    if (!id) return c.json({ user: null })
    try {
      const { payload } = await jwtVerify(id, jwks, { issuer: ISSUER, audience: CLIENT_ID })
      return c.json({ user: payload })
    } catch {
      // As a fallback in dev, decode without verify (don’t trust for auth)
      return c.json({ user: decodeJwt(id) })
    }
  })
```

Mount the auth routes in **`server/app.ts`**:

```ts
// server/app.ts
import { Hono } from 'hono'
import { authRoute } from './auth/kinde'
// ... your other imports

const app = new Hono()

app.route('/api/auth', authRoute)
// app.route('/api/expenses', expensesRoute) // existing

export default app
```

> **Cookie note (dev)**: With the Vite proxy (`/api` → `http://localhost:3000`), cookies are sent as same‑origin. If you call the backend directly from `http://localhost:5173` without a proxy, you must use `credentials: 'include'` on fetch **and** set cookies with `SameSite=None; Secure`.

---

## 4) Protect API with JWT middleware
Create **`server/auth/jwt.ts`** to verify the **access token** on protected routes:

```ts
// server/auth/jwt.ts
import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { Context } from 'hono'

const ISSUER = process.env.KINDE_ISSUER_URL!
const jwks = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`))

export type AuthVars = { Variables: { user: Record<string, unknown> } }

export async function requireAuth(c: Context<AuthVars>) {
  // Prefer explicit Bearer token, otherwise fall back to cookie
  const auth = c.req.header('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : c.req.cookie('access_token')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: ISSUER,
      clockTolerance: '60s',
    })
    c.set('user', payload)
    return null
  } catch (e: any) {
    return c.json({ error: `Invalid token: ${e?.message || 'verify failed'}` }, 401)
  }
}
```

Use it in a secure route, e.g. **`server/routes/secure.ts`**:

```ts
// server/routes/secure.ts
import { Hono } from 'hono'
import { requireAuth, type AuthVars } from '../auth/jwt'

export const secureRoute = new Hono<AuthVars>()
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

---

## 5) Frontend Auth Bar (Server‑driven)
Replace your React auth UI with **plain links** to backend routes and a small `/me` call.

Create **`/frontend/src/components/AuthBar.tsx`** (replace previous version):

```tsx
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

Ensure the header in **`/frontend/src/App.tsx`** renders `<AuthBar />` (as in earlier labs).

> **Remove frontend SDK**: If you previously added `@kinde-oss/kinde-auth-react`, you can uninstall it and remove the `KindeProvider` from `main.tsx`.

---

## 6) Testing

### Browser flow
1. Start backend and frontend (with Vite proxy enabled).
2. Click **Login** → Kinde hosted page → complete sign in.
3. Kinde redirects to `/api/auth/callback` → server sets **HttpOnly** cookies and redirects you back to the app.
4. Navbar shows your email. Navigate to `/expenses` and try app features.
5. Visit `GET /api/secure/profile` from the UI or with curl; it should return your user claims.

### curl
```bash
# Unauthenticated
curl -i http://localhost:3000/api/secure/profile

# After login, copy your access_token cookie value and try (or supply a Bearer token)
curl -i http://localhost:3000/api/secure/profile \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

---

## ✅ Checkpoints
- [ ] Kinde app created with **callback** and **logout** URLs set to your backend/FE.
- [ ] `/api/auth/login`, `/api/auth/callback`, `/api/auth/logout`, `/api/auth/me` working.
- [ ] Tokens stored in **HttpOnly cookies**; protected routes require a valid token.
- [ ] React shows **Login/Logout** via server routes (no frontend SDK).

---

## 🧯 Troubleshooting
- **Invalid callback URL** — Make sure `KINDE_REDIRECT_URI` exactly matches a value in **Allowed callback URLs** (scheme, host, port, and path). Also ensure the **logout redirect** matches your Kinde app settings.
- **Issuer errors** — If `jwtVerify` says *unexpected iss*, compare your token’s `iss` with env settings. Use the discovery doc and fix `KINDE_ISSUER_URL`.
- **Cookies not sent** — Use the Vite proxy so `/api` is same‑origin. If calling cross‑origin, set `credentials: 'include'` and set cookies with `SameSite=None; Secure`.
- **Using ID vs Access token** — Protect APIs with the **access token** (audience check skipped). Use the **id token** only to show profile data.
- **Clock skew** — Add `clockTolerance: '60s'` in dev to avoid minor time drift issues.

---

## 📤 What to Submit
Create `lab9-submission/` with:
- `screenshots/` → `login.png`, `callback_done.png`, `profile_api.png`
- `curl_profile.txt` → output of calling `/api/secure/profile`
- `git_log.txt` → `git log --oneline` for Lab 9 commits
- `notes.md` → 3–6 bullets: what changed moving auth to the server, cookie vs localStorage, token scopes

Zip and upload **Lab9.zip**.

---

## 📝 Marking Guide (20 pts)
- Server‑side auth flow implemented (login/callback/logout) – 6 pts  
- JWT middleware protects API; `/me` returns profile – 6 pts  
- Frontend uses server routes; cookies sent via proxy – 5 pts  
- Submission quality (screenshots + notes) – 3 pts

---

## 🔭 Next (Week 10 Preview)
We’ll add **file uploads** to S3‑compatible storage and link them to DB records.
