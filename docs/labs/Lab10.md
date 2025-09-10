

# Lab 10 — File Uploads & Assets (S3-Compatible Storage)

**Course:** COMP3330 – Practical Full‑Stack Web Dev  
**Week:** 10  
**Estimated time:** 120–150 minutes  
**Goal:** Enable file uploads (e.g., receipts or images) to S3‑compatible object storage (such as MinIO, DigitalOcean Spaces, AWS S3) and link them to your database records.

---

## ✅ Learning Outcomes
By the end of this lab you can:
- Configure an S3‑compatible bucket.
- Generate signed upload URLs on the backend with Hono.
- Upload files from the React frontend.
- Save file metadata/URLs into Postgres with Drizzle.
- Render uploaded assets in the UI.

---

## 🛠 Prerequisites
- Lab 9 completed (auth working).
- Neon Postgres + Drizzle already set up.
- Account on an S3‑compatible storage provider (AWS S3, DigitalOcean Spaces, or MinIO local).

---

## 1) Backend: Install AWS SDK
From the backend root:
```bash
bun add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

---

## 2) Backend: S3 Client Setup
Create `/server/lib/s3.ts`:
```ts
import { S3Client } from '@aws-sdk/client-s3'

export const s3 = new S3Client({
  region: process.env.S3_REGION!,
  endpoint: process.env.S3_ENDPOINT!, // e.g. https://nyc3.digitaloceanspaces.com
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
})
```

Add to `.env`:
```
S3_REGION=us-east-1
S3_ENDPOINT=https://nyc3.digitaloceanspaces.com
S3_BUCKET=comp3330-expenses
S3_ACCESS_KEY=
S3_SECRET_KEY=
```

---

## 3) Backend: Signed Upload Route
Create `/server/routes/upload.ts`:
```ts
import { Hono } from 'hono'
import { requireAuth } from '../auth/jwt'
import { s3 } from '../lib/s3'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const uploadRoute = new Hono()
  .post('/sign', async (c) => {
    const err = await requireAuth(c)
    if (err) return err

    const { filename, type } = await c.req.json()
    const key = `uploads/${Date.now()}-${filename}`

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      ContentType: type,
    })

    const url = await getSignedUrl(s3, command, { expiresIn: 60 })
    return c.json({ url, key })
  })
```

Mount in `app.ts`:
```ts
import { uploadRoute } from './routes/upload'
app.route('/api/upload', uploadRoute)
```

---

## 4) Drizzle: Save File URL
Update your expenses schema in `/server/db/schema.ts`:
```ts
export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }),
  amount: integer('amount'),
  fileUrl: varchar('file_url', { length: 500 }), // new column
})
```

Run:
```bash
bun run db:generate
bun run db:push
```

---

## 5) Frontend: Upload Form
Create `/frontend/src/components/UploadExpenseForm.tsx`:
```tsx
import { useState } from 'react'

export function UploadExpenseForm() {
  const [file, setFile] = useState<File | null>(null)

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return

    // 1. Ask backend for signed URL
    const res = await fetch('http://localhost:3000/api/upload/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, type: file.type }),
    })
    const { url, key } = await res.json()

    // 2. Upload file directly to S3
    await fetch(url, { method: 'PUT', body: file })

    // 3. Save expense with file URL
    await fetch('http://localhost:3000/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: file.name, amount: 0, fileUrl: `https://YOUR_BUCKET.${key}` }),
    })
  }

  return (
    <form onSubmit={handleUpload} className="space-y-3">
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <button type="submit" className="rounded bg-black px-4 py-2 text-white">Upload Expense</button>
    </form>
  )
}
```

---

## 6) Frontend: Show File Link
Update your `ExpensesList.tsx` to render file links:
```tsx
{data!.expenses.map((e) => (
  <li key={e.id} className="p-3 border rounded bg-white">
    <span>{e.title} – ${e.amount}</span>
    {e.fileUrl && (
      <a href={e.fileUrl} target="_blank" className="ml-3 text-blue-600 underline">View File</a>
    )}
  </li>
))}
```

---

## 🔍 Testing
1. Start backend + frontend.
2. Upload a file in the form.
3. Check S3 bucket: file should exist.
4. Refresh app: expense shows file link.
5. Click file link → file opens from S3.

---

## ✅ Checkpoints
- [ ] Signed upload URL generated from backend.
- [ ] File uploaded to S3 directly.
- [ ] Expense row saved with fileUrl.
- [ ] UI displays link to file.

---

## 📤 What to Submit
`lab10-submission/` with:
- `screenshots/` → `upload_form.png`, `s3_file.png`, `expense_with_link.png`
- `git_log.txt` with Lab 10 commits
- `notes.md` with 3–6 bullets: challenges, S3 provider used, lessons learned

Zip and upload **Lab10.zip**.

---

## 📝 Marking Guide (20 pts)
- Backend signed URL endpoint – 6 pts  
- Drizzle schema migration for fileUrl – 4 pts  
- Frontend upload form + API integration – 6 pts  
- Submission quality – 4 pts

---

## 🔭 Next (Week 11 Preview)
We’ll improve UX with **optimistic updates and polished UI patterns**.