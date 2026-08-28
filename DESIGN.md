---
name: Trường Giáo Lý Management System
description: A parish catechism school admin tool for attendance, grading, and sacramental records
colors:
  ledger-violet: 'oklch(0.4865 0.2423 291.8661)'
  ledger-violet-foreground: 'oklch(0.9838 0.0035 247.8583)'
  lilac-secondary: 'oklch(0.9486 0.0085 303.5068)'
  lilac-secondary-foreground: 'oklch(0.341 0.1625 292.9477)'
  ledger-grey: 'oklch(0.9838 0.0035 247.8583)'
  ink: 'oklch(0.1284 0.0267 261.5937)'
  card-white: 'oklch(1 0 0)'
  muted: 'oklch(0.9679 0.0027 264.5424)'
  muted-foreground: 'oklch(0.5503 0.0235 264.362)'
  accent-tint: 'oklch(0.9546 0.0227 303.2883)'
  destructive-red: 'oklch(0.6356 0.2082 25.3782)'
  border-line: 'oklch(0.9278 0.0058 264.5314)'
typography:
  body:
    fontFamily: 'Plus Jakarta Sans, Inter, system-ui, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: '-0.02em'
  title:
    fontFamily: 'Plus Jakarta Sans, Inter, system-ui, sans-serif'
    fontSize: '1rem'
    fontWeight: 500
    lineHeight: 1.375
    letterSpacing: '-0.02em'
  label:
    fontFamily: 'Plus Jakarta Sans, Inter, system-ui, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 500
    lineHeight: 1
    letterSpacing: '-0.02em'
rounded:
  sm: '12px'
  md: '14px'
  lg: '16px'
  xl: '20px'
  pill: '9999px'
spacing:
  xs: '4px'
  sm: '12px'
  md: '16px'
components:
  button-primary:
    backgroundColor: '{colors.ledger-violet}'
    textColor: '{colors.ledger-violet-foreground}'
    rounded: '{rounded.lg}'
    padding: '6px 10px'
  button-primary-hover:
    backgroundColor: '{colors.ledger-violet}'
  button-secondary:
    backgroundColor: '{colors.lilac-secondary}'
    textColor: '{colors.lilac-secondary-foreground}'
    rounded: '{rounded.lg}'
  button-outline:
    backgroundColor: '{colors.ledger-grey}'
    textColor: '{colors.ink}'
    rounded: '{rounded.lg}'
  input:
    backgroundColor: 'transparent'
    textColor: '{colors.ink}'
    rounded: '{rounded.lg}'
    padding: '4px 10px'
    height: '32px'
  badge-default:
    backgroundColor: '{colors.ledger-violet}'
    textColor: '{colors.ledger-violet-foreground}'
    rounded: '{rounded.pill}'
    padding: '2px 8px'
    height: '20px'
  card:
    backgroundColor: '{colors.card-white}'
    textColor: '{colors.ink}'
    rounded: '{rounded.xl}'
    padding: '{spacing.md}'
---

# Design System: Trường Giáo Lý Management System

## Overview

**Creative North Star: "The Parish Ledger"**

This is a working register, not a brochure: a violet-tinted administrative tool built for catechists and board members to record attendance, grades, and sacraments across academic years with full historical trust. The aesthetic reads as a modern parish office record book — orderly rows, generous rounding on containers, and a single confident violet used sparingly to mark what matters (primary actions, active states, focus). Density stays comfortable rather than spacious: this is used by people scanning ~100 students in a short pre-Mass window, so clarity and speed outrank decoration.

The system is brisk and functional throughout: no illustrative flourishes, no marketing-grade hero moments. Every screen exists to get a catechist or board member through a task — take attendance, look up a student, record a sacrament — quickly and correctly, on a phone as readily as a desktop.

**Key Characteristics:**

- One confident accent (Ledger Violet) used sparingly against a calm, near-white surface
- Generously rounded containers (16-20px) paired with tightly rounded interactive controls
- Soft, purple-tinted ambient shadows reserved for elevated surfaces (cards, popovers, dialogs), not for resting UI
- Tight tracking (-0.02em) sans-serif type throughout; no serif or display face
- Brisk, procedural component behavior — no decorative hover flourishes beyond opacity/background shifts

## Colors

A single violet accent carries all emphasis against a cool, near-white ledger surface; everything else is neutral gray-violet.

### Primary

- **Ledger Violet** (oklch(0.4865 0.2423 291.8661)): the sole accent — primary buttons, active nav/tab states, focus rings, links, badges denoting the system's own emphasis (not status). Used on a small minority of any given screen.

### Secondary

- **Lilac Secondary** (oklch(0.9486 0.0085 303.5068)): secondary button fills and low-emphasis violet-tinted surfaces (selected-but-not-primary states).

### Neutral

- **Ledger Grey** (oklch(0.9838 0.0035 247.8583)): page background.
- **Ink** (oklch(0.1284 0.0267 261.5937)): primary text color.
- **Card White** (oklch(1 0 0)): card and popover surfaces, sits one step lighter than the page background.
- **Muted** (oklch(0.9679 0.0027 264.5424) bg / oklch(0.5503 0.0235 264.362) text): secondary text, disabled states, table zebra/footer fills.
- **Border Line** (oklch(0.9278 0.0058 264.5314)): all hairline borders, inputs, dividers.
- **Destructive Red** (oklch(0.6356 0.2082 25.3782)): destructive actions and error states, always at reduced opacity fills (10-20%) rather than solid red.

### Named Rules

**The One Accent Rule.** Ledger Violet is the only saturated color in the system. Status and severity communicate through icon + label (attendance colors, badges), never by introducing a second brand hue.

## Typography

**Body/UI Font:** Plus Jakarta Sans, with Inter and system-ui fallback
**Character:** A single geometric-humanist sans carries the whole system — no serif, no display face, no font pairing. Tight tracking (-0.02em) gives dense tabular UI a slightly compressed, procedural rhythm rather than an airy editorial one.

### Hierarchy

- **Title** (500 weight, 1rem/16px, 1.375 line-height): card titles, section headers within a page.
- **Body** (400 weight, 0.875rem/14px, 1.5 line-height): default UI text — table cells, form labels, body copy, buttons.
- **Label** (500 weight, 0.75rem/12px, tight line-height): badges, small metadata, timestamps.

## Layout

Density-first: default control height is 32px (buttons, inputs), tightened via a 4px base spacing unit (`--spacing: 0.25rem`). Card internal padding is 16px by default, 12px in the `sm` card variant. Layout is standard admin-app: sidebar + content, list views as data tables, detail views as stacked cards. No asymmetric or editorial composition; the grid stays orderly because the content (rosters, grades, records) sets the rhythm.

## Elevation & Depth

Flat by default. Shadows are ambient and purple-tinted (`hsl(263 70% 50%)` at low opacity in light mode, near-black in dark mode), reserved for elevated surfaces — cards, popovers, dialogs, dropdowns — never applied to resting inline UI like buttons or inputs. Depth on resting surfaces comes from tonal contrast (card white against ledger grey background) and 1px rings, not shadow.

### Shadow Vocabulary

- **Ambient card** (`box-shadow: 0px 8px 30px 0px hsl(263 70% 50% / 0.08), 0px 1px 2px -1px hsl(263 70% 50% / 0.08)`): default resting shadow for popovers and floating panels.
- **Elevated dialog** (`box-shadow: 0px 8px 30px 0px hsl(263 70% 50% / 0.08), 0px 8px 10px -1px hsl(263 70% 50% / 0.08)`): modal-level elevation.

### Named Rules

**The Ambient-Not-Structural Rule.** Shadow signals "this floats above the page," never "this is pressed" or "this is important." Emphasis is carried by color and typography, not depth.

## Shapes

Containers round generously (cards/dialogs at 20px, popovers/inputs-wrapping surfaces at 16px); interactive controls round more tightly (buttons/inputs at 16px base, compact sizes at 10-12px) so the largest surfaces feel softest and the smallest controls stay crisp. Badges are fully pill-shaped. Borders are always the single `border-line` neutral hairline; no double borders, no colored borders except destructive/invalid states.

## Components

Every interactive component reads as brisk and functional: minimal hover flourish (background/opacity shift only, a 1px translate on press), no scale or shadow-pop on interaction.

### Buttons

- **Shape:** rounded-lg (16px at default size, 10-12px at `xs`/`sm` compact sizes)
- **Primary:** solid Ledger Violet fill, violet-foreground text, hover drops fill opacity to 80%
- **Secondary:** Lilac Secondary fill, low-contrast violet text
- **Outline / Ghost:** transparent or background-colored, border-line hairline (outline only), hover fills with muted
- **Destructive:** red at 10% fill opacity (not solid red), hover to 20%
- **Link:** text-only, violet, underline on hover
- **Press feedback:** 1px downward translate on active, no scale change

### Chips / Badges

- **Style:** pill-shaped (9999px radius), 20px height, solid violet fill by default; secondary/outline/destructive/ghost variants mirror button color logic at smaller scale

### Cards / Containers

- **Corner Style:** 20px radius (`rounded-xl`)
- **Background:** Card White against Ledger Grey page background
- **Shadow Strategy:** none at rest (see Elevation) — a 1px `ring-foreground/10` substitutes for shadow as the resting depth cue
- **Border:** none; ring only
- **Internal Padding:** 16px default, 12px in compact (`sm`) card variant

### Inputs / Fields

- **Style:** transparent background, border-line hairline border, 16px radius, 32px height
- **Focus:** border shifts to Ledger Violet ring color, 3px violet ring at 50% opacity
- **Error / Disabled:** invalid state swaps border/ring to Destructive Red; disabled drops opacity to 50% with a faint input tint

## Do's and Don'ts

### Do:

- **Do** keep Ledger Violet to primary actions, active states, and focus — the One Accent Rule.
- **Do** use opacity-reduced fills (10-20%) for destructive/status tints rather than solid saturated color, matching the existing destructive button treatment.
- **Do** reserve shadow for surfaces that float above the page (dialogs, popovers, dropdowns); keep resting UI flat.
- **Do** keep controls dense (32px default height, 4px spacing unit) — this is a task tool used under time pressure, not a marketing surface.

### Don't:

- **Don't** introduce a second saturated brand hue; status/severity communicates via icon + label, not a new color family.
- **Don't** add shadow, scale, or decorative motion to resting/hover states beyond background and 1px press-translate — brisk and functional, not playful.
- **Don't** use serif or display type; the system has one sans-serif voice throughout.
</content>
