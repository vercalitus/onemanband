# OneManBand — design contract

Direction A, "Hebrew modernist poster", in operate mode. Chosen 2026-11-09
after four directions were sketched and this one was built out on four
screens (patient page, today, week calendar, close session). The mockups live
outside the app, in `.impeccable/mocks/decision/a/`; the rollback point is the
git tag `before-redesign-a`.

The idea in one sentence: the facts that matter on a screen are read from
across the room, the way a poster is, and everything else is quiet.

## The field

- **Cobalt L.** The navigation rail and the plate across the top are one
  cobalt shape. The plate carries the screen's one to three facts in display
  numerals (a time, a session count, a balance). Nothing else in the app is
  cobalt except the selected state and links.
- **Ground, paper, hairlines.** Pages sit on `ground`; working surfaces are
  `paper`; separation is a 1px hairline, not a shadow and not a card inside a
  card. The one shadow belongs to a dialog lifted over the page.

## Colour, and what each one means

| Token | Value | Means |
|---|---|---|
| `cobalt` | `#1D3F8F` | The field, the selected state, links |
| `signal` | `#E4572E` | **Act now**: the primary button, the "now" marker, the outline round an open debt. Never text colour (it fails contrast on paper), never decoration |
| `olive` | `#5E6B2F` | Done: a visit that happened, a payment received |
| `ink` | `#16181A` | Text |
| `mute` | `#55585B` | Secondary text |
| `ground` | `#F5F5F2` | The page |
| `paper` | `#FFFFFF` | Working surfaces |
| `hair` | ink at 14% | Lines |

Tailwind's `sky` scale is remapped to a cobalt ramp, `slate` to a neutral ink
ramp and `emerald` to an olive ramp, so screens not yet redrawn already speak
the palette. A screen being redrawn should use the named tokens.

## One state vocabulary

Everywhere a visit, a payment or a task has a state, it is drawn the same way:

- **filled** (olive) — done
- **ring** — booked / planned
- **dashed ring** — not confirmed
- **struck through** — cancelled
- **orange** — now

A legend is shown wherever more than two of these appear together.

## Type

- **Heebo** for everything a person reads or types — Latin and Hebrew in one
  family, so a mixed line does not change voice halfway. Arabic keeps IBM Plex
  Sans Arabic.
- **Secular One** for display only: names and numerals on the plate, a sum in
  a form. Never for body text, never for labels.
- Three text sizes, **14 / 17 / 22**, plus display (56 on the plate). 13 is the
  floor for anything at all.
- Tabular numerals wherever times or money stand in a column.

## Shape and touch

- Radius 6px. Buttons and fields are rectangles with soft corners, not pills.
- Every target is at least 44px; primary actions 48–56px. The practitioner is
  on an iPad between patients, sometimes with a pen in hand.
- Focus ring: 3px cobalt, offset 2px (white on the cobalt field).

## What does not change here

The body map (`src/features/body-map/`) keeps its own figure and its own
colours for kinds of mark; they were settled with the practitioner and are
not part of this pass.
