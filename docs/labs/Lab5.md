

# Lab 5 — Frontend Setup (Vite React + Tailwind + ShadCN)

**Course:** COMP3330 – Practical Full‑Stack Web Dev  
**Week:** 5  
**Estimated time:** 120–150 minutes  
**Goal:** Scaffold a React frontend with **Vite**, style it with **TailwindCSS**, and add polished components with **ShadCN UI**. You’ll render a simple page and a reusable card to prepare for API integration next week.

> You will build this in the same repo as your backend, inside a new `frontend/` folder.

---

## ✅ Learning Outcomes
By the end of this lab you can:
- Create a **Vite React (TS)** app and run it locally.
- Configure **TailwindCSS** (PostCSS + config + directives).
- Initialize **ShadCN UI** and generate components.
- Build a basic layout and a reusable **Card** component.

---

## 🛠 Prerequisites
- Lab 3 completed (backend + DB working).  
- **Bun** and **Node.js** installed. *(ShadCN CLI uses Node; if you just installed Node, open a new terminal so PATH is recognized.)*

---

## 1) Scaffold Vite React (TypeScript)
From the **project root**:

```bash
bun create vite@latest frontend --template react-ts
cd frontend
bun install
bun run dev
```
Open http://localhost:5173 and confirm the Vite starter page loads.

---

## 2) Add & Configure TailwindCSS
Install Tailwind + PostCSS tools: (From `/frontend`)

```bash
bun add -d tailwindcss@3.4.13 postcss@8 autoprefixer@10
npx tailwindcss init -p 
```

Update **`tailwind.config.js`** `content` to include src and shadcn paths:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: { extend: {} },
  plugins: [],
}
```

Add Tailwind directives to **`src/index.css`** (replace file contents):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Replace **`src/App.tsx`** with a minimal Tailwind‑styled page:

```tsx
export default function App() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-3xl font-bold">COMP3330 – Frontend Setup</h1>
        <p className="mt-2 text-sm text-gray-600">Vite • React • Tailwind • ShadCN</p>
      </div>
    </main>
  )
}
```

‼️ Restart dev server if needed: `bun run dev`.

---

## 3) Initialize ShadCN UI
Initialize and generate components. Use **bunx** (or `npx`):

```bash
# In /frontend
bunx --bun shadcn@latest init
# Accept defaults or choose "apps" directory = src/components
bunx shadcn@latest add button card input
```

If `bunx` fails, try:
```bash
npx shadcn@latest init
npx shadcn@latest add button card input
```

> The CLI will add files into `src/components/ui/*` and may update Tailwind config. If it prompts to add the Radix/typography plugin, accept.

Ensure **`tailwind.config.js`** contains the ShadCN presets (add if missing):

```js
import { fontFamily } from 'tailwindcss/defaultTheme'

export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', ...fontFamily.sans],
      },
    },
  },
  plugins: [],
}
```

Ensure **`tsconfig.json`** contains the correct configurations as below:

```json
{
  "files": [],
  "references": [
    {
      "path": "./tsconfig.app.json"
    },
    {
      "path": "./tsconfig.node.json"
    }
  ],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Ensure **`tsconfig.json`** contains the correct configurations as below:

```json
{
  "compilerOptions": {
    // ...
    "baseUrl": ".",
    "paths": {
      "@/*": [
        "./src/*"
      ]
    }
    // ...
  }
}
```

Update **`vite.config.ts`**
Replace the following code in the **`vite.config.ts`** so your app can resolve paths without error:

```ts
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

---

## 4) Build a Reusable Card
Create **`src/components/AppCard.tsx`**:

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

export function AppCard() {
  return (
    <Card className="mt-6 font-mono">
      <CardHeader>
        <CardTitle>Frontend Ready</CardTitle>
        <CardDescription>Vite + React + Tailwind + ShadCN is configured.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Next lab: connect to your backend and render real data.
        </p>
      </CardContent>
    </Card>
  )
}
```

Use it in **`src/App.tsx`**:

```tsx
import { AppCard } from './components/AppCard'

export default function App() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-3xl font-bold">COMP3330 – Frontend Setup</h1>
        <p className="mt-2 text-sm text-gray-600">Vite • React • Tailwind • ShadCN</p>
        <AppCard />
      </div>
    </main>
  )
}
```

---

## 5) (Optional) Theme Toggle
Add a simple dark mode toggle later by installing the `toggle` + `switch` components via the ShadCN CLI and applying `class="dark"` on `<html>`.

---

## 🔍 Testing
- `bun run dev` shows a styled page and a **Card** component.  
- Edit text/classes to confirm Tailwind applies immediately.  
- Confirm ShadCN components render without console errors.

---

## ✅ Checkpoints
- [ ] Vite React app runs on http://localhost:5173.  
- [ ] Tailwind directives loaded; utility classes render.  
- [ ] ShadCN UI installed; `Card` renders.  
- [ ] `AppCard` component displays on the page.

---

## 📤 What to Submit
Create `lab5-submission/` with:
- `screenshots/` → `vite_home.png`, `card_render.png`
- `git_log.txt` → `git log --oneline` for Lab 5 commits
- `notes.md` → 3–6 bullets: setup issues, Tailwind/ShadCN observations

Zip and upload **Lab5.zip**.

---

## 📝 Marking Guide (20 pts)
- Vite React app scaffolding – 5 pts  
- Tailwind configured correctly – 5 pts  
- ShadCN UI initialized & components added – 6 pts  
- Submission quality (screenshots + notes) – 4 pts

---

## 🔭 Next (Week 6 Preview)
We’ll use **TanStack Query** to fetch data from your backend and render expenses with loading/error states.