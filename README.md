# GTS — Business Operating System

**Market: Egypt.** EGP, 14% VAT, withholding tax, 9-digit tax registration
numbers, ETA e-invoice document format, the 27 governorates, Sunday–Thursday
working week, and Africa/Cairo timestamps. See *Localisation* below.

## Run it

```bash
cd "D:\GTS System"
npm run dev
```

Then open **http://localhost:3400**. Sign in with the seeded
administrator — the sign-in page shows the credentials outside production.

The port is pinned to 3400 so it never collides with another project.

### First run against a fresh database

```bash
npm run db:deploy         # apply migrations to Neon
npm run db:seed           # permissions, roles, users, catalogue, sites
npm run db:seed:activity  # a plausible trading history (~8 min)
```

The activity seed drives the **real services** — `receiveStock`,
`createBill`, `checkIn` — so it doubles as an integration test. If an
engine were wrong it would fail rather than quietly producing pretty
numbers.

`npm run db:replenish` tops the development data back up after a test
run: the inventory suite deliberately drains two products to prove stock
cannot go negative, and the geofence suite clears today's attendance.

### The 17 modules

| Route | Module |
|---|---|
| `/dashboard` | Executive command centre — every figure from transactions |
| `/accounts` | Ageing ladder, receivable and payable |
| `/bills` | Electronic bills — the ETA tax document, approval, payments |
| `/clients` | Relationship: projects, goods, bills, payments, activity |
| `/vendors` | Supply: what they sent, what came back, what is owed |
| `/projects` | The operational spine — site location, team, materials |
| `/storage` | Warehouses and what stands in them |
| `/products` | Catalogue, live stock, reorder levels |
| `/attendance` | Geofenced check-in, validated server-side |
| `/leave` | Balances, reservation, approval queue |
| `/reports` | Financial, inventory, projects, attendance |
| `/users` | Accounts, roles, employees |
| `/permissions` | The access matrix |
| `/audit` | Who did what, append-only |
| `/admin` | The settings business logic reads |
| `/notifications` | Fanned out by permission |
| `/sign-in` | Credentials, argon2id, server-side sessions |

### Commands

```bash
npm run build        # production build — 28 routes
npm start            # serve the production build
npm run typecheck    # TypeScript, strict mode
npm run test:server  # 156 tests against the real database (~7 min)
npm run test:e2e     # 79 browser tests, desktop + mobile (~4 min)
npm test             # both
npm run contrast     # re-audit WCAG contrast of every colour pair
npm run db:studio    # browse the database
```

**`npm run test:server` talks to the real Neon database**, deliberately.
A mocked transaction cannot answer whether two concurrent issues drive
stock negative, which is the question worth asking. It cleans up after
itself.

> **Never `rm -rf .next` while a server is running.** It corrupts the dev
> bundler's module graph, and the symptom is misleading: pages 500 with
> `__webpack_modules__ is not a function` while `next build` compiles the
> same files cleanly. Stop the server first.

## Architecture

```
prisma/schema.prisma      33 tables, 50 FKs, 32 CHECK constraints
src/lib/
  db.ts                   Neon adapter + serialisable transaction helper
  auth.ts                 argon2id, sessions, requirePermission()
  permissions.ts          47 permission keys — the authorization vocabulary
  action.ts               the server-action wrapper: authorize → validate → run
  errors.ts               DomainError, so every service message reaches the user
  egypt.ts                the market profile
  eta.ts                  the ETA document + the totals engine
  geofence.ts             Haversine, fence verdicts, Maps links
  services/               one module per domain, all server-only
src/app/<module>/         page + actions + schemas + client forms
tests/server/             the engines, against real Postgres
tests/e2e/                the browser, against the real application
```

### The rules the code keeps

- **Stock is never assigned, only moved.** Every change appends an
  `InventoryTransaction` and derives the new level from the locked
  previous one. A CHECK constraint refuses a negative level even if a
  future caller bypasses the service.
- **The browser never supplies a total.** A bill form posts line items;
  the server computes subtotal, per-line VAT, total and withholding in
  Decimal and persists its own figures. There is no field in which a
  client could assert one.
- **A coordinate pair from a browser is a claim.** The attendance service
  re-runs the geofence against the administrator-set project location
  and writes only if its own verdict accepts.
- **Authorization is server-side.** `requirePermission()` queries the
  database on every protected operation. Hiding a button is a courtesy
  to the user, not a control.
- **The audit entry shares the transaction** with the change it records,
  so an action cannot succeed while its audit silently fails.

### Environment

`.env` holds the Neon connection strings and is gitignored.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | The **pooled** endpoint, used at runtime |
| `DIRECT_URL` | The **non-pooled** endpoint — Migrate and the test suite need it for advisory locks and row locks |
| `SHADOW_DATABASE_URL` | A throwaway database for Migrate's drift detection |
| `SESSION_SECRET` | Rotate in production |

Requires **Node 22+** — the Neon driver uses the global `WebSocket` for
the pooled connection that carries transactions. Do not add the `ws`
package: its native `bufferutil` addon does not survive Next's bundling.

## Localisation — Egypt

The market profile lives in three modules. Pages read from them; nothing
hardcodes a currency, a tax rate or a place name.

| Module | Holds |
|---|---|
| `src/lib/egypt.ts` | Currency, VAT and withholding rates, tax/national/insurance identifiers, the 27 governorates with coordinates, phone formats, the working calendar and statutory leave |
| `src/lib/eta.ts` | The Egyptian Tax Authority document: types, lifecycle, line items, **the totals engine**, numbering, submission validation |
| `src/lib/geofence.ts` | Haversine distance, fence verdicts, Egypt bounds, Google Maps links |

**Tax.** Standard VAT is 14%. VAT is accumulated **per line**, not applied to
the net total, so a document mixing standard-rated goods with zero-rated
exports computes correctly. Withholding tax (*khasm wa idafa*) is deducted by
the customer at payment and reduces the cash received — never the invoice
total — so it is modelled separately and shown below the total.

**Money.** Every persisted total comes from `computeBillTotals()` in
`lib/services/billing.ts`, which runs **server-side on Decimal values**
and is the only version whose output is ever stored. `computeTotals()`
in `lib/eta.ts` is the same arithmetic on floats, used for the live
preview on the bill form — which is why the two agree, and why the
preview is never submitted. A browser-supplied total is not validated;
there is no field to supply one in.

**Identifiers.** 9-digit tax registration numbers, 14-digit national IDs
(structurally validated — there is no published checksum, so a pass means
*well-formed*, not *verified*).

**Calendar.** The working week is Sunday–Thursday; Friday and Saturday are the
weekend. Attendance and leave both depend on this. Egypt observes summer time
again as of 2023, so every user-visible time resolves through `Africa/Cairo`
rather than a fixed +02:00 offset.

**E-invoicing is document-only.** Bills are produced in the ETA's shape, with
both parties' TRNs, GPC item codes, and the required document fields. They are
**not transmitted** — submission needs taxpayer credentials and an e-seal
certificate, which cannot live in this repository. The admin panel says
"Not configured" and the document shows no UUID, rather than implying a
compliance link that does not exist.

## Testing

**235 tests.** 156 server tests against the real Neon database, 79
browser tests across desktop Chrome and Pixel 7.

### `tests/server` — the engines, against real Postgres

Not mocks. A mocked transaction cannot answer whether two concurrent
issues drive stock negative, and that is the question worth asking.

- `inventory.test.ts` — the brief's scenario exactly (100 → allocate 30 →
  **70** → return 10 → **80**, remaining **20**), damage written off
  rather than restocked, transfers that roll back both halves, and
  **two concurrent issues of 6 against 10 units where exactly one
  succeeds**. The ledger replays row-by-row to the stored level.
- `billing.test.ts` — per-line VAT (1,400 on a mixed 20,000 net, not the
  2,800 an aggregate would overcharge), withholding on the pre-VAT base,
  Decimal precision, the status machine, and **two concurrent payments
  of 8,000 on an 11,400 bill where one succeeds**.
- `attendance.test.ts` — a client posting `accepted: true,
  distanceMetres: 0` from downtown Cairo **is still refused**, because
  those fields are not in the API surface. Assignment is checked before
  distance, so an unassigned person cannot probe where a site is.
- `leave.test.ts` — Friday and Saturday excluded from working days, and
  two requests cannot spend the same remaining day.
- `tax.test.ts`, `geofence.test.ts` — the pure engines, against
  hand-computed values.
- `working-days-parity.test.ts` — the client's copy of the calendar
  arithmetic agrees with the server's across 400 random ranges.

### `tests/e2e` — the browser, against the real application

- `auth.spec.ts` — sign-in, sessions, route protection, and that an
  unknown address gets the same message as a wrong password.
- `attendance.spec.ts` — **the brief's critical flow**: admin assigns an
  employee, the employee sees the pinned site, gets Maps navigation from
  the project's own coordinates, is refused from 25km away with the real
  distance, checks in inside the fence, and is refused a second time.
- `clients.spec.ts` — create, edit, duplicate refusal, search.
- `modules.spec.ts` — every one of the 17 modules renders with real data.
- `egypt-locale.spec.ts` — the localisation, asserted against real
  screens: net + VAT = total to the piastre, 9-digit TRNs, and an ETA
  panel that does not claim a connection it does not have.

## Things to try

- **Dark mode** — the whole system is theme-aware. Switch your OS to dark and
  reload; every token inverts by lightness, and chroma is reduced to prevent
  halation on OLED.
- **Arabic / RTL** — in `src/app/layout.tsx`, change
  `<html lang="en" dir="ltr">` to `<html lang="ar" dir="rtl">`. The layout
  mirrors through logical properties, the Arabic typeface takes over with its
  own leading, and numbers keep their Latin form and reading order. Verified
  against the tax invoice, which is the hardest case: Latin product and GPC
  codes are wrapped in `<bdi>` so they stay separable when the paragraph
  direction flips. English remains the shipped default — most Egyptian offices
  run bilingually, and the toggle is per-tenant in Administration.
- **Responsive** — resize down through 1440 / 1280 / 1024 / 768 / 430 / 390.
  At 768 the rail disappears and the bottom navigation takes over, with
  Attendance in the centre.
- **The geofence, for real** — `/attendance` uses the device's actual
  position. In Chrome DevTools open *Sensors* and set a location: from
  30.0131, 31.4914 (Palm Hills New Cairo) check-in unlocks; from
  30.0444, 31.2357 (downtown Cairo) it refuses and shows the true
  distance with a Maps link. The server re-runs the fence either way, so
  spoofing the browser's position past the button still fails.

## Notes for whoever picks this up

- **`src/lib/fixtures.ts` is dead.** It was the demonstration vocabulary
  for the prototype; every page now queries the database. The file is
  kept only because the seed borrows a few real Egyptian company names
  from it, and can go once those move into the seed itself.
- **`'use server'` modules may export ONLY async functions.** Next turns
  every export into a callable endpoint, so an exported `const schema =
  z…` fails the build. Each module's Zod schemas therefore live in a
  sibling `schemas.ts`, and `action()` results are private consts behind
  exported async wrappers.
- **`server-only` and client components.** `lib/action.ts` is
  server-only, so the `ActionResult` type lives in `lib/action-result.ts`
  with no imports at all — even `import type` from a server-only module
  can drag it into the client graph and fail the build.
- **Node 22+ is required.** The Neon driver uses the global `WebSocket`
  for the pooled connection that carries transactions. Do **not** add the
  `ws` package to supply one: its native `bufferutil` addon does not
  survive Next's bundling and every query dies with
  `bufferUtil.mask is not a function`. `lib/db.ts` asserts the global
  exists and says why.
- **Prisma 7 moved connection URLs** out of `schema.prisma` into
  `prisma.config.ts`. Neon also needs a **real** shadow database —
  Migrate refuses when shadow equals main, and Neon cannot create one on
  the fly — so `gts_shadow` exists on the same project.
- **The `@/…` alias is set in `next.config.mjs`**, not just `tsconfig.json`.
  Webpack did not reliably pick up the tsconfig `paths` here, and the explicit
  alias is resolver-independent. Do not remove it.
- **TypeScript is pinned to v6.** Next 15 cannot use the TypeScript 7 native
  compiler; upgrading TS requires Next 16.2.11 or later.
- **`postcss-import` must run before `tailwindcss`** in `postcss.config.js`,
  and the `@import` must be the first rule in `globals.css`. Otherwise the
  tokens never inline and every `var()` silently resolves to nothing.
- **Attendance geolocation is real end to end.** The client watches the
  device with `navigator.geolocation.watchPosition` and shows the
  distance using the same `evaluate()` the server runs — which is why
  they agree. The client decides nothing: it posts a coordinate pair and
  an accuracy figure, and the server re-runs the fence against the
  administrator-set project location before writing. There is no
  `accepted` or `distance` field in the request, so a crafted one cannot
  assert its own verdict.
- **Rotate the Neon credential.** `.env` is gitignored, but the
  connection string in it was shared in plaintext during development and
  should be considered compromised.
- **The ETA integration does not exist.** The document format does. Submission
  needs taxpayer credentials, a client id/secret and an e-seal certificate; the
  code holds a nullable `EtaSubmission` rather than inventing a UUID, and the
  admin panel reports "Not configured".
