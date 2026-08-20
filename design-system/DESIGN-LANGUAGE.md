# GTS — Design Language

The visual system for the GTS business operating system. This document is the
authority; `tokens/*.css` is its executable form. Screens are built from these
decisions, not from new per-page decisions.

---

## 0. Position

**Editorial · Premium enterprise · Modern operations · Sophisticated data.**

The product is an *instrument*, not a website. Three commitments follow:

1. **Typography carries hierarchy — not cards and shadows.** Most content sits
   on the page with no container at all. A box must earn its border.
2. **Color is information.** Chrome is ink and paper. Color appears where it
   encodes meaning: a status, a domain, a data series, a delta.
3. **Density is a feature.** This is used eight hours a day. Air is spent
   deliberately at editorial moments, never sprayed to look "modern".

### Explicitly rejected

| Rejected | Instead |
|---|---|
| Everything a rounded white card | Four container types; `region` (no chrome) is the default |
| 4-equal-KPI grid on every screen | `grid-metrics` — lead metric is 1.6× its siblings |
| Generic blue product | Ink foundation, one structural blue, seven domain hues |
| Gradients / glassmorphism | Flat surfaces; elevation via lightness + hairline |
| Decorative shapes | The only ornament is a 2.5rem accent rule |
| Big radii | 2–6px. Radius signals interactivity, not style |
| Spinner on every load | Shape-matched skeletons |
| Illustrated empty states | Typographic, naming object + next action |

---

## 1. Typography

Four families, each with one job.

| Family | Role | Why |
|---|---|---|
| **Archivo** | Display + UI | Grotesque with real character; tight caps, wide weight range. Distinctive without being trendy. |
| **Newsreader** | Editorial + documents | Gives reports and bills the voice of a printed financial document. |
| **IBM Plex Sans Arabic** | All Arabic | A deliberate Arabic face by a serious foundry — not a fallback. Metrically compatible with Archivo. |
| **Roboto Flex** | Financial figures | Variable `opsz`/`GRAD` axes; true tabular + slashed zero. Money gets its own voice. |

### Dual-script baseline

Neither script leads. Both are normalized to one vertical rhythm:

```
Archivo             cap 0.730em   x-height 0.517em
IBM Plex Sans Ar.   cap 0.698em   x-height 0.516em
```

Arabic runs optically small at equal pixel size, so it is scaled **+4 %**
(`--gts-ar-adjust`) at the root rather than nudged per component. Arabic also
receives longer leading (1.7 vs 1.5) — its ascenders, descenders and dot
stacks collide at Latin line-heights.

### Scale

Base is **14px**, deliberately small so tables stay legible at high row counts.
Contrast comes from the *top* of the scale (48–88px), not from padding.
Ratio 1.2 (minor third), 11px → 88px.

### Rules

- Arabic is **never letter-spaced** — it breaks cursive joins.
- Arabic has **no uppercase**; the overline voice becomes weight + color.
- Newsreader has no Arabic. The editorial voice in Arabic is carried by
  *weight contrast* in Plex Arabic (light at large sizes), not a substitute serif.
- Latin runs inside Arabic (SKUs, emails, invoice numbers) keep the Latin face,
  cancel the +4 % correction, and are `unicode-bidi: isolate`.

### Financial numerals

Money is the most important content in the product and is typeset as its own
voice — never "bold body text".

- `tnum` + `slashed-zero` always: columns align, 0/O never confuse.
- **Currency mark is subordinate**: 0.52em, raised, 62 % opacity.
- **Decimals are de-emphasized** (55 % opacity) so the integer reads first.
- The **hero figure** (`--gts-text-5xl`, opsz 144, GRAD −50) appears **once per
  view**. A second one means the hierarchy failed.

---

## 2. Color

Built in **OKLCH** so every ramp is perceptually even and dark is a lightness
inversion rather than a hand-tuned fork.

### Foundation: ink, not blue

A warm-cooled near-black with a faint indigo cast (H 265). Reads as expensive
print. The page is **off-white** (`ink-05`) and raised surfaces go **lighter**
(`ink-00`) — elevation reads without a shadow. This single decision is what
keeps the UI from becoming card soup.

### Brand: Prussian blue

A deep, cool structural blue (H 255). It is the *structure* of the product:
brand mark, primary action, rail marker, focus ring, chart primary series, and
the single hero figure. Deliberately cooler than the finance domain indigo
(H 262), so brand and domain never collide in the same rail.

> **Red is not a brand colour.** Red is reserved, wholly and without exception,
> for danger — overdue, negative, absent, destructive. Nothing decorative may
> take it, because a red figure in this product has to mean *"a problem"* on
> sight. That reservation is the entire point of a blue brand: it leaves red
> free to carry alarm at full strength. A chart may not spend red on an
> ordinary category; series 4 is bronze for exactly this reason.

> **Primary buttons are the brand blue.** Unlike an ochre brand, a structural
> blue is exactly what a commit action should be: it reads as *the system's
> action* rather than as decoration, and it leaves ink free to be text.

### Domain accents

Each area owns a hue. Unity comes from all of them sharing the same chroma and
lightness discipline; only hue rotates.

| Domain | Hue | Character |
|---|---|---|
| Finance | Indigo 262 | Analytical, audited, sober |
| Inventory | Structural teal 200 | Operational, gridded |
| Projects | Vermilion 34 | Energetic, delivery, momentum |
| Clients | Violet 310 | Relationship, human |
| Vendors | Bronze 50 | Supply; the warm counterweight to a cool brand |
| Attendance | Green 155 | Geographic, presence |
| Admin | Graphite (chroma 0.012) | Deliberately colorless — configuration is machinery |

Applied by scoping a subtree: `<main data-domain="finance">`. Components read
`--gts-accent` and stay domain-agnostic.

**Accent surface area is strictly limited**: rail marker, section rule, active
nav, primary chart series, data emphasis. It never colors page backgrounds or
body text.

### Verified contrast

All 40 semantic pairs pass **WCAG AA (≥4.5:1)** in both themes, computed from
OKLCH via `contrast.mjs`, which exits non-zero on any failure so it can gate a
build. Notable corrections:

| Pair | Before | After |
|---|---|---|
| White on blue-50 | — | **5.44:1** ✓ |
| Projects accent on page | 4.25:1 ✗ | **5.40:1** ✓ |
| Attendance accent on page | 4.27:1 ✗ | **5.62:1** ✓ |

Run `node contrast.mjs` after any color change.

Status is **never color alone** — a dot's *shape* also encodes state (filled =
active, hollow = pending, pulsing = live), so it survives colorblindness and
grayscale printing.

---

## 3. Space, grid, elevation

- **4px base.** Small end does the work; `space-12`/`16` reserved for editorial breaks.
- **Control rhythm:** 24 / 28 / **34 (default)** / 40 / 48px, all snapping to 44px
  minimum under `pointer: coarse`.
- **Radius:** 2–6px. Containers nearly square, controls softer.
- **Elevation:** shadows are a last resort, tinted with the ink hue, never pure
  black. Only genuinely floating objects (popover, drawer, modal, toast) get one.

### Compositions, not a card grid

Named templates encode the compositions the product actually uses:

| Template | Split | Use |
|---|---|---|
| `grid-editorial` | 7:5 | Entity + its ledger — the detail-screen workhorse |
| `grid-command` | 8:4 | Data ocean + signal rail |
| `grid-ledger` | 1fr:20rem | Wide table + fixed analysis panel |
| `grid-triptych` | 5:4:3 | Three *unequal* panels — unequal widths create rhythm |
| `grid-metrics` | 1.6:1:1:1 | Stat band whose **first cell is the lead metric** |

### Containers

| Type | Chrome | For |
|---|---|---|
| **Region** | None — a rule + heading | **Default.** Most sections |
| **Panel** | Hairline border | Grouped data |
| **Card** | Raised, shadowed | Rarest — discrete actionable objects only |
| **Slab** | Full-bleed tint, no radius | Editorial openers, summary bands |

---

## 4. Responsive

Six designed widths, not "desktop then shrink".

| Width | Architecture |
|---|---|
| **1440** Command | Full density, rail expanded, 12 col |
| **1280** Standard | Rail expanded, tighter gutters |
| **1024** Condensed | Rail **compact**, splits collapse |
| **768** Tablet | No rail — top nav + drawer, 8 col |
| **430** Mobile-L | Bottom nav, sheets, 4 col |
| **390** Mobile | Single column, sticky action |

**Mobile navigation is a different architecture, not a shrunk sidebar**: five
primary destinations plus an overflow sheet, safe-area aware, with **Attendance
raised in the center** because it is the daily action. Mobile prioritizes
actions, essential data, attendance and approvals — density is a desktop asset.

---

## 5. RTL & bidirectional

RTL is **structural, not a stylesheet fork**. Every directional value uses
logical properties (`margin-inline`, `inset-inline`, `border-inline`).

- Direction is driven by `[lang]` for *typography* and `[dir]` for *layout* —
  a page can be RTL while containing Latin runs.
- **Numbers, dates, IDs and phone numbers stay LTR-isolated in both directions**,
  so `1,250.00-` never renders as `-00.052,1`. Eastern Arabic numerals are a
  per-tenant opt-in (`[data-numerals]`), not a layout default.
- **Numeric table columns** align to the cell's inline end while the number
  itself stays LTR — the correct bidi behavior.
- **Charts do not mirror.** A time axis runs left→right in both scripts because
  the numerals do. Only legends and labels flip.
- Icons mirror **selectively**: `icon-directional` (arrows, chevrons) flips;
  `icon-fixed` (clocks, charts, logos, checkmarks, anything containing digits)
  never does.

---

## 6. Motion

**Motion reports state. It never decorates.** Nothing blocking exceeds 220ms —
animation a user must *wait for* becomes friction by 3pm.

| Token | Duration | Use |
|---|---|---|
| instant | 80ms | Hover, press, checkbox |
| fast | 130ms | Tooltip, dropdown, tab |
| base | 180ms | Panels, popovers |
| slow | 260ms | Drawers, sheets, routes |

Entrances travel **6–8px only** — long slides read as sluggish in dense UI.
Row stagger is 22ms, **capped at 8 items**, so long tables never crawl.

`--gts-ease-confirm` is the system's **only overshoot**, reserved for
confirmation — attendance check-in, payment posted, stock received. Because it
is rare, it means something.

Directional keyframes consume `--gts-dir` (1 / −1) so RTL mirrors without
duplicate definitions.

**Reduced motion replaces movement with instant state** rather than disabling
feedback: confirmations still read, only travel and looping are removed.

---

## 7. States

**Loading** — skeletons mirror the *shape* of incoming content. Never a
full-page spinner: it hides the layout and makes the app feel slower. Numbers
arrive before charts; layout never shifts.

**Empty** — typographic, not illustrated (an operator meets these dozens of
times a day; a cute drawing wears out fast). Every empty state names the
**object** and offers the **next action**. "Filtered to zero" is a distinct
state that keeps filters visible and offers to clear them.

**Error** — three tiers: *field* (inline), *section* (region failed, page still
works), *page* (calm, editorial, with a support code — never a stack trace).

---

## 8. Module direction

**Dashboard** — an executive command center, not a KPI wall. One hero figure
(cash position), a metric band with a dominant lead cell, then alerts ranked by
consequence. Not every metric is equal.

**Accounts** — closest to a premium financial product. Receivables/payables as
an aging structure, cash-flow trend, overdue given danger weight. Serif
editorial headers borrow the authority of printed statements.

**Storage** — operational register: capacity as proportion, stock movement shown
as *directional travel* (`gts-travel`), transfers as flows between named places.

**Projects** — the most visually expressive module. Strong project headers,
meaningful progress, location visuals, activity timelines.

**Clients** — a relationship history, not a record: Projects → Products → Bills
→ Payments → Returns → Account, presented as one lifecycle timeline.

**Vendors** — the mirror of Clients, in bronze: products, purchasing history,
bills, payments, balances.

**Electronic Bills** — real financial documents. Newsreader headers, generous
spacing, unambiguous totals (the total row is a *document conclusion*, with a
2px rule above it), and a print stylesheet with repeating table headers.

**Attendance** — a deliberately different register: larger, softer, more
immediate. Four geofence states (outside / approaching / inside / attended) each
with their own color and treatment. The check-in CTA **breaks the control scale
on purpose** at 88px — it must be unmissable, one-handed, in sunlight.

---

## 9. Using this system

```ts
// app/layout.tsx
import { gtsFontVars } from '@/design-system/fonts';
import '@/design-system/tokens/index.css';

<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} className={gtsFontVars}>
```

`postcss-import` **must precede** `tailwindcss` in `postcss.config.js`, and the
`@import` must be the first rule in the entry CSS — otherwise tokens silently
fail to inline and every `var()` resolves to nothing.

Tailwind's default palette, spacing and radius scales are **replaced, not
extended**: `bg-blue-500` and `rounded-2xl` do not exist and cannot drift in.

**Before approving any screen:** *Does this look intentionally art-directed, or
could I mistake it for an AI-generated SaaS template?* If the latter, the
answer is usually that it became a grid of equal rounded cards. Reach for
`region`, an unequal split, and typographic hierarchy instead.
