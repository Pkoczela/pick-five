# Pick Five

Pick Five is a private, mobile-first NFL against-the-spread pool. Players join a league with a reusable code, choose exactly five teams each week, and follow the pool after picks lock. Commissioners own official spreads, payment tracking, score corrections, winner resolution, and rollover accounting.

## Local setup

Requirements: Node.js 22+, npm, and a Supabase project.

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and fill in the Supabase project URL, publishable key, and server-only secret key.
3. Apply every SQL file in `supabase/migrations` in filename order.
4. Run `supabase/seed.sql` once to create the 32 NFL teams.
5. Start the app with `npm run dev` and open `http://localhost:3000`.

The secret key must never be exposed through `NEXT_PUBLIC_*` variables or browser code.

## Verification

```text
npm test
npm run lint
npm run typecheck
npm run build
```

Provider tests use committed fixtures/mocks and do not require live ESPN access. The commissioner can always refresh ESPN scores manually; existing schedule data and commissioner overrides are preserved when a refresh fails.

## Production

- Configure the same environment variables in Vercel.
- Apply migrations to the production Supabase project before deploying the corresponding application version.
- Verify RLS is enabled on every public table.
- Run one real week in parallel with the legacy workbook and reconcile spreads, picks, ATS outcomes, tiebreaker, payout, and rollover before cutover.
- Keep database backups and the commissioner correction/audit workflow available before retiring the workbook.

Detailed implementation and acceptance plans are indexed in [docs/README.md](docs/README.md).
