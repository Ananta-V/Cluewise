# Cluewise — JavaScript + Vercel Edition

A self-contained Cluewise web app built with vanilla HTML/CSS/JavaScript and Vercel Node.js Functions. It uses Turso (hosted libSQL / SQLite-compatible storage) so accounts and learning data persist centrally. Run locally with Vercel CLI and a private `.env.local` file; no Vercel dashboard environment-variable setup is needed for local use.

**No Python. No Flask. No Next.js build. No static local database file.**

## Included

- `public/index.html` — member sign-in and Cluewise learning interface.
- `public/app.css` — responsive interface styling.
- `public/app.js` — member UI, copyable prompt builder, JSON import, learning and review flows.
- `public/admin.html` — administrator console at `/admin`.
- `public/admin.js` — add/remove member management.
- `api/[...route].js` — all JavaScript serverless API routes, auth/session handling, password hashing, database setup, and account isolation.
- `vercel.json` — maps `/admin` to the admin page and configures the function.

The database schema is created automatically on the first API request. The member table begins with **zero users**. No demo members are seeded.

## 1. Configure Turso locally (no Vercel dashboard variables)

1. Create a Turso database and copy its database URL (`libsql://...`).
2. Create a fresh read-write database token in the Turso dashboard. Never reuse a token that has been pasted into chat, committed, or shared.
3. Copy `.env.example` to `.env.local` in this project root.
4. Fill in the values:

| Variable | Value |
|---|---|
| `TURSO_DATABASE_URL` | Your `libsql://...` database URL |
| `TURSO_AUTH_TOKEN` | Fresh Turso read-write token |
| `SESSION_SECRET` | Random secret of at least 32 characters |
| `ADMIN_PASSWORD` | Admin password (defaults to `12345` as initial fallback if not set) |

Generate a session secret with Node.js:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

`.env.local` is ignored by Git. Set your custom `ADMIN_PASSWORD` in `.env.local` or Vercel Environment Variables before public launch.

## 2. Run Cluewise locally

Install Node.js 20 or later, then run:

```bash
npm install
npm start
```

Open `http://localhost:3000` or `http://localhost:3000/admin` in your browser. The initial admin password is `12345`.

## 3. Deploying later

This project uses Vercel Node.js Functions (`api/[...route].js`). A deployed Vercel project does not receive your computer's `.env.local` file. If you deploy it later, provide the four secrets through a secure runtime secret mechanism supported by the host. Never commit credentials to GitHub, even in a private repository.

## 4. Use Cluewise

- Main app: `https://your-project.vercel.app/`
- Admin page: `https://your-project.vercel.app/admin`
- Sign in with the member name and password assigned by the administrator.
- There is no public self-registration.
- Open `/admin`, sign in with the configured admin password, and add members. Set a name and password for each person.
- Remove a member from the same page. Their sets, attempts, and saved clues are deleted with the account.

## 5. Local development

Install Node.js 20 or later, create a Turso database, and copy `.env.example` to `.env.local` and enter your real values. Then:

```bash
npm install
npm start
```

Open `http://localhost:3000` in your browser. API routes use the same Turso database when those environment variables are configured.

## Data isolation and security

- Member accounts are created only by the admin.
- Member passwords are stored as salted scrypt hashes. The raw password is not stored in the database.
- The browser receives an HTTP-only, signed session cookie. The member ID is verified against the database before private data is served.
- Every learning-set, attempt, and review operation is filtered by the authenticated member ID on the server. Guessing another set's ID does not grant access.
- Admin endpoints require a separate administrator-role session. Members cannot add or remove accounts.
- Deleting a member removes that member's learning sets, answers/progress, and saved-review rows.
- No users are inserted during initial setup.

## Notes

- This is JavaScript end to end. Turso stores data remotely; it is not a SQLite file on Vercel's temporary filesystem.
- The prompt builder asks the AI for exactly 30 multiple-choice learning clues and requires one copyable fenced JSON block. The importer strips the Markdown fences automatically.
- Question objects need `question`, four `options`, an `answer` that exactly matches one option, and an `explanation`. `crossword_clue` and `deeper_prompt` are optional.
- Existing data in a previous standalone browser LocalStorage or an earlier local SQLite database is not migrated automatically.
- Back up the Turso database regularly. For large-scale traffic or advanced analytics, consider reviewing database tier and capacity.
