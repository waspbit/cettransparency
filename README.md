# CET Transparency Portal

Vercel static frontend (`public/`) + serverless API (`api/`). Google Sheets = registry and metadata, private Drive folder = PDFs, Upstash Redis = sessions and rate limits.

## Assets (add your own files)
- `public/assets/logo.png` – CET logo (header; hidden automatically if missing)
- `public/assets/cet_building.jpg` – hero background (maroon overlay is applied on top)

## 1. Google Sheets
**Registry spreadsheet** → tab `Student Registry`: A `StudentNumber`, B `Status` (Active/Inactive), C `AccessLevel` (Student/Admin).
**Documents spreadsheet** → tab `Transparency Documents`: exactly A `DocID`, B `Title`, C `Description`, D `Date`, E `Status` (Published/Unpublished). DocIDs may contain letters, numbers, `-`, `_` only (max 64).

## 2. Google Drive (private) and DocID mapping
Create a folder, keep it **Restricted** (never "anyone with the link"). Upload each PDF named exactly `<DocID>.pdf` (e.g. `CET-2026-001.pdf`). The backend only serves a file when the folder contains exactly one match, it is a real PDF, and the sheet row is Published. No extra worksheet columns are used.

## 3. Google service account
Google Cloud → enable Sheets API and Drive API → create a service account + JSON key. Share both spreadsheets and the Drive folder with its `client_email` as **Viewer**. Paste the full JSON into `GOOGLE_SERVICE_ACCOUNT_JSON`.

## 4. Upstash Redis
Create a free Redis DB at upstash.com (or Vercel Marketplace) and copy REST URL and token.

## 5. Deploy
Push to a private GitHub repo → import in Vercel → add all variables from `.env.example` → deploy. Local test: `npm i -g vercel && vercel dev`.

## Behaviour
- Session: random 256-bit id in an HttpOnly, Secure, SameSite=Strict cookie, stored in Redis, 30-minute absolute expiry, deleted on logout.
- Rate limit: 10 attempts/10 min per IP and 8/10 min per student number.
- Every PDF request re-checks session and Published status.
- Admin work is done in Sheets/Drive. `AccessLevel` is stored in the session but no admin API exists, so students have no admin surface.

## Limitations
- Student-number-only access does not prove identity.
- Hiding download/print is a deterrent only; screenshots and dev tools can still capture content.
- Vercel serverless responses are capped at about 4.5 MB, so keep PDFs under ~4 MB.
- The registry uses one generic denial message so inactive and unregistered numbers can't be told apart.

## Troubleshooting
- `500` on login: check env vars and that the sheets are shared with the service account.
- Document not available: file name must equal `<DocID>.pdf`, in the configured folder, with a Published row and a unique DocID.
- Always logged out: Upstash variables missing or wrong.
- Tab names must match exactly, including spaces.
