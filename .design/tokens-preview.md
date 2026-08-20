# Blue + red palette candidates (OKLCH)

Working notes for the four direction artboards. All values OKLCH so the
existing `contrast.mjs` validator can check them unchanged.

## The tension
Red currently means DANGER in this product (overdue, negative, absent).
Promoting red to a brand colour collides with that. Three resolutions,
one per direction:

- **A / Prussian** — blue is structure, red is semantic only. Safest.
- **B / Signal** — red is brand chrome (rail, rules), danger red pushed
  darker + more saturated to stay distinct.
- **C / Split** — blue = money, red = operations. Red is a DOMAIN hue,
  danger becomes a deeper oxblood.
- **D / Inverted** — dark workspace, blue and red both as luminous data
  colours against near-black.

## Candidate ramps

### Blue (structural) — H 255, cooler than the old finance indigo 268
    blue-05  oklch(96.8% 0.018 255)
    blue-10  oklch(92.8% 0.038 255)
    blue-30  oklch(74.0% 0.115 255)
    blue-50  oklch(52.0% 0.150 255)   <- primary
    blue-60  oklch(44.0% 0.140 255)
    blue-80  oklch(30.0% 0.095 255)

### Red (brand / accent) — H 27
    red-05   oklch(96.8% 0.018 27)
    red-10   oklch(93.0% 0.042 27)
    red-30   oklch(74.0% 0.135 27)
    red-50   oklch(53.0% 0.195 27)    <- brand primary
    red-60   oklch(46.0% 0.180 27)
    red-80   oklch(32.0% 0.115 27)

### Danger, when red is spent on brand — oxblood H 18, darker
    danger-fg-light  oklch(41.0% 0.165 18)
    danger-fg-dark   oklch(72.0% 0.140 18)

Ink foundation is unchanged (H 265 near-black) — it is what keeps the
product from reading as a template, and neither blue nor red replaces it.
