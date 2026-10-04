---
version: 1
slug: "app-p-code-page-tsx"
primary_target: "app/p/[code]/page.tsx"
related_targets: ["components/patient/Questions.tsx","components/patient/PostureRunner.tsx","components/patient/Outcome.tsx"]
---

# Surface brief: patient flow `/p/[code]`

Mode: Operate. Older Thai adults (often with a child or grandchild) on their own phone at home, indoor daylight or evening room light, phone held in hand or propped 2 m away for the camera. Job: open the QR link, do today's prescribed ฤๅษีดัดตน postures safely, stop the moment something feels wrong, and let the result reach the clinic. Most important screen (user, 4 Oct): Today + Start. Must not feel like a government form, nor "too Thai" (gold kanok, temple). Team rules: `.claude/skills/thai-elderly-ui/SKILL.md` (pinned fonts, sizes, Thaitone palette, content guardrails).

Components in scope: `app/p/[code]/page.tsx`, `components/patient/{Questions,PostureRunner,Outcome}.tsx`, `components/LevelBadge.tsx`, shared tokens in `app/globals.css` + `app/layout.tsx`.

## Direction contract

THESIS: Each day's homework is one thread; a week of practice weaves a ผ้าขาวม้า. The surface refuses the category default of a white health app with progress rings and badges, and refuses gold Thai ornament.

OWN-WORLD: Ivory ground #FAF7F0, ink #1F1B16. Shell header is a solid เขียวใบแค #145139 field with a woven selvedge strip (check of green, คราม #16466E, รงทอง #E8BB1F, ivory) along its lower edge. Panels are ivory-white with one 2px border system, 20–24px radius, no shadows. Check pattern appears only as data (done days, session progress) or the selvedge, never behind text. IBM Plex Sans Thai Looped body 20px/1.7, IBM Plex Sans Thai display 31–39px/1.35. Lucide outline icons, 2px stroke, always labelled. Emergency red #A51C22 only for stopping and 1669.

STORY: The patient sees whose plan this is, what today asks, and one big way to start; sees the week woven so far without being scored; moves one question or one posture at a time; can stop at any moment from a bar that never scrolls away; ends seeing today's thread added to the cloth, or a calm clear instruction to rest, call the clinic, or call 1669.

FIRST VIEWPORT (375×812): green header band (clinic name, "การบ้านหลังนวด", plan code) ending in the selvedge strip → "การบ้านวันนี้" 31px + "4 ท่า" with the next-visit date → 64px+ solid green "เริ่มทำการบ้านวันนี้" with play icon, full width → "สัปดาห์นี้" cloth: 7 day columns จ–อา, done days densely woven, today ringed in gold, others pale warp, with "ทำแล้ว 2 จาก 5 วัน" → first posture row expanded with its DTAM sheet crop; the rest one line each, continuing below the fold.

FORM: ผ้าขาวม้า weave (assigned, candidate 4 of 7 on the grounded list); seed key 7f3745a0. Raises: one state-mark vocabulary (filled done / hollow not yet / red strike stopped / gold ring today); current item expands, others recede; solid colour fields for shell and primary; strong type-scale contrast; one 2px border system; every posture numbered "ท่าที่ n จาก m". Signature interaction: session progress is a warp of n posture segments that weave in as each posture completes, and the outcome adds today's band to the week cloth.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Clinic, slip, DTAM, and landing surfaces inherit this world in later passes (redesign.md order).
