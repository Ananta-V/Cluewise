# Vercel launch checklist

- [ ] Create and connect a Turso database.
- [ ] Add `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` to Vercel.
- [ ] Add a random `SESSION_SECRET` (at least 32 characters).
- [ ] Set a new private `ADMIN_PASSWORD`; do not leave `12345` on a public deployment.
- [ ] Deploy the repository root.
- [ ] Open `/api/health` and confirm it returns `{"ok":true,"app":"Cluewise","database":"connected"}`.
- [ ] Open `/admin`, sign in, and confirm the member directory is empty.
- [ ] Create two test members and confirm each sees a separate empty learning library.
- [ ] Import a test question set into one member account and confirm the other account cannot see it.
- [ ] Remove the test members before inviting learners.
