# Lab 12 — Production Deployment (Serve Frontend from Hono + Fly.io)

**Course:** COMP3330 – Practical Full‑Stack Web Dev  
**Week:** 12  
**Estimated time:** 120–180 minutes  
**Goal:** Build your React frontend, serve it from your **Hono** backend, and deploy the full app (API + static UI) to **Fly.io**.

> You’ll produce a single public URL hosting both the API (`/api/*`) and the frontend (served statically).

---

## ✅ Learning Outcomes
By the end of this lab you can:
- Build a production bundle of a Vite React app.
- Serve static files via **Hono** (with SPA fallback to `index.html`).
- Containerize a **Bun + Hono** app with Docker.
- Configure **Fly.io** and deploy with environment secrets.
- Verify health, run DB migrations in prod, and troubleshoot.

---

## 🛠 Prerequisites
- Labs 5–11 completed (frontend+backend integrated; auth optional for deployment).
- Fly.io account and the **flyctl** CLI installed (`brew install flyctl` on macOS).
- Working `.env` locally (DATABASE_URL, KINDE_*, S3_* as applicable).

---

## 1) Build the Frontend
From `/frontend`:

```bash
bun run build
```

This creates `/frontend/dist/`.

---

## 2) Serve Frontend from Hono (Static + SPA Fallback)
Install the static middleware in the **backend** (if not already):

```bash
bun add hono
```

Create a `public/` folder in the backend and copy the built assets:

```bash
# from project root
mkdir -p server/public
cp -r frontend/dist/* server/public/
```

Update **`server/app.ts`** (or your main file) to serve static files and SPA fallback:

```ts
// server/app.ts (excerpt)
import { Hono } from 'hono'
import { serveStatic } from 'hono/serve-static'

const app = new Hono()

// Static assets
app.use('/*', serveStatic({ root: './server/public' }))

// API routes (make sure these are defined BEFORE the fallback below)
// app.route('/api/expenses', expensesRoute)
// app.route('/api/secure', secureRoute)

// SPA fallback for client-side routing: for non-API, non-file requests
app.get('*', async (c, next) => {
  const url = new URL(c.req.url)
  if (url.pathname.startsWith('/api')) return next()
  // serve index.html
  return c.env?.ASSETS
    ? await c.env.ASSETS.fetch(new Request('index.html'))
    : c.html(await Bun.file('./server/public/index.html').text())
})

export default app
```

> Ensure API routes are registered **before** the wildcard fallback.

---

## 3) Health Check Route
Add a simple health endpoint for Fly:

```ts
// server/routes/health.ts
import { Hono } from 'hono'
export const healthRoute = new Hono().get('/', (c) => c.text('ok'))

// in app.ts
// app.route('/health', healthRoute)
```

Test locally:
```bash
bun run dev
curl -i http://localhost:3000/health
```

---

## 4) Dockerize (Bun + Hono)
Create **`Dockerfile`** at project root:

```dockerfile
# syntax=docker/dockerfile:1
FROM oven/bun:1 as base
WORKDIR /app

# Install deps
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Build frontend
COPY frontend ./frontend
RUN cd frontend && bun run build

# Copy server and compiled frontend to ./server/public
COPY server ./server
RUN mkdir -p server/public && cp -r frontend/dist/* server/public/

# Start runtime image
FROM oven/bun:1 as runtime
WORKDIR /app
COPY --from=base /app /app

ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "server/index.ts"]
```

> Adjust the start command to match your entry file (e.g., `server/index.ts`, `server/app.ts`, or `src/index.ts`). If you use `ts-node`/transpile‑on‑run with Bun, this works. Otherwise bundle server code first.

---

## 5) Fly.io App Setup
From project root:

```bash
flyctl launch --now=false --no-deploy --name <your-app-name>
```

This generates **`fly.toml`**. Open it and confirm:

```toml
app = "<your-app-name>"
primary_region = "sea" # or your closest region

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

[[services.ports]]
  handlers = ["http"]
  port = 80
[[services.ports]]
  handlers = ["tls", "http"]
  port = 443

[[services.http_checks]]
  interval = "10s"
  timeout = "2s"
  method = "get"
  path = "/health"
```

---

## 6) Configure Secrets (Env Vars)
Set production env vars in Fly (replace with your values):

```bash
flyctl secrets set \
  DATABASE_URL="postgresql://...sslmode=require" \
  KINDE_ISSUER_URL="https://<tenant>.kinde.com" \
  KINDE_AUDIENCE="api://default" \
  S3_REGION="us-east-1" \
  S3_ENDPOINT="https://nyc3.digitaloceanspaces.com" \
  S3_BUCKET="comp3330-expenses" \
  S3_ACCESS_KEY="..." \
  S3_SECRET_KEY="..."
```

> Keep secrets in Fly; do **not** commit `.env` with real credentials.

---

## 7) (Optional) Run DB Migrations in Prod
If you rely on `drizzle-kit push` or a migration script, add a one‑off run:

```bash
flyctl ssh console -C "bun run db:generate && bun run db:push"
```

Or ship a dedicated script (see Lab 4) and run it once:

```bash
flyctl ssh console -C "bun server/db/migrate.ts"
```

---

## 8) Deploy
From project root:

```bash
flyctl deploy
```

Watch the logs. When it’s healthy, open the URL printed (e.g., `https://<your-app-name>.fly.dev`).

- Visit `/` → frontend loads.
- Hit `/api/expenses` → API responds.
- `curl https://<app>.fly.dev/health` → `ok`.

---

## 🔍 Troubleshooting
- **Blank page / 404 on refresh**: ensure SPA fallback serves `index.html` for non‑API routes.
- **DB connect errors**: confirm `DATABASE_URL` is set and includes `sslmode=require` for Neon.
- **CORS issues**: since UI and API share the same origin in prod, disable dev CORS. In dev, allow `http://localhost:5173`.
- **Docker build fails**: verify paths in Dockerfile; ensure `bun.lockb` exists. If missing, run `bun install` locally.
- **Memory/ports**: internal port must match `EXPOSE 3000` and Fly `internal_port`.

---

## ✅ Checkpoints
- [ ] Frontend built and copied into `server/public/`.
- [ ] Hono serves static files and SPA fallback works.
- [ ] Health endpoint returns `ok`.
- [ ] Fly app created with proper `fly.toml`.
- [ ] Secrets set; app deployed and reachable via HTTPS.

---

## 📤 What to Submit
Create `lab12-submission/` with:
- `url.txt` → your public Fly URL
- `screenshots/` → `home_prod.png`, `api_prod.png`, `health_ok.png`
- `git_log.txt` → `git log --oneline` for Lab 12 commits
- `notes.md` → 4–8 bullets: issues, fixes, next steps

Zip and upload **Lab12.zip**.

---

## 📝 Marking Guide (20 pts)
- Static serving + SPA fallback – 6 pts  
- Dockerfile + Fly config – 6 pts  
- Deployed app reachable (UI + API + health) – 6 pts  
- Submission quality – 2 pts

---

## 🎉 Done!
You now have a single production URL serving both your backend API and your frontend UI on Fly.io.
