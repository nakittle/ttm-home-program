# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Patients (primary):** mostly older Thai adults, often helped by a child or grandchild, using their own phone at home after a Thai traditional massage visit. Their job: do the ฤๅษีดัดตน postures the practitioner prescribed, on the prescribed days, safely, and know when to stop.
- **Clinic staff:** Thai traditional medicine practitioners and assistants in hospital / รพ.สต. clinics (UC scheme) and DTAM's 17 service centres, on desktops. Their job: prescribe postures per patient in about 30 seconds, print an A6 appointment slip with a QR code, and see adherence and red flags before the next visit.
- **DTAM (payer, B2G):** กรมการแพทย์แผนไทยและการแพทย์ทางเลือก. Sees aggregate numbers only, never an individual.

## Product Purpose

Closes the loop "practitioner prescribes per patient → patient does it at home → data and red flags return to the clinic → DTAM sees the aggregate". Success: patients actually do the home program, clinics see red flags before the next visit, and DTAM can see for the first time what share of distributed postures are really done.

## Positioning

The only home-program loop built on DTAM's own 2569 posture sheets: a practitioner's per-patient prescription travels by QR to the patient's phone (no app install), Thai voice reads DTAM's text, the phone camera times each hold on-device, and results return to the prescribing clinic. Not a "camera posture-counting app", and it never promises less pain.

## Operating Context

- Patient opens `/p/<code>#<secret>` from the QR on a paper A6 slip; no login, no install. Adds a recurring reminder to the phone calendar (.ics).
- Each session: symptom questions → pain 0–10 before → each posture (DTAM sheet image, steps with Thai voice, optional camera hold timer or a button fallback, stop buttons ปวดแปล๊บ / เวียนหัว / เซ) → pain after → closing questions → outcome. Red flags pause a posture, stop and contact the clinic, or send the patient to call 1669.
- Works offline with a local outbox; camera frames never leave the phone.
- Clinic: `/clinic` (login by clinic code + PIN), `/clinic/new`, `/clinic/slip/<code>`, `/clinic/settings`. DTAM: `/dtam`.
- Hackathon: Thai Traditional Medicine Digital Health & AI Hackathon 2026, Track 4. Video recorded 8 Oct 2569, submission 9 Oct 2569 before noon.

## Capabilities and Constraints

- Legally the app only relays a licensed practitioner's order and shows official content: it never diagnoses, never picks postures, never judges posture quality ("wrong"). The word "วินิจฉัย" never appears in patient UI.
- Content: 3 symptom groups (office syndrome, knee osteoarthritis, frozen shoulder), 13 unique postures transcribed from DTAM sheets; 16 red-flag rules drafted by the team from DTAM documents, labelled as awaiting professional endorsement.
- Voice: pre-generated Gemini TTS from DTAM sheet text, with device speech as fallback; labelled AI-generated under every posture.
- Data: plan code only on the server (no name, HN, phone); Supabase in Singapore; deleted 90 days after a plan closes; patient can withdraw consent and delete at any time.
- Stack: Next.js 16, React 19, Tailwind 4, Supabase, MediaPipe on-device, Vercel (sin1). Tests in Vitest (`npm test`).

## Brand Commitments

- Working name "การบ้านหลังนวด" (temporary).
- DTAM posture sheets used as-is with DTAM credit and a "ดูต้นฉบับ" link on every posture.
- Red-flag screen wording and the 1669 path are fixed text from `redflags.json`; never reworded during restyling.
- Team UI brief: `.claude/skills/thai-elderly-ui/SKILL.md` (Thai typography, elderly sizes, Thaitone palette). Patient UI must not feel like a government form, nor "too Thai" (gold kanok ornament, temple motifs).

## Evidence on Hand

- DTAM posture sheets: `public/postures/*.webp`; source PDFs in `C:\HACKATHON\research\content\sources\`.
- Seeded demo data: 3 clinics, 60 plans, 443 sessions, 40 flags (synthetic, labelled as demo).
- Pitch figures with sources in `C:\HACKATHON\research\` (UC massage services 4.05M visits in 2568, older adults' phone use 84%, etc.). No user testimonials, outcome data, or pain-reduction evidence exist; never fabricate them.

## Product Principles

1. Relay, never decide: the practitioner and DTAM's sheet are the authority; the app carries them faithfully.
2. Safety outranks completion: stopping is always one tap away, and a stop is never framed as failure.
3. One thing at a time for older hands and eyes: one question or one posture per screen, a way back at every step.
4. Data minimisation is visible: say plainly what is and is not collected.
5. Works on a cheap phone, offline, without installing anything.

## Accessibility & Inclusion

Older Thai adults with reduced vision, dexterity, and digital confidence. Patient screens: 20px base text, looped Thai face, AAA contrast where possible, targets ≥ 56px (primary 64px, 1669 ≥ 72px), colour never the only signal, voice for every instruction, respect reduced motion.
