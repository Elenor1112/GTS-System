# GTS — build progress

Live status of the backend build. Phase 1 is the foundation everything
else rests on; later phases layer modules on top of it.

## Phase 1 — Foundation ✅ complete and verified

| Piece | State | Evidence |
|---|---|---|
| Neon Postgres 18.4 | live | 33 tables, 50 FKs, 32 CHECK constraints, 128 indexes, 9 enums |
| Prisma 7.9.1 schema | applied | `prisma/schema.prisma`, 2 migrations deployed |
| Integrity constraints | applied | `20260819130000_integrity_constraints` — negative stock, bad coords, zero payments all rejected by Postgres |
| Seed | idempotent | 47 permissions, 5 roles, 8 users, 5 clients, 5 vendors, 6 products, 3 warehouses, 4 geofenced projects |
| Auth core | written | argon2id, server-side sessions, SHA-256 token storage |
| RBAC | written | 47 permissions, `requirePermission()` guard |
| Audit service | written | diff-only, redacts secrets, shares caller's transaction |
| Inventory engine | **25/25 tests pass** | real DB, real concurrency, real constraints |
| Counters | written | gapless refs via `INSERT … ON CONFLICT … RETURNING` |
| Notifications | written | fan-out by permission, unread de-duplication |

### What the inventory tests actually prove

Run with `npm run test:server` (~2 min, hits the real database).

- The brief's scenario exactly: 100 → allocate 30 → **70** → return 10 → **80**, project remaining **20**
- Damage writes stock off rather than restocking it
- Transfers move stock without creating or destroying any; a failed transfer rolls back **both** halves
- Stock can never go negative — refused in the service *and* by the CHECK constraint when the service is bypassed
- **Two concurrent issues of 6 against 10 units: exactly one succeeds**, final stock 4, never negative
- The ledger replays row-by-row to exactly the stored stock level
- Adjustments post the *delta* (−3), never the counted total, so shrinkage stays visible
- Every movement writes an audit row carrying its actor

## Phase 2 — Financial core

| Piece | State | Evidence |
|---|---|---|
| Bill service | **33/33 tests pass** | totals, status machine, approval history, concurrency |
| Payment service | covered above | WHT settlement, overpayment refusal, payment races |
| Account summaries | pending | |
| PDF generation | pending | |

### What the billing tests prove

- Per-line VAT: 14% goods mixed with zero-rated exports give VAT 1,400 on
  a 20,000 net — not the 2,800 an aggregate calculation would overcharge
- Withholding computed on the **pre-VAT base** (100, not 114), and the
  bill settles at total − WHT, because that is what the buyer owes in cash
- No withholding below the ETA 300 threshold
- Decimal arithmetic: 3 × 0.10 is exactly 0.30, not 0.30000000000000004
- Unit price rounds to piastres **before** multiplying, so a printed
  invoice reproduces its own line total
- Gapless sequential numbering, separate sequences for INV and PUR
- A draft cannot skip approval and be sent; terminal states are terminal
- **Two concurrent approvals: exactly one succeeds, one APPROVED row**
- **Two concurrent payments of 8,000 on an 11,400 bill: one succeeds**
- A bill with payments recorded cannot be cancelled

## Phase 3 — People

| Piece | State | Evidence |
|---|---|---|
| Attendance + geofence | **26/26 tests pass** | server-side re-validation |
| Leave service | pending | |

### What the attendance tests prove

- The server recomputes the Haversine distance itself and stores **its
  own** figure, never the client's
- A client posting `accepted: true, distanceMetres: 0` from downtown Cairo
  is still refused — those fields are not in the API surface at all
- Refusals carry the real distance and site coordinates, so the screen can
  offer Google Maps navigation instead of a bare denial
- A fix accurate only to 900m cannot claim to be inside a 300m fence
- Positions outside Egypt, swapped lat/lng and NaN are all rejected
- Assignment is checked **before** distance, so an unassigned person
  cannot probe where a site is
- Duplicate check-in refused, and it **holds under two simultaneous
  requests** — the unique index is the real defence, not a read-then-write
- `workDate` is the Cairo date: 22:30 UTC files under the next day
- Friday and Saturday are the weekend, so absence means absence
- The radius in force at check-in is stored, so widening the fence later
  cannot retroactively legitimise a past check-in

## Phase 4 — Surface (in progress)

| Piece | State | Evidence |
|---|---|---|
| Sign-in + sessions | **10/10 E2E pass** | real browser, real cookie, real DB |
| Route protection | done | middleware + per-page `requirePermission()` |
| Server action wrapper | done | authorize → validate → run, one place |
| App shell | done | permission-aware nav, unread count, identity |
| Dashboard | done | every figure derived from transactions |
| Clients list + detail + forms | **8/8 E2E pass** | create, edit, duplicate refusal, search |
| Projects list + detail | done | location editor, team assignment |
| Attendance + geofence | **7/7 E2E pass** | the brief's critical flow, end to end |
| Vendors list + detail + forms | done | supply history, payables, catalogue |
| Products + Storage | done | live stock, margins, low-stock flags |
| Bills list + detail + form | done | ETA document, workflow, payments |
| Leave | done | balances, reservation, approval queue |
| Users + Employees | done | roles, deactivation, password reset |
| Permissions | done | the access matrix, editable per role |
| Audit log | done | filterable, paginated, append-only |
| Administration | done | the settings business logic reads |
| Reports | done | financial, inventory, projects, attendance |
| Accounts | done | ageing ladder, receivable and payable |
| Notifications | done | fan-out by permission, read state |
| Production build | **passes** | 28 routes compile, middleware active |
| Server tests | **156/156 pass** | against real Neon |
| Module sweep | **35/35 E2E pass** | every module renders with real data |

**All 17 modules are built.**

### The critical flow, verified in a real browser

`npx playwright test tests/e2e/attendance.spec.ts`

1. Admin opens the project and **assigns an employee** through the real form
2. Employee opens Attendance and sees **the site the admin pinned**
3. **Google Maps navigation** uses the project's own coordinates — the
   employee never types a destination, so they cannot navigate somewhere
   else and check in against it
4. From downtown Cairo the check-in is **refused**, with the real
   Haversine distance shown
5. Inside the 300m fence the action **unlocks and records**, storing the
   server's own distance and the radius in force at that moment
6. A second check-in the same Cairo day is **refused**

### Development data

`npm run db:seed` then `npm run db:seed:activity`. The activity seed
drives the **real services** — receiveStock, createBill, checkIn — so it
doubles as an integration test: if an engine were wrong, it would fail
rather than quietly producing plausible numbers. It generates ~EGP 2M of
trading history, 68 geofence-validated check-ins, and a ledger that ages
into genuine overdue balances.

## Phase 5 — Verification

- [ ] Playwright E2E for the three critical flows
- [ ] RTL and mobile verification
- [ ] Permission matrix verification per role

## Fixed along the way

- **Rail overlap** — traced to Next's own dev-indicator badge, not the
  layout. Disabled via `devIndicators: false`; it has no production
  equivalent and was landing in every verification screenshot.
- **Uppercased client names** — `.gts-table th` applied `text-transform`
  to every `th`, including the `<th scope="row">` identity cells that are
  the correct markup for a record's name. Scoped to `thead th`.
- **Test pollution** — the server suite ran against the development
  database and left 265 notifications behind, showing as a "99+" badge.
  Added a global teardown that removes only what the run created.
- **Playwright's 5s default** — a sign-in is argon2id plus a round trip to
  us-east-2 plus dev compilation. Raised to 15s; the code was never slow,
  the budget was wrong.
- **`server-only` leaking into the client bundle** — this broke the
  production build entirely, and was masked for a while by test-timing
  noise. Two causes: the attendance page was `'use client'` while
  rendering a server `Shell`, and `ActionResult` was imported from the
  server-only `lib/action.ts`. The type now lives in `lib/action-result.ts`
  with no imports at all, and attendance is a server page with a small
  client island for the geolocation.
- **`ws` was a wrong turn** — added to fix a stale Neon socket, it broke
  every query with `bufferUtil.mask is not a function` under Next's
  bundler. Node 26 has a native global WebSocket that the Neon driver
  uses; the package was never needed. `lib/db.ts` now asserts the global
  exists and says why, so it is not re-attempted.
- **`DomainError` base class** — `toResult()` listed each service's error
  class by name, so `ClientError` fell through to "Something went wrong"
  and swallowed a useful "code already in use". Every service error now
  extends one base and the wrapper does a single check, which cannot go
  stale as services are added.
- **Test pollution, again** — the E2E suite left 451 notifications and a
  drawer of "First Company" clients. The Playwright teardown now removes
  the notifications, attendance and clients its own run created.
- **`'use server'` may export ONLY async functions** — Next turns every
  export into a callable endpoint, so an exported `const schema = z…`
  fails the build. The bill schemas moved to `app/bills/schemas.ts`, and
  every `export const xAction` became a private const behind an exported
  async wrapper. This broke the build only once bills were added; the
  earlier modules had the same latent fault and were fixed with it.
- **US date format on every date input** — `<html lang="en">` makes
  Chromium render `<input type="date">` month-first. Egypt writes dates
  day-first, and a due date read as 08/09 rather than 09/08 is a month's
  difference on an invoice. Now `lang="en-GB"`.
- **Two products stuck at zero stock** — the inventory suite drains
  CEM-42.5N and STL-B12 to prove stock cannot go negative, and never put
  them back, so the development catalogue looked like a supply crisis.
  `npm run db:restock` tops them up **through `receiveStock()`**, so the
  ledger explains the units rather than a column being set behind its back.

## If the dev server starts throwing `__webpack_modules__ is not a function`

Deleting `.next` **while `next dev` is running** corrupts its module
graph, and the symptom is confusing: pages 500 with a webpack error that
looks like a code fault, and the production build compiles the same files
cleanly. The order matters —

```bash
# stop the server first, then clean, then start
npx next build     # verify the code actually compiles
rm -rf .next
npm run dev
```

When a run fails only in dev, check `npx next build` before assuming the
code is broken. The full E2E suite passes against `npm start`.

## Test-run ordering

`npx playwright test` — **79 passing**, desktop and mobile.

Capped at **4 workers**. These drive one Next dev server compiling routes
on demand and one Neon pool; past about four concurrent browsers the
bottleneck becomes the server, and tests fail on a timeout that measures
contention rather than the application. Every spec passes alone at any
width — four is where they also pass together.

The projects run in a deliberate chain, because they share one database
and one dev server:

```
setup  →  auth  →  desktop  →  mobile
```

- **setup** signs in once and saves the session. Retried twice even
  locally: it is the first request a cold dev server sees and pays for
  compiling `/sign-in`, the sign-in action and `/dashboard` on demand.
- **auth** runs signed out with **one worker** — every test performs a
  real argon2id sign-in, and eight in parallel is a self-inflicted load
  test that fails on the very hashing cost the design intends.
- **desktop** runs the full suite in parallel on the shared session.
- **mobile** re-runs only attendance and locale, *after* desktop. Run
  concurrently, the two projects race for the same generated client codes
  and for the single "one check-in per employee per project per day" row.

Attendance clears the check-in it creates, for the same reason.

## Decisions worth knowing about

- **`app/leave/working-days.ts` duplicates the server's calendar
  arithmetic** so a form can show what a date range will cost before it
  is submitted. The service is `server-only` and cannot be imported into
  a bundle. `tests/server/working-days-parity.test.ts` asserts the two
  agree across 400 random ranges — duplicated logic drifts unless
  something forces it not to.
- **The reports page separates "invoiced" from "cash moved"** because
  they are aged differently: a bill counts in the month it was issued, a
  payment in the month it was received. Shown in one row, a reader
  naturally subtracts figures that do not describe the same
  transactions.
- **The administrator role cannot be edited from the permissions
  screen.** It holds every permission implicitly through `can()`, so
  saving a reduced set would appear to work and change nothing. The
  screen says so rather than offering the checkboxes.
- **The last administrator cannot be demoted or deactivated.** Enforced
  in the service, not the form, so it holds whichever caller reaches it.

## The locale tests, retargeted

`tests/e2e/egypt-locale.spec.ts` was written against the fixture
prototype and asserted hardcoded figures from one invoice that no longer
exists. Rather than delete or weaken them, each was pointed at the real
screen and rewritten to assert what the engine actually guarantees:

- The totals test now opens a real bill and checks **net + VAT = total to
  the piastre**, and that VAT never exceeds 14% of net. That holds for
  any seed; the old constants held for one.
- The TRN test opens a bill's Parties section and matches the 9-digit
  `123-456-789` grouping.
- The currency and VAT-rate tests moved from a settings screen to the
  bill form, which is where those choices actually live — a document's
  currency is per-document, not a global preference.
- The weekend test now asserts the configured working hours are shown;
  the Friday/Saturday rule itself is unit-tested against real dates in
  `tests/server`, which is precise rather than dependent on the day the
  suite happens to run.

## Known issues

- `npm audit` reports 6 high transitive advisories (postcss, sharp,
  prisma's deepmerge-ts). All are build-time or image-processing paths,
  none in a runtime request path. `audit fix --force` would move Next off
  15 and break the pinned TypeScript 6 constraint, so they are left alone
  deliberately.
- The `.env` in this repo holds a real Neon credential. It is gitignored,
  but it must be rotated before this is deployed anywhere.
