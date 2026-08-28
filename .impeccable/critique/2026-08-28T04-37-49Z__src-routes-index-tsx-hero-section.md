---
target: src/routes/index.tsx (hero section)
total_score: 11
max_score: 20
na_heuristics: 1,5,7,9,10
p0_count: 1
p1_count: 2
timestamp: 2026-08-28T04-37-49Z
slug: src-routes-index-tsx-hero-section
---

## Design Health Score

| #         | Heuristic                       | Score     | Key Issue                                                                                                                                                                                                                                                                                            |
| --------- | ------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | Visibility of System Status     | n/a       | Static marketing hero, no async state to reflect                                                                                                                                                                                                                                                     |
| 2         | Match System / Real World       | 2         | Domain vocabulary (Huynh trưởng, bí tích) is correct, but "Dự Án Mã Nguồn Mở" (open-source) is a developer-facing concept the target catechist/parent audience likely doesn't recognize                                                                                                              |
| 3         | User Control and Freedom        | 3         | Two undemanding CTAs, no forced funnel; minor gap: "Vào Cổng Demo" jumps straight to `/login` with no preview of what the demo contains                                                                                                                                                              |
| 4         | Consistency and Standards       | 2         | Hero reaches for `font-serif`, a second saturated accent hue (amber), and decorative hover/float motion — all explicitly prohibited by this project's own DESIGN.md ("no serif or display face," "One Accent Rule," "no decorative hover flourishes") with no documented rationale for the departure |
| 5         | Error Prevention                | n/a       | No input/error-prone interaction in a static hero                                                                                                                                                                                                                                                    |
| 6         | Recognition Rather Than Recall  | 3         | Icon+text CTA pairing aids recognition; badge/version chip legible at a glance                                                                                                                                                                                                                       |
| 7         | Flexibility and Efficiency      | n/a       | No repeat-user shortcuts applicable to a static hero                                                                                                                                                                                                                                                 |
| 8         | Aesthetic and Minimalist Design | 1         | Badge row (2 pills) + gradient background + glow-shadow CTA + floating animated image + amber accent all compete simultaneously; nothing is subtracted                                                                                                                                               |
| 9         | Error Recovery                  | n/a       | No error states present                                                                                                                                                                                                                                                                              |
| 10        | Help and Documentation          | n/a       | Not applicable to a hero section                                                                                                                                                                                                                                                                     |
| **Total** |                                 | **11/20** | **Acceptable (55%)**                                                                                                                                                                                                                                                                                 |

Five heuristics scored n/a as genuinely inapplicable to a static Persuade-mode hero (no async state, no input, no errors, no repeat-use shortcuts, no in-hero docs).

## Design Specificity Verdict

**LLM assessment:** This hero is generic-SaaS structure with a Vietnamese Catholic skin over it, not a design authored outward from the domain. The formula — eyebrow badge row, serif-italic-accent headline, muted subhead, primary+ghost CTA pair, floating 3D render — is the exact template used by countless open-source dev-tool landing pages. Nothing in the layout, badge shape, button treatment, or hover-lift/glow CTA styling is derived from "parish," "catechism," or the project's own "Ledger" identity. The one domain-specific signal is the copy itself; the visual system does none of the specificity work. This also directly contradicts DESIGN.md's "Parish Ledger" North Star (single sans-serif voice, no serif/display type, One Accent Rule, no decorative hover flourishes) with no documented rationale for why the landing page gets an exception. A genuinely authored version would lean into something concretely parish-specific — a ledger/register visual motif, real photography of catechists/students, or typography referencing a parish bulletin — rather than a generic "Sacred Modernity" 3D render.

**Deterministic scan:** `detect.mjs --json` on the file returned exit 2 with 8 findings total, but **zero fall inside the hero section's actual line range** (`{/* Hero Section */}` spans roughly lines 403-461). The 5 `design-system-color` findings (lines 293-302) are in the top-of-file inline `<style>` block backing `.mesh-gradient`/`.mesh-gradient-vivid`, and the 3 `border-accent-on-rounded` findings (lines 477-501) are in the _next_ section ("Product Philosophy" feature cards), not the hero. Within strict hero scope, the automated detector is clean.

**Correction to Assessment A:** the design-review pass flagged `mesh-gradient-vivid` and `.glass` as classes with no CSS backing anywhere in the repo (rated P0). I verified this directly — both are real, defined in the component's own inline `<style>{\`...\`}</style>`block (lines 304, 326 of the current file), not in`app.css`. The reviewing agent's grep-only check missed this in-file style block. This is downgraded from a P0 defect to a minor observation about a non-obvious styling pattern (see below) — it does not affect the score.

**Visual overlays:** Not available this run. No browser automation tool was exposed in this session, so no screenshot or injected-detector overlay could be produced. This is a fallback-signal gap, not a finding — treat the visual/contrast/overflow analysis below as source-code-derived, not screen-verified.

## Overall Impression

The copy is genuinely good — specific, warm, three concrete product pillars in one sentence. The visual system around it is a well-executed but generic template that both fights the product's own documented design identity and under-serves its actual audience (non-technical parish volunteers on cheap Android phones) with developer-facing jargon and a mobile experience that quietly drops the one visual asset meant to build trust. The single biggest opportunity: use the CTA hierarchy and copy quality already here as the foundation, and replace the borrowed "OSS SaaS hero" visual grammar with something legibly parish-specific, especially on mobile where most real visits will happen.

## What's Working

1. **CTA hierarchy is genuinely clear.** "Vào Cổng Demo" (primary, filled, arrow icon) vs. "GitHub" (secondary, outline) correctly signals which action matters most without a confusing third option.
2. **Subhead copy is domain-authentic and information-dense.** "chuyển đổi số quy trình quản lý điểm danh, hồ sơ bí tích và kết nối phụ huynh" names three concrete product pillars (attendance, sacramental records, parent contact) in one sentence — real information, not marketing filler.
3. **Line-length discipline.** The paragraph is capped at `max-w-[65ch]`, giving genuinely good typographic scannability.

## Priority Issues

**[P0] Hero image is a 5.6MB unoptimized PNG with no width/height or responsive loading**
Why it matters: `public/stitch/hero.png` is 5,601,048 bytes with no `width`/`height` attributes, no `loading`/`fetchpriority`, and no responsive `srcset`. PRODUCT.md states the audience is on cheap Android phones and often-unreliable networks; even though the image is hidden below `lg` (mobile is spared the download), desktop/tablet visitors on slow connections pay a severe LCP tax, and the missing dimensions cause layout shift while it loads.
Fix: Compress/convert to WebP/AVIF (target well under 500KB), add explicit `width`/`height`, add `fetchpriority="high"` since it's above the fold.
Suggested command: `/impeccable optimize`

**[P1] No mobile substitute for the hero image — the visual identity signal disappears exactly for the primary audience**
Why it matters: `hidden lg:block` wraps the only visual/brand asset in the hero; below `lg` there is no compensating element. PRODUCT.md names mobile-on-cheap-Android as the primary access pattern, so the majority of real visitors get a text-only hero with a dead visual gap, losing the trust-building "this was made for people like me" signal exactly where it's needed most.
Fix: Serve a lighter, compressed variant of the image inline below the CTAs on mobile, or design a lightweight mobile-specific visual rather than removing it outright.
Suggested command: `/impeccable adapt`

**[P1] Second saturated accent hue (amber) fights the product's own "One Accent Rule" and the primary CTA for attention**
Why it matters: The eyebrow badge uses amber-500/15 background + amber-700/amber-400 text, sitting beside a violet version chip and violet primary CTA. DESIGN.md states Ledger Violet is the sole accent and status communicates via icon+label, not a second hue. Amber here is purely decorative, not semantic, and competes directly with the CTA for the eye's first landing point.
Fix: Make the eyebrow badge neutral/outline (border-line + muted-foreground text) so violet stays the only color signal.
Suggested command: `/impeccable quieter`

**[P2] Jargon-dense eyebrow badge and version chip target developers, not the stated audience**
Why it matters: "Dự Án Mã Nguồn Mở Quản Lý Trường Giáo Lý" (open-source project) and a raw `v{version}` semver chip are GitHub-visitor signals, not parish-volunteer signals. PRODUCT.md's audience is explicitly non-technical catechists and parents — this copy is more likely to read as noise than credibility to the actual target reader.
Fix: Split messaging by audience — a lighter, benefit-oriented eyebrow for general visitors, with "open-source"/version detail moved to a footer or folded into the GitHub CTA itself.
Suggested command: `/impeccable clarify`

**[P2] Motion load stacks multiple simultaneous cues in a hero meant to build calm trust**
Why it matters: `animate-float` on the hero image plus `hover:-translate-y-1` / `hover:scale-[1.03]` / `group-hover:translate-x-1` on CTAs stack several concurrent motion signals. For a parish administrative tool aiming for trust and calm (not a flashy consumer app), this reads as more "energetic SaaS demo" than "steady tool I can rely on."
Fix: Keep one motion signal (e.g., CTA hover only) and drop the constant ambient float on the image, or slow/soften it substantially.
Suggested command: `/impeccable quieter`

## Persona Red Flags

**Jordan (First-Timer):** Lands on a page whose top badge uses a phrase ("mã nguồn mở"/open-source) they likely don't recognize, and sees nothing visually anchoring "this is for a Catholic parish school" beyond text they have to read carefully. On mobile, Jordan gets no product visual at all — nothing to anchor "what does this actually look like when I use it," so the two CTAs (login demo or GitHub) have to be taken purely on faith.

**Casey (Distracted Mobile User):** Casey is exactly PRODUCT.md's described user — a parent or catechist on a mid/low-end Android phone, glancing for a few seconds. Casey gets the worst version of this hero: no image (dead `hidden lg:block` space), a two-pill badge row plus a three-line headline plus a paragraph to scroll past before reaching a button — nothing here is optimized for "decide in 3 seconds," which is Casey's actual behavior pattern.

## Minor Observations

- `font-serif` resolves to plain `Georgia, serif` (no custom display face or font-loading strategy) — calling this a deliberate "serif display headline" overstates what's actually an unstyled browser fallback.
- The italic accent word "Hiện Đại" is wrapped in a `bg-primary/10 px-1.5 rounded` highlight box, but the box doesn't cover the full clause ("Modern" is highlighted, "Platform"/"For every parish" isn't) — the emphasis boundary feels arbitrary.
- The primary CTA's inline `style={{ boxShadow: '...oklch(0.4865 0.2423 291.8661 / 0.5)' }}` hardcodes the Ledger Violet value directly instead of referencing the `--primary` CSS variable already defined in `app.css` — dark mode uses a different `--primary` value, so this shadow won't adapt when the theme switches.
- `.mesh-gradient-vivid` and `.glass` are defined in the component's own inline `<style>` block rather than the shared stylesheet — functionally fine, but a non-obvious pattern that misled the independent design-review pass into flagging them as missing; worth consolidating into `app.css` alongside the base `.mesh-gradient` definition for discoverability.
- `target="_blank" rel="noopener noreferrer"` on the GitHub link is correctly implemented — good baseline hygiene, easy to get wrong.

## Questions to Consider

1. If DESIGN.md's "Parish Ledger" system explicitly bans serif type, a second accent hue, and decorative hover motion for the whole product, where is the decision written down that the landing page gets an exception — and should that exception get its own documented marketing-register addendum?
2. The audience is parish volunteers on cheap Android phones per PRODUCT.md — why does mobile, the majority of real visits, get a strictly reduced hero missing the one asset meant to build first-glance trust?
3. What would a hero built outward from "ledger/register" or "parish bulletin" as the actual visual motif look like, instead of the borrowed open-source-SaaS template currently in place?
