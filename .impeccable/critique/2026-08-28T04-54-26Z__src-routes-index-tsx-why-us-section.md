---
target: src/routes/index.tsx (why-us section)
total_score: 12
max_score: 20
na_heuristics: 1,3,7,9,10
p0_count: 1
p1_count: 1
timestamp: 2026-08-28T04-54-26Z
slug: src-routes-index-tsx-why-us-section
---

## Design Health Score

| #         | Heuristic                       | Score     | Key Issue                                                                                                        |
| --------- | ------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------- |
| 1         | Visibility of System Status     | n/a       | Static marketing content                                                                                         |
| 2         | Match System / Real World       | 2         | Copy frames benefits in developer/IT terms ("mã nguồn mở," "Docker") not parish-staff language                   |
| 3         | User Control and Freedom        | n/a       | No flow/steps in a static section                                                                                |
| 4         | Consistency and Standards       | 1         | `cursor-pointer`+`hover:scale-105` used only here — sibling `featureItems` grid omits it for non-clickable cards |
| 5         | Error Prevention                | 3         | Nothing to error on                                                                                              |
| 6         | Recognition Rather Than Recall  | 3         | Icon+heading+description scannable at a glance                                                                   |
| 7         | Flexibility and Efficiency      | n/a       | No shortcuts applicable to static content                                                                        |
| 8         | Aesthetic and Minimalist Design | 3         | Card 2's heading is visibly longer, breaking grid rhythm                                                         |
| 9         | Error Recovery                  | n/a       | No error states                                                                                                  |
| 10        | Help and Documentation          | n/a       | Not applicable                                                                                                   |
| **Total** |                                 | **12/20** | **Acceptable (60%)**                                                                                             |

## Design Specificity Verdict

**LLM assessment:** Generic 3-feature-card SaaS template with a serif Vietnamese heading. The subhead ("dedication and spirit of community service") speaks to the volunteer-catechist identity — but the three cards abandon that voice: "open source, transparent, community can audit the code" (card 1), "Docker, deploy in minutes" (card 3). PRODUCT.md's audience is catechists/board members/parents on cheap Android phones, not developers evaluating a repo — the reassurance PRODUCT.md says this audience needs (historical records never lost, works without training) is absent from all three cards.

**Deterministic scan:** 3 findings land inside this section, all `border-accent-on-rounded` at lines 467/478/491 (`rounded-2xl` + `border-t-4` clash on all three cards). Matches the hook finding surfaced repeatedly this session.

**Agreement between assessments:** Both independently flagged the same three cards — detector on structural grounds (radius/border clash), design review on interaction grounds (false `cursor-pointer` affordance, no `href`/`onClick`, breaking the page's own sibling-grid convention).

**Visual overlays:** Unavailable — no browser tool this session (fallback signal).

## Overall Impression

The subhead does the emotional work; the cards don't follow through — pivoting into open-source/Docker language for a non-technical audience, on cards that falsely invite a tap and go nowhere, with three arbitrary accent colors and no legend.

## What's Working

1. Subhead copy is genuinely well-targeted at volunteer/service identity.
2. Card 2's content (flexible attendance/grading methods) is the one domain-distinctive claim, per PRODUCT.md's teacher-configurable grading model.
3. `glass` + `rounded-2xl` gives the three cards a coherent shared container language.

## Priority Issues

**[P0] False affordance: `cursor-pointer` + `hover:scale-105` on non-interactive cards**
Why it matters: No `href`/`onClick` anywhere in the block; breaks the page's own convention (sibling `featureItems` grid correctly omits this for non-clickable cards); produces a dead-tap moment on mobile.
Fix: Remove the pointer/scale affordance, or wire real navigation if intended.
Suggested command: `/impeccable bolder` (fold into the redesign)

**[P1] Copy pitches developers, not the stated buyer**
Why it matters: "mã nguồn mở," "kiểm tra mã nguồn," "Docker deploy" are GitHub-visitor language; PRODUCT.md's actual value props (historical integrity, offline-first, no training needed) are absent.
Fix: Reframe around cost/trust/reach outcomes this audience cares about.
Suggested command: `/impeccable clarify`

**[P2] Three accent colors with no semantic meaning**
Why it matters: No legend/taxonomy — reads as arbitrary decoration rather than a deliberate persuasive palette.
Fix: Commit to a documented rationale, or unify toward one accent family.
Suggested command: `/impeccable bolder` (fold into the redesign)

**[P3] Icon/message mismatch + heading-length imbalance**
Why it matters: `Monitor` icon implies desktop-only against a "runs on your phone too" claim; card 2's heading breaks grid rhythm.
Fix: Swap icon, shorten heading.
Suggested command: `/impeccable typeset`

## Persona Red Flags

**Casey (mobile):** Most likely to tap a falsely-interactive card and get nothing — reads as broken.
**Jordan (first-timer):** Wants reassurance sacramental records won't be lost; gets an open-source pitch instead.

## Minor Observations

- 4px `border-t-4` feels heavy against the otherwise soft `glass` aesthetic.
- `amber-600` text vs `amber-500` border on card 2 — two different amber shades for one accent.
- Card 3 has an explicit `dark:` icon color override; cards 1/2 don't — worth checking dark-mode contrast on all three.

## Questions to Consider

1. Was there a plan to link these cards to `/docs` or a features page that got cut, or is the hover-scale/cursor-pointer pattern just copy-pasted from elsewhere?
2. If a board member/priest is the actual buyer, why lead with "open source" and "Docker" instead of historical-integrity and ease-of-use?
