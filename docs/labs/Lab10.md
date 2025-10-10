# Lab 10 — Secure File Uploads with Signed URLs

**Course:** COMP3330 – Practical Full‑Stack Web Dev  
**Week:** 10  
**Estimated time:** 120–150 minutes  
**Goal:** Build a complete “upload a receipt” feature that stores files in S3‑compatible storage, keeps the bucket private, and delivers time‑limited download links in your React app.

---

## ✅ Learning Outcomes
By the end of this lab you will know how to:
- Configure an S3‑compatible bucket to accept browser uploads.
- Generate presigned upload URLs in a Hono backend.
- Store object keys in Postgres with Drizzle migrations.
- Create and use presigned download URLs so private files remain secure.
- Drive the entire upload → update → display flow from a React + TanStack Query frontend.

---

## 🧰 Prerequisites
Make sure these are ready before you start:
- Lab 9 is complete (authentication middleware works and sessions/cookies reach the API).
- Neon Postgres + Drizzle are running locally, and `bun run db:push` works.
- You have an S3‑compatible bucket (AWS S3, DigitalOcean Spaces, or MinIO) plus access/secret keys.
- Vite dev server proxies `/api/*` to your backend (so the browser sends cookies correctly).

> **Tip:** If you still need a bucket, create one now and note the region, endpoint URL, and name. Keep the bucket private—this lab relies on signed URLs for access.

---

## 🗺️ Architecture at a Glance
1. **Frontend** asks the backend for a signed upload URL (no file data yet).
2. **Browser** uploads the file directly to S3 using that URL.
3. **Frontend** tells the backend which expense the file belongs to (sending only the key, not the file).
4. **Backend** stores the key in Postgres and, when data is fetched later, returns a fresh signed download URL.

Keep this flow in mind as you work through the steps.

---

## 🪪 Step 0 – Bucket Setup & CORS
1. Log in to your storage provider and open the bucket you will use for receipts.
2. Ensure **public access is blocked** (bucket should be private).
3. Navigate to S3 > Bucket > Permissions > CORS, add this CORS rule so the browser can upload from `http://localhost:5173`:

   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:5173"],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```
   Add extra origins (for production) later as needed.

---

## 🧩 Step 1 – Install SDK Dependencies
From the **backend project root** run:
```bash
bun add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```
These packages let us sign upload/download URLs programmatically.

---

## 🔐 Step 2 – Configure Environment Variables
In `.env` (backend), add the S3 settings you collected earlier:
```
S3_REGION=us-west-2                # match your bucket
S3_ENDPOINT=https://s3.us-west-2.amazonaws.com
S3_BUCKET=your-bucket-name
S3_ACCESS_KEY=...                  # never commit secrets
S3_SECRET_KEY=...
```

Restart the backend after editing `.env` so new values load.

---

## 🧱 Step 3 – Create the S3 Client
File: `server/lib/s3.ts`
```ts
import { S3Client } from '@aws-sdk/client-s3'

export const s3 = new S3Client({
  region: process.env.S3_REGION!,
  endpoint: process.env.S3_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
})
```

> **Why:** Centralising the client keeps credentials in one place and lets other modules reuse it.

---

## ✍️ Step 4 – Build the Signed Upload Route
File: `server/routes/upload.ts`
```ts
import { Hono } from 'hono'
import { requireAuth } from '../auth/requireAuth'
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

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 })
    return c.json({ uploadUrl, key })
  })
```

Mount it in `server/app.ts` (near other routes):
```ts
import { uploadRoute } from './routes/upload'
app.route('/api/upload', uploadRoute)
```

> **Test:** With the backend running and a logged-in browser session, `POST /api/upload/sign` should return JSON containing `uploadUrl` and `key`.

---

## 🗄️ Step 5 – Update the Database Schema
File: `server/db/schema.ts`
```ts
export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 100 }).notNull(),
  amount: integer('amount').notNull(),
  fileUrl: varchar('file_url', { length: 500 }), // stores the S3 key or null
})
```

Apply the migration:
```bash
bun run db:generate
bun run db:push
```

> **Reminder:** Existing rows will have `file_url = NULL`, which is fine. You check the new `file_url` column in Drizzle Studio with `bun run db:studio` command

---

## 🔄 Step 6 – Teach the Expenses Route About Files
File: `server/routes/expenses.ts`

1. **Extend Zod schemas** so updates may include `fileKey`:
   ```ts
   const updateExpenseSchema = z.object({
     title: z.string().min(3).max(100).optional(),
     amount: z.number().int().positive().optional(),
     fileUrl: z.string().min(1).nullable().optional(),
     fileKey: z.string().min(1).optional(),
   })
   ```

2. **Translate incoming data** to the DB column:
   ```ts
   const buildUpdatePayload = (input: UpdateExpenseInput) => {
     const updates: Partial<Pick<ExpenseRow, 'title' | 'amount' | 'fileUrl'>> = {}
     if (input.title !== undefined) updates.title = input.title
     if (input.amount !== undefined) updates.amount = input.amount
     if (Object.prototype.hasOwnProperty.call(input, 'fileKey')) {
       updates.fileUrl = input.fileKey ?? null
     }
     if (Object.prototype.hasOwnProperty.call(input, 'fileUrl')) {
       updates.fileUrl = input.fileUrl ?? null
     }
     return updates
   }
   ```

3. **Return signed download URLs** whenever an expense is read:
   ```ts
   const withSignedDownloadUrl = async (row: ExpenseRow): Promise<ExpenseRow> => {
     if (!row.fileUrl) return row
     if (row.fileUrl.startsWith('http://') || row.fileUrl.startsWith('https://')) {
       return row
     }

     try {
       const signedUrl = await getSignedUrl(
         s3,
         new GetObjectCommand({
           Bucket: process.env.S3_BUCKET!,
           Key: row.fileUrl,
         }),
         { expiresIn: 3600 },
       )
       return { ...row, fileUrl: signedUrl }
     } catch (error) {
       console.error('Failed to sign download URL', error)
       return row
     }
   }
   ```

4. **Use the helper** in every route that returns expenses:
   ```ts
   const rows = await db.select().from(expenses)
   const expensesWithUrls = await Promise.all(rows.map(withSignedDownloadUrl))
   return c.json({ expenses: expensesWithUrls })
   ```

Now every list/detail request automatically receives a fresh, time‑limited download link.

---

## 🧑‍💻 Step 7 – Frontend Upload Form
File: `frontend/src/components/UploadExpenseForm.tsx`

Key points for the component:
- Keep local state for the selected file and error messages.
- On submit:
  1. `POST /api/upload/sign` (include credentials for cookies).
  2. `PUT` the file to the returned `uploadUrl` with the correct `Content-Type`.
  3. `PUT /api/expenses/:id` with `{ fileKey: key }`.
- Clear the form and surface errors to the user.

Your finished handler should look similar to:
```tsx
const { uploadUrl, key } = await fetch('/api/upload/sign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ filename: file.name, type: file.type }),
}).then((res) => res.json())

await fetch(uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': file.type },
  body: file,
})

await fetch(`/api/expenses/${expenseId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ fileKey: key }),
})
```

> **UX hint:** Disable the button while uploading and show an error message if any step fails.

---

## 📄 Step 8 – Show Signed Links in the UI
**Detail Page (`frontend/src/routes/expenses.detail.tsx`)**
- Fetch the expense with React Query.
- Render `UploadExpenseForm` and a conditional “Download Receipt” link when `item.fileUrl` is set.
- After a successful upload, invalidate/refetch the query so the new signed link appears immediately.

**List Page (`frontend/src/routes/expenses.list.tsx` or `components/ExpensesList.tsx`)**
- Query `/api/expenses` with `credentials: 'include'`.
- Treat `fileUrl` as `string | null`.
- Only render the download anchor if `fileUrl` exists.
- Optional: show a fallback label (e.g., “Receipt not uploaded”).

Signed URLs expire (we chose 1 hour). When a link stops working, refreshing the page triggers a new fetch and a fresh URL.

---

## 🧪 Step 9 – Test the Full Flow
1. Start backend and frontend (`bun dev` / `bun run dev` or your scripts).
2. Log in to the app.
3. Open an expense detail page and upload a file.
4. Confirm the network tab shows:
   - `POST /api/upload/sign` → 200
   - `PUT https://...s3...` → 200
   - `PUT /api/expenses/:id` → 200
5. In your bucket’s console, verify the object exists under `uploads/...`.
6. Return to `/expenses` and confirm the “Download Receipt” link works (should download or display the file).
7. Wait until the signed URL expires (or change `expiresIn` briefly) to observe the need for refetching.

> **Troubleshooting:**
> - **CORS error on upload?** Double-check the bucket’s CORS JSON and make sure you’re using the right origin.
> - **403 AccessDenied on download?** You might be storing the full URL instead of the key, or the bucket/credentials might be wrong.
> - **Zod complaining about missing title/amount?** Ensure the `PUT /api/expenses/:id` schema matches the payload `{ fileKey: string }`.

---

## ✅ Checkpoints
- [ ] Backend returns `{ uploadUrl, key }` and enforces auth.
- [ ] Files upload directly from the browser to S3.
- [ ] Expenses table stores the S3 key (not a public URL).
- [ ] API responses include signed download URLs.
- [ ] UI shows working “Download Receipt” links for each expense with a file.

---

## 📤 Submission Package
Create `lab10-submission/` containing:
- `screenshots/`
  - `sign_request.png` – proof of successful presign.
  - `s3_object.png` – object visible in the bucket.
  - `expenses_with_links.png` – UI showing working download links.
- `git_log.txt` – relevant commits for Lab 10.
- `notes.md` – 3–6 bullet points summarising challenges, provider used, and key takeaways.

Zip the folder as `Lab10.zip` and upload it to the LMS.

---

## 🔭 Looking Ahead (Week 11)
Next week we’ll focus on polishing UX: optimistic UI updates, progress indicators, and improving perceived performance for these upload workflows.

