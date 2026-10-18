---
version: 1
slug: "app-p-code-page-tsx"
primary_target: "app/p/[code]/page.tsx"
related_targets: ["components/patient/Questions.tsx","components/patient/PostureRunner.tsx","components/patient/Outcome.tsx"]
---

# Surface brief: patient flow `/p/[code]`

Mode: Operate. Older Thai adults (often with a child or grandchild) on their own phone at home, indoor daylight or evening room light, phone held in hand or propped 2 m away for the camera. Job: open the QR link, do today's prescribed ฤๅษีดัดตน postures safely, stop the moment something feels wrong, and let the result reach the clinic. Most important screen: Today + Start. Must not feel like a government form, nor "too Thai" (gold kanok, temple). Team rules: `.claude/skills/thai-elderly-ui/SKILL.md` (pinned fonts, sizes, Thaitone palette, content guardrails).

Components in scope: `app/p/[code]/page.tsx`, `components/patient/{Questions,PostureRunner,Outcome}.tsx`, `components/LevelBadge.tsx`, shared tokens in `app/globals.css` + `app/layout.tsx`.

## Direction contract

Replaced 5 Oct 2026 by team decision: the first direction ("ผ้าขาวม้า" weave, seed 7f3745a0) looked dated. The team chose the reference "Tend — A Habit Garden" (miaai-lab Claude-Opus-5.5-100-HTML-Files #046) and dropped the weave entirely.

THESIS: A calm daily-habit app, not a hospital form: soft sage wash, floating paper cards, a warm greeting, and one big pill to start.

OWN-WORLD: Sage background #f4f6f0 with sun and sage radial glows; paper cards #fbfcf8 with a layered soft shadow and 24px corners; forest #2f4f3a for ink accents and the primary pill (with a tinted drop shadow); clay #a4563a only for one accent word in display headings; sun #f2c14e for the today/current ring; emergency red #a51c22 only for stopping and 1669. Thai type is unchanged: Plex Sans Thai Looped body at 20px, Plex Sans Thai display at 28px and up.

STORY: Greeting, then today's task count and next visit, then one start pill. The week is shown as a progress bar plus seven day tiles. Posture flow runs one thing per screen, with a fixed stop bar.

FIRST VIEWPORT (375×812): brand row (sprout tile, name, clinic, plan-code pill) with a sun-and-leaf corner art; date line; greeting h1 "สวัสดี" + clay time-of-day word; meta line; 76px forest start pill; the week card begins.

FORM: team-selected reference (Tend), code-led. Signature: arch-shaped posture picture, and bars that grow from sage to forest.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Follow-on surfaces

- Clinic, slip, DTAM, and landing surfaces share this direction.
