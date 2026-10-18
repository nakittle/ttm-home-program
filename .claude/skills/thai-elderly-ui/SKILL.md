---
name: thai-elderly-ui
description: Project rules for any UI change in การบ้านหลังนวด (TTM Home Program) — Thai typography, elderly-friendly sizes and targets, the Thaitone palette, and how the installed design skills share the work. Use before designing, restyling or reviewing any page, component or CSS in this repo (patient /p, clinic /clinic, DTAM /dtam, /lab).
---

# Thai + elderly UI rules for การบ้านหลังนวด

Patients are mostly older Thai adults on phones; clinic staff and DTAM use desktops. Goal: modern, recognisably Thai, beautiful, and easy for older eyes and hands. Research and sources are kept in the team's research notes (outside this repository). Items marked [I] are the team's interpretation, not a cited standard.

## Who owns what (avoid conflicting skills)

- **Design direction:** the one design-direction skill installed (Impeccable if installed, otherwise frontend-design). Feed it THIS file as the brief. Never let a second skill regenerate the design system.
- **ui-ux-pro-max:** lookup only — `--domain ux`, `--domain color`, industry `healthcare`. Do not run its `--design-system` generator or adopt its font pairings (none are Thai).
- **design plugin:** `accessibility-review`, `design-critique`, `ux-copy` for review. Do not connect its bundled MCP connectors.
- **web-design-guidelines (Vercel):** code audit with `file:line` output. Ignore its English typography rules for Thai text.
- **cognitive-accessibility / adaptive-interfaces:** plain language, memory load, one task per screen.
- **Check visually** in the built-in browser pane at mobile size (375×812) before calling anything done.

## Typography

- Body/UI: **IBM Plex Sans Thai Looped** 400/500/600 (Google Fonts via `next/font/google`). Display ≥ 28px only: **IBM Plex Sans Thai** 600/700. Fallback: Noto Sans Thai Looped. Looped (มีหัว) reads better for older readers; loopless lowers accuracy on long text.
- Patient screens: base **20px**. Clinic/DTAM: never below **16px**. Scale 16 / 20 / 25 / 31 / 39. Pain-scale numbers ≥ 32px.
- Line-height **1.7** body, **1.35** headings [I]. Thai stacks vowels/tone marks above and below — never put `overflow:hidden` or a fixed height on a text box; check that ปู่ ญี่ ฎ ฐ are not clipped.
- Thai has no spaces between words: do not insert spaces mid-phrase; keep line breaks natural.

## Colour (updated 5 Oct 2026: "Tend" sage style chosen by the user; see DESIGN.md)

| Role | Hex | Contrast |
|---|---|---|
| Background | `#F4F6F0` (+ soft sun/sage radial glows) | — |
| Card / paper | `#FBFCF8` with soft layered shadow | — |
| Text | `#1F2F25` | 12.9:1 |
| Muted text | `#3F5546` | 7.2:1 |
| Primary (forest) | `#2F4F3A` | 8.4:1; white on it 9.1:1 |
| Accent word (clay) | `#A4563A` | 4.9:1, display sizes only |
| Sun fill / today ring | `#F2C14E` | ink on it 8.4:1 (never as text colour) |
| Emergency 1669 | `#A51C22` | white on it 7.5:1 |

- Aim for AAA (7:1) on patient screens for body text.
- Define colours as tokens in `app/globals.css` (`@theme inline`); keep custom classes in `@layer components` so utilities override them (an unlayered class once hid selected-answer colours).

## Size, spacing, shape

- Primary buttons **64px** tall, pill-shaped, full width on phones. Every other target **≥ 56px** with **≥ 12px** gap [I] (WCAG AAA is 44px; Android 48dp).
- 1669 button **≥ 72px**, fixed, never animated or hidden in a menu.
- 8px spacing grid, 24px screen padding, 20–24px corner radius. Outline icons, 2px stroke, 28–32px, always with a Thai text label.

## Behaviour

- One question or one exercise per screen. Every step has a Back button.
- Yes/no answers show colour **and** ✓/✗ and stay visibly selected.
- No swipe-only or long-press actions; no auto-advance without a pause.
- Respect `prefers-reduced-motion`. Keep motion subtle and purposeful.
- ลายไทย only as a faint background/divider (≤ 6% opacity) in headers or on /dtam — never behind text; no gold gradients.

## Content guardrails (do not break while restyling)

- The app never diagnoses: never use the word "วินิจฉัย" in patient UI; never say a posture is "wrong".
- Keep DTAM credit + "ดูต้นฉบับ" link and the AI-voice label under every posture.
- Keep the red-flag screens' wording and the 1669 path intact.
- Run `npm test` after UI changes; the patient flow has tests.
