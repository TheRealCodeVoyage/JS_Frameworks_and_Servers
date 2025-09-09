

# Lab 1 — Kickoff & Environment Setup (Bun + Hono)

**Course:** COMP3330 – Practical Full‑Stack Web Dev  
**Week:** 1  
**Estimated time:** 90–120 minutes  
**Goal:** Get a working backend HTTP server using **Bun** and **Hono**, run it locally, and test a couple of routes. You’ll also initialize Git and submit a short deliverables bundle.

---

## ✅ Learning Outcomes
By the end of this lab you can:
- Install and verify **Bun**.
- Scaffold a Bun project and add **Hono** as the web framework.
- Create basic routes and use a **logger middleware**.
- Run the server with **hot‑reload** and test endpoints with Thunder Client (or curl/Postman).
- Initialize a **Git** repository and follow a consistent project structure for upcoming labs.

---

## 📦 What You’ll Build Today
A minimal backend server that responds to:
- `GET /` → JSON: `{ "message": "OK" }`
- `GET /health` → JSON: `{ "status": "healthy" }`
- `GET /api/test` → JSON: `{ "message": "test" }`

> We’ll extend this code in later labs (DB, validation, RPC, auth, etc.).

---

## 🛠 Prerequisites
- **VS Code** with the following extensions recommended:
  - *ESLint* (dbaeumer.vscode-eslint)
  - *Thunder Client* (rangav.vscode-thunder-client) – or use Postman/curl
- **Git** installed and configured (`git --version`).

> If you already have Node.js installed, that’s fine—today we’ll use **Bun** as the runtime.

---

## 1) Install Bun
Follow the official install command from https://bun.sh and run:

```bash
bun --version
```

If you see a version number (e.g., `1.x.x`), you’re good.

---

## 2) Create Project Skeleton
We’ll keep a clean mono‑style layout for future labs.

```bash
mkdir comp3330-expensetracker
cd comp3330-expensetracker
bun init -y
mkdir server
```

This creates a base project and a **server/** folder for backend code.

Update the auto‑generated **package.json** to add dev scripts (open it and replace the `scripts` section with):

```json
"scripts": {
  "start": "bun server/index.ts",
  "dev": "bun --hot server/index.ts"
}
```

---

## 3) Add Hono and Logger Middleware
Install dependencies:

```bash
bun add hono
```

Create **server/app.ts**:

```ts
// server/app.ts
import { Hono } from 'hono'
import { logger } from 'hono/logger'

export const app = new Hono()

// Global middleware
app.use('*', logger())

// Routes
app.get('/', (c) => c.json({ message: 'OK' }))
app.get('/health', (c) => c.json({ status: 'healthy' }))
app.get('/api/test', (c) => c.json({ message: 'test' }))
```

Create **server/index.ts** (entry):

```ts
// server/index.ts
import { app } from './app'

// Prefer PORT from env; default 3000
const port = Number(process.env.PORT || 3000)

export default {
  port,
  fetch: app.fetch,
}

console.log(`🚀 Server running on http://localhost:${port}`)
```

> Note: Bun can use an exported default with `{ port, fetch }` to start the server.

Run it:

```bash
bun run dev
```

You should see the rocket log message. Visit:
- http://localhost:3000/
- http://localhost:3000/health
- http://localhost:3000/api/test

---

## 4) Test with Thunder Client (or curl)
**Thunder Client** (VS Code sidebar → Thunder icon):
1. Create a new **GET** request to `http://localhost:3000/health`.
2. Send → expect `{ "status": "healthy" }`.

Or with **curl**:

```bash
curl -s http://localhost:3000/health | jq
```

---

## 5) Organize Project & Commit
We’ll keep a conventional layout to grow into:

```
comp3330-expensetracker/
├─ server/
│  ├─ app.ts
│  └─ index.ts
├─ package.json
└─ README.md (optional)
```

Initialize git and make your first commit:

```bash
git init
git add .
git commit -m "lab1: bun + hono minimal server with routes"
```

Create a new GitHub repo and push (optional but recommended):

```bash
git branch -M main
git remote add origin <YOUR_REPO_URL>
git push -u origin main
```

---

## 6) (Optional) Bonus: Environment Port
Try launching on a different port:

```bash
PORT=5173 bun run dev
```

Confirm the server logs and endpoints now run on `http://localhost:5173`.

---

## 🧪 Checkpoints (TA/Auto‑check)
- [ ] `bun --version` prints a version.
- [ ] Server starts with `bun run dev` and prints the URL.
- [ ] `GET /`, `GET /health`, and `GET /api/test` all return correct JSON.
- [ ] Git repo initialized with at least one commit.

---

## 🧯 Troubleshooting
- **Port already in use**: change `PORT` env var or close the other process.
- **Thunder Client can’t connect**: ensure the server is running and URL matches the port.
- **TypeScript import errors**: Bun supports TS natively; ensure files are `.ts` and you’re running from project root.

---

## 📤 What to Submit
Create a `lab1-submission/` folder containing:
- `screenshot_server_running.png` – terminal showing the server log line.
- `screenshot_thunder_health.png` – Thunder Client (or curl output) for `/health`.
- `git_log.txt` – output of `git log --oneline`.
- `notes.md` – 2–5 bullets on anything you learned or got stuck on. Include your Github Repo Address.

Zip and upload to the LMS as **Lab1.zip**. Include your GitHub repo link if you pushed it.

---

## 📝 Marking Guide (10 pts)
- **Server runs with three routes** (4 pts)
- **Logger middleware present** (1 pt)
- **Testing evidence (screenshots)** (2 pts)
- **Git initialized + commit log** (2 pts)
- **Notes.md reflection** (1 pt)

> *Late labs may receive reduced credit as per course policy.*

---

## 🔭 What’s Next (Week 2 Preview)
We’ll add structured routing and prepare for validation with **Zod**, then expand endpoints you built today. Keep this project – we’ll build on it every week.