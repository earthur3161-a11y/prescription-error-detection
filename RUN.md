# Running MediGuard on another computer

MediGuard is a Next.js app. It has **no external database** — all data lives in
the browser (IndexedDB) and seeds itself on first load, so there's nothing to
export or migrate. You just need to get the code onto the other machine and run it.

## Prerequisites (on the other computer)

- **Node.js 20 LTS or newer** — download from https://nodejs.org (the "LTS" build).
  Check it's installed: `node -v`

## Steps

1. **Copy the project folder** to the other computer — via USB, zip, cloud drive, or git.
   **Do not copy these two folders** (they're large, machine-specific, and regenerate):
   - `node_modules/`
   - `.next/`

   If zipping, exclude them. (`.env.local`, which enables the demo logins, *should*
   be included — but note it's git-ignored, so if you transfer via git you'll need
   to recreate it: a single line `NEXT_PUBLIC_ENABLE_DEV_ACCOUNTS=true`.)

2. **Open a terminal in the project folder** and install dependencies:
   ```
   npm install
   ```

3. **Build and start** (production mode — fastest, most stable):
   ```
   npm run build
   npm start
   ```
   Then open **http://localhost:3000**.

   *Or* for development mode (auto-reload on code changes):
   ```
   npm run dev
   ```

## Demo logins

Password for all: **`MediGuard!24`** — MFA accepts **any 6 digits** (e.g. `000000`).

| Portal            | URL                 | Email                          |
| ----------------- | ------------------- | ------------------------------ |
| Physician         | `/physician/login`  | `ama.owusu@demo.mediguard.gh`  |
| Pharmacy          | `/pharmacy/login`   | `kwame.mensah@demo.mediguard.gh` |
| Facility Admin    | `/admin/login`      | `efua.boateng@demo.mediguard.gh` |
| Super Admin       | `/superadmin/login` | `root@demo.mediguard.gh`       |

Patients can use **Check Your Medicine** at `/check` with no login.

## To let someone use it without installing anything

Deploy it and share the URL — the app runs entirely in their browser:
```
npm install -g vercel
vercel
```
Follow the prompts, then in the Vercel dashboard add the environment variable
`NEXT_PUBLIC_ENABLE_DEV_ACCOUNTS = true` and redeploy. Anyone with the link can
use it; each visitor gets their own local seeded demo data.

## Notes

- Only accessible from the same computer by default. To reach it from another
  device on the **same network**, start with `npm start` and open
  `http://<that-computer's-IP>:3000` (the terminal prints the Network URL).
- Each browser keeps its own data. To reset, use the in-app "Reset local data"
  option or clear the site's IndexedDB in the browser dev tools.
