---
name: การบ้านหลังนวด
description: Thai traditional-medicine home program; each day's homework is a thread, a week of practice weaves a ผ้าขาวม้า.
colors:
  background: "#faf7f0"
  surface: "#fffdf8"
  foreground: "#1f1b16"
  muted: "#4a453d"
  line: "#d9d0bf"
  brand: "#145139"
  brand-deep: "#0d3a28"
  brand-tint: "#e3eee7"
  indigo: "#16466e"
  indigo-tint: "#e2eaf3"
  gold: "#e8bb1f"
  gold-tint: "#fbf0c8"
  emergency: "#a51c22"
  emergency-tint: "#f9e4e2"
typography:
  display:
    fontFamily: "IBM Plex Sans Thai, IBM Plex Sans Thai Looped, sans-serif"
    fontSize: "39px"
    fontWeight: 700
    lineHeight: 1.25
  headline:
    fontFamily: "IBM Plex Sans Thai, IBM Plex Sans Thai Looped, sans-serif"
    fontSize: "31px"
    fontWeight: 700
    lineHeight: 1.35
  numeral:
    fontFamily: "IBM Plex Sans Thai, IBM Plex Sans Thai Looped, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1
  action:
    fontFamily: "IBM Plex Sans Thai, IBM Plex Sans Thai Looped, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.35
  title:
    fontFamily: "IBM Plex Sans Thai Looped, Noto Sans Thai Looped, sans-serif"
    fontSize: "25px"
    fontWeight: 600
    lineHeight: 1.35
  question:
    fontFamily: "IBM Plex Sans Thai Looped, Noto Sans Thai Looped, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.6
  body-lg:
    fontFamily: "IBM Plex Sans Thai Looped, Noto Sans Thai Looped, sans-serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.7
  body:
    fontFamily: "IBM Plex Sans Thai Looped, Noto Sans Thai Looped, sans-serif"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "IBM Plex Sans Thai Looped, Noto Sans Thai Looped, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.7
  caption:
    fontFamily: "IBM Plex Sans Thai Looped, Noto Sans Thai Looped, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  cell: "12px"
  control: "16px"
  button: "20px"
  panel: "24px"
  pill: "9999px"
spacing:
  hairline: "6px"
  gap: "12px"
  inset: "20px"
  stack: "24px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "#ffffff"
    typography: "{typography.action}"
    rounded: "{rounded.button}"
    padding: "12px 24px"
    height: "76px"
  button-primary-active:
    backgroundColor: "{colors.brand-deep}"
    textColor: "#ffffff"
  button-step:
    backgroundColor: "{colors.brand}"
    textColor: "#ffffff"
    rounded: "{rounded.button}"
    padding: "12px 24px"
    height: "64px"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.brand}"
    rounded: "{rounded.button}"
    padding: "12px 24px"
    height: "56px"
  button-ghost-active:
    backgroundColor: "{colors.brand-tint}"
    textColor: "{colors.brand}"
  button-listen:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.indigo}"
    rounded: "{rounded.button}"
    height: "56px"
  button-stop:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.emergency}"
    rounded: "{rounded.button}"
    height: "72px"
  button-stop-active:
    backgroundColor: "{colors.emergency-tint}"
    textColor: "{colors.emergency}"
  button-1669:
    backgroundColor: "{colors.emergency}"
    textColor: "#ffffff"
    typography: "{typography.headline}"
    rounded: "{rounded.button}"
    height: "76px"
  answer-yes-selected:
    backgroundColor: "{colors.emergency}"
    textColor: "#ffffff"
    rounded: "{rounded.button}"
    height: "80px"
  answer-no-selected:
    backgroundColor: "{colors.brand}"
    textColor: "#ffffff"
    rounded: "{rounded.button}"
    height: "80px"
  pain-cell-selected:
    backgroundColor: "{colors.foreground}"
    textColor: "#ffffff"
    typography: "{typography.numeral}"
    rounded: "{rounded.button}"
    height: "80px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.panel}"
    padding: "20px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  shell-header:
    backgroundColor: "{colors.brand}"
    textColor: "#ffffff"
    padding: "20px"
---

# Design System: การบ้านหลังนวด

<!-- Scope: recorded from the shipped patient flow (/p/[code]) and the shared tokens in app/globals.css and app/layout.tsx. The clinic (/clinic), appointment slip (/clinic/slip) and DTAM (/dtam) surfaces have NOT been restyled into this world yet; they share the tokens but do not conform to the rules below. -->

## Overview

**Creative North Star: "ผ้าขาวม้าที่ทอเองทุกวัน" (the loincloth you weave yourself, a day at a time)**

Each day's homework is one thread, and a week of practice weaves a ผ้าขาวม้า check of เขียวใบแค green, คราม indigo, a thin รงทอง gold thread and ivory. The cloth is how the patient sees progress, and it is information, not a score. There are no streaks, rings, badges or points. Around the cloth the surface is quiet. It has an ivory ground, ink text, one 2px border system, generous rounded panels and no shadows. The shell is a solid green field ending in a woven selvedge strip.

Older Thai eyes and hands set the density. Text is large and set in the looped Thai face, targets are big, and each screen does one thing: one question, one posture, or one outcome. The current item expands and everything else recedes. Safety outranks completion, so stopping is always one tap away, and red belongs only to stopping and 1669.

The world rejects the white health app with progress rings and badges, the government form, and "too Thai" ornament (gold kanok, temple motifs, gold gradients).

**Key Characteristics:**
- Ivory ground, ink text, solid green shell with a woven selvedge along its lower edge.
- The weave appears only as data (done days, session threads) and as the selvedge, never behind text.
- One state-mark vocabulary for days and threads: woven, bare warp, dashed, red strike, gold ring.
- Flat panels with one 2px border system and 20–24px corners. No shadows.
- Looped Thai for everything you read, and the loopless display face only at 28px and above.
- A single authored motion: a thread weaving in.

## Colors

The palette is Thaitone-derived: one deep green carries the brand and every primary action, indigo carries information and listening, gold is a fill and a ring only, and red is held back for stopping.

### Primary
- **เขียวใบแค Leaf Green** (`brand`): the shell header field, every primary button, posture number discs, the "ไม่ใช่" selected answer and the ground of a woven thread. White on it is 9.3:1.
- **Deep Leaf** (`brand-deep`): the pressed state of primary buttons and the unwoven ground of session threads inside the header.
- **Leaf Wash** (`brand-tint`): the "done today" notice, the success panel, a done day's cell, and pain levels 0–3.

### Secondary
- **คราม Indigo** (`indigo`): listening buttons (ฟังคำถาม, ฟัง), informational icons, inline links (ดูต้นฉบับ), offline and save-pending messages, the focus outline, and the warp threads of the weave.
- **Indigo Wash** (`indigo-tint`): the pressed state of listening buttons.

### Tertiary
- **รงทอง Turmeric Gold** (`gold`): fill, ring and thread only, never text. Used for the today/current ring, the gold thread in the weave and selvedge, the offline pill, text selection, the hold-timer arc and the pause-posture frame border. Ink on it is 9.4:1.
- **Gold Wash** (`gold-tint`): the "keep a chair nearby" notice, pause-posture panels, and pain levels 4–6 (levels 7–10 use gold at 55%).

### Emergency
- **Stop Red** (`emergency`): stop buttons, the 1669 call button, the red strike on a stopped day, the frame of stop and 1669 messages, and the "ใช่" answer to a red-flag question (a yes there is what stops the run). White on it is 7.5:1.
- **Stop Wash** (`emergency-tint`): the ground of the 1669 message panel and the pressed state of stop buttons.

### Neutral
- **Ivory Ground** (`background`): the page.
- **Cotton White** (`surface`): panels, ghost buttons, the fixed stop bar, unwoven warp.
- **Ink** (`foreground`): all body text (16:1), and the selected pain number's fill.
- **Faded Ink** (`muted`): secondary lines, labels and credits (8.9:1). Body text never goes lighter than this.
- **Loom Line** (`line`): the one border colour: panel borders, row dividers, bare warp threads, the stop bar's top edge.

### Named Rules
**The Red Is For Stopping Rule.** Stop Red appears only on stop controls, the 1669 path, the stopped-day strike, and the yes answer to a red-flag question. A screen with no way to stop has no red.

**The Gold Never Speaks Rule.** Gold is never a text colour. It rings, fills and threads. Ink sits on it.

## Typography

**Display Font:** IBM Plex Sans Thai 600/700 (with IBM Plex Sans Thai Looped)
**Body Font:** IBM Plex Sans Thai Looped 400/500/600 (with Noto Sans Thai Looped)

**Character:** The looped (มีหัว) face carries every sentence a patient reads, because older readers read it more accurately. The loopless Plex Thai appears only at display sizes, for page titles, primary action labels, pain numerals and the 1669 call, where it reads as a confident, modern voice.

### Hierarchy
- **Display** (700, 39px, 1.25): the home title "การบ้านวันนี้" only.
- **Headline** (700, 31px, 1.3–1.35): page titles (posture name, pain question, consent), the shell's product name, the success headline and the 1669 button.
- **Numeral** (700, 34px, 1): pain scale numbers 0–10.
- **Action** (600, 28px): labels on the largest primary buttons (start today, consent, timed hold), in the display face.
- **Title** (600, 25px, 1.35): section headings (สัปดาห์นี้, ขั้นตอน, ท่าที่แพทย์แผนไทยสั่ง), the yes/no answer labels and the button-mode repetition counter.
- **Question** (600, 24px, 1.6): the symptom question, which is the screen's h1.
- **Body large** (22px, 1.5–1.7, regular or 600): flag messages, panel values, step-nav labels and emphasised notices.
- **Body** (20px, 1.7): the patient base, set on the patient main element.
- **Label** (18px): metadata lines, `<dt>` labels, day labels under the cloth.
- **Caption** (16px, 1.6): credits, the AI-voice note, privacy notes, the FPS readout. This is the floor; nothing in the patient flow is smaller.

### Named Rules
**The Loops For Reading Rule.** Any text a patient reads as a sentence is set in the looped face. The loopless display face is only for 28px and above.

**The No Clip Rule.** Thai stacks marks above and below the line, so text boxes never get a fixed height or `overflow: hidden`, and line-height never drops below 1.25 on Thai text.

## Layout

The patient flow is a single centred column of at most 576px with 20px side padding, the same on a phone and on a desktop (the desktop simply centres the column on the ivory ground). Sections stack 32px apart, the elements within a section 20–24px apart, and controls 12px apart. On a 375×812 phone the first viewport holds the green header with its selvedge, the today title and meta line, the full-width start button and the week cloth.

During a run the header becomes a compact progress band. It shows the step label with the "ข้อ n จาก m" or "ท่าที่ n จาก m" counter, a 56px "ออก" button, and the session warp. While a posture is on screen a stop bar is fixed to the bottom edge. It never scrolls away, it respects the safe-area inset, and the content above it reserves 208px of bottom padding so nothing hides behind it.

### Named Rules
**The One Thing Per Screen Rule.** Each screen holds one question, one posture or one outcome, with Back and Next (Back is omitted only where there is nowhere to go back to). The question itself is the h1; the counter lives in the header, not above the question.

**The Stop Bar Rule.** During a posture the stop controls are fixed at the bottom of the viewport: two buttons, or three when the posture is standing (ปวดแปล๊บ, เวียนหัว, เซ).

## Elevation & Depth

The system is flat. No element in the patient flow casts a shadow. Depth comes from solid colour fields (the green shell against ivory), the cotton-white surface against the ivory ground, and the one 2px Loom Line border. The fixed stop bar is separated by a 2px top border, not a shadow. Focus is the only lifted state: a 3px indigo outline with a 3px offset (gold on the green header).

### Named Rules
**The Flat Cloth Rule.** No shadows. If something needs to stand apart, give it a 2px border, a solid field or a tint.

## Shapes

Corners are generous and soft but not pill-shaped: 24px for panels and lists, 20px for buttons and answer tiles, 16px for small inline controls and images, 12px for day cells in the cloth, and full rounding for number discs, the plan-code chip and session threads. Every border is 2px. Panels with rows divide them with 2px Loom Line rules. The selvedge is the one hard-edged form: a 10px full-bleed stripe of gold, green, indigo and ivory.

## Components

### Buttons
Solid, heavy-labelled and full width on phones, with an outline icon (2–2.5 stroke) and a Thai label on every button.
- **Shape:** gently rounded (20px).
- **Primary:** Leaf Green fill, white 600 text. The home start button is 76px tall with a 28px display-face label. The consent button is 72px. Step Next and in-panel primaries are 64px.
- **Pressed / Disabled:** pressed deepens to Deep Leaf; disabled drops to 40% opacity. There is no hover treatment; this is a touch surface.
- **Ghost:** Cotton White with a 2px Leaf Green border and green text, at least 56px tall. Used for Back, home, calendar and fallbacks. The pressed state is Leaf Wash.
- **Listen:** a ghost button with an indigo border at 70% and indigo text and icon (Volume2). Every question and posture step has one.
- **Stop:** Cotton White, 2px Stop Red border, red icon above a red 20px label, 72px tall. Lives only in the fixed stop bar.
- **1669:** Stop Red fill, white 31px display-face label with a phone icon, 76px tall, inside the 1669 message panel. Never animated.

### Answer tiles
Yes and No sit side by side, 80px tall, with a ✓ or ✗ icon plus the word, so colour is never the only signal. Unselected tiles are Cotton White with a tinted border (red at 60% for ใช่, green at 60% for ไม่ใช่). A selected tile fills solid and stays filled.

### Pain scale
Eleven 80px tiles in a four-column grid, each with a 34px display numeral. The tile tint deepens with the number: Leaf Wash for 0–3, Gold Wash for 4–6, gold at 55% for 7–10. Red is not used. The chosen tile fills with Ink and white text.

### Cards / Containers
- **Corner Style:** 24px.
- **Background:** Cotton White, or a tint when the panel carries a state (Leaf Wash for done, Gold Wash for pause or caution, Stop Wash for 1669).
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 2px; Loom Line by default, the state colour when the panel carries a state.
- **Internal Padding:** 20px; list rows 16px.

### Flag message
A red-flag outcome is a single framed panel, and its level is carried by the frame and the action, not by a label pill. For 1669 that means a Stop Red border on Stop Wash, a Siren mark, 25px semibold text and the 1669 button. A stop-and-contact-clinic outcome has a Stop Red border on Cotton White, a CircleAlert mark and a "call the clinic" primary button. A pause has a gold border on Gold Wash. A note has a Loom Line border. The wording is fixed text and is never restyled into new copy.

### Inputs / Fields
- **Style:** Cotton White, 2px Loom Line border, 16px corners, 18px text, full width.
- **Focus:** the global 3px indigo outline.

### Navigation
- **Shell header (home):** a solid Leaf Green field holding the clinic name (white at 90%), the plan code in a pill with a white 60% border, and the product name in the 31px display face, ending in the selvedge.
- **Run header:** the same field, compact, with the step label and counter, a ghost-white "ออก" button and the session warp above the selvedge.

### Week cloth (signature)
Seven day cells Sunday to Saturday, each 64px tall with 12px corners and 6px gaps, labelled underneath (today reads "วันนี้" in 600 Ink). This is the only place the full check pattern appears at rest.
- **Woven (done):** the full check fills the cell, inside a Leaf Green border, with a small ✓ disc on the corner.
- **Bare warp (not yet / not done):** pale vertical Loom Line threads on Cotton White.
- **Red strike (stopped for safety):** a 5px Stop Red bar at −20° across the cell, ringed in Cotton White. A stopped day is never counted or drawn as done.
- **Gold ring (today):** a 3px gold outline with a 2px offset.
- The count beside the heading ("ทำแล้ว n จาก m วัน") is plain information, with no percentage or streak.

### Session warp (signature)
One rounded thread per prescribed posture, 14px tall and spread across the run header.
- **Woven (done):** the check weaves in over a gold-bordered thread.
- **Dashed (skipped):** a dashed white border on an empty thread.
- **Bare (not yet):** Deep Leaf with a faint Leaf Wash border.
- **Gold ring (current):** a 2px gold outline.

### Weave-in (the one motion)
When a posture or a day completes, its thread is revealed left to right by a clip-path wipe over 700ms on an ease-out-expo curve (`cubic-bezier(0.16, 1, 0.3, 1)`). It plays on each finished session thread and on today's cell on the outcome screen. Under `prefers-reduced-motion` all animation durations collapse to 0.01ms, so the thread simply appears woven.

## Do's and Don'ts

### Do:
- **Do** use the weave only as data (a done day, a done posture thread) or as the header selvedge.
- **Do** mark state with the one vocabulary: woven for done, bare warp for not yet, dashed for skipped, red strike for stopped for safety, gold ring for today or current.
- **Do** set patient body text at 20px in the looped face, with 1.7 line height.
- **Do** make primary buttons 64–76px, every other target at least 56px, and the 1669 button at least 72px, with 12px between targets.
- **Do** pair every lucide outline icon (stroke 2–2.5) with a Thai text label.
- **Do** give every question and every posture step a listen button in indigo.
- **Do** keep the stop bar fixed at the bottom for the whole posture.
- **Do** keep DTAM credit, the "ดูต้นฉบับ" link and the AI-voice label under every posture.

### Don't:
- **Don't** put the check pattern behind text, as a panel texture or as a page background.
- **Don't** use Stop Red for anything except stopping, 1669, the stopped-day strike and the yes answer to a red-flag question.
- **Don't** set text in gold.
- **Don't** add shadows; separate with a 2px border, a solid field or a tint.
- **Don't** show progress as rings, percentages, streaks, badges or points; the cloth is the only progress display at rest.
- **Don't** use gold kanok, temple motifs or gold gradients.
- **Don't** use the loopless display face below 28px.
- **Don't** add motion beyond the weave-in, and never animate the 1669 button.
