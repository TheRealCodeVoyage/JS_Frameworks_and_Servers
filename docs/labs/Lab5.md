

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

### 5.1 Verify config + CSS are in place

- tailwind.config.js must have:

```js
export default {
  darkMode: ['class'],
  content: ['./index.html','./src/**/*.{ts,tsx}'],
  // …
}
```

- src/index.css must include the CSS variables:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root { /* light tokens… */ }
  .dark { /* dark tokens… */ }
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}
```

- Now, we need to define out Light and Dark modes by providing the light and dark tokens. below you can find example of these tokens, but feel free to change them as you desired your theme to be:

```css
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --ring: 215 20.2% 65.1%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --ring: 217.2 32.6% 17.5%;
  }
```

### 5.2 Use token classes instead of fixed grays

- If your layout uses `bg-gray-50` `text-gray-900`, it won’t change in dark mode. Switch to the tokenized classes:
- make these changes in src/App.tsx

```tsx
export default function App() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-3xl font-bold">COMP3330 – Frontend Setup</h1>
        <p className="mt-2 text-sm text-muted-foreground">Vite • React • Tailwind • ShadCN</p>
        {/* rest… */}
      </div>
    </main>
  )
}
```

- Use bg-card, text-muted-foreground, border-border, etc., in components.

### 5.3 Add a real toggle (no framework dependency)

- You can keep `<html class="dark">` hardcoded for testing, but for a working toggle add a tiny component that flips the dark class and persists the choice:

- Create src/components/theme-toggle.tsx

```tsx
import { useEffect, useState } from 'react'
import { Switch } from '@/components/ui/switch' // shadcn
import { Sun, Moon } from 'lucide-react'

type Theme = 'light' | 'dark'

function setTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
  localStorage.setItem('theme', theme)
}

export function ThemeToggle() {
  const [checked, setChecked] = useState(false)

  // on mount: respect saved pref (default to light)
  useEffect(() => {
    const saved = (localStorage.getItem('theme') as Theme) || 'light'
    setChecked(saved === 'dark')
    setTheme(saved)
  }, [])

  return (
    <div className="flex items-center gap-2">
      <Sun className="h-4 w-4" />
      <Switch
        checked={checked}
        onCheckedChange={(v) => {
          setChecked(v)
          setTheme(v ? 'dark' : 'light')
        }}
        aria-label="Toggle dark mode"
      />
      <Moon className="h-4 w-4" />
    </div>
  )
}
```

- Use the *theme toggle* component we just created in your header or nav (in App.tsx):

```tsx
import { ThemeToggle } from '@/components/theme-toggle'

export default function App() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl p-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Expenses App</h1>
          <nav className="flex items-center gap-4">
            {/* links… */}
            <ThemeToggle />
          </nav>
        </header>
        {/* rest of page content */}
      </div>
    </main>
  )
}
```

### 5.4 (Optional) Improve initial load

- Add this small inline script before your app mounts (in index.html) so the correct theme is applied with no flash:

```html
<script>
  (function () {
    try {
      var saved = localStorage.getItem('theme');
      if (saved === 'dark') document.documentElement.classList.add('dark');
    } catch (e) {}
  })();
</script>
```


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