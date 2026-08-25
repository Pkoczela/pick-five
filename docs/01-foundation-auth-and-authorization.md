# Plan 1 — Foundation, Authentication, and Authorization

## Outcome

Create a production-shaped Next.js and Supabase foundation in which invited users authenticate, claim league membership, and enter a role-aware mobile shell. Authorization is league-scoped and testable before feature work begins.

## Scope

- Next.js App Router with strict TypeScript.
- Styling foundation and mobile-first layout primitives.
- Supabase local/project configuration, typed clients, and migrations.
- Username and password authentication backed by server-only Supabase credential mapping.
- Reusable league-code enrollment and code rotation/disable flow.
- `OWNER`, `COMMISSIONER`, and `PLAYER` authorization helpers.
- Initial Row Level Security policies and authorization tests.
- Test runner, linting, formatting, type checking, and CI commands.
- Environment-variable validation and server/client separation.

## Work packages

### 1.1 Application scaffold

- Create the route groups for authentication, player pages, and `/admin`.
- Establish server and browser Supabase clients with cookie-safe session handling.
- Add a typed environment module that fails fast for missing server configuration.
- Ensure the service-role key is importable only from server-only modules.
- Add baseline error boundary, not-found page, loading shell, and metadata.

### 1.2 Authentication flow

- Build username/password sign-in with invalid-credential, unavailable, and retry states.
- Keep the internal Supabase Auth email mapping private; users interact only with usernames.
- Redirect authenticated users without an active membership to a safe join screen.
- Support sign-out and expired-session recovery.

### 1.3 Membership enrollment

- Normalize and hash reusable codes consistently.
- Create the auth identity and league membership as one compensated server workflow.
- Reject disabled/unknown codes and duplicate usernames without exposing sensitive details.
- Let owners rotate or disable the reusable code without changing existing memberships.

### 1.4 Role-aware shell

- Player navigation: current week, standings, history, account/sign out.
- Commissioner navigation: dashboard plus week, spreads, submissions, payments, results, players, audit.
- Hide irrelevant navigation for usability, while retaining server/database enforcement.
- Include league name and current role in account context.

### 1.5 Authorization base

- Create reusable server guards for authenticated user, active league member, and commissioner/owner.
- Establish RLS helper functions that avoid recursive policy queries.
- Deny cross-league access by default.
- Document the narrowly scoped uses of service-role access.

## Security tests

- Unauthenticated users cannot read league data.
- Authenticated but uninvited users cannot enter a league.
- A player cannot call an admin mutation directly.
- A player in League A cannot read League B.
- An inactive member cannot retain application access.
- A commissioner can operate only inside their league.
- Service-role secrets never appear in client bundles or browser-visible environment data.

## Deliverables

- Runnable local app and Supabase environment.
- Basic sign-in, callback, claim, access-pending, and role-aware layouts.
- Initial migrations and RLS tests.
- `.env.example` with descriptions but no secrets.
- CI script covering lint, type check, and tests.
- Short local setup guide in the repository root or `docs/`.

## Exit criteria

- A pre-created player and commissioner can each sign in and land in the correct shell.
- An invited identity is linked exactly once and unauthorized identities receive no league data.
- Role and tenant isolation tests pass against a real local Postgres/Supabase instance.
- No feature route relies on client-side role checks as its authorization boundary.
