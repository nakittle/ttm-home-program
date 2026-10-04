---
name: การบ้านหลังนวด
description: Thai traditional-medicine home program; a calm garden where each day's homework is tended and its progress grows.
colors:
  background: "#f4f6f0"
  surface: "#fbfcf8"
  foreground: "#1f2f25"
  muted: "#3f5546"
  line: "#d6e0d2"
  sage: "#9cb59a"
  sage-tint: "#dfe8da"
  brand: "#2f4f3a"
  brand-2: "#456b52"
  brand-deep: "#233d2c"
  brand-tint: "#eaf0e6"
  indigo: "#35584a"
  indigo-tint: "#e6eee8"
  gold: "#f2c14e"
  gold-tint: "#fbf1d3"
  clay-ink: "#a4563a"
  emergency: "#a51c22"
  emergency-tint: "#f9e4e2"
typography:
  display:
    fontFamily: "IBM Plex Sans Thai, IBM Plex Sans Thai Looped, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.2
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
  answer:
    fontFamily: "IBM Plex Sans Thai Looped, Noto Sans Thai Looped, sans-serif"
    fontSize: "25px"
    fontWeight: 600
    lineHeight: 1.35
  question:
    fontFamily: "IBM Plex Sans Thai Looped, Noto Sans Thai Looped, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.6
  title:
    fontFamily: "IBM Plex Sans Thai Looped, Noto Sans Thai Looped, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.35
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
  tile: "16px"
  panel: "24px"
  arch: "160px 160px 20px 20px"
  pill: "9999px"
spacing:
  hairline: "6px"
  gap: "12px"
  row: "16px"
  inset: "20px"
  section: "28px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "#ffffff"
    typography: "{typography.action}"
    rounded: "{rounded.pill}"
    padding: "12px 28px"
    height: "76px"
  button-primary-active:
    backgroundColor: "{colors.brand-deep}"
    textColor: "#ffffff"
  button-step:
    backgroundColor: "{colors.brand}"
    textColor: "#ffffff"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    padding: "12px 28px"
    height: "64px"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.brand}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
    height: "56px"
  button-ghost-active:
    backgroundColor: "{colors.brand-tint}"
    textColor: "{colors.brand}"
  button-listen:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.indigo}"
    rounded: "{rounded.pill}"
    height: "56px"
  button-stop:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.emergency}"
    rounded: "{rounded.panel}"
    height: "72px"
  button-stop-active:
    backgroundColor: "{colors.emergency-tint}"
    textColor: "{colors.emergency}"
  button-1669:
    backgroundColor: "{colors.emergency}"
    textColor: "#ffffff"
    typography: "{typography.headline}"
    rounded: "{rounded.pill}"
    height: "76px"
  answer-yes-selected:
    backgroundColor: "{colors.emergency}"
    textColor: "#ffffff"
    typography: "{typography.answer}"
    rounded: "{rounded.panel}"
    height: "80px"
  answer-no-selected:
    backgroundColor: "{colors.brand}"
    textColor: "#ffffff"
    typography: "{typography.answer}"
    rounded: "{rounded.panel}"
    height: "80px"
  pain-cell-selected:
    backgroundColor: "{colors.brand}"
    textColor: "#ffffff"
    typography: "{typography.numeral}"
    rounded: "{rounded.panel}"
    height: "80px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.panel}"
    padding: "20px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.tile}"
    padding: "12px 16px"
  day-tile-done:
    backgroundColor: "{colors.brand}"
    textColor: "#ffffff"
    rounded: "{rounded.tile}"
    height: "48px"
  plan-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.brand}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
---

# Design System: การบ้านหลังนวด

<!-- Scope: recorded from the shipped patient flow (/p/[code]) and the shared tokens in app/globals.css and app/layout.tsx. The world is modelled on the reference page "Tend — A Habit Garden". The clinic (/clinic), appointment slip (/clinic/slip) and DTAM (/dtam) surfaces have NOT been restyled into this world yet; they inherit the new tokens and the .btn / .card classes but their layouts do not conform to the rules below. The earlier ผ้าขาวม้า weave world (woven cells, selvedge, weave-in) has been removed from the code and is no longer part of the system. -->

## Overview

**Creative North Star: "สวนเล็กๆ ที่ดูแลทุกวัน" (a small garden you tend each day)**

The patient opens a calm morning garden: a sage-washed page lit by a soft sun glow from the top right and a sage glow from the left, paper-white cards that float on soft layered shadows, forest-green ink, and a single clay-coloured accent word in the greeting. Progress grows rather than scores. The week is a row of tiles that fill with forest green and a check when a day is done, with a rounded bar above them that grows from sage to forest. The greeting, the date and a picture of the first posture in an arched frame make the first viewport feel personal and unhurried.

Older Thai eyes and hands set the density. Text is large and set in the looped Thai face, targets are big and pill-shaped, and each screen does one thing: one question, one posture or one outcome. Safety outranks completion, so during a posture the stop controls are pinned to the bottom of the screen, and red belongs only to stopping and 1669.

Decoration is confined to the top-right corner of the home header, beside the brand row. It is a faint sun and two leaf sprigs, never behind the greeting or any sentence.

**Key Characteristics:**
- Sage wash ground with two fixed radial glows (sun top-right, sage left); paper-white cards on soft layered shadows.
- Forest green carries the brand and every primary action; pill-shaped buttons with a soft drop shadow.
- One clay accent word per heading (greeting, date, consent title); never a sentence.
- One state-mark vocabulary: done = filled forest with a check, today or current = sun ring, stopped = red cross, skipped = dashed sage.
- Looped Thai for everything you read; the loopless display face only at 28px and above.
- Two authored motions, rise and grow-in, both collapsed under reduced motion.

## Colors

A garden palette: sage and paper for the ground, deep forest for ink and action, sun gold for marking today, clay for one accent word, and red held back for stopping.

### Primary
- **Forest** (`brand`): every primary button, filled done-day tiles, the selected "ไม่ใช่" answer, the selected pain number, the success check disc, headings and the brand name. White on it is 9.1:1.
- **Deep Forest** (`brand-deep`): the pressed state of primary buttons.
- **Young Leaf** (`brand-2`): the far end of the growing progress fill.
- **Leaf Wash** (`brand-tint`): the "done today" pill, the success card, pain levels 0–3, the ghost button's pressed state.

### Secondary
- **Sage** (`sage`): the 2px border of ghost buttons, the near end of the progress fill, the dashed skipped thread, the scrollbar thumb and the leaf sprigs in the header art.
- **Sage Wash** (`sage-tint`): empty progress tracks and session threads, past days not done, the number chips beside posture steps, the brand mark tile, and the ground behind the arched posture picture.
- **Pine** (`indigo`, token name kept from the first pass): listening buttons (ฟังคำถาม, ฟัง), informational icons, the "ดูต้นฉบับ" link, offline and save-pending messages.
- **Pine Wash** (`indigo-tint`): the pressed state of listening buttons.

### Tertiary
- **Sun Gold** (`gold`): fill and ring only, never text. The today ring on the week, the current-posture ring on the session bar, the offline pill, text selection, the sun in the header art, the pause-posture frame. Ink sits on it.
- **Sun Wash** (`gold-tint`): the "keep a chair nearby" notice, pause-posture panels, pain levels 4–6 (7–10 use gold at 55%).
- **Clay Ink** (`clay-ink`): the accent word in a heading (the greeting's time of day, the date, "โปรดอ่าน") and the focus outline. 4.9:1 on the ground, so it is used only at 18px semibold or larger.

### Emergency
- **Stop Red** (`emergency`): stop buttons, the 1669 button, the stopped-day cross, the frame of stop and 1669 messages, the "ใช่" answer to a red-flag question, the delete-my-data button and the not-sent message. White on it is 7.5:1.
- **Stop Wash** (`emergency-tint`): the ground of the 1669 message and of a stopped day, and the pressed state of stop buttons.

### Neutral
- **Morning Sage Ground** (`background`): the page, under the two radial glows.
- **Paper** (`surface`): cards, lists, ghost buttons, the plan-code chip and the fixed stop bar.
- **Forest Ink** (`foreground`): all body text (12.9:1).
- **Faded Forest** (`muted`): secondary lines, labels, day names and credits (7.2:1). Body text never goes lighter than this.
- **Hedge Line** (`line`): card borders, list dividers, future-day tile borders, the stop bar's top edge.

### Named Rules
**The Red Is For Stopping Rule.** Stop Red appears only on stop controls, the 1669 path, the stopped-day cross, the yes answer to a red-flag question, and destructive or failed-save messages. A screen with no way to stop has no red.

**The Sun Never Speaks Rule.** Gold is never a text colour. It rings, fills and glows. Ink sits on it.

**The One Clay Word Rule.** Clay Ink colours one or two words inside a heading or the date line, at 18px semibold or larger. It never colours a sentence, a button or a state.

## Typography

**Display Font:** IBM Plex Sans Thai 600/700 (with IBM Plex Sans Thai Looped)
**Body Font:** IBM Plex Sans Thai Looped 400/500/600 (with Noto Sans Thai Looped)

**Character:** The looped (มีหัว) face carries every sentence a patient reads, because older readers read it more accurately. The loopless Plex Thai appears only at display sizes, where it reads as a confident, modern voice: the greeting, page titles, primary action labels, pain numerals and the 1669 call.

### Hierarchy
- **Display** (700, 40px, 1.2): the home greeting "สวัสดี…" only. The consent title uses the same face at 34px.
- **Headline** (600–700, 31px, 1.3–1.35): posture name, pain question, the success headline and the 1669 button.
- **Numeral** (700, 34px, 1): pain scale numbers 0–10.
- **Action** (600, 28px): labels on the largest primary buttons (start today, consent, timed hold), in the display face.
- **Answer** (600, 25px): the yes/no answer labels, the button-mode repetition counter and the "ขั้นตอน" heading.
- **Question** (600, 24px, 1.6): the symptom question, which is the screen's h1.
- **Title** (600, 22px, 1.35): section headings (สัปดาห์นี้, ท่าที่แพทย์แผนไทยสั่ง), step Next labels, the first posture's name.
- **Body large** (22px, 1.5–1.7): flag messages, card values, emphasised notices.
- **Body** (20px, 1.7): the patient base, set on the patient main element.
- **Label** (18px): the date line, brand name, metadata lines, `<dt>` labels, day names under the week.
- **Caption** (16px, 1.6): clinic name, plan-code chip, credits, the AI-voice note, privacy notes, the FPS readout. This is the floor; nothing in the patient flow is smaller.

### Named Rules
**The Loops For Reading Rule.** Any text a patient reads as a sentence is set in the looped face. The loopless display face is only for 28px and above.

**The No Clip Rule.** Thai stacks marks above and below the line, so text boxes never get a fixed height or `overflow: hidden`, and line-height never drops below 1.2 on Thai text.

## Layout

The patient flow is a single centred column of at most 576px with 20px side padding, the same on a phone and on a desktop, which centres the column on the glowing sage ground. Sections stack 28px apart, elements within a section 12–24px apart, and controls 12px apart.

On the home screen the header is a brand row (a sage-wash tile with a sprout icon, the product name over the clinic name, and the plan-code chip on the right) with the decorative corner art behind its right end. Below it come the date line, the greeting, the meta line ("การบ้านวันนี้ n ท่า · นัดครั้งถัดไป …"), the full-width start button, the week card, and the prescribed postures list headed by the first posture in an arched frame. On a 375×812 phone the first viewport holds everything down to the top of the week card.

During a run the header becomes a compact band: the step label with its counter ("ข้อ n จาก m", "ท่าที่ n จาก m"), a 56px "ออก" ghost button, and the session bar. While a posture is on screen a stop bar is fixed to the bottom edge. It never scrolls away, it respects the safe-area inset, and the content above it reserves 208px of bottom padding so nothing hides behind it.

### Named Rules
**The One Thing Per Screen Rule.** Each screen holds one question, one posture or one outcome, with Back and Next (Back is omitted only where there is nowhere to go back to). The question itself is the h1; the counter lives in the header, not above the question.

**The Stop Bar Rule.** During a posture the stop controls are fixed at the bottom of the viewport: two buttons, or three when the posture is standing (ปวดแปล๊บ, เวียนหัว, เซ).

**The Corner Garden Rule.** Decoration lives only in the top-right corner of the home header, masked to fade toward the text, and never sits behind the greeting, the date or any sentence.

## Elevation & Depth

The system is softly lifted. Paper cards float on a layered shadow over the sage ground: an inset white highlight on the top edge, a long, diffuse forest-tinted drop, and a short contact shadow. Primary buttons, filled done-day tiles, selected answers and the success disc carry a tighter, darker drop so they read as pressable. Depth also comes from the two fixed radial glows on the page.

### Shadow Vocabulary
- **Paper lift** (`box-shadow: 0 1px 0 rgb(255 255 255 / 0.8) inset, 0 18px 40px -22px rgb(47 79 58 / 0.35), 0 2px 6px -2px rgb(47 79 58 / 0.12)`): cards, lists, the plan-code chip, unselected answer tiles, notices, posture sheets, flag messages.
- **Button drop** (`box-shadow: 0 12px 22px -12px rgb(35 61 44 / 0.75)`): primary buttons, the 1669 button, selected answers and pain number, filled done-day tiles, the success check disc. Removed when disabled.
- **Stop bar** (`box-shadow: 0 -12px 30px -18px rgb(47 79 58 / 0.45)`): the fixed bottom stop bar only, cast upward.

### Named Rules
**The Paper On Sage Rule.** Anything that holds content is Paper with the paper lift and a 1px Hedge Line border. Anything you press to act carries the button drop. Nothing else casts a shadow.

## Shapes

Shapes are soft and rounded. Buttons, chips, pills, progress tracks and session threads are fully rounded. Cards, lists, answer tiles, pain tiles, stop buttons, flag messages and posture sheets use 24px corners. Day tiles, number chips, the brand mark tile and inputs use 16px corners. The first posture's picture sits in an arch: 160px top corners over 20px bottom corners. Card borders are 1px; state-bearing frames (answer tiles, stop buttons, flag messages, ghost buttons, future day tiles) use 2px.

## Components

### Buttons
Soft, pill-shaped and full width on phones, with an outline icon (stroke 2–2.5) and a Thai label on every button.
- **Shape:** fully rounded pill.
- **Primary:** Forest fill, white 600 text, button drop. The home start button is 76px tall with a 28px display-face label, the consent button 72px, the button-mode hold 80px, step Next and in-panel primaries 64px.
- **Pressed / Disabled:** pressed nudges down 1px, scales to 99% and deepens to Deep Forest; disabled drops to 40% opacity and loses its shadow. There is no hover treatment; this is a touch surface.
- **Ghost:** Paper with a 2px Sage border and Forest text, at least 56px tall. Used for Back, home, calendar, leave and fallbacks. Pressed is Leaf Wash.
- **Listen:** a ghost pill with Pine text and icon (Volume2), bordered in Pine at 70% for whole questions and in Sage for each posture step.
- **Stop:** Paper, 2px Stop Red border, 24px corners, a red icon above a red 20px label, 72px tall. Lives only in the fixed stop bar.
- **1669:** Stop Red pill, white 31px display-face label with a phone icon, 76px tall, button drop, inside the 1669 message. Never animated.

### Chips
- **Plan code:** Paper pill with a 1px Hedge Line border, the paper lift and a 16px semibold Forest code.
- **Offline:** Sun Gold pill with Forest Ink text and a WifiOff icon.
- **Done today:** Leaf Wash pill with a CircleCheck icon and Forest 20px semibold text.
- **Picture labels:** Paper at 90% pills on the arched picture ("ท่าแรก", hold time).

### Answer tiles
Yes and No sit side by side, 80px tall, 24px corners, with a check or cross icon plus the word, so colour is never the only signal. Unselected tiles are Paper with a 2px tinted border (red at 50% for ใช่, forest at 50% for ไม่ใช่) and the paper lift. A selected tile fills solid with the button drop and stays filled.

### Pain scale
Eleven 80px tiles in a four-column grid with 24px corners, each with a 34px display numeral. The tile tint deepens with the number: Leaf Wash for 0–3, Sun Wash for 4–6, gold at 55% for 7–10. Red is not used. The chosen tile fills Forest with white text and the button drop.

### Cards / Containers
- **Corner Style:** 24px.
- **Background:** Paper, or a wash when the card carries a state (Leaf Wash for success, Sun Wash for pause or caution, Stop Wash for 1669).
- **Shadow Strategy:** the paper lift (see Elevation & Depth).
- **Border:** 1px Hedge Line; 2px in the state colour when the card carries a state.
- **Internal Padding:** 20px; list rows 16px.

### Flag message
A red-flag outcome is a single framed card that rises in, and its level is carried by the frame and the action, not by a label pill. For 1669: a Stop Red border on Stop Wash, a Siren mark, 25px semibold text and the 1669 button. Stop-and-contact-clinic: a Stop Red border on Paper, a CircleAlert mark and a "call the clinic" primary pill. Pause: a Sun Gold border on Sun Wash. Note: a Hedge Line border on Paper. The wording is fixed text and is never restyled into new copy.

### Inputs / Fields
- **Style:** Paper, 2px Hedge Line border, 16px corners, 18px text, full width.
- **Focus:** the global 3px Clay Ink outline with a 3px offset.

### Navigation
- **Home header:** a transparent brand row over the glow: sprout tile, product name (18px bold Forest) over the clinic name (16px Faded Forest, truncated), and the plan-code chip. The corner art (a faint sun and two leaf sprigs) sits behind its right end.
- **Run header:** the step label and counter in 20px semibold Forest, a ghost "ออก" pill and the session bar below.

### Week card (signature)
A card with the heading "สัปดาห์นี้", the count "ทำแล้ว n จาก m วัน" as plain information, a 14px growing bar, then seven 48px day tiles Sunday to Saturday with 16px corners and 6px gaps, labelled underneath (today reads "วันนี้" in 600 Forest Ink).
- **Done:** filled Forest with a white check and the button drop.
- **Today:** a 3px Sun Gold ring with a 2px offset.
- **Stopped for safety:** 2px Stop Red border on Stop Wash with a red cross. A stopped day is never counted or drawn as done.
- **Past, not done:** Sage Wash, empty.
- **Future:** Paper with a 2px Hedge Line border.

### Session bar (signature)
One 12px rounded thread per prescribed posture with 6px gaps, in the run header.
- **Done:** the sage-to-forest fill grows in.
- **Skipped:** a 2px dashed Sage border on an empty thread.
- **Not yet:** Sage Wash.
- **Current:** a 2px Sun Gold ring with a 2px offset.

### Arched posture picture (signature)
The first prescribed posture appears at the top of the list in a 224px arch (160px top corners, 20px bottom) on Sage Wash, with "ท่าแรก" and its hold time in Paper pills at the bottom corners.

### Motion
- **Rise:** sections and cards fade up 16px over 600ms (`cubic-bezier(0.2, 0.9, 0.3, 1)`), staggered 70ms per index.
- **Grow-in:** progress fills scale in from the left over 800ms (`cubic-bezier(0.3, 1.2, 0.4, 1)`).
- Under `prefers-reduced-motion` every animation and transition collapses to 0.01ms with no delay, so content and fills simply appear.

## Do's and Don'ts

### Do:
- **Do** set patient body text at 20px in the looped face, with 1.7 line height.
- **Do** make primary buttons 64–76px, every other target at least 56px, and the 1669 button at least 72px, with 12px between targets.
- **Do** mark state with the one vocabulary: filled forest with a check for done, a sun ring for today or current, a red cross for stopped (never counted), a dashed sage thread for skipped.
- **Do** put content on Paper cards with the paper lift and a 1px Hedge Line border.
- **Do** keep decoration in the top-right corner of the home header, faded toward the text.
- **Do** pair every lucide outline icon (stroke 2–2.5) with a Thai text label.
- **Do** give every question and every posture step a listen button in Pine.
- **Do** keep the stop bar fixed at the bottom for the whole posture.
- **Do** keep DTAM credit, the "ดูต้นฉบับ" link and the AI-voice label under every posture.

### Don't:
- **Don't** put decoration, glows or art behind the greeting, the date or any body text.
- **Don't** use Stop Red for anything except stopping, 1669, the stopped-day cross, the yes answer to a red-flag question, and destructive or failed-save messages.
- **Don't** set text in gold, or set a whole sentence in Clay Ink.
- **Don't** show progress as streaks, percentages, badges or points; the week card's count and growing bar are the only progress display.
- **Don't** use the loopless display face below 28px.
- **Don't** animate the 1669 button, and don't add motion beyond rise and grow-in.
