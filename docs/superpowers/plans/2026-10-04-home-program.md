# การบ้านหลังนวด (TTM Home Program) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เว็บแอปที่แพทย์แผนไทยสั่งท่าฤๅษีดัดตนของกรมฯ ให้ผู้ป่วยผ่าน QR ผู้ป่วยทำที่บ้านพร้อมกล้องนับเวลาค้างท่าและเสียงไทย แล้วผลและธงแดงกลับถึงคลินิก และกรมฯ เห็นภาพรวม ส่งงาน 9 ต.ค. 2569 ก่อนเที่ยง

**Architecture:** Next.js 16 (App Router) บน Vercel ทุกคำขอข้อมูลผ่าน API routes ของเราไป Supabase (สิงคโปร์) ด้วย service role key ฝั่งเซิร์ฟเวอร์เท่านั้น ถ้าไม่มีคีย์จะใช้ MemoryStore แทน (สำหรับเทสต์และเครื่องนักพัฒนา) กล้องใช้ MediaPipe Pose บนมือถือ กฎท่าเป็นข้อมูล JSON ที่ตัวอ่านกฎ (DSL) ประเมินเป็นเรขาคณิต ธงแดงเป็นกฎตายตัวชุดเดียวที่รันทั้งบนมือถือและเซิร์ฟเวอร์

**Tech Stack:** Next.js 16.3.8, React 19, TypeScript, Tailwind 4, Vitest 5, zod 4.6.5, jose 6, @supabase/supabase-js 2.117.2, @mediapipe/tasks-vision 1.0.1, qrcode 1.5.4, idb-keyval 6.3.0, sharp (dev)

**สเปก:** `docs/superpowers/specs/2026-10-04-home-program-design.md`

**สถานะโค้ดในแผน:** โค้ดทุกไฟล์ในแผนนี้เขียนและรันจริงแล้วในโฟลเดอร์ทดลองระหว่างทำแผน (4 ต.ค.)
- `npm test` ผ่าน 107 ข้อ, `tsc --noEmit` ผ่าน, `eslint` ไม่มี error, `next build` ผ่าน
- ทดลองกดทั้งเส้นในเบราว์เซอร์ผ่าน: คลินิกเข้าระบบ → สร้างแผน → ใบนัด QR → ผู้ป่วยยินยอม → คัดกรอง → ท่า (โมเดล MediaPipe โหลดบน GPU ได้ เครื่องทดสอบไม่มีกล้องจึงถอยไปโหมดปุ่มตามที่ออกแบบ) → ระดับปวด → ธง RF08 ขึ้นบน dashboard → หน้ากรมฯ แสดงยอดรวม

## Global Constraints

- ห้ามมีช่องชื่อ เลขบัตร เบอร์ของผู้ป่วย หรือ HN ในฐานข้อมูลหรือ API ใด
- รหัสลับของแผนอยู่หลัง `#` ในลิงก์ผู้ป่วยเท่านั้น (ยกเว้นลิงก์ปฏิทิน `.ics` ที่สเปกยอมรับ) เซิร์ฟเวอร์เก็บเฉพาะ SHA-256
- ภาพจากกล้องห้ามออกจากมือถือ ห้ามบันทึก
- ธงแดงระดับ 🔴 `call_1669` และ 🟠 `stop_and_contact_clinic` คลินิกปิดไม่ได้ ข้อความถึงผู้ป่วยใช้ข้อความตายตัวใน `content/redflags.json` เท่านั้น
- เนื้อหาท่ามาจากแผ่นกรมฯ ปี 2569 ชุด 1, 2, 6 คำต่อคำ ทุกท่าแสดง `creditLine()` และลิงก์ต้นฉบับ ห้ามใช้ลิงก์หน้าข่าว 47002 ของกลุ่มไหล่ติด
- ห้ามสัญญาว่าลดปวด ห้ามใช้คำว่า "วินิจฉัย" "ท่าผิด" "รักษาหาย" ในหน้าผู้ป่วย
- ห้าม LLM ตัดสินอะไรเกี่ยวกับผู้ป่วย Gemini ใช้เฉพาะสร้างเสียงจากข้อความของกรมฯ ตอน build
- Key ทุกตัวผู้ใช้ใส่เองใน `.env.local` และ Vercel ห้ามพิมพ์ key ใน chat ห้าม commit `.env.local`
- Next.js 16: `params` ใน route handler เป็น Promise (`await ctx.params`) อ่าน `node_modules/next/dist/docs/` ก่อนเขียน API ที่ไม่มีในแผน
- route.ts ห้าม export อะไรนอกจาก HTTP handler (state ที่ต้องรีเซ็ตในเทสต์อยู่ใน `lib/http.ts`)
- ข้อความ UI ภาษาไทยไม่ระบุเพศ (ไม่ใช้ ครับ/ค่ะ/คะ)
- commit ด้วยชื่อ "TTM Home Program Team" (ตั้งไว้ใน repo แล้ว) ยังไม่ push จนกว่าผู้ใช้อนุญาต

## โครงสร้างไฟล์

```
content/                 postures.json (13 ท่า + กฎกล้อง), groups.json (กลุ่มและลิงก์แผ่น), redflags.json (16 กฎ)
lib/content/             schema.ts (zod), index.ts (โหลด + ตัวช่วย)
lib/pose/                landmarks.ts, geometry.ts, rules.ts (DSL), session.ts (state machine), camera.ts (เบราว์เซอร์)
lib/redflags.ts          ประเมินธงแดง
lib/plan.ts, lib/ics.ts  รหัสแผน/รหัสลับ, ไฟล์ปฏิทิน
lib/db/                  types.ts, memory.ts, supabase.ts, index.ts (getStore)
lib/aggregate.ts         adherence, dashboard คลินิก, สรุปกรมฯ
lib/auth.ts, lib/http.ts PIN, cookie, ตัวช่วย HTTP, rate limit
lib/api/                 schemas.ts (zod ของ API), guards.ts
lib/seed.ts              ข้อมูลจำลอง
lib/audio-keys.ts, lib/wav.ts, lib/audio.ts, lib/offline.ts, lib/client.ts
app/api/...              14 routes
app/clinic/..., app/p/[code], app/dtam, app/lab, app/page.tsx
components/              LevelBadge.tsx, patient/{Questions,Outcome,PostureRunner}.tsx
scripts/                 fetch-mediapipe.mjs, make-sheet-images.mjs, gen-tts.mts, seed.mts, purge.mts
supabase/schema.sql
tests/                   *.test.ts + helpers/
```

---

### Task 1: ตั้งโปรเจกต์ Next.js 16 + Vitest + หน้าแรก

**Files:**
- Create: ไฟล์จาก create-next-app, `vitest.config.mts`, `tests/helpers/empty.ts`, `.env.example`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx`
- Modify: `package.json`, `tsconfig.json`, `eslint.config.mjs`, `.gitignore`

**Interfaces:**
- Produces: alias `@/` → root, `server-only` alias ในเทสต์, คลาส CSS `.btn .btn-ghost .card .input`, สี `brand`, ฟอนต์ Sarabun

- [ ] **Step 1: สร้างโปรเจกต์ในโฟลเดอร์ชั่วคราวแล้วคัดลอกเข้า repo** (repo มี `docs/` และ `.git` อยู่แล้ว create-next-app จึงสร้างทับตรง ๆ ไม่ได้)

```bash
cd C:/HACKATHON
npx --yes create-next-app@16.3.8 hp-scaffold --ts --app --eslint --tailwind --no-src-dir --import-alias "@/*" --use-npm --no-turbopack --disable-git --yes
rm -rf hp-scaffold/.git && cp -r hp-scaffold/. home-program/ && rm -rf hp-scaffold
cd home-program
git checkout -- .gitignore 2>/dev/null; cat .gitignore
```

ถ้า `.gitignore` ของ create-next-app ทับของเดิม ให้แน่ใจว่ามี `.env*` และเพิ่มบรรทัดท้ายไฟล์:

```
!.env.example
# MediaPipe assets are fetched at build time
/public/mediapipe/
```

- [ ] **Step 2: ติดตั้ง dependencies**

```bash
npm i zod@4.6.5 jose@6.2.12 @supabase/supabase-js@2.117.2 @mediapipe/tasks-vision@1.0.1 qrcode@1.5.4 idb-keyval@6.3.0 server-only@0.0.1
npm i -D @types/node@24 vitest@5.0.3 tsx@4 @types/qrcode@1 sharp
```

(`vitest@5` ต้องการ `@types/node` ≥ 22 จึงต้องระบุ `@types/node@24`)

- [ ] **Step 3: ตั้งค่า scripts, tsconfig, eslint**

```bash
npm pkg set scripts.test="vitest run" scripts.typecheck="tsc --noEmit" scripts.prebuild="node scripts/fetch-mediapipe.mjs" scripts.predev="node scripts/fetch-mediapipe.mjs" scripts.seed="tsx --env-file-if-exists=.env.local scripts/seed.mts" scripts.purge="tsx --env-file-if-exists=.env.local scripts/purge.mts" scripts.tts="tsx --env-file-if-exists=.env.local scripts/gen-tts.mts" scripts.images="node scripts/make-sheet-images.mjs ../research/content/sources"
node -e "const fs=require('fs');const t=JSON.parse(fs.readFileSync('tsconfig.json','utf8'));t.compilerOptions.allowImportingTsExtensions=true;fs.writeFileSync('tsconfig.json',JSON.stringify(t,null,2)+'\n')"
```

`eslint.config.mjs`:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored MediaPipe runtime copied at build time
    "public/mediapipe/**",
  ]),
]);

export default eslintConfig;
```

`vitest.config.mts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
      "server-only": path.resolve(import.meta.dirname, "tests/helpers/empty.ts"),
    },
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
```

`tests/helpers/empty.ts`:

```ts
export {};
```

`.env.example`:

```
# Copy to .env.local and fill in. Never commit .env.local. Never paste keys into chat.

# Supabase (region: Singapore). Without these the app uses an in-memory store (data is lost on restart).
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# 32+ random characters, signs the clinic / DTAM cookies
SESSION_SECRET=

# Password for the /dtam overview in the demo
DTAM_DEMO_PASSWORD=

# Enables POST /api/demo/reset (leave empty to disable)
DEMO_RESET_TOKEN=
# PIN for the demo clinics DEMO-A / DEMO-B / DEMO-C created by the seed
DEMO_CLINIC_PIN=246810

# Only on your machine, for npm run tts (not needed on Vercel)
GEMINI_API_KEY=
GEMINI_TTS_MODEL=
```

- [ ] **Step 4: หน้าแรกและธีม**

`app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";

const sarabun = Sarabun({ subsets: ["thai", "latin"], weight: ["400", "600", "700"], variable: "--font-sarabun" });

export const metadata: Metadata = {
  title: "การบ้านหลังนวด",
  description: "แพทย์แผนไทยสั่งท่าฤๅษีดัดตนของกรมการแพทย์แผนไทยฯ ให้ผู้ป่วยทำที่บ้าน แล้วผลกลับถึงคลินิก",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#7c2d12" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${sarabun.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

`app/globals.css`:

```css
@import "tailwindcss";

:root {
  --background: #fffbf5;
  --foreground: #1c1917;
  --brand: #7c2d12;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-brand: var(--brand);
  --font-sans: var(--font-sarabun);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sarabun), sans-serif;
  font-size: 18px;
}

.btn {
  @apply inline-flex items-center justify-center rounded-xl px-5 py-3 font-semibold text-white bg-brand active:opacity-80 disabled:opacity-40;
}
.btn-ghost {
  @apply inline-flex items-center justify-center rounded-xl px-5 py-3 font-semibold border border-stone-300 bg-white active:bg-stone-100 disabled:opacity-40;
}
.card {
  @apply rounded-2xl bg-white shadow-sm border border-stone-200 p-4;
}
.input {
  @apply w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-lg;
}

@media print {
  .no-print {
    display: none !important;
  }
  body {
    background: white;
  }
}
```

`app/page.tsx`:

```tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <h1 className="text-3xl font-bold text-brand">การบ้านหลังนวด</h1>
      <p>
        แพทย์แผนไทยสั่งท่าฤๅษีดัดตนของกรมการแพทย์แผนไทยฯ ให้ผู้ป่วยรายคนผ่าน QR → ผู้ป่วยทำที่บ้านตามเสียง
        และกล้องมือถือช่วยนับเวลาค้างท่า → ผลและธงแดงกลับถึงคลินิกก่อนนัดครั้งถัดไป → กรมฯ เห็นภาพรวม
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/clinic" className="card hover:border-brand">
          <div className="text-xl font-semibold">สำหรับคลินิก</div>
          <div className="text-stone-600">สร้างแผน ออกใบนัดพร้อม QR ดูผลและธงแดง</div>
        </Link>
        <Link href="/dtam" className="card hover:border-brand">
          <div className="text-xl font-semibold">สำหรับกรมฯ</div>
          <div className="text-stone-600">ภาพรวมการทำตามแผน (ยอดรวม ไม่มีข้อมูลรายคน)</div>
        </Link>
      </div>
      <p className="text-sm text-stone-500">
        ผู้ป่วยไม่ต้องเข้าหน้านี้ ให้สแกน QR บนใบนัดที่ได้จากคลินิก · เนื้อหาท่าจากแผ่น
        &ldquo;ยืดเหยียด...ดัดตน...พ้นโรค ด้วยท่าฤๅษีดัดตน&rdquo; กรมการแพทย์แผนไทยและการแพทย์ทางเลือก 2569 · ต้นแบบสำหรับการแข่งขัน
        ไม่ใช่เครื่องมือวินิจฉัย
      </p>
    </main>
  );
}
```

- [ ] **Step 5: ตรวจว่า typecheck ผ่าน** (ยังไม่ build เพราะ `prebuild` ต้องใช้ `scripts/fetch-mediapipe.mjs` ใน Task 11)

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16 app with Vitest, Thai layout and home page"
```

---

### Task 2: เนื้อหาท่า กลุ่ม กฎธงแดง และภาพแผ่นท่า

**Files:**
- Create: `content/postures.json`, `content/groups.json`, `content/redflags.json`, `lib/content/schema.ts`, `lib/content/index.ts`, `scripts/make-sheet-images.mjs`, `public/postures/*.webp` (สร้างด้วยสคริปต์), `tests/content.test.ts`

**Interfaces:**
- Produces: `postures`, `groupsFile`, `redflags`, `getPosture(id)`, `activeGroups()`, `getGroup(id)`, `posturesForGroups(groupIds): string[]`, `sheetUrl(sheet)`, `creditLine(posture)`, `rulesAskedAt(at, postureId?)`; types `Condition`, `Detector`, `Posture`, `Group`, `RedFlagRule`, `RedFlagLevel`

ข้อความใน `steps_th`, `cautions_th`, `contraindications_th` ถอดคำต่อคำจากภาพแผ่น (`C:\HACKATHON\research\content\sources\the{1,2,6}\p*.png`) เมื่อ 4 ต.ค. กฎกล้อง (`detector`) ออกแบบจากสเปกตรวจจับที่ผู้ตรวจยืนยันแล้ว (`research/content/2026-10-04-ท่าและกฎธงแดง-raw.json`) ค่าตั้งต้นจะปรับด้วยคลิปของทีมใน Task 11

- [ ] **Step 1: เขียนเทสต์**

`tests/content.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { activeGroups, creditLine, getPosture, groupsFile, postures, posturesForGroups, redflags, rulesAskedAt } from "@/lib/content";

describe("content files", () => {
  it("has the 13 unique postures from DTAM sheets 1, 2 and 6", () => {
    expect(postures).toHaveLength(13);
    expect(new Set(postures.map((p) => p.id)).size).toBe(13);
    for (const p of postures) expect([1, 2, 6]).toContain(p.source.sheet);
  });

  it("every active group lists only known postures and every posture belongs to a group", () => {
    const listed = new Set(activeGroups().flatMap((g) => g.posture_ids));
    for (const id of listed) expect(() => getPosture(id)).not.toThrow();
    for (const p of postures) expect(listed.has(p.id)).toBe(true);
  });

  it("every sheet referenced by a group or posture has a URL", () => {
    for (const g of groupsFile.groups) expect(groupsFile.sheets[String(g.sheet)]).toBeDefined();
    for (const p of postures) expect(groupsFile.sheets[String(p.source.sheet)].url).toMatch(/^https:\/\/www\.dtam\.moph\.go\.th\//);
  });

  it("does not link the frozen-shoulder sheet to news page 47002 (it embeds the wrong flipbook)", () => {
    expect(groupsFile.sheets["2"].url).not.toContain("47002");
  });

  it("alternate-side postures have an even number of units and a first side", () => {
    for (const p of postures.filter((x) => x.detector.sides === "alternate")) {
      expect(p.detector.units % 2).toBe(0);
      expect(p.detector.first_side).not.toBeNull();
    }
  });

  it("only kae-lom-pakang is counted as reps (its sheet gives no hold time)", () => {
    expect(postures.filter((p) => p.detector.mode === "reps").map((p) => p.id)).toEqual(["kae-lom-pakang"]);
  });

  it("de-duplicates the posture shared by the office and shoulder sheets", () => {
    const ids = posturesForGroups(["office", "shoulder"]);
    expect(ids.filter((id) => id === "kae-puat-thong-sabak-chom")).toHaveLength(1);
    expect(ids).toHaveLength(9);
  });

  it("builds a DTAM credit line with the page number", () => {
    expect(creditLine(getPosture("kae-kiat"))).toContain("หน้า 2");
    expect(creditLine(getPosture("kae-kiat"))).toContain("กรมการแพทย์แผนไทยและการแพทย์ทางเลือก");
  });
});

describe("red flag rules", () => {
  it("has 16 rules with a source and an evidence strength", () => {
    expect(redflags.rules).toHaveLength(16);
    for (const r of redflags.rules) {
      expect(r.source_th.length).toBeGreaterThan(5);
      expect(["stated", "derived", "team"]).toContain(r.strength);
    }
  });

  it("emergency and stop rules can never be switched off by a clinic", () => {
    for (const r of redflags.rules.filter((x) => x.level === "call_1669" || x.level === "stop_and_contact_clinic")) {
      expect(r.clinic_adjustable).toBe(false);
    }
  });

  it("asks 7 questions before a session", () => {
    expect(rulesAskedAt("pre").map((r) => r.id).sort()).toEqual(["RF01", "RF02", "RF05", "RF06", "RF14", "RF15", "RF16"]);
  });

  it("asks the kneeling question only before kae-sabak-na-chom", () => {
    expect(rulesAskedAt("before_posture", "kae-sabak-na-chom").map((r) => r.id)).toEqual(["RF12"]);
    expect(rulesAskedAt("before_posture", "kae-kiat")).toEqual([]);
  });
});
```

- [ ] **Step 2: รันให้ fail**

Run: `npx vitest run tests/content.test.ts`
Expected: FAIL (ไม่พบ `@/lib/content`)

- [ ] **Step 3: ไฟล์เนื้อหา**

`content/postures.json`:

```json
[
  {
    "id": "kae-kiat",
    "name_th": "ท่าแก้เกียจ",
    "name_en": "Generalized weakness or Not Alert",
    "position": "sitting_floor",
    "steps_th": [
      "ท่าเตรียม นั่งขัดสมาธิ ลำตัวตั้งตรง หน้ามองตรง วางมือทั้งสองข้างไว้ที่หน้าขา",
      "ประสานมือทั้งสองข้าง ไว้ที่ระดับหน้าอก",
      "ค่อย ๆ สูดลมหายใจเข้าให้เต็มที่ พลิกฝ่ามือที่ประสานกัน ดันยืดออกไปด้านหน้า แขนเหยียดตรง",
      "ค่อย ๆ หันหน้า บิดลำตัว พร้อมกับแขน ไปทางขวาให้มากที่สุดเท่าที่จะทำได้ นิ่งค้างไว้ประมาณ 10 วินาที โดยไม่กลั้นหายใจ แล้วค่อย ๆ คลายย้อนกลับไปอยู่ในท่าเตรียม",
      "ทำสลับอีกข้างหนึ่ง (ทำสลับซ้าย-ขวานับเป็น 1 รอบ) ทำซ้ำ 3 รอบ"
    ],
    "note_th": "หมายเหตุ : สามารถปรับเปลี่ยนเป็นนั่งเก้าอี้ได้",
    "cautions_th": [
      "ควรยืดตัวก่อนหมุนเพื่อลดแรงบิดที่บริเวณกระดูกสันหลังส่วนเอว",
      "ไม่ควรยกไหล่สูงหรือห่อไหล่มากเกินไป",
      "หลีกเลี่ยงการหมุนอย่างรวดเร็ว"
    ],
    "contraindications_th": [
      "ผู้ที่มีหมอนรองกระดูกสันหลังเคลื่อนระยะเฉียบพลัน",
      "ผู้ที่มีภาวะข้อไหล่อักเสบเฉียบพลัน",
      "ผู้ที่มีปัญหาการทรงตัวจากโรคทางระบบประสาท"
    ],
    "source": { "sheet": 1, "page": 2 },
    "detector": {
      "view": "front",
      "sides": "alternate",
      "first_side": "R",
      "mode": "hold",
      "hold_seconds": 10,
      "units": 6,
      "difficulty": "medium",
      "required": ["L_SHOULDER", "R_SHOULDER", "L_WRIST", "R_WRIST", "L_HIP", "R_HIP"],
      "in_pose": { "all": [
        { "near": ["L_WRIST", "R_WRIST"], "within": 0.45 },
        { "above": ["MID_WRIST", "MID_HIP"], "by": 0.5 },
        { "toward": ["MID_WRIST", "{S}"], "by": 0.35 }
      ] }
    }
  },
  {
    "id": "kae-lom-puat-sisa",
    "name_th": "ท่าแก้ลมปวดศีรษะ",
    "name_en": "Headache",
    "position": "sitting_floor",
    "steps_th": [
      "ท่าเตรียม นั่งขัดสมาธิ ลำตัวตั้งตรง หน้ามองตรง วางมือทั้งสองข้างไว้ที่หน้าขา",
      "นั่งชันเข่าข้างซ้ายขึ้น ฝ่าเท้าแนบกับพื้น หันปลายเท้าซ้ายออกไปให้ได้มากที่สุด",
      "พนมมือให้ปลายนิ้วอยู่ระดับคาง กางศอกออกให้ขนานกับพื้น",
      "ค่อย ๆ สูดลมหายใจเข้าให้เต็มที่ ยกมือขึ้นเหนือศีรษะ",
      "ออกแรงดันปลายนิ้วไปทางด้านซ้ายและขวา นิ่งค้างไว้ประมาณ 10 วินาที โดยไม่กลั้นหายใจ แล้วค่อย ๆ คลายย้อนกลับไปอยู่ในท่าเตรียม",
      "ทำสลับอีกข้างหนึ่ง (ทำสลับซ้าย-ขวานับเป็น 1 รอบ) ทำซ้ำ 3 รอบ"
    ],
    "note_th": null,
    "cautions_th": [],
    "contraindications_th": [],
    "source": { "sheet": 1, "page": 3 },
    "detector": {
      "view": "front",
      "sides": "alternate",
      "first_side": "L",
      "mode": "hold",
      "hold_seconds": 10,
      "units": 6,
      "difficulty": "easy",
      "required": ["NOSE", "L_SHOULDER", "R_SHOULDER", "L_WRIST", "R_WRIST"],
      "in_pose": { "all": [
        { "near": ["L_WRIST", "R_WRIST"], "within": 0.45 },
        { "above": ["MID_WRIST", "NOSE"], "by": 0.3 }
      ] }
    }
  },
  {
    "id": "kae-lom-wian-sisa",
    "name_th": "ท่าแก้ลมเวียนศีรษะ",
    "name_en": "Vertigo",
    "position": "sitting_floor",
    "steps_th": [
      "ท่าเตรียม นั่งขัดสมาธิ ลำตัวตั้งตรง หน้ามองตรง วางมือทั้งสองข้างไว้ที่หน้าขา",
      "วางสันมือข้างซ้ายไว้บริเวณท้ายทอย ปลายนิ้วชี้ขึ้น สันมือข้างขวาวางไว้บริเวณเหนือหัวเข่าขวา",
      "ค่อย ๆ สูดลมหายใจเข้าให้เต็มที่ แขนซ้ายออกแรงดันศีรษะให้เบือนหน้าทางขวาให้ได้มากที่สุด จนรู้สึกตึงต้นคอ พร้อมกับแบะไหล่ซ้ายออก ส่วนมือขวาออกแรงกดเหนือหัวเข่า นิ่งค้างไว้ประมาณ 10 วินาที โดยไม่กลั้นหายใจ แล้วค่อย ๆ คลายย้อนกลับไปอยู่ในท่าเตรียม",
      "ทำสลับอีกข้างหนึ่ง (ทำสลับซ้าย-ขวานับเป็น 1 รอบ) ทำซ้ำ 3 รอบ"
    ],
    "note_th": null,
    "cautions_th": [
      "ผู้ที่มีประวัติปวดคอเรื้อรัง",
      "ผู้ที่เป็นโรคหมอนรองกระดูกคอเสื่อม",
      "ผู้ที่มีประวัติมีอาการเวียนศีรษะจากการหมุน"
    ],
    "contraindications_th": [],
    "source": { "sheet": 1, "page": 4 },
    "detector": {
      "view": "front",
      "sides": "alternate",
      "first_side": "R",
      "mode": "hold",
      "hold_seconds": 10,
      "units": 6,
      "difficulty": "medium",
      "required": ["NOSE", "L_SHOULDER", "R_SHOULDER", "L_ELBOW", "R_ELBOW", "L_WRIST", "R_WRIST"],
      "in_pose": { "all": [
        { "above": ["{O}_ELBOW", "{O}_SHOULDER"], "by": 0.05 },
        { "above": ["{O}_WRIST", "{O}_SHOULDER"], "by": 0.3 },
        { "below": ["{S}_WRIST", "{S}_ELBOW"], "by": 0.05 }
      ] }
    }
  },
  {
    "id": "kae-lom-pakang",
    "name_th": "ท่าแก้ลมปะกัง",
    "name_en": "Migraine",
    "position": "sitting_floor",
    "steps_th": [
      "ท่าเตรียม นั่งขัดสมาธิ ลำตัวตั้งตรง หน้ามองตรง วางมือทั้งสองข้างไว้ที่หน้าขา",
      "มือขวาจับที่คาง โดยปลายคางอยู่บริเวณง่ามมือ และปลายนิ้วชี้ขึ้น",
      "ค่อย ๆ สูดลมหายใจเข้าให้เต็มที่ มือซ้ายวางไว้ที่หน้าผาก นิ้วหัวแม่มืออยู่บริเวณขมับด้านซ้าย ข้อศอกอยู่ในระดับหัวไหล่ ค่อย ๆ ออกแรงนวด คลึง ที่ขมับทั้งสองข้าง พร้อมกับหายใจเข้าลึก ๆ จนท้องป่อง ค่อย ๆ ผ่อนลมหายใจออก แล้วคลายย้อนกลับไปอยู่ในท่าเตรียม",
      "ทำสลับอีกข้างหนึ่ง (ทำสลับซ้าย-ขวานับเป็น 1 รอบ) ทำซ้ำ 3 รอบ"
    ],
    "note_th": "แผ่นไม่ระบุเวลาค้างของท่านี้ แอปจึงนับเป็นจำนวนครั้ง",
    "cautions_th": [],
    "contraindications_th": [],
    "source": { "sheet": 1, "page": 5 },
    "detector": {
      "view": "front",
      "sides": "alternate",
      "first_side": "R",
      "mode": "reps",
      "hold_seconds": 3,
      "units": 6,
      "difficulty": "hard",
      "required": ["NOSE", "L_SHOULDER", "R_SHOULDER", "L_WRIST", "R_WRIST"],
      "in_pose": { "all": [
        { "near": ["{S}_WRIST", "NOSE"], "within": 0.6 },
        { "near": ["{O}_WRIST", "NOSE"], "within": 0.7 },
        { "above": ["{O}_WRIST", "NOSE"], "by": 0.05 }
      ] }
    }
  },
  {
    "id": "kae-puat-thong-sabak-chom",
    "name_th": "แก้ปวดท้อง แก้สะบักจม",
    "name_en": "Abdominal pain & Scapular Discomfort",
    "position": "sitting_floor",
    "steps_th": [
      "ท่าเตรียม นั่งขัดสมาธิ ลำตัวตั้งตรง หน้ามองตรง วางมือทั้งสองข้างไว้ที่หน้าขา",
      "ยกแขนกางออกด้านข้างหงายมือ ให้อยู่ในแนวระดับบ่า",
      "ค่อย ๆ สูดลมหายใจเข้าให้เต็มที่ ยกแขนทั้งสองข้างขึ้นจนข้อศอกอยู่ระดับเดียวกับบ่า สูดลมหายใจเข้าเต็มที่ พร้อมกับแอ่นอก เหยียดมือออกในท่ารำ (กระดกปลายนิ้วมือลงให้มากที่สุดเท่าที่จะทำได้) นิ่งค้างไว้ ประมาณ 10 วินาที โดยไม่กลั้นหายใจ แล้วค่อย ๆ คลายย้อนกลับไปอยู่ในท่าเตรียม",
      "ทำซ้ำ 3 รอบ"
    ],
    "note_th": null,
    "cautions_th": [],
    "contraindications_th": [],
    "source": { "sheet": 1, "page": 6, "also": { "sheet": 2, "page": 2 } },
    "detector": {
      "view": "front",
      "sides": "both",
      "first_side": null,
      "mode": "hold",
      "hold_seconds": 10,
      "units": 3,
      "difficulty": "easy",
      "required": ["L_SHOULDER", "R_SHOULDER", "L_ELBOW", "R_ELBOW", "L_WRIST", "R_WRIST"],
      "in_pose": { "all": [
        { "above": ["L_WRIST", "L_SHOULDER"], "by": 0.3 },
        { "above": ["R_WRIST", "R_SHOULDER"], "by": 0.3 },
        { "above": ["L_ELBOW", "L_SHOULDER"], "by": -0.2 },
        { "above": ["R_ELBOW", "R_SHOULDER"], "by": -0.2 }
      ] }
    }
  },
  {
    "id": "kae-sabak-na-chom",
    "name_th": "ท่าแก้สะบักหน้าจม",
    "name_en": "Scapular & Shoulder Discomfort",
    "position": "kneeling",
    "steps_th": [
      "ท่าเตรียม นั่งคุกเข่าปลายเท้าราบไปทางด้านหลัง หน้ามองตรง วางมือทั้งสองข้างไว้ที่หน้าขาบริเวณ หัวเข่า",
      "เอื้อมมือทั้งสองข้างไปด้านหลัง จับที่หลังเท้าทั้งสองข้างไว้",
      "ค่อย ๆ สูดลมหายใจเข้าให้เต็มที่ แล้วยืดลำตัว แอ่นอก แบะไหล่ ค่อย ๆ ออกแรงดึงเท้าทั้งสองข้างขึ้น พร้อมแหงนหน้าขึ้นให้มากที่สุดเท่าที่จะทำได้ นิ่งค้างไว้ประมาณ 10 วินาที โดยไม่กลั้นหายใจ แล้วค่อย ๆ คลายย้อนกลับไปอยู่ในท่าเตรียม",
      "ทำซ้ำ 3 รอบ"
    ],
    "note_th": null,
    "cautions_th": ["ผู้ที่มีอาการปวดเข่า"],
    "contraindications_th": [],
    "source": { "sheet": 2, "page": 3 },
    "detector": {
      "view": "front",
      "sides": "both",
      "first_side": null,
      "mode": "hold",
      "hold_seconds": 10,
      "units": 3,
      "difficulty": "hard",
      "required": ["NOSE", "L_EAR", "R_EAR", "L_SHOULDER", "R_SHOULDER", "L_HIP", "R_HIP"],
      "in_pose": { "all": [
        { "above": ["NOSE", "MID_EAR"], "by": 0.02 },
        { "below": ["L_WRIST", "L_HIP"], "by": -0.25 },
        { "below": ["R_WRIST", "R_HIP"], "by": -0.25 }
      ] }
    }
  },
  {
    "id": "kae-salak-lai",
    "name_th": "ท่าแก้สลักไหล่",
    "name_en": "Shoulder Discomfort",
    "position": "standing",
    "steps_th": [
      "ท่าเตรียม ยืนตัวตรง หน้ามองตรง แขนแนบข้างลำตัว",
      "ค่อย ๆ สูดลมหายใจเข้าให้เต็มที่ แล้วมือซ้ายกดเหนี่ยว ที่แนวบ่าด้านหลัง ชิดต้นคอด้านซ้าย ออกแรงดึงโน้มบ่าซ้าย มาด้านหน้า",
      "มือขวาจับข้อศอกซ้าย ออกแรงดึงเข้าหาลำตัว นิ่งค้างไว้ประมาณ 10 วินาที โดยไม่กลั้นหายใจ แล้วค่อย ๆ คลาย ย้อนกลับไปอยู่ในท่าเตรียม",
      "ทำสลับอีกข้างหนึ่ง (ทำสลับซ้าย-ขวานับเป็น 1 รอบ) ทำซ้ำ 3 รอบ"
    ],
    "note_th": "หมายเหตุ : ท่าฤๅษีดัดตนดั้งเดิมเป็นการยืนเท้าแตะพื้นข้างเดียว ทั้งนี้ เพื่อป้องกันผู้ที่มีปัญหาการทรงตัว จึงปรับเป็นยืนเท้าแตะพื้นทั้งสองข้าง",
    "cautions_th": [],
    "contraindications_th": [],
    "source": { "sheet": 2, "page": 4 },
    "detector": {
      "view": "front",
      "sides": "alternate",
      "first_side": "L",
      "mode": "hold",
      "hold_seconds": 10,
      "units": 6,
      "difficulty": "medium",
      "required": ["L_SHOULDER", "R_SHOULDER", "L_ELBOW", "R_ELBOW", "L_WRIST", "R_WRIST"],
      "in_pose": { "all": [
        { "near": ["{S}_WRIST", "{S}_SHOULDER"], "within": 0.5 },
        { "near": ["{O}_WRIST", "{S}_ELBOW"], "within": 0.5 }
      ] }
    }
  },
  {
    "id": "kae-kho-khlet-kae-lai-khat",
    "name_th": "ท่าแก้คอเคล็ด แก้ไหล่ขัด",
    "name_en": "Stiffness of neck & Shoulder",
    "position": "standing",
    "steps_th": [
      "ท่าเตรียม ยืนตัวตรง หน้ามองตรง แขนแนบข้างลำตัว",
      "ยืนแยกขาให้เท้าทั้งสองข้าง อยู่แนวเดียวกับหัวไหล่ แบะปลายเท้าออกไปด้านข้างให้ได้มากที่สุด งอแขนให้ข้อมืออยู่ระดับอก ปลายนิ้วชี้ขึ้น พร้อมกับกระดกข้อมือ และงอนิ้วมือทั้งสองข้าง กางศอกทั้งสองข้างออกข้างลำตัว พร้อมยืดอกขึ้น",
      "ค่อย ๆ สูดลมหายใจเข้าให้เต็มที่ แล้วย่อตัวให้ได้มากที่สุดเท่าที่จะทำได้ พร้อมกับค่อย ๆ ออกแรงกด ที่สันมือทั้งสองข้าง ลงที่เหนือยอดอก ประมาณ 10 วินาที โดยไม่กลั้นหายใจ แล้วค่อย ๆ คลาย ย้อนกลับไปอยู่ในท่าเตรียม",
      "ทำซ้ำ 3 รอบ"
    ],
    "note_th": null,
    "cautions_th": ["ผู้ที่มีปัญหาการทรงตัว"],
    "contraindications_th": [],
    "source": { "sheet": 2, "page": 5 },
    "detector": {
      "view": "front",
      "sides": "both",
      "first_side": null,
      "mode": "hold",
      "hold_seconds": 10,
      "units": 3,
      "difficulty": "medium",
      "required": ["L_SHOULDER", "R_SHOULDER", "L_ELBOW", "R_ELBOW", "L_WRIST", "R_WRIST", "L_HIP", "R_HIP"],
      "in_pose": { "all": [
        { "drop": ["MID_HIP"], "by": 0.2 },
        { "between": ["MID_WRIST", "MID_SHOULDER", "MID_HIP"] },
        { "xdist": ["L_ELBOW", "R_ELBOW"], "gte": 0.9 }
      ] }
    }
  },
  {
    "id": "kae-lom-nai-ok-nai-eo",
    "name_th": "ท่าแก้ลมในอก ในเอว",
    "name_en": "Chest & Low back pain",
    "position": "standing",
    "steps_th": [
      "ท่าเตรียม ยืนตัวตรง หน้ามองตรง แขนแนบข้างลำตัว",
      "ก้าวเท้าขวาไปด้านหน้าหนึ่งก้าว โน้มตัวไปด้านหน้าเล็กน้อย แล้วยกเปิดส้นเท้าซ้ายขึ้น",
      "ยื่นแขนขวาออกไปข้างหน้า งอข้อศอกเล็กน้อย หงายฝ่ามือขึ้นอยู่ระดับศีรษะ กระดกข้อมือขวา ให้ปลายนิ้วชี้ลง",
      "มือซ้ายวางสันมือไว้ที่เอว ฝ่ามือแนบกับสีข้าง นิ้วมือชี้ขึ้น ค่อย ๆ ย่อเข่าทั้งสองข้าง เปิดส้นเท้าข้างซ้าย ค่อย ๆ สูดลมหายใจเข้าให้เต็มที่ บิดลำตัวไปทางซ้ายให้ได้มากที่สุดเท่าที่จะทำได้ แอ่นอก แหงนหน้าขึ้นเล็กน้อย นิ่งค้างไว้ประมาณ 10 วินาที โดยไม่กลั้นหายใจ แล้วค่อย ๆ คลายย้อนกลับไปอยู่ในท่าเตรียม",
      "ทำสลับอีกข้างหนึ่ง (ทำสลับซ้าย-ขวานับเป็น 1 รอบ) ทำซ้ำ 3 รอบ"
    ],
    "note_th": null,
    "cautions_th": ["ผู้ที่มีปัญหาการทรงตัว"],
    "contraindications_th": [],
    "source": { "sheet": 2, "page": 6 },
    "detector": {
      "view": "side",
      "sides": "alternate",
      "first_side": "R",
      "mode": "hold",
      "hold_seconds": 10,
      "units": 6,
      "difficulty": "hard",
      "required": ["NOSE", "L_WRIST", "R_WRIST", "L_HIP", "R_HIP", "L_ANKLE", "R_ANKLE"],
      "in_pose": { "all": [
        { "any": [
          { "above": ["L_WRIST", "NOSE"], "by": -0.15 },
          { "above": ["R_WRIST", "NOSE"], "by": -0.15 }
        ] },
        { "xdist": ["L_ANKLE", "R_ANKLE"], "gte": 0.5 },
        { "drop": ["MID_HIP"], "by": 0.08 }
      ] }
    }
  },
  {
    "id": "kae-khao-khat",
    "name_th": "ท่าแก้เข่าขัด",
    "name_en": "Knee trouble",
    "position": "sitting_floor",
    "steps_th": [
      "ท่าเตรียม นั่งขัดสมาธิ ลำตัวตรง หน้ามองตรง วางมือทั้งสองข้างไว้ที่หน้าขา",
      "นั่งเหยียดเท้าทั้งสองข้าง ไปทางด้านหน้า มือทั้งสองข้าง วางไว้ที่ต้นขา ค่อย ๆ สูดลมหายใจ เข้าให้เต็มที่ แอ่นอก แหงนหน้าขึ้น กระดกข้อเท้าทั้งสองข้างขึ้น ให้ได้มากที่สุดเท่าที่จะทำได้",
      "มือทั้งสองข้างนวดไล่จากต้นขา ไปจนถึงเข่า กดนวดรอบ ๆ หัวเข่า ประมาณ 10 วินาที โดยไม่กลั้นหายใจ แล้วค่อย ๆ คลายย้อนกลับ ไปอยู่ในท่าเตรียม ทำซ้ำ 3 รอบ"
    ],
    "note_th": null,
    "cautions_th": [
      "ไม่ควรกดรอบหัวเข่าแรงเกินไปโดยเฉพาะในผู้ที่มีอาการบวมอักเสบ",
      "ควรรักษาระดับหลังให้ตรง หลีกเลี่ยงการงอหลังส่วนเอว"
    ],
    "contraindications_th": [
      "ผู้ที่มีข้อเข่าอักเสบเฉียบพลัน หรือมีน้ำในข้อจำนวนมาก หรือเอ็นเข่าฉีกขาดระยะยังไม่ฟื้นตัว",
      "ผู้ที่มีการบาดเจ็บเฉียบพลันของกล้ามเนื้อน่องหรือเอ็นร้อยหวาย",
      "ผู้ที่เพิ่งผ่าตัดข้อเข่าและยังไม่ผ่านการฟื้นฟูอย่างเหมาะสม"
    ],
    "source": { "sheet": 6, "page": 2 },
    "detector": {
      "view": "side",
      "sides": "visible",
      "first_side": null,
      "mode": "hold",
      "hold_seconds": 10,
      "units": 3,
      "difficulty": "medium",
      "required": ["{V}_HIP", "{V}_KNEE", "{V}_ANKLE", "{V}_WRIST"],
      "in_pose": { "all": [
        { "angle": ["{V}_HIP", "{V}_KNEE", "{V}_ANKLE"], "gte": 145 },
        { "level": ["{V}_HIP", "{V}_ANKLE"], "within": 0.45 },
        { "proj": ["{V}_WRIST", "{V}_HIP", "{V}_KNEE"], "min": 0.2, "max": 1.2 }
      ] }
    }
  },
  {
    "id": "kae-klon",
    "name_th": "ท่าแก้กล่อน",
    "name_en": "Low abdominal pain & Scrotal distention",
    "position": "sitting_floor",
    "steps_th": [
      "ท่าเตรียม นั่งขัดสมาธิ ลำตัวตรง หน้ามองตรง วางมือทั้งสองข้างไว้ที่หน้าขา",
      "นั่งเหยียดเท้าทั้งสองข้างไปทางด้านหน้า มือทั้งสองข้างวางไว้ที่ต้นขา",
      "ค่อย ๆ สูดลมหายใจเข้าให้เต็มที่ แล้วโน้มตัวยื่นแขนไปทางด้านหน้า จนถึงข้อเท้าทั้งสองข้าง กระดกฝ่าเท้าขึ้น เลื่อนมือทั้งสองข้างไปจับปลายฝ่าเท้า (บริเวณนิ้วเท้า) ค่อยๆ เชิดหน้าขึ้น นิ่งค้างไว้ประมาณ 10 วินาที โดยไม่กลั้นหายใจ แล้วค่อย ๆ คลายย้อนกลับไปอยู่ในท่าเตรียม ทำซ้ำ 3 รอบ"
    ],
    "note_th": null,
    "cautions_th": [
      "หากไม่สามารถยื่นแขนไปด้านหน้าจับปลายฝ่าเท้าได้ ให้ทำในระดับที่สามารถทำได้ เพื่อไม่ให้เกิดการงอหลังส่วนเอวมากเกินไป หลีกเลี่ยงแรงกดต่อหมอนรองกระดูกสันหลังและเกิดอาการปวดตึงรุนแรง"
    ],
    "contraindications_th": [
      "ผู้ที่มีหมอนรองกระดูกสันหลังส่วนเอวเคลื่อนในระยะเฉียบพลัน",
      "ผู้ที่มีอาการปวดร้าวลงขาจากการกดทับเส้นประสาท sciatic อย่างชัดเจน",
      "ผู้ที่มีอาการกล้ามเนื้อหลังอักเสบเฉียบพลัน หรือมีภาวะเอ็นร้อยหวายฉีกขาด"
    ],
    "source": { "sheet": 6, "page": 3 },
    "detector": {
      "view": "side",
      "sides": "visible",
      "first_side": null,
      "mode": "hold",
      "hold_seconds": 10,
      "units": 3,
      "difficulty": "medium",
      "required": ["{V}_HIP", "{V}_KNEE", "{V}_ANKLE", "{V}_WRIST"],
      "in_pose": { "all": [
        { "angle": ["{V}_HIP", "{V}_KNEE", "{V}_ANKLE"], "gte": 135 },
        { "level": ["{V}_HIP", "{V}_ANKLE"], "within": 0.45 },
        { "proj": ["{V}_WRIST", "{V}_HIP", "{V}_ANKLE"], "min": 0.75, "max": 1.4 }
      ] }
    }
  },
  {
    "id": "kae-khao-kae-kha",
    "name_th": "ท่าแก้เข่า แก้ขา",
    "name_en": "Knee & Leg Trouble",
    "position": "standing",
    "steps_th": [
      "ท่าเตรียม ยืนตัวตรง หน้ามองตรง แขนแนบข้างลำตัว",
      "ก้าวเท้าขวาไปด้านหน้าหนึ่งก้าว โน้มตัวไปด้านหน้าเล็กน้อย แล้วยกเปิดส้นเท้าซ้ายขึ้น",
      "มือข้างซ้ายวางไว้บริเวณสะโพกซ้าย โดยปลายนิ้วชี้ลงพื้น และมือข้างขวาวางบริเวณหน้าขา",
      "ค่อย ๆ สูดลมหายใจเข้าให้เต็มที่ แล้วย่อเข่าทั้งสองข้าง บิดลำตัว และหันหน้าไปทางซ้ายให้ได้มากที่สุดเท่าที่จะทำได้ นิ่งค้างไว้ประมาณ 10 วินาที โดยไม่กลั้นหายใจ แล้วค่อย ๆ คลายย้อนกลับ ไปอยู่ในท่าเตรียม",
      "ทำสลับอีกข้างหนึ่ง (ทำสลับซ้าย-ขวานับเป็น 1 รอบ) ทำซ้ำ 3 รอบ"
    ],
    "note_th": null,
    "cautions_th": [
      "ควบคุมการหมุนลำตัวไม่ให้เกิดแรงบิดเกินไป",
      "หลีกเลี่ยงการย่อลึกเกินกำลังในผู้ที่มีกล้ามเนื้อสะโพกอ่อนแรง"
    ],
    "contraindications_th": [
      "ผู้ที่มีข้อเข่าเสื่อมระยะปวดรุนแรง",
      "ผู้ที่มีหมอนรองกระดูกสันหลังส่วนเอวเคลื่อนในระยะเฉียบพลัน",
      "ผู้ที่มีภาวะข้อสะโพกเสื่อมรุนแรง",
      "ผู้ที่มีความผิดปกติของการทรงตัวหรือโรคทางระบบประสาทที่ควบคุมการยืนไม่ได้"
    ],
    "source": { "sheet": 6, "page": 4 },
    "detector": {
      "view": "side",
      "sides": "alternate",
      "first_side": "R",
      "mode": "hold",
      "hold_seconds": 10,
      "units": 6,
      "difficulty": "hard",
      "required": ["L_HIP", "R_HIP", "L_KNEE", "R_KNEE", "L_ANKLE", "R_ANKLE"],
      "in_pose": { "all": [
        { "xdist": ["L_ANKLE", "R_ANKLE"], "gte": 0.6 },
        { "drop": ["MID_HIP"], "by": 0.1 },
        { "any": [
          { "angle": ["L_HIP", "L_KNEE", "L_ANKLE"], "lte": 160 },
          { "angle": ["R_HIP", "R_KNEE", "R_ANKLE"], "lte": 160 }
        ] }
      ] }
    }
  },
  {
    "id": "damrong-kai-ayu-yuen",
    "name_th": "ท่าดำรงกายอายุยืน",
    "name_en": "For longevity",
    "position": "standing",
    "steps_th": [
      "ท่าเตรียม ยืนตัวตรง หน้ามองตรง แขนแนบข้างลำตัว",
      "แยกขาให้เท้าทั้งสองข้าง อยู่ในแนวเดียวกับหัวไหล่ แบะปลายเท้าออกไปด้านข้าง ให้ได้มากที่สุดเท่าที่จะทำได้",
      "กำมือขวาขึ้นไว้ระดับหน้าอก ห่างจากลำตัวประมาณ 1 ฝ่ามือ แล้วกำมือซ้ายยกขึ้นซ้อนไว้ใต้มือขวา",
      "ค่อย ๆ สูดลมหายใจเข้าเต็มที่ แล้วย่อขาลงพอประมาณ เปิดแบะหัวเข่าออกด้านข้าง หลังตรง หน้ามองตรง พร้อมทั้งออกแรงที่มือทั้งสองข้างกำกดต้านกันไว้ นิ่งค้างไว้ประมาณ 10 วินาที โดยไม่กลั้นหายใจ แล้วค่อย ๆ คลายย้อนกลับไปอยู่ในท่าเตรียม ทำซ้ำ 3 รอบ"
    ],
    "note_th": null,
    "cautions_th": [
      "ผู้ที่มีข้อเข่าเสื่อม ค่อย ๆ เพิ่มระดับการย่อลง",
      "ไม่ควรย่อลึกเกินกำลังโดยเฉพาะในผู้ที่มีกล้ามเนื้อสะโพกอ่อนแรง",
      "ควรเหยียดหลังให้ตรง แต่ไม่ควรแอ่นหลังมากเกินไป"
    ],
    "contraindications_th": [
      "ผู้ที่มีเอ็นเข่าฉีกขาดหรือข้อเข่าเสื่อมระยะปวดมาก",
      "ผู้ที่มีภาวะข้อสะโพกเสื่อมระดับรุนแรง หรือความผิดปกติของกระดูกบริเวณข้อสะโพก",
      "ผู้ที่เพิ่งผ่าตัดข้อสะโพกหรือข้อเข่า",
      "ผู้ที่มีหมอนรองกระดูกสันหลังส่วนเอวเคลื่อนในระยะเฉียบพลัน",
      "ผู้ที่มีภาวะความดันโลหิตสูงที่ควบคุมไม่ได้หรือโรคหัวใจที่ยังมีอาการ"
    ],
    "source": { "sheet": 6, "page": 5 },
    "detector": {
      "view": "front",
      "sides": "both",
      "first_side": null,
      "mode": "hold",
      "hold_seconds": 10,
      "units": 3,
      "difficulty": "easy",
      "required": ["L_SHOULDER", "R_SHOULDER", "L_WRIST", "R_WRIST", "L_HIP", "R_HIP", "L_ANKLE", "R_ANKLE"],
      "in_pose": { "all": [
        { "xdist": ["L_ANKLE", "R_ANKLE"], "gte": 0.8 },
        { "drop": ["MID_HIP"], "by": 0.15 },
        { "near": ["L_WRIST", "R_WRIST"], "within": 0.45 },
        { "between": ["MID_WRIST", "MID_SHOULDER", "MID_HIP"] }
      ] }
    }
  }
]
```

`content/groups.json`:

```json
{
  "series_title_th": "ยืดเหยียด...ดัดตน...พ้นโรค ด้วยท่าฤๅษีดัดตน",
  "publisher_th": "กรมการแพทย์แผนไทยและการแพทย์ทางเลือก",
  "year_be": 2569,
  "sheets": {
    "1": { "title_th": "กลุ่มกล้ามเนื้อและพังผืด (Office syndrome)", "url": "https://www.dtam.moph.go.th/dtam-dl/46988/" },
    "2": { "title_th": "กลุ่มหัวไหล่ติด", "url": "https://www.dtam.moph.go.th/dtam-dl/46997/" },
    "3": { "title_th": "กลุ่มนิ้วล็อค (Trigger Finger)", "url": "https://www.dtam.moph.go.th/news-release/47271/" },
    "4": { "title_th": "กลุ่มอาการปวดหลัง และกลุ่มหมอนรองกระดูกทับเส้นประสาท", "url": "https://www.dtam.moph.go.th/news-release/48207/" },
    "5": { "title_th": "กลุ่มกล้ามเนื้อสะโพกหนีบเส้นประสาท (Piriformis Syndrome)", "url": "https://www.dtam.moph.go.th/news-release/48813/" },
    "6": { "title_th": "กลุ่มเข่าเสื่อม (Knee Osteoarthritis)", "url": "https://www.dtam.moph.go.th/news-release/49037/" },
    "7": { "title_th": "กลุ่มอัมพฤกษ์/อัมพาต (Stroke)", "url": "https://www.dtam.moph.go.th/news-release/49296/" }
  },
  "groups": [
    {
      "id": "office",
      "name_th": "ออฟฟิศซินโดรม",
      "sheet": 1,
      "active": true,
      "posture_ids": ["kae-kiat", "kae-lom-puat-sisa", "kae-lom-wian-sisa", "kae-lom-pakang", "kae-puat-thong-sabak-chom"]
    },
    {
      "id": "shoulder",
      "name_th": "หัวไหล่ติด",
      "sheet": 2,
      "active": true,
      "posture_ids": ["kae-puat-thong-sabak-chom", "kae-sabak-na-chom", "kae-salak-lai", "kae-kho-khlet-kae-lai-khat", "kae-lom-nai-ok-nai-eo"]
    },
    {
      "id": "knee",
      "name_th": "เข่าเสื่อม",
      "sheet": 6,
      "active": true,
      "posture_ids": ["kae-khao-khat", "kae-klon", "kae-khao-kae-kha", "damrong-kai-ayu-yuen"]
    },
    { "id": "trigger-finger", "name_th": "นิ้วล็อค", "sheet": 3, "active": false, "posture_ids": [] },
    { "id": "low-back", "name_th": "ปวดหลัง / หมอนรองกระดูกทับเส้นประสาท", "sheet": 4, "active": false, "posture_ids": [] },
    { "id": "piriformis", "name_th": "สะโพกหนีบเส้นประสาท", "sheet": 5, "active": false, "posture_ids": [] },
    { "id": "stroke", "name_th": "อัมพฤกษ์ / อัมพาต", "sheet": 7, "active": false, "posture_ids": [] }
  ]
}
```

`content/redflags.json`:

```json
{
  "label_th": "ร่างโดยทีมจากเอกสารกรมฯ รอผู้ประกอบวิชาชีพรับรอง",
  "rules": [
    {
      "id": "RF01",
      "level": "call_1669",
      "ask_at": ["pre", "during"],
      "postures": null,
      "question_th": "ตอนนี้มีอาการเหล่านี้ที่เพิ่งเกิดขึ้นทันทีไหม: หน้าเบี้ยว ปากเบี้ยว แขนหรือขาข้างใดข้างหนึ่งอ่อนแรงหรือชา พูดไม่ชัด มองไม่เห็นหรือเห็นภาพซ้อน วิงเวียน บ้านหมุน หรือเดินเซจนทรงตัวไม่อยู่",
      "trigger": { "type": "yes" },
      "patient_message_th": "หยุดทำท่าทันที นั่งหรือนอนพักในที่ปลอดภัย แล้วโทร 1669 เดี๋ยวนี้ อย่ารอให้หายเอง จำเวลาที่เริ่มมีอาการไว้บอกเจ้าหน้าที่",
      "source_th": "แนวทางเวชปฏิบัติการดูแลผู้ป่วยระยะกลางด้วยการแพทย์แผนไทย (กรมฯ 2564) หน้าพิมพ์ 41–42; กรมควบคุมโรค สัญญาณเตือนโรคหลอดเลือดสมอง",
      "strength": "derived",
      "clinic_adjustable": false
    },
    {
      "id": "RF02",
      "level": "call_1669",
      "ask_at": ["pre"],
      "postures": null,
      "question_th": "ตอนนี้เจ็บหรือแน่นหน้าอก หายใจไม่ทันหรือหอบเหนื่อยผิดปกติ ใจสั่นเต้นไม่เป็นจังหวะ หรือหน้าซีด ปากเขียว ไหม",
      "trigger": { "type": "yes" },
      "patient_message_th": "หยุดทำท่าทันที นั่งพักอยู่กับที่ แล้วโทร 1669 เดี๋ยวนี้ และรอเจ้าหน้าที่มาช่วย",
      "source_th": "แนวทางเวชปฏิบัติการดูแลผู้ป่วยระยะกลางด้วยการแพทย์แผนไทย (กรมฯ 2564) หน้าพิมพ์ 42",
      "strength": "derived",
      "clinic_adjustable": false
    },
    {
      "id": "RF16",
      "level": "call_1669",
      "ask_at": ["pre", "post"],
      "postures": null,
      "question_th": "ตอนนี้ปวดศีรษะรุนแรงขึ้นมาทันที หรือปวดแบบที่ไม่เคยเป็นมาก่อน หรือมีคอแข็ง อาเจียนพุ่งร่วมด้วยไหม",
      "trigger": { "type": "yes" },
      "patient_message_th": "หยุดทำท่าทันที นอนพักในที่ปลอดภัย แล้วโทร 1669 เดี๋ยวนี้",
      "source_th": "แนวทางเวชปฏิบัติการดูแลผู้ป่วยระยะกลางด้วยการแพทย์แผนไทย (กรมฯ 2564) หน้าพิมพ์ 42 และ 23",
      "strength": "derived",
      "clinic_adjustable": false
    },
    {
      "id": "RF03",
      "level": "call_1669",
      "ask_at": ["post"],
      "postures": null,
      "question_th": "ผู้ป่วยเป็นลม หมดสติ ชัก หรือซึมลง สับสน พูดไม่รู้เรื่อง ไหม (ให้ญาติช่วยตอบได้)",
      "trigger": { "type": "yes" },
      "patient_message_th": "ญาติโทร 1669 ทันที ให้ผู้ป่วยนอนในที่ปลอดภัย และห้ามให้ทำท่าต่อ",
      "source_th": "CPG_PCU หน้าพิมพ์ 138 ข้อ 4.1",
      "strength": "derived",
      "clinic_adjustable": false
    },
    {
      "id": "RF04",
      "level": "stop_and_contact_clinic",
      "ask_at": ["during"],
      "postures": null,
      "question_th": "ระหว่างทำท่า มีอาการปวดแปล๊บ หรือปวดเสียวขึ้นมาทันทีไหม",
      "trigger": { "type": "yes" },
      "patient_message_th": "หยุดท่านี้ทันที ค่อย ๆ คลายกลับท่าพัก วันนี้ไม่ต้องทำท่านี้อีก แล้วแจ้งคลินิกให้หมอดูก่อนทำต่อ",
      "source_th": "CPG_PCU หน้าพิมพ์ 152 คำแนะนำการปฏิบัติตัวของผู้ป่วย",
      "strength": "stated",
      "clinic_adjustable": false
    },
    {
      "id": "RF05",
      "level": "stop_and_contact_clinic",
      "ask_at": ["pre"],
      "postures": null,
      "question_th": "ข้อที่ปวด เช่น เข่าหรือไหล่ บวมขึ้น แดง หรือจับแล้วร้อนกว่าข้างที่ดี มากกว่าตอนที่ไปหาหมอไหม",
      "trigger": { "type": "yes" },
      "patient_message_th": "งดท่าที่ต้องใช้ข้อนั้นไว้ก่อน ห้ามกดหรือนวดตรงที่บวม รวมถึงขั้นกดนวดรอบหัวเข่าในท่าแก้เข่าขัด แล้วแจ้งคลินิก",
      "source_th": "CPG_PCU หน้าพิมพ์ 152 ข้อห้ามการยืดกล้ามเนื้อ",
      "strength": "derived",
      "clinic_adjustable": false
    },
    {
      "id": "RF06",
      "level": "stop_and_contact_clinic",
      "ask_at": ["pre"],
      "postures": null,
      "question_th": "วันนี้มีไข้ ตัวร้อน หรือหนาวสั่นไหม (ถ้ามีปรอทวัดไข้ วัดได้ 38 องศาขึ้นไปไหม)",
      "trigger": { "type": "yes" },
      "patient_message_th": "วันนี้งดทำท่าทั้งหมดและพักผ่อน แล้วแจ้งคลินิก ถ้าข้อบวม แดง ร้อนด้วย ให้แจ้งเร็วที่สุด",
      "source_th": "CPG_PCU หน้าพิมพ์ 138 ข้อ 4.2",
      "strength": "derived",
      "clinic_adjustable": false
    },
    {
      "id": "RF14",
      "level": "stop_and_contact_clinic",
      "ask_at": ["pre"],
      "postures": null,
      "question_th": "ใน 2 วันที่ผ่านมา หกล้ม มีอุบัติเหตุ หรือบาดเจ็บใหม่ไหม",
      "trigger": { "type": "yes" },
      "patient_message_th": "งดทำท่าทั้งหมดไว้ก่อน แล้วแจ้งคลินิกให้หมอตรวจก่อนทำต่อ",
      "source_th": "CPG_PCU หน้าพิมพ์ 138 ข้อ 3.3",
      "strength": "derived",
      "clinic_adjustable": false
    },
    {
      "id": "RF15",
      "level": "stop_and_contact_clinic",
      "ask_at": ["pre"],
      "postures": null,
      "question_th": "ขาข้างหนึ่งบวมกว่าอีกข้างจนเห็นได้ชัดไหม เช่น น่องหรือข้อเท้าบวมข้างเดียว",
      "trigger": { "type": "yes" },
      "patient_message_th": "งดท่าที่ใช้ขาไว้ก่อน ห้ามนวดหรือบีบขาข้างที่บวม แล้วแจ้งคลินิกวันนี้ ถ้าเจ็บหน้าอกหรือหายใจไม่ทันด้วย ให้โทร 1669",
      "source_th": "แนวทางเวชปฏิบัติการดูแลผู้ป่วยระยะกลางด้วยการแพทย์แผนไทย (กรมฯ 2564) หน้าพิมพ์ 42",
      "strength": "derived",
      "clinic_adjustable": false
    },
    {
      "id": "RF07",
      "level": "stop_and_contact_clinic",
      "ask_at": [],
      "postures": null,
      "question_th": "ระดับปวด 8 ขึ้นไป (ปวดมากจนทำกิจวัตรประจำวันเองไม่ได้)",
      "trigger": { "type": "pain_gte", "value": 8 },
      "patient_message_th": "งดทำท่าไว้ก่อน แล้วแจ้งคลินิกวันนี้หรือพรุ่งนี้ ให้หมอดูอาการ",
      "source_th": "CPG_PCU หน้าพิมพ์ 138 ข้อ 4.4",
      "strength": "derived",
      "clinic_adjustable": false
    },
    {
      "id": "RF13",
      "level": "stop_and_contact_clinic",
      "ask_at": ["post"],
      "postures": null,
      "question_th": "ตอนก้มตัว บิดตัว หรือหลังทำท่า มีอาการปวดร้าวลงขาหรือแขน ชา หรือเหมือนเข็มทิ่มตามขาหรือแขน ที่เกิดใหม่หรือมากขึ้นไหม",
      "trigger": { "type": "yes" },
      "patient_message_th": "หยุดท่าก้มและท่าบิดตัวไว้ก่อน แล้วแจ้งคลินิกให้หมอตรวจ ถ้าแขนหรือขาอ่อนแรงขึ้นมาทันที ให้โทร 1669",
      "source_th": "แผ่นท่าชุดที่ 6 หน้า 3 (ข้อห้าม) และชุดที่ 1 หน้า 2",
      "strength": "derived",
      "clinic_adjustable": false
    },
    {
      "id": "RF08",
      "level": "pause_posture",
      "ask_at": [],
      "postures": null,
      "question_th": "ระดับปวดหลังทำ เพิ่มจากก่อนทำตั้งแต่ 3 ระดับ",
      "trigger": { "type": "pain_delta_gte", "value": 3 },
      "patient_message_th": "วันนี้พอแค่นี้ก่อน ท่าที่เหลือไม่ต้องทำ พักให้หาย ถ้าพรุ่งนี้เช้ายังปวดมากกว่าเดิม ให้แจ้งคลินิก ครั้งหน้าทำแค่พอรู้สึกตึง ไม่ต้องฝืนจนเจ็บ",
      "source_th": "ทีมเสนอ อิงหลักการยืดกล้ามเนื้อโดยไม่เจ็บ CPG_PCU หน้าพิมพ์ 152",
      "strength": "team",
      "clinic_adjustable": true
    },
    {
      "id": "RF10",
      "level": "pause_posture",
      "ask_at": ["during"],
      "postures": null,
      "question_th": "ตอนหันหน้า เบือนหน้า หรือแหงนหน้า มีอาการเวียนหัว บ้านหมุน หรือชาเสียวร้าวลงแขนไหม",
      "trigger": { "type": "yes" },
      "patient_message_th": "หยุดท่านั้น ค่อย ๆ หันหน้ากลับมาตรง นั่งพักจนหาย ข้ามท่านี้ไปก่อนจนกว่าหมอจะบอกให้ทำต่อ ถ้าเวียนหัวไม่หาย หรือหน้าเบี้ยว แขนขาอ่อนแรง พูดไม่ชัด ให้โทร 1669",
      "source_th": "แผ่นท่าชุดที่ 1 หน้า 4 ข้อควรระวัง",
      "strength": "derived",
      "clinic_adjustable": true
    },
    {
      "id": "RF11",
      "level": "pause_posture",
      "ask_at": ["during"],
      "postures": null,
      "question_th": "ตอนยืนทำท่า รู้สึกเซ ยืนไม่มั่นคง หรือเกือบล้มไหม",
      "trigger": { "type": "yes" },
      "patient_message_th": "หยุดท่ายืนทันที แล้วนั่งพักบนเก้าอี้ที่มั่นคง ข้ามท่ายืนไปก่อน ทำเฉพาะท่านั่ง แล้วบอกหมอครั้งหน้า ถ้าล้มไปแล้ว ให้แจ้งคลินิก",
      "source_th": "แผ่นท่าชุดที่ 2 หน้า 4–6 ข้อควรระวัง",
      "strength": "derived",
      "clinic_adjustable": true
    },
    {
      "id": "RF12",
      "level": "pause_posture",
      "ask_at": ["before_posture"],
      "postures": ["kae-sabak-na-chom"],
      "question_th": "ตอนนั่งคุกเข่า ปวดเข่าไหม",
      "trigger": { "type": "yes" },
      "patient_message_th": "ข้ามท่าแก้สะบักหน้าจมไปก่อน ไม่ต้องฝืนคุกเข่า แล้วถามหมอครั้งหน้าว่าควรใช้ท่าอื่นแทนไหม",
      "source_th": "แผ่นท่าชุดที่ 2 หน้า 3 ข้อควรระวัง",
      "strength": "derived",
      "clinic_adjustable": true
    },
    {
      "id": "RF09",
      "level": "note_for_next_visit",
      "ask_at": ["post"],
      "postures": null,
      "question_th": "หลังทำท่า รู้สึกตึง ๆ หรือเมื่อย ๆ กล้ามเนื้อเล็กน้อยไหม",
      "trigger": { "type": "yes_and_pain_delta_lte", "value": 2 },
      "patient_message_th": "ตึงหรือเมื่อยเล็กน้อยหลังยืดเหยียดเป็นเรื่องที่พบได้ ไม่ใช่อาการอันตราย ทำต่อได้ตามปกติ แอปจะบันทึกไว้ให้หมอดูครั้งหน้า ถ้าเมื่อยมากขึ้นเรื่อย ๆ หรือ 3 วันแล้วยังไม่ดีขึ้น ให้แจ้งคลินิก",
      "source_th": "CPG_PCU หน้าพิมพ์ 151",
      "strength": "derived",
      "clinic_adjustable": true
    }
  ]
}
```

- [ ] **Step 4: สคีมาและตัวโหลด**

`lib/content/schema.ts`:

```ts
import { z } from "zod";

/** Point names a rule may use. {S}/{O}/{V} are replaced per side at run time (lib/pose/rules.ts). */
export const PointName = z.string().regex(/^(\{S\}|\{O\}|\{V\}|L|R|MID)?_?[A-Z_]+$/);

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { angle: [string, string, string]; gte?: number; lte?: number }
  | { above: [string, string]; by: number }
  | { below: [string, string]; by: number }
  | { near: [string, string]; within: number }
  | { level: [string, string]; within: number }
  | { xdist: [string, string]; gte?: number; lte?: number }
  | { toward: [string, string]; by: number }
  | { drop: [string]; by: number }
  | { between: [string, string, string] }
  | { proj: [string, string, string]; min: number; max: number };

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(ConditionSchema).min(1) }).strict(),
    z.object({ any: z.array(ConditionSchema).min(1) }).strict(),
    z.object({ not: ConditionSchema }).strict(),
    z.object({ angle: z.tuple([PointName, PointName, PointName]), gte: z.number().optional(), lte: z.number().optional() }).strict(),
    z.object({ above: z.tuple([PointName, PointName]), by: z.number() }).strict(),
    z.object({ below: z.tuple([PointName, PointName]), by: z.number() }).strict(),
    z.object({ near: z.tuple([PointName, PointName]), within: z.number().positive() }).strict(),
    z.object({ level: z.tuple([PointName, PointName]), within: z.number().positive() }).strict(),
    z.object({ xdist: z.tuple([PointName, PointName]), gte: z.number().optional(), lte: z.number().optional() }).strict(),
    z.object({ toward: z.tuple([PointName, z.enum(["{S}", "{O}", "L", "R"])]), by: z.number() }).strict(),
    z.object({ drop: z.tuple([PointName]), by: z.number() }).strict(),
    z.object({ between: z.tuple([PointName, PointName, PointName]) }).strict(),
    z.object({ proj: z.tuple([PointName, PointName, PointName]), min: z.number(), max: z.number() }).strict(),
  ]),
);

export const DetectorSchema = z.object({
  view: z.enum(["front", "side"]),
  sides: z.enum(["both", "alternate", "visible"]),
  first_side: z.enum(["L", "R"]).nullable(),
  mode: z.enum(["hold", "reps"]),
  hold_seconds: z.number().positive(),
  units: z.number().int().positive(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  required: z.array(PointName).min(1),
  in_pose: ConditionSchema,
});

export const PostureSchema = z.object({
  id: z.string().regex(/^[a-z-]+$/),
  name_th: z.string().min(1),
  name_en: z.string().min(1),
  position: z.enum(["sitting_floor", "standing", "kneeling"]),
  steps_th: z.array(z.string().min(1)).min(1),
  note_th: z.string().nullable(),
  cautions_th: z.array(z.string()),
  contraindications_th: z.array(z.string()),
  source: z.object({
    sheet: z.number().int(),
    page: z.number().int(),
    also: z.object({ sheet: z.number().int(), page: z.number().int() }).optional(),
  }),
  detector: DetectorSchema,
});

export const GroupsFileSchema = z.object({
  series_title_th: z.string(),
  publisher_th: z.string(),
  year_be: z.number().int(),
  sheets: z.record(z.string(), z.object({ title_th: z.string(), url: z.url() })),
  groups: z.array(
    z.object({
      id: z.string(),
      name_th: z.string(),
      sheet: z.number().int(),
      active: z.boolean(),
      posture_ids: z.array(z.string()),
    }),
  ),
});

export const RedFlagLevel = z.enum(["call_1669", "stop_and_contact_clinic", "pause_posture", "note_for_next_visit"]);

export const RedFlagRuleSchema = z.object({
  id: z.string().regex(/^RF\d{2}$/),
  level: RedFlagLevel,
  ask_at: z.array(z.enum(["pre", "during", "post", "before_posture"])),
  postures: z.array(z.string()).nullable(),
  question_th: z.string().min(1),
  trigger: z.discriminatedUnion("type", [
    z.object({ type: z.literal("yes") }),
    z.object({ type: z.literal("pain_gte"), value: z.number() }),
    z.object({ type: z.literal("pain_delta_gte"), value: z.number() }),
    z.object({ type: z.literal("yes_and_pain_delta_lte"), value: z.number() }),
  ]),
  patient_message_th: z.string().min(1),
  source_th: z.string().min(1),
  strength: z.enum(["stated", "derived", "team"]),
  clinic_adjustable: z.boolean(),
});

export const RedFlagsFileSchema = z.object({ label_th: z.string(), rules: z.array(RedFlagRuleSchema).min(1) });

export type Detector = z.infer<typeof DetectorSchema>;
export type Posture = z.infer<typeof PostureSchema>;
export type GroupsFile = z.infer<typeof GroupsFileSchema>;
export type Group = GroupsFile["groups"][number];
export type RedFlagRule = z.infer<typeof RedFlagRuleSchema>;
export type RedFlagLevel = z.infer<typeof RedFlagLevel>;
```

`lib/content/index.ts`:

```ts
import posturesJson from "@/content/postures.json";
import groupsJson from "@/content/groups.json";
import redflagsJson from "@/content/redflags.json";
import { GroupsFileSchema, PostureSchema, RedFlagsFileSchema, type Group, type Posture, type RedFlagRule } from "./schema";

export const postures: Posture[] = PostureSchema.array().parse(posturesJson);
export const groupsFile = GroupsFileSchema.parse(groupsJson);
export const redflags = RedFlagsFileSchema.parse(redflagsJson);

const postureById = new Map(postures.map((p) => [p.id, p]));

export function getPosture(id: string): Posture {
  const p = postureById.get(id);
  if (!p) throw new Error(`unknown posture ${id}`);
  return p;
}

export function activeGroups(): Group[] {
  return groupsFile.groups.filter((g) => g.active);
}

export function getGroup(id: string): Group {
  const g = groupsFile.groups.find((x) => x.id === id);
  if (!g) throw new Error(`unknown group ${id}`);
  return g;
}

/** Posture ids for the chosen groups, in sheet order, each posture once (kae-puat-thong-sabak-chom is in two sheets). */
export function posturesForGroups(groupIds: string[]): string[] {
  const out: string[] = [];
  for (const gid of groupIds) for (const pid of getGroup(gid).posture_ids) if (!out.includes(pid)) out.push(pid);
  return out;
}

export function sheetUrl(sheet: number): string {
  return groupsFile.sheets[String(sheet)].url;
}

/** "ที่มา: ..." credit line shown under every posture. */
export function creditLine(p: Posture): string {
  const s = groupsFile.sheets[String(p.source.sheet)];
  return `ที่มา: ${groupsFile.series_title_th} ${s.title_th} ${groupsFile.publisher_th} ${groupsFile.year_be} หน้า ${p.source.page}`;
}

export function rulesAskedAt(at: RedFlagRule["ask_at"][number], postureId?: string): RedFlagRule[] {
  return redflags.rules.filter(
    (r) => r.ask_at.includes(at) && (r.postures === null || (postureId !== undefined && r.postures.includes(postureId))),
  );
}
```

- [ ] **Step 5: รันเทสต์ให้ผ่าน**

Run: `npx vitest run tests/content.test.ts`
Expected: PASS 12 tests

- [ ] **Step 6: ภาพแผ่นท่า**

`scripts/make-sheet-images.mjs`:

```js
// Turn the rendered DTAM sheet pages into one WebP per posture: public/postures/<id>.webp
// Source PNGs (rendered at 2000 px wide) live outside the repo: <sources>/the<sheet>/p<page>.png
// Run: node scripts/make-sheet-images.mjs ../research/content/sources
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const sources = path.resolve(root, process.argv[2] ?? "../research/content/sources");
const postures = JSON.parse(readFileSync(path.join(root, "content", "postures.json"), "utf8"));
const out = path.join(root, "public", "postures");
mkdirSync(out, { recursive: true });

for (const p of postures) {
  const src = path.join(sources, `the${p.source.sheet}`, `p${p.source.page}.png`);
  if (!existsSync(src)) throw new Error(`missing ${src}`);
  const dest = path.join(out, `${p.id}.webp`);
  const info = await sharp(src).resize({ width: 1100 }).webp({ quality: 72 }).toFile(dest);
  console.log(`${p.id}.webp ${Math.round(info.size / 1024)} KB`);
}
```

Run: `npm run images`
Expected: 13 บรรทัด เช่น `kae-kiat.webp 127 KB`

- [ ] **Step 7: Commit**

```bash
git add content lib/content scripts/make-sheet-images.mjs public/postures tests/content.test.ts
git commit -m "feat(content): DTAM 2569 postures (verbatim), groups, red-flag rules and sheet images"
```

---

### Task 3: เรขาคณิตและตัวอ่านกฎท่า (DSL)

**Files:**
- Create: `lib/pose/landmarks.ts`, `lib/pose/geometry.ts`, `lib/pose/rules.ts`, `tests/helpers/skeleton.ts`, `tests/helpers/posture-fixtures.ts`, `tests/pose-rules.test.ts`

**Interfaces:**
- Consumes: `Condition`, `Detector` (Task 2)
- Produces: `Frame`, `Side`, `LANDMARK_INDEX`; `point(frame, name)`, `angleDeg`, `projT`, `torsoLength`, `medianFrame(frames)`; `Calibration {U, base}`, `evaluate(cond, {frame, calib, side})`, `requiredVisible(det, frame, side)`, `calibrate(frames)`, `visibleSide(frame)`

หน่วยวัดทุกเกณฑ์คือ U = ความยาวลำตัว (กลางไหล่ถึงกลางสะโพก) ตอนคาลิเบรต จึงไม่ขึ้นกับระยะกล้องหรือขนาดตัว

- [ ] **Step 1: เทสต์และ fixtures**

`tests/helpers/skeleton.ts`:

```ts
import { LANDMARK_INDEX, type Frame, type LandmarkName } from "@/lib/pose/landmarks";

export type Pose = Partial<Record<LandmarkName, [number, number]>>;

/** Build a 1000×1000 px frame; listed points visible (0.99), others invisible. */
export function frame(pose: Pose, t = 0, hidden: LandmarkName[] = [], dim: LandmarkName[] = []): Frame {
  const points = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
  for (const [name, xy] of Object.entries(pose) as [LandmarkName, [number, number]][]) {
    const vis = hidden.includes(name) ? 0.1 : dim.includes(name) ? 0.6 : 0.99;
    points[LANDMARK_INDEX[name]] = { x: xy[0] / 1000, y: xy[1] / 1000, visibility: vis };
  }
  return { t, width: 1000, height: 1000, points };
}

// Person facing the camera. Person's LEFT appears on the image RIGHT (larger x). Torso length U = 250 px.
export const STANDING_FRONT: Pose = {
  NOSE: [500, 150], L_EAR: [530, 140], R_EAR: [470, 140],
  L_SHOULDER: [580, 250], R_SHOULDER: [420, 250],
  L_ELBOW: [600, 370], R_ELBOW: [400, 370],
  L_WRIST: [605, 480], R_WRIST: [395, 480],
  L_HIP: [560, 500], R_HIP: [440, 500],
  L_KNEE: [560, 700], R_KNEE: [440, 700],
  L_ANKLE: [560, 900], R_ANKLE: [440, 900],
};

export const SITTING_FRONT: Pose = {
  NOSE: [500, 350], L_EAR: [530, 340], R_EAR: [470, 340],
  L_SHOULDER: [580, 450], R_SHOULDER: [420, 450],
  L_ELBOW: [620, 580], R_ELBOW: [380, 580],
  L_WRIST: [630, 700], R_WRIST: [370, 700],
  L_HIP: [560, 700], R_HIP: [440, 700],
  L_KNEE: [680, 740], R_KNEE: [320, 740],
  L_ANKLE: [560, 760], R_ANKLE: [440, 760],
};

// Person seen from their left side, facing image right.
export const STANDING_SIDE: Pose = {
  NOSE: [540, 150], L_EAR: [500, 140], R_EAR: [495, 140],
  L_SHOULDER: [505, 250], R_SHOULDER: [495, 250],
  L_ELBOW: [510, 370], R_ELBOW: [500, 370],
  L_WRIST: [515, 480], R_WRIST: [505, 480],
  L_HIP: [505, 500], R_HIP: [495, 500],
  L_KNEE: [505, 700], R_KNEE: [495, 700],
  L_ANKLE: [505, 900], R_ANKLE: [495, 900],
};

export const SITTING_SIDE: Pose = {
  NOSE: [440, 430], L_EAR: [400, 420], R_EAR: [395, 420],
  L_SHOULDER: [400, 450], R_SHOULDER: [395, 450],
  L_ELBOW: [420, 570], R_ELBOW: [415, 570],
  L_WRIST: [500, 690], R_WRIST: [495, 690],
  L_HIP: [400, 700], R_HIP: [395, 700],
  L_KNEE: [520, 720], R_KNEE: [515, 720],
  L_ANKLE: [450, 740], R_ANKLE: [445, 740],
};

export const with_ = (base: Pose, patch: Pose): Pose => ({ ...base, ...patch });
```

`tests/helpers/posture-fixtures.ts`:

```ts
import type { LandmarkName, Side } from "@/lib/pose/landmarks";
import { SITTING_FRONT, SITTING_SIDE, STANDING_FRONT, STANDING_SIDE, with_, type Pose } from "./skeleton";

export interface Fixture {
  neutral: Pose; // calibration (starting) position
  inPose: Pose;
  side: Side | null; // active side the inPose frame shows
  dim?: LandmarkName[]; // points with low visibility (to choose the visible side)
}

const SIDE_DIM: LandmarkName[] = ["R_SHOULDER", "R_ELBOW", "R_WRIST", "R_HIP", "R_KNEE", "R_ANKLE"];

/** Hand-made frames that should satisfy each posture's rule (and the neutral frame should not). */
export const FIXTURES: Record<string, Fixture> = {
  "kae-kiat": {
    neutral: SITTING_FRONT,
    inPose: with_(SITTING_FRONT, { L_WRIST: [400, 520], R_WRIST: [380, 520], L_ELBOW: [520, 500], R_ELBOW: [380, 480] }),
    side: "R",
  },
  "kae-lom-puat-sisa": {
    neutral: SITTING_FRONT,
    inPose: with_(SITTING_FRONT, { L_WRIST: [505, 250], R_WRIST: [495, 250], L_ELBOW: [600, 320], R_ELBOW: [400, 320] }),
    side: "L",
  },
  "kae-lom-wian-sisa": {
    neutral: SITTING_FRONT,
    inPose: with_(SITTING_FRONT, { L_ELBOW: [640, 400], L_WRIST: [560, 340] }),
    side: "R",
  },
  "kae-lom-pakang": {
    neutral: SITTING_FRONT,
    inPose: with_(SITTING_FRONT, { R_WRIST: [500, 400], R_ELBOW: [430, 470], L_WRIST: [510, 300], L_ELBOW: [620, 440] }),
    side: "R",
  },
  "kae-puat-thong-sabak-chom": {
    neutral: SITTING_FRONT,
    inPose: with_(SITTING_FRONT, { L_WRIST: [700, 330], R_WRIST: [300, 330], L_ELBOW: [650, 440], R_ELBOW: [350, 440] }),
    side: null,
  },
  "kae-sabak-na-chom": {
    neutral: SITTING_FRONT,
    inPose: with_(SITTING_FRONT, { NOSE: [500, 330], L_WRIST: [600, 690], R_WRIST: [400, 690] }),
    side: null,
  },
  "kae-salak-lai": {
    neutral: STANDING_FRONT,
    inPose: with_(STANDING_FRONT, { L_WRIST: [560, 260], L_ELBOW: [520, 330], R_WRIST: [530, 340], R_ELBOW: [440, 380] }),
    side: "L",
  },
  "kae-kho-khlet-kae-lai-khat": {
    neutral: STANDING_FRONT,
    inPose: with_(STANDING_FRONT, {
      NOSE: [500, 210], L_SHOULDER: [580, 310], R_SHOULDER: [420, 310],
      L_ELBOW: [640, 380], R_ELBOW: [360, 380], L_WRIST: [560, 380], R_WRIST: [440, 380],
      L_HIP: [560, 560], R_HIP: [440, 560], L_KNEE: [640, 700], R_KNEE: [360, 700],
    }),
    side: null,
  },
  "kae-lom-nai-ok-nai-eo": {
    neutral: STANDING_SIDE,
    inPose: with_(STANDING_SIDE, { R_WRIST: [300, 160], L_ANKLE: [430, 900], R_ANKLE: [600, 900], L_HIP: [505, 530], R_HIP: [495, 530] }),
    side: "R",
  },
  "kae-khao-khat": {
    neutral: SITTING_SIDE,
    inPose: with_(SITTING_SIDE, { L_KNEE: [550, 700], L_ANKLE: [700, 700], L_WRIST: [500, 680] }),
    side: null,
    dim: SIDE_DIM,
  },
  "kae-klon": {
    neutral: SITTING_SIDE,
    inPose: with_(SITTING_SIDE, { L_KNEE: [550, 700], L_ANKLE: [700, 700], L_WRIST: [680, 690], NOSE: [560, 560] }),
    side: null,
    dim: SIDE_DIM,
  },
  "kae-khao-kae-kha": {
    neutral: STANDING_SIDE,
    inPose: with_(STANDING_SIDE, {
      L_HIP: [505, 540], R_HIP: [495, 540], L_KNEE: [620, 720], L_ANKLE: [600, 900], R_KNEE: [450, 720], R_ANKLE: [420, 900],
    }),
    side: "R",
  },
  "damrong-kai-ayu-yuen": {
    neutral: STANDING_FRONT,
    inPose: with_(STANDING_FRONT, {
      NOSE: [500, 210], L_SHOULDER: [580, 310], R_SHOULDER: [420, 310],
      L_WRIST: [505, 380], R_WRIST: [495, 400], L_ELBOW: [600, 400], R_ELBOW: [400, 400],
      L_HIP: [560, 560], R_HIP: [440, 560], L_KNEE: [660, 700], R_KNEE: [340, 700], L_ANKLE: [620, 900], R_ANKLE: [380, 900],
    }),
    side: null,
  },
};
```

`tests/pose-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getPosture, postures } from "@/lib/content";
import { angleDeg, medianFrame, point, projT } from "@/lib/pose/geometry";
import { calibrate, evaluate, requiredVisible, visibleSide } from "@/lib/pose/rules";
import { FIXTURES } from "./helpers/posture-fixtures";
import { frame, SITTING_FRONT, STANDING_FRONT } from "./helpers/skeleton";

describe("geometry", () => {
  it("measures angles in degrees", () => {
    expect(angleDeg({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(90);
    expect(angleDeg({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(180);
  });

  it("projects a point onto a segment", () => {
    expect(projT({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(0.5);
  });

  it("returns null for invisible points and averages mid points", () => {
    const f = frame(STANDING_FRONT, 0, ["L_WRIST"]);
    expect(point(f, "L_WRIST")).toBeNull();
    expect(point(f, "MID_WRIST")).toBeNull();
    expect(point(f, "MID_HIP")).toEqual({ x: 500, y: 500 });
  });

  it("median filter removes a one-frame spike", () => {
    const frames = [0, 1, 2, 3, 4].map((i) => frame(STANDING_FRONT, i));
    frames[2].points[15].y = 0.05; // L_WRIST jumps
    expect(medianFrame(frames).points[15].y).toBeCloseTo(0.48);
  });
});

describe("calibration", () => {
  it("uses torso length as the unit", () => {
    expect(calibrate([frame(STANDING_FRONT)])!.U).toBeCloseTo(250);
  });
  it("fails when hips are not visible", () => {
    expect(calibrate([frame(STANDING_FRONT, 0, ["L_HIP", "R_HIP"])])).toBeNull();
  });
});

describe("posture rules on hand-made frames", () => {
  for (const p of postures) {
    const fx = FIXTURES[p.id];
    it(`${p.id}: in-pose frame passes, neutral frame fails`, () => {
      expect(fx, `missing fixture for ${p.id}`).toBeDefined();
      const calib = calibrate([frame(fx.neutral, 0, [], fx.dim)])!;
      const side = fx.side;
      expect(evaluate(p.detector.in_pose, { frame: frame(fx.inPose, 1, [], fx.dim), calib, side })).toBe(true);
      expect(evaluate(p.detector.in_pose, { frame: frame(fx.neutral, 1, [], fx.dim), calib, side })).toBe(false);
    });
  }

  it("kae-kiat checks the twist direction", () => {
    const fx = FIXTURES["kae-kiat"];
    const calib = calibrate([frame(fx.neutral)])!;
    const det = getPosture("kae-kiat").detector;
    expect(evaluate(det.in_pose, { frame: frame(fx.inPose), calib, side: "L" })).toBe(false);
  });

  it("kae-klon (reach to toes) is not mistaken for kae-khao-khat hands on thighs", () => {
    const fx = FIXTURES["kae-khao-khat"];
    const calib = calibrate([frame(fx.neutral, 0, [], fx.dim)])!;
    expect(evaluate(getPosture("kae-klon").detector.in_pose, { frame: frame(fx.inPose, 0, [], fx.dim), calib, side: null })).toBe(false);
  });

  it("hidden wrists make the posture false instead of throwing", () => {
    const fx = FIXTURES["kae-puat-thong-sabak-chom"];
    const calib = calibrate([frame(fx.neutral)])!;
    const det = getPosture("kae-puat-thong-sabak-chom").detector;
    expect(evaluate(det.in_pose, { frame: frame(fx.inPose, 0, ["L_WRIST"]), calib, side: null })).toBe(false);
  });

  it("picks the side the camera sees better", () => {
    const fx = FIXTURES["kae-khao-khat"];
    expect(visibleSide(frame(fx.inPose, 0, [], fx.dim))).toBe("L");
  });

  it("reports whether the required landmarks are in view", () => {
    const det = getPosture("damrong-kai-ayu-yuen").detector;
    expect(requiredVisible(det, frame(STANDING_FRONT), null)).toBe(true);
    expect(requiredVisible(det, frame(STANDING_FRONT, 0, ["L_ANKLE"]), null)).toBe(false);
    expect(requiredVisible(getPosture("kae-kiat").detector, frame(SITTING_FRONT), "R")).toBe(true);
  });
});
```

- [ ] **Step 2: รันให้ fail**

Run: `npx vitest run tests/pose-rules.test.ts`
Expected: FAIL (ไม่พบ `@/lib/pose/geometry`)

- [ ] **Step 3: เขียนโค้ด**

`lib/pose/landmarks.ts`:

```ts
/** MediaPipe Pose landmark indexes (33-point model). */
export const LANDMARK_INDEX = {
  NOSE: 0,
  L_EAR: 7,
  R_EAR: 8,
  L_SHOULDER: 11,
  R_SHOULDER: 12,
  L_ELBOW: 13,
  R_ELBOW: 14,
  L_WRIST: 15,
  R_WRIST: 16,
  L_HIP: 23,
  R_HIP: 24,
  L_KNEE: 25,
  R_KNEE: 26,
  L_ANKLE: 27,
  R_ANKLE: 28,
  L_HEEL: 29,
  R_HEEL: 30,
  L_FOOT: 31,
  R_FOOT: 32,
} as const;

export type LandmarkName = keyof typeof LANDMARK_INDEX;

/** Mid points are the average of the left and right landmark. */
export const MID_POINTS = ["MID_SHOULDER", "MID_HIP", "MID_WRIST", "MID_EAR", "MID_ANKLE", "MID_KNEE", "MID_ELBOW"] as const;
export type MidName = (typeof MID_POINTS)[number];

export type Side = "L" | "R";

export interface RawPoint {
  x: number; // 0..1 of video width
  y: number; // 0..1 of video height
  visibility: number; // 0..1
}

/** One camera frame worth of landmarks. */
export interface Frame {
  t: number; // ms
  width: number; // video px
  height: number; // video px
  points: RawPoint[]; // length 33
}

export const VISIBLE = 0.5;
```

`lib/pose/geometry.ts`:

```ts
import { LANDMARK_INDEX, MID_POINTS, VISIBLE, type Frame, type LandmarkName, type MidName } from "./landmarks";

export interface Pt {
  x: number; // px
  y: number; // px, grows downward
}

/** Pixel position of a named or mid point, or null when not visible enough. */
export function point(frame: Frame, name: string): Pt | null {
  if ((MID_POINTS as readonly string[]).includes(name)) {
    const base = (name as MidName).slice(4); // e.g. "HIP"
    const a = point(frame, `L_${base}`);
    const b = point(frame, `R_${base}`);
    if (!a || !b) return null;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  const idx = LANDMARK_INDEX[name as LandmarkName];
  if (idx === undefined) throw new Error(`unknown point ${name}`);
  const p = frame.points[idx];
  if (!p || p.visibility < VISIBLE) return null;
  return { x: p.x * frame.width, y: p.y * frame.height };
}

export function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Angle ABC in degrees (0..180). */
export function angleDeg(a: Pt, b: Pt, c: Pt): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const den = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (den === 0) return 0;
  const cos = Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / den));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Position of p along a→b: 0 at a, 1 at b. */
export function projT(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return 0;
  return ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
}

/** Torso length (mid shoulder to mid hip) in px: the unit "U" every rule threshold uses. */
export function torsoLength(frame: Frame): number | null {
  const s = point(frame, "MID_SHOULDER");
  const h = point(frame, "MID_HIP");
  if (!s || !h) return null;
  const u = dist(s, h);
  return u > 0 ? u : null;
}

/** Median-filter the last frames landmark by landmark (removes single-frame jitter). */
export function medianFrame(frames: Frame[]): Frame {
  const last = frames[frames.length - 1];
  const med = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const points = last.points.map((_, i) => ({
    x: med(frames.map((f) => f.points[i].x)),
    y: med(frames.map((f) => f.points[i].y)),
    visibility: med(frames.map((f) => f.points[i].visibility)),
  }));
  return { ...last, points };
}
```

`lib/pose/rules.ts`:

```ts
import type { Condition, Detector } from "@/lib/content/schema";
import { angleDeg, dist, medianFrame, point, projT, torsoLength, type Pt } from "./geometry";
import { LANDMARK_INDEX, type Frame, type Side } from "./landmarks";

/** Measured in the neutral starting position; every threshold is a multiple of U. */
export interface Calibration {
  U: number; // torso length px
  base: Frame; // median neutral frame
}

export interface RuleContext {
  frame: Frame;
  calib: Calibration;
  side: Side | null; // active side for "alternate" postures
}

const other = (s: Side): Side => (s === "L" ? "R" : "L");

/** Side whose arm/leg landmarks the camera sees better (for side-view postures). */
export function visibleSide(frame: Frame): Side {
  const parts = ["SHOULDER", "ELBOW", "WRIST", "HIP", "KNEE", "ANKLE"] as const;
  const score = (s: Side) =>
    parts.reduce((sum, p) => sum + frame.points[LANDMARK_INDEX[`${s}_${p}` as keyof typeof LANDMARK_INDEX]].visibility, 0);
  return score("L") >= score("R") ? "L" : "R";
}

export function resolveName(name: string, ctx: RuleContext): string {
  if (name.includes("{V}")) return name.replace("{V}", visibleSide(ctx.frame));
  if (name.includes("{S}") || name.includes("{O}")) {
    if (!ctx.side) throw new Error(`${name} needs an active side`);
    return name.replace("{S}", ctx.side).replace("{O}", other(ctx.side));
  }
  return name;
}

function pts(names: string[], ctx: RuleContext): Pt[] | null {
  const out: Pt[] = [];
  for (const n of names) {
    const p = point(ctx.frame, resolveName(n, ctx));
    if (!p) return null;
    out.push(p);
  }
  return out;
}

/** Is the person in the posture described by `cond` in this frame? Invisible points make it false. */
export function evaluate(cond: Condition, ctx: RuleContext): boolean {
  const U = ctx.calib.U;
  if ("all" in cond) return cond.all.every((c) => evaluate(c, ctx));
  if ("any" in cond) return cond.any.some((c) => evaluate(c, ctx));
  if ("not" in cond) return !evaluate(cond.not, ctx);
  if ("angle" in cond) {
    const p = pts(cond.angle, ctx);
    if (!p) return false;
    const a = angleDeg(p[0], p[1], p[2]);
    return (cond.gte === undefined || a >= cond.gte) && (cond.lte === undefined || a <= cond.lte);
  }
  if ("above" in cond) {
    const p = pts(cond.above, ctx);
    return !!p && (p[1].y - p[0].y) / U >= cond.by;
  }
  if ("below" in cond) {
    const p = pts(cond.below, ctx);
    return !!p && (p[0].y - p[1].y) / U >= cond.by;
  }
  if ("near" in cond) {
    const p = pts(cond.near, ctx);
    return !!p && dist(p[0], p[1]) / U <= cond.within;
  }
  if ("level" in cond) {
    const p = pts(cond.level, ctx);
    return !!p && Math.abs(p[0].y - p[1].y) / U <= cond.within;
  }
  if ("xdist" in cond) {
    const p = pts(cond.xdist, ctx);
    if (!p) return false;
    const d = Math.abs(p[0].x - p[1].x) / U;
    return (cond.gte === undefined || d >= cond.gte) && (cond.lte === undefined || d <= cond.lte);
  }
  if ("toward" in cond) {
    const sideName = resolveName(cond.toward[1], ctx) as Side;
    const p = pts([cond.toward[0], `${sideName}_SHOULDER`, `${other(sideName)}_SHOULDER`, "MID_SHOULDER"], ctx);
    if (!p) return false;
    const sign = Math.sign(p[1].x - p[2].x) || 1;
    return ((p[0].x - p[3].x) * sign) / U >= cond.by;
  }
  if ("drop" in cond) {
    const name = resolveName(cond.drop[0], ctx);
    const now = point(ctx.frame, name);
    const then = point(ctx.calib.base, name);
    return !!now && !!then && (now.y - then.y) / U >= cond.by;
  }
  if ("between" in cond) {
    const p = pts(cond.between, ctx);
    if (!p) return false;
    const margin = 0.05 * U;
    const top = Math.min(p[1].y, p[2].y) - margin;
    const bottom = Math.max(p[1].y, p[2].y) + margin;
    return p[0].y >= top && p[0].y <= bottom;
  }
  if ("proj" in cond) {
    const p = pts(cond.proj, ctx);
    if (!p) return false;
    const t = projT(p[0], p[1], p[2]);
    return t >= cond.min && t <= cond.max;
  }
  throw new Error(`unknown condition ${JSON.stringify(cond)}`);
}

/** Are all landmarks this posture needs visible (for the camera-setup screen)? */
export function requiredVisible(det: Detector, frame: Frame, side: Side | null): boolean {
  const ctx: RuleContext = { frame, calib: { U: 1, base: frame }, side: side ?? "L" };
  return det.required.every((n) => point(frame, resolveName(n, ctx)) !== null);
}

/** Calibrate from ~2 s of neutral frames. Returns null when the torso is not visible. */
export function calibrate(frames: Frame[]): Calibration | null {
  if (frames.length === 0) return null;
  const base = medianFrame(frames);
  const U = torsoLength(base);
  return U ? { U, base } : null;
}
```

- [ ] **Step 4: รันให้ผ่าน**

Run: `npx vitest run tests/pose-rules.test.ts`
Expected: PASS 24 tests (13 ท่าผ่านกับเฟรมในท่าและไม่ผ่านกับเฟรมเตรียม)

- [ ] **Step 5: Commit**

```bash
git add lib/pose tests/helpers tests/pose-rules.test.ts
git commit -m "feat(pose): geometry, data-driven posture rules and calibration"
```

---

### Task 4: ตัวนับเวลาค้างท่า (state machine)

**Files:**
- Create: `lib/pose/session.ts`, `tests/pose-session.test.ts`

**Interfaces:**
- Consumes: `Detector`, `Side`
- Produces: `startSession(det)`, `step(det, state, tMs, inPose): SessionState`, `sideForUnit(det, i)`, `toResult(postureId, state): PostureResult`, `PostureResult {posture_id, method: "camera"|"button"|"skipped", units_done, units_target, seconds_held}`, `GRACE_MS=700`, `RELEASE_MS=1000`

- [ ] **Step 1: เทสต์**

`tests/pose-session.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getPosture } from "@/lib/content";
import type { Detector } from "@/lib/content/schema";
import { startSession, step, toResult, type SessionState } from "@/lib/pose/session";

/** Feed frames every 100 ms from t0 for `ms`, with a constant inPose value. */
function run(det: Detector, s: SessionState, t0: number, ms: number, inPose: boolean): [SessionState, number] {
  let st = s;
  let t = t0;
  for (; t < t0 + ms; t += 100) st = step(det, st, t, inPose);
  return [st, t];
}

const hold = getPosture("damrong-kai-ayu-yuen").detector; // both sides, 10 s × 3
const alt = getPosture("kae-kiat").detector; // alternate R first, 10 s × 6 units
const reps = getPosture("kae-lom-pakang").detector; // reps: 3 s in pose, 6 units

describe("pose session (hold mode)", () => {
  it("waits in ready until the person is in the pose", () => {
    const [s] = run(hold, startSession(hold), 0, 3000, false);
    expect(s.phase).toBe("ready");
    expect(s.heldMs).toBe(0);
  });

  it("counts a unit after 10 s in the pose, then needs 1 s out of it", () => {
    let [s, t] = run(hold, startSession(hold), 0, 10200, true);
    expect(s.unitsDone).toBe(1);
    expect(s.phase).toBe("release");
    [s, t] = run(hold, s, t, 500, false);
    expect(s.phase).toBe("release");
    [s] = run(hold, s, t, 700, false);
    expect(s.phase).toBe("ready");
  });

  it("keeps counting through a short loss (≤ 0.7 s) of the pose", () => {
    let [s, t] = run(hold, startSession(hold), 0, 5000, true);
    [s, t] = run(hold, s, t, 500, false);
    expect(s.phase).toBe("hold");
    [s] = run(hold, s, t, 4600, true);
    expect(s.unitsDone).toBe(1);
  });

  it("pauses (without resetting) after a longer loss", () => {
    let [s, t] = run(hold, startSession(hold), 0, 5000, true);
    [s, t] = run(hold, s, t, 2000, false);
    expect(s.phase).toBe("paused");
    const held = s.heldMs;
    expect(held).toBeGreaterThan(4500);
    [s] = run(hold, s, t, 6000, true);
    expect(s.unitsDone).toBe(1);
  });

  it("finishes after all units", () => {
    let s = startSession(hold);
    let t = 0;
    for (let i = 0; i < 3; i++) {
      [s, t] = run(hold, s, t, 10300, true);
      [s, t] = run(hold, s, t, 1300, false);
    }
    expect(s.phase).toBe("done");
    expect(s.unitsDone).toBe(3);
    const r = toResult("damrong-kai-ayu-yuen", s);
    expect(r).toMatchObject({ method: "camera", units_done: 3, units_target: 3 });
    expect(r.seconds_held).toBeGreaterThanOrEqual(30);
  });

  it("ignores long gaps between frames (tab in background)", () => {
    let s = step(hold, startSession(hold), 0, true);
    s = step(hold, s, 100, true);
    s = step(hold, s, 60_000, true);
    expect(s.heldMs).toBeLessThanOrEqual(300);
  });
});

describe("alternate sides", () => {
  it("starts on the sheet's first side and switches each unit", () => {
    let s = startSession(alt);
    expect(s.side).toBe("R");
    let t = 0;
    [s, t] = run(alt, s, t, 10300, true);
    [s, t] = run(alt, s, t, 1300, false);
    expect(s.side).toBe("L");
    [s, t] = run(alt, s, t, 10300, true);
    [s] = run(alt, s, t, 1300, false);
    expect(s.side).toBe("R");
    expect(s.unitsDone).toBe(2);
  });
});

describe("reps mode", () => {
  it("counts a rep after 3 s in the pose and a release", () => {
    const [s1, t] = run(reps, startSession(reps), 0, 3200, true);
    expect(s1.unitsDone).toBe(1);
    const [s] = run(reps, s1, t, 1300, false);
    expect(s.phase).toBe("ready");
    expect(s.side).toBe("L");
  });
});
```

- [ ] **Step 2: รันให้ fail**

Run: `npx vitest run tests/pose-session.test.ts`
Expected: FAIL (ไม่พบ `@/lib/pose/session`)

- [ ] **Step 3: เขียนโค้ด**

`lib/pose/session.ts`:

```ts
import type { Detector } from "@/lib/content/schema";
import type { Side } from "./landmarks";

export type Phase = "ready" | "hold" | "paused" | "release" | "done";

export interface SessionState {
  phase: Phase;
  unitsDone: number;
  unitsTarget: number;
  heldMs: number; // in the current unit
  totalHeldMs: number;
  side: Side | null; // side of the current unit
  lastT: number | null;
  lastInPoseT: number | null;
  releaseSinceT: number | null;
}

export const GRACE_MS = 700; // brief loss of the pose keeps the clock running
export const RELEASE_MS = 1000; // must leave the pose this long before the next unit
const MAX_DT = 200; // ignore gaps longer than this (tab paused, slow frame)

export function sideForUnit(det: Detector, unitIndex: number): Side | null {
  if (det.sides !== "alternate" || !det.first_side) return null;
  const first = det.first_side;
  return unitIndex % 2 === 0 ? first : first === "L" ? "R" : "L";
}

export function startSession(det: Detector): SessionState {
  return {
    phase: "ready",
    unitsDone: 0,
    unitsTarget: det.units,
    heldMs: 0,
    totalHeldMs: 0,
    side: sideForUnit(det, 0),
    lastT: null,
    lastInPoseT: null,
    releaseSinceT: null,
  };
}

/**
 * Advance the session with one frame result. Pure: returns a new state.
 * Hold mode and reps mode share this machine; reps simply use a short hold (detector.hold_seconds).
 */
export function step(det: Detector, s: SessionState, t: number, inPose: boolean): SessionState {
  if (s.phase === "done") return s;
  const dt = s.lastT === null ? 0 : Math.max(0, Math.min(MAX_DT, t - s.lastT));
  const next: SessionState = { ...s, lastT: t };
  if (inPose) next.lastInPoseT = t;
  const holdMs = det.hold_seconds * 1000;

  switch (s.phase) {
    case "ready":
      if (inPose) return { ...next, phase: "hold", heldMs: 0 };
      return next;
    case "paused":
      if (inPose) return { ...next, phase: "hold" };
      return next;
    case "hold": {
      const withinGrace = inPose || (s.lastInPoseT !== null && t - s.lastInPoseT <= GRACE_MS);
      if (!withinGrace) return { ...next, phase: "paused" };
      const heldMs = s.heldMs + dt;
      const totalHeldMs = s.totalHeldMs + dt;
      if (heldMs >= holdMs) {
        return { ...next, phase: "release", heldMs: holdMs, totalHeldMs, unitsDone: s.unitsDone + 1, releaseSinceT: inPose ? null : t };
      }
      return { ...next, heldMs, totalHeldMs };
    }
    case "release": {
      if (inPose) return { ...next, releaseSinceT: null };
      const since = s.releaseSinceT ?? t;
      if (t - since < RELEASE_MS) return { ...next, releaseSinceT: since };
      if (s.unitsDone >= s.unitsTarget) return { ...next, phase: "done", releaseSinceT: null };
      return { ...next, phase: "ready", heldMs: 0, releaseSinceT: null, side: sideForUnit(det, s.unitsDone) };
    }
  }
}

/** Result stored in the session record (sessions.results[]). */
export interface PostureResult {
  posture_id: string;
  method: "camera" | "button" | "skipped";
  units_done: number;
  units_target: number;
  seconds_held: number;
}

export function toResult(postureId: string, s: SessionState): PostureResult {
  return {
    posture_id: postureId,
    method: "camera",
    units_done: s.unitsDone,
    units_target: s.unitsTarget,
    seconds_held: Math.round(s.totalHeldMs / 100) / 10,
  };
}
```

- [ ] **Step 4: รันให้ผ่าน**

Run: `npx vitest run tests/pose-session.test.ts`
Expected: PASS 8 tests

- [ ] **Step 5: Commit**

```bash
git add lib/pose/session.ts tests/pose-session.test.ts
git commit -m "feat(pose): hold/reps state machine with grace, pause and release"
```

---

### Task 5: ประเมินธงแดง

**Files:**
- Create: `lib/redflags.ts`, `tests/redflags.test.ts`

**Interfaces:**
- Consumes: `redflags` (Task 2)
- Produces: `Answers = Partial<Record<string, boolean>>`, `ClinicRuleSettings {disabled, thresholds}`, `DEFAULT_SETTINGS`, `evaluateRedFlags(input, settings?): FiredFlag[]` (เรียงจากรุนแรงสุด), `worst(flags)`, `ruleById(id)`, `stopsSession(level)`, `SEVERITY`

- [ ] **Step 1: เทสต์**

`tests/redflags.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { redflags } from "@/lib/content";
import { evaluateRedFlags, stopsSession, worst } from "@/lib/redflags";

describe("red flags", () => {
  it("fires nothing when every answer is no and pain is low", () => {
    expect(evaluateRedFlags({ answers: {}, painBefore: 3, painAfter: 3 })).toEqual([]);
  });

  for (const r of redflags.rules.filter((x) => x.trigger.type === "yes")) {
    it(`${r.id} fires on "yes" with level ${r.level}`, () => {
      const out = evaluateRedFlags({ answers: { [r.id]: true }, painBefore: 2, painAfter: 2 });
      expect(out.map((f) => f.rule_id)).toContain(r.id);
    });
  }

  it("RF07: pain 8 or more before or after stops the session", () => {
    expect(worst(evaluateRedFlags({ answers: {}, painBefore: 8 }))?.rule_id).toBe("RF07");
    expect(worst(evaluateRedFlags({ answers: {}, painBefore: 2, painAfter: 9 }))?.level).toBe("stop_and_contact_clinic");
    expect(evaluateRedFlags({ answers: {}, painBefore: 7, painAfter: 7 })).toEqual([]);
  });

  it("RF08: pain up by 3 pauses (team proposal, default threshold 3)", () => {
    expect(evaluateRedFlags({ answers: {}, painBefore: 2, painAfter: 5 }).map((f) => f.rule_id)).toEqual(["RF08"]);
    expect(evaluateRedFlags({ answers: {}, painBefore: 2, painAfter: 4 })).toEqual([]);
  });

  it("RF09: mild soreness is only a note, and not when pain jumped", () => {
    expect(evaluateRedFlags({ answers: { RF09: true }, painBefore: 2, painAfter: 3 }).map((f) => f.level)).toEqual(["note_for_next_visit"]);
    expect(evaluateRedFlags({ answers: { RF09: true }, painBefore: 2, painAfter: 6 }).map((f) => f.rule_id)).toEqual(["RF08"]);
  });

  it("orders flags from most to least severe", () => {
    const out = evaluateRedFlags({ answers: { RF09: true, RF04: true, RF01: true }, painBefore: 2, painAfter: 2 });
    expect(out.map((f) => f.level)).toEqual(["call_1669", "stop_and_contact_clinic", "note_for_next_visit"]);
    expect(worst(out)?.rule_id).toBe("RF01");
  });

  it("clinics can change adjustable rules only", () => {
    const settings = { disabled: ["RF09", "RF01"], thresholds: { RF08: 5, RF07: 99 } };
    expect(evaluateRedFlags({ answers: { RF09: true }, painBefore: 1, painAfter: 2 }, settings)).toEqual([]);
    expect(evaluateRedFlags({ answers: {}, painBefore: 2, painAfter: 6 }, settings)).toEqual([]);
    expect(evaluateRedFlags({ answers: {}, painBefore: 2, painAfter: 7 }, settings).map((f) => f.rule_id)).toEqual(["RF08"]);
    // RF01 is an emergency rule and RF07 a stop rule: the clinic settings are ignored
    expect(evaluateRedFlags({ answers: { RF01: true } }, settings).map((f) => f.rule_id)).toEqual(["RF01"]);
    expect(evaluateRedFlags({ answers: {}, painBefore: 8 }, settings).map((f) => f.rule_id)).toEqual(["RF07"]);
  });

  it("records the posture for buttons pressed during a posture", () => {
    expect(evaluateRedFlags({ answers: { RF04: true }, postureId: "kae-kiat" })[0].posture_id).toBe("kae-kiat");
  });

  it("only emergency and stop levels end the session", () => {
    expect(stopsSession("call_1669")).toBe(true);
    expect(stopsSession("stop_and_contact_clinic")).toBe(true);
    expect(stopsSession("pause_posture")).toBe(false);
  });
});
```

- [ ] **Step 2: รันให้ fail**

Run: `npx vitest run tests/redflags.test.ts`
Expected: FAIL

- [ ] **Step 3: เขียนโค้ด**

`lib/redflags.ts`:

```ts
import { redflags } from "@/lib/content";
import type { RedFlagLevel, RedFlagRule } from "@/lib/content/schema";

/** Rule id → patient answered "yes". */
export type Answers = Partial<Record<string, boolean>>;

export interface RedFlagInput {
  answers: Answers;
  painBefore?: number | null;
  painAfter?: number | null;
  postureId?: string | null; // posture on screen when a "during" button was pressed
}

/** Per-clinic changes; only rules with clinic_adjustable=true are affected. */
export interface ClinicRuleSettings {
  disabled: string[];
  thresholds: Record<string, number>;
}

export const DEFAULT_SETTINGS: ClinicRuleSettings = { disabled: [], thresholds: {} };

export interface FiredFlag {
  rule_id: string;
  level: RedFlagLevel;
  posture_id: string | null;
}

export const SEVERITY: Record<RedFlagLevel, number> = {
  call_1669: 3,
  stop_and_contact_clinic: 2,
  pause_posture: 1,
  note_for_next_visit: 0,
};

function fires(rule: RedFlagRule, input: RedFlagInput, settings: ClinicRuleSettings): boolean {
  const yes = input.answers[rule.id] === true;
  const before = input.painBefore ?? null;
  const after = input.painAfter ?? null;
  const delta = before !== null && after !== null ? after - before : null;
  const value = (rule.clinic_adjustable ? settings.thresholds[rule.id] : undefined) ?? ("value" in rule.trigger ? rule.trigger.value : 0);
  switch (rule.trigger.type) {
    case "yes":
      return yes;
    case "pain_gte":
      return Math.max(before ?? -1, after ?? -1) >= value;
    case "pain_delta_gte":
      return delta !== null && delta >= value;
    case "yes_and_pain_delta_lte":
      return yes && (delta === null || delta <= value);
  }
}

/** Evaluate every rule; deterministic, used on the phone and again on the server. */
export function evaluateRedFlags(input: RedFlagInput, settings: ClinicRuleSettings = DEFAULT_SETTINGS): FiredFlag[] {
  return redflags.rules
    .filter((r) => !(r.clinic_adjustable && settings.disabled.includes(r.id)))
    .filter((r) => fires(r, input, settings))
    .map((r) => ({ rule_id: r.id, level: r.level, posture_id: input.postureId ?? null }))
    .sort((a, b) => SEVERITY[b.level] - SEVERITY[a.level]);
}

/** The response the patient sees: the most severe fired rule, or null. */
export function worst(flags: FiredFlag[]): FiredFlag | null {
  return flags.length ? flags[0] : null;
}

export function ruleById(id: string): RedFlagRule {
  const r = redflags.rules.find((x) => x.id === id);
  if (!r) throw new Error(`unknown rule ${id}`);
  return r;
}

/** Does this level stop the whole session (vs. only the current posture)? */
export function stopsSession(level: RedFlagLevel): boolean {
  return level === "call_1669" || level === "stop_and_contact_clinic";
}
```

- [ ] **Step 4: รันให้ผ่าน**

Run: `npx vitest run tests/redflags.test.ts`
Expected: PASS 21 tests

- [ ] **Step 5: Commit**

```bash
git add lib/redflags.ts tests/redflags.test.ts
git commit -m "feat(redflags): deterministic red-flag evaluation with clinic-adjustable rules"
```

---

### Task 6: รหัสแผน รหัสลับ และไฟล์ปฏิทิน

**Files:**
- Create: `lib/plan.ts`, `lib/ics.ts`, `tests/plan-ics.test.ts`

**Interfaces:**
- Produces: `newPlanCode()`, `PLAN_CODE_RE`, `newSecret()`, `hashSecret(s)`, `secretMatches(secret, hash)`, `patientUrl(origin, code, secret)`; `buildIcs(IcsInput)`, `rrule(daysPerWeek, untilDate)`, `foldLine(line)`

- [ ] **Step 1: เทสต์**

`tests/plan-ics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildIcs, foldLine, rrule } from "@/lib/ics";
import { hashSecret, newPlanCode, newSecret, PLAN_CODE_RE, patientUrl, secretMatches } from "@/lib/plan";

describe("plan codes and secrets", () => {
  it("makes readable codes without confusing characters", () => {
    for (let i = 0; i < 200; i++) {
      const c = newPlanCode();
      expect(c).toMatch(PLAN_CODE_RE);
      expect(c).not.toMatch(/[IO01]/);
    }
  });

  it("makes 128-bit url-safe secrets", () => {
    const s = newSecret();
    expect(s).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(newSecret()).not.toBe(s);
  });

  it("stores only a hash and compares in constant time", () => {
    const s = newSecret();
    const h = hashSecret(s);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain(s);
    expect(secretMatches(s, h)).toBe(true);
    expect(secretMatches(s + "x", h)).toBe(false);
    expect(secretMatches(s, "abc")).toBe(false);
  });

  it("puts the secret after # in the patient link", () => {
    expect(patientUrl("https://x.app", "KPT-42", "sec")).toBe("https://x.app/p/KPT-42#sec");
  });
});

describe("calendar file", () => {
  it("uses DAILY for 7 days a week and spaced weekdays otherwise", () => {
    expect(rrule(7, "2026-10-20")).toBe("RRULE:FREQ=DAILY;UNTIL=20261020T165959Z");
    expect(rrule(3, "2026-10-20")).toBe("RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261020T165959Z");
  });

  it("folds long Thai lines at 75 bytes", () => {
    const line = "DESCRIPTION:" + "ก".repeat(60);
    for (const part of foldLine(line).split("\r\n")) expect(Buffer.byteLength(part, "utf8")).toBeLessThanOrEqual(75);
  });

  it("builds a valid VCALENDAR with a Bangkok start time and an alarm", () => {
    const ics = buildIcs({
      code: "KPT-42", daysPerWeek: 7, remindTime: "19:00", startDate: "2026-10-05", untilDate: "2026-10-19",
      url: "https://x.app/p/KPT-42#sec", now: new Date("2026-10-04T00:00:00Z"),
    });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART;TZID=Asia/Bangkok:20261005T190000");
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics.replace(/\r\n /g, "")).toContain("URL:https://x.app/p/KPT-42#sec");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
```

- [ ] **Step 2: รันให้ fail**

Run: `npx vitest run tests/plan-ics.test.ts`
Expected: FAIL

- [ ] **Step 3: เขียนโค้ด**

`lib/plan.ts`:

```ts
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I, O
const DIGITS = "23456789"; // no 0, 1

/** Short code people can read aloud, e.g. "K7P-42" style: 3 letters + "-" + 2 digits. */
export function newPlanCode(): string {
  const l = Array.from({ length: 3 }, () => LETTERS[randomInt(LETTERS.length)]).join("");
  const d = Array.from({ length: 2 }, () => DIGITS[randomInt(DIGITS.length)]).join("");
  return `${l}-${d}`;
}

export const PLAN_CODE_RE = /^[A-HJ-NP-Z]{3}-[2-9]{2}$/;

/** 128-bit random secret, URL-safe. Shown once inside the QR, never stored in plain text. */
export function newSecret(): string {
  return randomBytes(16).toString("base64url");
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/** Constant-time comparison of a presented secret with the stored hash. */
export function secretMatches(secret: string, storedHash: string): boolean {
  const a = Buffer.from(hashSecret(secret), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Patient link: the secret lives after "#", so it is never sent in the URL to the server or logged. */
export function patientUrl(origin: string, code: string, secret: string): string {
  return `${origin}/p/${code}#${secret}`;
}
```

`lib/ics.ts`:

```ts
/** Recurring reminder as an iCalendar file (RFC 5545) that phone calendars import. */
export interface IcsInput {
  code: string;
  daysPerWeek: number; // 1..7
  remindTime: string; // "HH:MM" Bangkok time
  startDate: string; // YYYY-MM-DD
  untilDate: string; // YYYY-MM-DD (next visit)
  url: string; // link back to the plan
  now?: Date;
}

const BYDAY: Record<number, string> = {
  1: "MO",
  2: "MO,TH",
  3: "MO,WE,FR",
  4: "MO,TU,TH,FR",
  5: "MO,TU,WE,TH,FR",
  6: "MO,TU,WE,TH,FR,SA",
};

const ymd = (d: string) => d.replaceAll("-", "");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Fold lines longer than 75 octets (Thai characters are 3 bytes in UTF-8). */
export function foldLine(line: string): string {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch, "utf8");
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes + b > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function rrule(daysPerWeek: number, untilDate: string): string {
  const until = `UNTIL=${ymd(untilDate)}T165959Z`; // end of that day in Bangkok
  if (daysPerWeek >= 7) return `RRULE:FREQ=DAILY;${until}`;
  return `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[Math.max(1, daysPerWeek)]};${until}`;
}

export function buildIcs(i: IcsInput): string {
  const [hh, mm] = i.remindTime.split(":");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TTM Home Program//TH",
    "CALSCALE:GREGORIAN",
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Bangkok",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0700",
    "TZOFFSETTO:+0700",
    "TZNAME:ICT",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${i.code}@ttm-home-program`,
    `DTSTAMP:${stamp(i.now ?? new Date())}`,
    `DTSTART;TZID=Asia/Bangkok:${ymd(i.startDate)}T${hh}${mm}00`,
    "DURATION:PT15M",
    rrule(i.daysPerWeek, i.untilDate),
    `SUMMARY:${escapeText("ทำท่าฤๅษีดัดตน (การบ้านหลังนวด)")}`,
    `DESCRIPTION:${escapeText(`เปิดแผนของคุณ: ${i.url}`)}`,
    `URL:${i.url}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText("ถึงเวลาทำท่าฤๅษีดัดตนแล้ว")}`,
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
```

- [ ] **Step 4: รันให้ผ่าน**

Run: `npx vitest run tests/plan-ics.test.ts`
Expected: PASS 7 tests

- [ ] **Step 5: Commit**

```bash
git add lib/plan.ts lib/ics.ts tests/plan-ics.test.ts
git commit -m "feat(plan): readable plan codes, hashed secrets and recurring calendar file"
```

---

### Task 7: ชั้นข้อมูล การคำนวณยอด PIN และข้อมูลจำลอง

**Files:**
- Create: `lib/db/types.ts`, `lib/db/memory.ts`, `lib/db/supabase.ts`, `lib/db/index.ts`, `supabase/schema.sql`, `lib/aggregate.ts`, `lib/auth.ts`, `lib/seed.ts`, `tests/aggregate.test.ts`

**Interfaces:**
- Consumes: `PostureResult` (Task 4), `Answers`, `ClinicRuleSettings`, `SEVERITY` (Task 5), `hashSecret`, `newSecret` (Task 6), `activeGroups`, `posturesForGroups` (Task 2)
- Produces: `Store` interface + `MemoryStore`, `SupabaseStore`, `getStore()`, `setStore(s)`, `usingMemoryStore()`, `DuplicateCodeError`; row types `ClinicRow PlanRow SessionRow FlagRow`; `adherence()`, `clinicDashboard(plans, sessions, flags, today): DashboardItem[]`, `dtamSummary(...)`, `addDays`, `daysBetween`, `MIN_CELL=5`; `hashPin`, `verifyPin`, `signSession`, `readSession`, `CLINIC_COOKIE`, `DTAM_COOKIE`, `cookieOptions`; `seedDemo(store, today, pin, seed?)`, `DEMO_CLINICS`

- [ ] **Step 1: เทสต์**

`tests/aggregate.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { addDays, adherence, clinicDashboard, daysBetween, dtamSummary, MIN_CELL } from "@/lib/aggregate";
import { hashPin, verifyPin } from "@/lib/auth";
import { MemoryStore } from "@/lib/db/memory";
import type { PlanRow, SessionRow } from "@/lib/db/types";
import { seedDemo } from "@/lib/seed";

const plan = (over: Partial<PlanRow> = {}): PlanRow => ({
  id: "p1", code: "ABC-23", secret_hash: "x", clinic_id: "c1", group_ids: ["knee"], posture_ids: ["kae-klon"],
  days_per_week: 7, remind_time: "19:00", start_date: "2026-10-01", next_visit_date: "2026-10-14",
  status: "active", consent_at: null, closed_at: null, created_at: "2026-10-01T00:00:00Z", ...over,
});
const session = (on: string, method: "camera" | "button" | "skipped" = "camera", over: Partial<SessionRow> = {}): SessionRow => ({
  id: on, plan_id: "p1", performed_on: on, pain_before: 4, pain_after: 3,
  results: [{ posture_id: "kae-klon", method, units_done: method === "skipped" ? 0 : 3, units_target: 3, seconds_held: 30 }],
  answers: {}, client_id: on, created_at: `${on}T12:00:00Z`, ...over,
});

describe("dates", () => {
  it("adds and diffs days", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(daysBetween("2026-10-01", "2026-10-08")).toBe(7);
  });
});

describe("adherence", () => {
  it("is done days / expected days, capped at 1", () => {
    const p = plan();
    const ss = ["2026-10-01", "2026-10-02", "2026-10-03"].map((d) => session(d));
    expect(adherence(p, ss, "2026-10-01", "2026-10-04")).toBeCloseTo(0.75);
    expect(adherence(p, [...ss, session("2026-10-04"), session("2026-10-04", "camera", { id: "dup", client_id: "dup" })], "2026-10-01", "2026-10-04")).toBe(1);
  });
  it("scales the expectation by days per week", () => {
    expect(adherence(plan({ days_per_week: 3 }), [session("2026-10-01"), session("2026-10-03"), session("2026-10-05")], "2026-10-01", "2026-10-07")).toBe(1);
  });
  it("ignores sessions where every posture was skipped", () => {
    expect(adherence(plan(), [session("2026-10-01", "skipped")], "2026-10-01", "2026-10-02")).toBe(0);
  });
  it("is null before the plan starts", () => {
    expect(adherence(plan(), [], "2026-09-01", "2026-09-10")).toBeNull();
  });
});

describe("clinic dashboard", () => {
  it("puts unacknowledged red flags first, then inactive patients", () => {
    const p1 = plan({ id: "p1", code: "AAA-22" });
    const p2 = plan({ id: "p2", code: "BBB-22" });
    const p3 = plan({ id: "p3", code: "CCC-22", next_visit_date: "2026-10-25" });
    const sessions = [session("2026-10-05"), { ...session("2026-10-06"), plan_id: "p3", id: "s3", client_id: "s3" }];
    const flags = [{ id: "f1", plan_id: "p2", session_id: null, rule_id: "RF04", level: "stop_and_contact_clinic" as const, posture_id: "kae-klon", created_at: "2026-10-06T00:00:00Z", acknowledged_at: null }];
    const items = clinicDashboard([p1, p2, p3], sessions, flags, "2026-10-08");
    expect(items.map((i) => i.code)).toEqual(["BBB-22", "AAA-22", "CCC-22"]);
    expect(items[0].priority).toBe(0);
    expect(items[1].priority_reason).toBe("ไม่ได้ทำ 3 วัน");
  });
  it("treats acknowledged flags and notes as non-urgent", () => {
    const flags = [
      { id: "f1", plan_id: "p1", session_id: null, rule_id: "RF04", level: "stop_and_contact_clinic" as const, posture_id: null, created_at: "x", acknowledged_at: "y" },
      { id: "f2", plan_id: "p1", session_id: null, rule_id: "RF09", level: "note_for_next_visit" as const, posture_id: null, created_at: "x", acknowledged_at: null },
    ];
    const [item] = clinicDashboard([plan()], [session("2026-10-07")], flags, "2026-10-08");
    expect(item.open_flags).toEqual([]);
    expect(item.notes).toHaveLength(1);
    expect(item.priority).toBe(4);
  });
  it("reports how many postures were counted by camera", () => {
    const [item] = clinicDashboard([plan()], [session("2026-10-01"), session("2026-10-02", "button")], [], "2026-10-03");
    expect(item.camera_share).toBe(0.5);
  });
});

describe("pin hashing", () => {
  it("verifies the right pin only", () => {
    const h = hashPin("246810");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(verifyPin("246810", h)).toBe(true);
    expect(verifyPin("000000", h)).toBe(false);
    expect(verifyPin("246810", "garbage")).toBe(false);
  });
});

describe("demo seed + DTAM summary", () => {
  const store = new MemoryStore();
  const today = "2026-10-08";
  let counts: Awaited<ReturnType<typeof seedDemo>>;
  beforeAll(async () => {
    counts = await seedDemo(store, today, "246810");
  });

  it("creates 3 demo clinics and 60 plans, deterministically", async () => {
    expect(counts.clinics).toBe(3);
    expect(counts.plans).toBe(60);
    expect(counts.sessions).toBeGreaterThan(200);
    const again = new MemoryStore();
    expect(await seedDemo(again, today, "246810")).toEqual(counts);
  });

  it("summarises without any per-patient rows", () => {
    const s = dtamSummary(store.clinics, store.plans, store.sessions, store.flags, today);
    expect(s.totals.plans).toBe(60);
    expect(s.weekly_adherence).toHaveLength(8);
    expect(s.clinics).toHaveLength(3);
    expect(JSON.stringify(s)).not.toMatch(/[A-Z]{3}-\d{2}/); // no plan codes leak
    expect(s.totals.adherence).toBeGreaterThan(0);
    expect(s.totals.adherence).toBeLessThanOrEqual(1);
  });

  it(`hides clinics with fewer than ${MIN_CELL} plans`, () => {
    const one = store.plans.filter((p) => p.clinic_id === store.clinics[0].id).slice(0, 3);
    const s = dtamSummary(store.clinics.slice(0, 1), one, store.sessions, [], today);
    expect(s.clinics[0].hidden).toBe(true);
    expect(s.clinics[0].plans).toBeNull();
  });
});
```

- [ ] **Step 2: รันให้ fail**

Run: `npx vitest run tests/aggregate.test.ts`
Expected: FAIL

- [ ] **Step 3: ชั้นข้อมูล**

`lib/db/types.ts`:

```ts
import type { RedFlagLevel } from "@/lib/content/schema";
import type { PostureResult } from "@/lib/pose/session";
import type { Answers, ClinicRuleSettings } from "@/lib/redflags";

// No table has a name, national ID, phone of a patient, or HN.

export interface ClinicRow {
  id: string;
  code: string;
  name: string;
  pin_hash: string;
  phone: string | null; // the clinic's phone, shown to patients
  is_demo: boolean;
  settings: ClinicRuleSettings;
  created_at: string;
}

export type PlanStatus = "active" | "completed" | "stopped";

export interface PlanRow {
  id: string;
  code: string;
  secret_hash: string;
  clinic_id: string;
  group_ids: string[];
  posture_ids: string[];
  days_per_week: number;
  remind_time: string; // HH:MM
  start_date: string; // YYYY-MM-DD
  next_visit_date: string; // YYYY-MM-DD
  status: PlanStatus;
  consent_at: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface SessionRow {
  id: string;
  plan_id: string;
  performed_on: string; // YYYY-MM-DD (patient's local date)
  pain_before: number | null;
  pain_after: number | null;
  results: PostureResult[];
  answers: Answers;
  client_id: string; // generated on the phone; makes retries idempotent
  created_at: string;
}

export interface FlagRow {
  id: string;
  plan_id: string;
  session_id: string | null;
  rule_id: string;
  level: RedFlagLevel;
  posture_id: string | null;
  created_at: string;
  acknowledged_at: string | null;
}

export type NewPlan = Omit<PlanRow, "id" | "created_at" | "consent_at" | "closed_at" | "status">;
export type NewSession = Omit<SessionRow, "id" | "created_at">;
export type NewFlag = Omit<FlagRow, "id" | "created_at" | "acknowledged_at">;
export type NewClinic = Omit<ClinicRow, "id" | "created_at">;

export class DuplicateCodeError extends Error {}

export interface Store {
  listClinics(): Promise<ClinicRow[]>;
  getClinic(id: string): Promise<ClinicRow | null>;
  getClinicByCode(code: string): Promise<ClinicRow | null>;
  insertClinic(c: NewClinic): Promise<ClinicRow>;
  updateClinicSettings(id: string, settings: ClinicRuleSettings): Promise<void>;

  insertPlan(p: NewPlan): Promise<PlanRow>; // throws DuplicateCodeError
  getPlanByCode(code: string): Promise<PlanRow | null>;
  updatePlan(id: string, patch: Partial<Pick<PlanRow, "status" | "next_visit_date" | "secret_hash" | "consent_at" | "closed_at">>): Promise<void>;
  listPlans(filter?: { clinicId?: string }): Promise<PlanRow[]>;

  /** Returns the existing row when (plan_id, client_id) was already stored. */
  insertSession(s: NewSession): Promise<{ row: SessionRow; created: boolean }>;
  listSessions(filter?: { planIds?: string[] }): Promise<SessionRow[]>;

  insertFlags(f: NewFlag[]): Promise<FlagRow[]>;
  listFlags(filter?: { planIds?: string[] }): Promise<FlagRow[]>;
  acknowledgeFlag(id: string, clinicId: string, at: string): Promise<boolean>;

  /** Patient withdrawal: delete sessions and flags of a plan. */
  deletePlanData(planId: string): Promise<void>;
  /** Delete plans closed before the date together with their data. Returns how many plans. */
  purgeClosedBefore(isoDate: string): Promise<number>;
  /** Demo only: remove everything. */
  resetAll(): Promise<void>;
}
```

`lib/db/memory.ts`:

```ts
import { randomUUID } from "node:crypto";
import { DuplicateCodeError, type ClinicRow, type FlagRow, type NewClinic, type NewFlag, type NewPlan, type NewSession, type PlanRow, type SessionRow, type Store } from "./types";

/** In-memory store for tests and for running locally before Supabase is set up. */
export class MemoryStore implements Store {
  clinics: ClinicRow[] = [];
  plans: PlanRow[] = [];
  sessions: SessionRow[] = [];
  flags: FlagRow[] = [];
  private now = () => new Date().toISOString();

  async listClinics() {
    return [...this.clinics];
  }
  async getClinic(id: string) {
    return this.clinics.find((c) => c.id === id) ?? null;
  }
  async getClinicByCode(code: string) {
    return this.clinics.find((c) => c.code === code) ?? null;
  }
  async insertClinic(c: NewClinic) {
    if (this.clinics.some((x) => x.code === c.code)) throw new DuplicateCodeError(c.code);
    const row: ClinicRow = { ...c, id: randomUUID(), created_at: this.now() };
    this.clinics.push(row);
    return row;
  }
  async updateClinicSettings(id: string, settings: ClinicRow["settings"]) {
    const c = this.clinics.find((x) => x.id === id);
    if (c) c.settings = settings;
  }

  async insertPlan(p: NewPlan) {
    if (this.plans.some((x) => x.code === p.code)) throw new DuplicateCodeError(p.code);
    const row: PlanRow = { ...p, id: randomUUID(), status: "active", consent_at: null, closed_at: null, created_at: this.now() };
    this.plans.push(row);
    return row;
  }
  async getPlanByCode(code: string) {
    return this.plans.find((p) => p.code === code) ?? null;
  }
  async updatePlan(id: string, patch: Partial<PlanRow>) {
    const p = this.plans.find((x) => x.id === id);
    if (p) Object.assign(p, patch);
  }
  async listPlans(filter: { clinicId?: string } = {}) {
    return this.plans.filter((p) => !filter.clinicId || p.clinic_id === filter.clinicId);
  }

  async insertSession(s: NewSession) {
    const existing = this.sessions.find((x) => x.plan_id === s.plan_id && x.client_id === s.client_id);
    if (existing) return { row: existing, created: false };
    const row: SessionRow = { ...s, id: randomUUID(), created_at: this.now() };
    this.sessions.push(row);
    return { row, created: true };
  }
  async listSessions(filter: { planIds?: string[] } = {}) {
    return this.sessions.filter((s) => !filter.planIds || filter.planIds.includes(s.plan_id));
  }

  async insertFlags(f: NewFlag[]) {
    const rows = f.map((x) => ({ ...x, id: randomUUID(), created_at: this.now(), acknowledged_at: null }));
    this.flags.push(...rows);
    return rows;
  }
  async listFlags(filter: { planIds?: string[] } = {}) {
    return this.flags.filter((f) => !filter.planIds || filter.planIds.includes(f.plan_id));
  }
  async acknowledgeFlag(id: string, clinicId: string, at: string) {
    const f = this.flags.find((x) => x.id === id);
    const plan = f && this.plans.find((p) => p.id === f.plan_id);
    if (!f || !plan || plan.clinic_id !== clinicId) return false;
    f.acknowledged_at = at;
    return true;
  }

  async deletePlanData(planId: string) {
    this.sessions = this.sessions.filter((s) => s.plan_id !== planId);
    this.flags = this.flags.filter((f) => f.plan_id !== planId);
  }
  async purgeClosedBefore(isoDate: string) {
    const old = this.plans.filter((p) => p.closed_at !== null && p.closed_at < isoDate).map((p) => p.id);
    for (const id of old) await this.deletePlanData(id);
    this.plans = this.plans.filter((p) => !old.includes(p.id));
    return old.length;
  }
  async resetAll() {
    this.clinics = [];
    this.plans = [];
    this.sessions = [];
    this.flags = [];
  }
}
```

`lib/db/supabase.ts`:

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DuplicateCodeError, type ClinicRow, type FlagRow, type NewClinic, type NewFlag, type NewPlan, type NewSession, type PlanRow, type SessionRow, type Store } from "./types";

function check<T>(res: { data: T; error: { code?: string; message: string } | null }): T {
  if (res.error) throw new Error(`database: ${res.error.message}`);
  return res.data;
}

/** Postgres dates come back as "YYYY-MM-DD"; keep them as strings. */
export class SupabaseStore implements Store {
  private db: SupabaseClient;
  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async listClinics() {
    return check(await this.db.from("clinics").select("*").order("code")) as ClinicRow[];
  }
  async getClinic(id: string) {
    return check(await this.db.from("clinics").select("*").eq("id", id).maybeSingle()) as ClinicRow | null;
  }
  async getClinicByCode(code: string) {
    return check(await this.db.from("clinics").select("*").eq("code", code).maybeSingle()) as ClinicRow | null;
  }
  async insertClinic(c: NewClinic) {
    const res = await this.db.from("clinics").insert(c).select("*").single();
    if (res.error?.code === "23505") throw new DuplicateCodeError(c.code);
    return check(res) as ClinicRow;
  }
  async updateClinicSettings(id: string, settings: ClinicRow["settings"]) {
    check(await this.db.from("clinics").update({ settings }).eq("id", id));
  }

  async insertPlan(p: NewPlan) {
    const res = await this.db.from("plans").insert(p).select("*").single();
    if (res.error?.code === "23505") throw new DuplicateCodeError(p.code);
    return check(res) as PlanRow;
  }
  async getPlanByCode(code: string) {
    return check(await this.db.from("plans").select("*").eq("code", code).maybeSingle()) as PlanRow | null;
  }
  async updatePlan(id: string, patch: Partial<PlanRow>) {
    check(await this.db.from("plans").update(patch).eq("id", id));
  }
  async listPlans(filter: { clinicId?: string } = {}) {
    let q = this.db.from("plans").select("*");
    if (filter.clinicId) q = q.eq("clinic_id", filter.clinicId);
    return check(await q) as PlanRow[];
  }

  async insertSession(s: NewSession) {
    const existing = check(
      await this.db.from("sessions").select("*").eq("plan_id", s.plan_id).eq("client_id", s.client_id).maybeSingle(),
    ) as SessionRow | null;
    if (existing) return { row: existing, created: false };
    const res = await this.db.from("sessions").insert(s).select("*").single();
    if (res.error?.code === "23505") {
      const again = check(await this.db.from("sessions").select("*").eq("plan_id", s.plan_id).eq("client_id", s.client_id).single());
      return { row: again as SessionRow, created: false };
    }
    return { row: check(res) as SessionRow, created: true };
  }
  async listSessions(filter: { planIds?: string[] } = {}) {
    let q = this.db.from("sessions").select("*");
    if (filter.planIds) q = q.in("plan_id", filter.planIds.length ? filter.planIds : ["00000000-0000-0000-0000-000000000000"]);
    return check(await q) as SessionRow[];
  }

  async insertFlags(f: NewFlag[]) {
    if (!f.length) return [];
    return check(await this.db.from("flags").insert(f).select("*")) as FlagRow[];
  }
  async listFlags(filter: { planIds?: string[] } = {}) {
    let q = this.db.from("flags").select("*");
    if (filter.planIds) q = q.in("plan_id", filter.planIds.length ? filter.planIds : ["00000000-0000-0000-0000-000000000000"]);
    return check(await q) as FlagRow[];
  }
  async acknowledgeFlag(id: string, clinicId: string, at: string) {
    const flag = check(await this.db.from("flags").select("id, plan_id").eq("id", id).maybeSingle()) as { plan_id: string } | null;
    if (!flag) return false;
    const plan = check(await this.db.from("plans").select("clinic_id").eq("id", flag.plan_id).maybeSingle()) as { clinic_id: string } | null;
    if (!plan || plan.clinic_id !== clinicId) return false;
    check(await this.db.from("flags").update({ acknowledged_at: at }).eq("id", id));
    return true;
  }

  async deletePlanData(planId: string) {
    check(await this.db.from("flags").delete().eq("plan_id", planId));
    check(await this.db.from("sessions").delete().eq("plan_id", planId));
  }
  async purgeClosedBefore(isoDate: string) {
    const old = check(await this.db.from("plans").select("id").lt("closed_at", isoDate)) as { id: string }[];
    if (old.length) check(await this.db.from("plans").delete().in("id", old.map((o) => o.id)));
    return old.length;
  }
  async resetAll() {
    check(await this.db.from("clinics").delete().neq("code", "")); // cascades to plans, sessions, flags
  }
}
```

`lib/db/index.ts`:

```ts
import "server-only";
import { MemoryStore } from "./memory";
import { SupabaseStore } from "./supabase";
import type { Store } from "./types";

const g = globalThis as unknown as { __hpStore?: Store };

/**
 * Supabase when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set; otherwise an in-memory store
 * (fine for local development and tests, but it forgets everything when the server restarts).
 */
export function getStore(): Store {
  if (!g.__hpStore) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    g.__hpStore = url && key ? new SupabaseStore(url, key) : new MemoryStore();
  }
  return g.__hpStore;
}

/** Tests replace the store. */
export function setStore(s: Store): void {
  g.__hpStore = s;
}

export function usingMemoryStore(): boolean {
  return getStore() instanceof MemoryStore;
}
```

`supabase/schema.sql`:

```sql
-- TTM Home Program schema. Run once in Supabase → SQL Editor.
-- No table stores a patient's name, national ID, phone or HN.

create extension if not exists pgcrypto;

create table if not exists clinics (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  pin_hash text not null,
  phone text,
  is_demo boolean not null default false,
  settings jsonb not null default '{"disabled":[],"thresholds":{}}',
  created_at timestamptz not null default now()
);

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  secret_hash text not null,
  clinic_id uuid not null references clinics(id) on delete cascade,
  group_ids text[] not null,
  posture_ids text[] not null,
  days_per_week int not null check (days_per_week between 1 and 7),
  remind_time text not null,
  start_date date not null,
  next_visit_date date not null,
  status text not null default 'active' check (status in ('active','completed','stopped')),
  consent_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  performed_on date not null,
  pain_before int check (pain_before between 0 and 10),
  pain_after int check (pain_after between 0 and 10),
  results jsonb not null,
  answers jsonb not null,
  client_id text not null,
  created_at timestamptz not null default now(),
  unique (plan_id, client_id)
);

create table if not exists flags (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  rule_id text not null,
  level text not null check (level in ('call_1669','stop_and_contact_clinic','pause_posture','note_for_next_visit')),
  posture_id text,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz
);

create index if not exists plans_clinic_idx on plans(clinic_id);
create index if not exists sessions_plan_idx on sessions(plan_id);
create index if not exists flags_plan_idx on flags(plan_id);

-- The app talks to the database only from the server with the service role key.
-- Turn on RLS with no policies so the anon/public key can read or write nothing.
alter table clinics enable row level security;
alter table plans enable row level security;
alter table sessions enable row level security;
alter table flags enable row level security;
```

- [ ] **Step 4: คำนวณยอด PIN และข้อมูลจำลอง**

`lib/aggregate.ts`:

```ts
import { SEVERITY } from "@/lib/redflags";
import type { RedFlagLevel } from "@/lib/content/schema";
import type { ClinicRow, FlagRow, PlanRow, SessionRow } from "@/lib/db/types";

const DAY = 86_400_000;
const toDay = (d: string) => Date.parse(`${d}T00:00:00Z`);
export const daysBetween = (a: string, b: string) => Math.round((toDay(b) - toDay(a)) / DAY);
export const addDays = (d: string, n: number) => new Date(toDay(d) + n * DAY).toISOString().slice(0, 10);

/** A session counts as "done" when at least one posture was done (camera or button), not only skipped. */
const isDone = (s: SessionRow) => s.results.some((r) => r.method !== "skipped" && r.units_done > 0);

/** Share of expected sessions done in [from, to] (inclusive), capped at 1. null when nothing was expected yet. */
export function adherence(plan: PlanRow, sessions: SessionRow[], from: string, to: string): number | null {
  const start = from > plan.start_date ? from : plan.start_date;
  const end = to < plan.next_visit_date ? to : plan.next_visit_date;
  const days = daysBetween(start, end) + 1;
  if (days <= 0) return null;
  const expected = (plan.days_per_week / 7) * days;
  if (expected < 0.5) return null;
  const doneDays = new Set(sessions.filter((s) => s.plan_id === plan.id && isDone(s) && s.performed_on >= start && s.performed_on <= end).map((s) => s.performed_on));
  return Math.min(1, doneDays.size / expected);
}

export interface DashboardItem {
  code: string;
  status: PlanRow["status"];
  group_ids: string[];
  start_date: string;
  next_visit_date: string;
  adherence_7d: number | null;
  adherence_all: number | null;
  last_session_on: string | null;
  days_since_last: number | null;
  pain: { on: string; before: number | null; after: number | null }[];
  open_flags: { id: string; rule_id: string; level: RedFlagLevel; posture_id: string | null; created_at: string }[];
  notes: { rule_id: string; created_at: string }[];
  camera_share: number | null;
  priority: 0 | 1 | 2 | 3 | 4;
  priority_reason: string;
}

/** Clinic dashboard rows, most urgent first. */
export function clinicDashboard(plans: PlanRow[], sessions: SessionRow[], flags: FlagRow[], today: string): DashboardItem[] {
  const items = plans.map((p): DashboardItem => {
    const ps = sessions.filter((s) => s.plan_id === p.id).sort((a, b) => a.performed_on.localeCompare(b.performed_on));
    const pf = flags.filter((f) => f.plan_id === p.id);
    const open = pf
      .filter((f) => !f.acknowledged_at && f.level !== "note_for_next_visit")
      .sort((a, b) => SEVERITY[b.level] - SEVERITY[a.level]);
    const last = ps.length ? ps[ps.length - 1].performed_on : null;
    const sinceLast = last ? daysBetween(last, today) : p.start_date <= today ? daysBetween(p.start_date, today) : null;
    const results = ps.flatMap((s) => s.results).filter((r) => r.method !== "skipped");
    const camera = results.filter((r) => r.method === "camera").length;
    const daysToVisit = daysBetween(today, p.next_visit_date);

    let priority: DashboardItem["priority"] = 4;
    let reason = "ปกติ";
    if (p.status !== "active") {
      reason = p.status === "completed" ? "ครบคอร์สแล้ว" : "หยุดแผนแล้ว";
    } else if (open.some((f) => SEVERITY[f.level] >= 2)) {
      priority = 0;
      reason = "มีธงแดงที่ยังไม่รับทราบ";
    } else if (open.length) {
      priority = 1;
      reason = "มีท่าที่ผู้ป่วยต้องพัก";
    } else if (sinceLast !== null && sinceLast >= 3) {
      priority = 2;
      reason = `ไม่ได้ทำ ${sinceLast} วัน`;
    } else if (daysToVisit >= 0 && daysToVisit <= 2) {
      priority = 3;
      reason = "ใกล้วันนัด";
    }

    return {
      code: p.code,
      status: p.status,
      group_ids: p.group_ids,
      start_date: p.start_date,
      next_visit_date: p.next_visit_date,
      adherence_7d: adherence(p, ps, addDays(today, -6), today),
      adherence_all: adherence(p, ps, p.start_date, today),
      last_session_on: last,
      days_since_last: sinceLast,
      pain: ps.map((s) => ({ on: s.performed_on, before: s.pain_before, after: s.pain_after })),
      open_flags: open.map((f) => ({ id: f.id, rule_id: f.rule_id, level: f.level, posture_id: f.posture_id, created_at: f.created_at })),
      notes: pf.filter((f) => f.level === "note_for_next_visit").map((f) => ({ rule_id: f.rule_id, created_at: f.created_at })),
      camera_share: results.length ? camera / results.length : null,
      priority,
      priority_reason: reason,
    };
  });
  const active = (i: DashboardItem) => (i.status === "active" ? 0 : 1);
  return items.sort((a, b) => active(a) - active(b) || a.priority - b.priority || a.next_visit_date.localeCompare(b.next_visit_date));
}

export const MIN_CELL = 5; // hide counts from clinics with fewer patients than this

export interface ClinicSummary {
  clinic_code: string;
  clinic_name: string;
  is_demo: boolean;
  hidden: boolean; // fewer than MIN_CELL plans: numbers withheld
  plans: number | null;
  active_patients: number | null;
  adherence: number | null;
  completion_rate: number | null;
  camera_share: number | null;
}

export interface DtamSummary {
  generated_on: string;
  totals: { plans: number; active_patients: number; adherence: number | null; completion_rate: number | null; camera_share: number | null };
  weekly_adherence: { week_start: string; adherence: number | null }[];
  flags_by_group: { group_id: string; level: RedFlagLevel; count: number }[];
  clinics: ClinicSummary[];
}

function mean(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function stats(plans: PlanRow[], sessions: SessionRow[], today: string) {
  const activeCut = addDays(today, -13);
  const active = plans.filter((p) => p.status === "active" && sessions.some((s) => s.plan_id === p.id && s.performed_on >= activeCut)).length;
  const closed = plans.filter((p) => p.status !== "active");
  const completion = closed.length ? closed.filter((p) => p.status === "completed").length / closed.length : null;
  const results = sessions.flatMap((s) => s.results).filter((r) => r.method !== "skipped");
  const camera = results.length ? results.filter((r) => r.method === "camera").length / results.length : null;
  const adh = mean(plans.map((p) => adherence(p, sessions, p.start_date, today)));
  return { plans: plans.length, active, completion, camera, adh };
}

/** DTAM view: aggregates only, no per-patient rows, small clinics masked. */
export function dtamSummary(clinics: ClinicRow[], plans: PlanRow[], sessions: SessionRow[], flags: FlagRow[], today: string, weeks = 8): DtamSummary {
  const all = stats(plans, sessions, today);
  const weekly = Array.from({ length: weeks }, (_, i) => {
    const start = addDays(today, -7 * (weeks - i) + 1);
    const end = addDays(start, 6);
    return { week_start: start, adherence: mean(plans.map((p) => adherence(p, sessions, start, end))) };
  });
  const planGroups = new Map(plans.map((p) => [p.id, p.group_ids]));
  const counts = new Map<string, number>();
  for (const f of flags) {
    for (const g of planGroups.get(f.plan_id) ?? []) {
      const key = `${g}|${f.level}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const flagsByGroup = [...counts.entries()].map(([k, count]) => {
    const [group_id, level] = k.split("|");
    return { group_id, level: level as RedFlagLevel, count };
  });
  const perClinic = clinics.map((c): ClinicSummary => {
    const cp = plans.filter((p) => p.clinic_id === c.id);
    const ids = new Set(cp.map((p) => p.id));
    const s = stats(cp, sessions.filter((x) => ids.has(x.plan_id)), today);
    const hidden = cp.length < MIN_CELL;
    return {
      clinic_code: c.code,
      clinic_name: c.name,
      is_demo: c.is_demo,
      hidden,
      plans: hidden ? null : s.plans,
      active_patients: hidden ? null : s.active,
      adherence: hidden ? null : s.adh,
      completion_rate: hidden ? null : s.completion,
      camera_share: hidden ? null : s.camera,
    };
  });
  return {
    generated_on: today,
    totals: { plans: all.plans, active_patients: all.active, adherence: all.adh, completion_rate: all.completion, camera_share: all.camera },
    weekly_adherence: weekly,
    flags_by_group: flagsByGroup,
    clinics: perClinic,
  };
}
```

`lib/auth.ts`:

```ts
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";

/** "scrypt$<salt hex>$<hash hex>" */
export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, 32);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [alg, saltHex, hashHex] = stored.split("$");
  if (alg !== "scrypt" || !saltHex || !hashHex) return false;
  const want = Buffer.from(hashHex, "hex");
  const got = scryptSync(pin, Buffer.from(saltHex, "hex"), want.length);
  return timingSafeEqual(want, got);
}

export type SessionClaims = { role: "clinic"; clinicId: string } | { role: "dtam" };

export const CLINIC_COOKIE = "hp_clinic";
export const DTAM_COOKIE = "hp_dtam";
export const SESSION_HOURS = 12;

function key(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (32+ characters)");
  return new TextEncoder().encode(s);
}

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(key());
}

export async function readSession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.role === "clinic" && typeof payload.clinicId === "string") return { role: "clinic", clinicId: payload.clinicId };
    if (payload.role === "dtam") return { role: "dtam" };
    return null;
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_HOURS * 3600,
};
```

`lib/seed.ts`:

```ts
import { activeGroups, posturesForGroups } from "@/lib/content";
import { addDays, daysBetween } from "@/lib/aggregate";
import { hashPin } from "@/lib/auth";
import { hashSecret, newSecret } from "@/lib/plan";
import type { NewFlag, Store } from "@/lib/db/types";
import type { PostureResult } from "@/lib/pose/session";

/** Small deterministic PRNG so the demo data is the same every time. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEMO_CLINICS = [
  { code: "DEMO-A", name: "ศูนย์สาธิต ก (ข้อมูลจำลอง)", phone: "02-000-0001" },
  { code: "DEMO-B", name: "ศูนย์สาธิต ข (ข้อมูลจำลอง)", phone: "02-000-0002" },
  { code: "DEMO-C", name: "ศูนย์สาธิต ค (ข้อมูลจำลอง)", phone: "02-000-0003" },
];

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Fill the store with 3 demo clinics, ~60 plans over the last 8 weeks. Returns counts. */
export async function seedDemo(store: Store, today: string, pin: string, seed = 42) {
  const rnd = mulberry32(seed);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
  const groups = activeGroups().map((g) => g.id);
  let plansMade = 0;
  let sessionsMade = 0;
  let flagsMade = 0;

  for (const [ci, c] of DEMO_CLINICS.entries()) {
    const clinic = await store.insertClinic({ ...c, pin_hash: hashPin(pin), is_demo: true, settings: { disabled: [], thresholds: {} } });
    for (let i = 0; i < 20; i++) {
      const g1 = pick(groups);
      const groupIds = rnd() < 0.3 ? [...new Set([g1, pick(groups)])] : [g1];
      const start = addDays(today, -Math.floor(rnd() * 56));
      const length = 14 + Math.floor(rnd() * 15);
      const visit = addDays(start, length);
      const days = pick([3, 5, 7] as const);
      const code = `${LETTERS[ci * 3]}${LETTERS[(i * 7) % 24]}${LETTERS[(i * 11 + ci) % 24]}-${2 + (i % 8)}${2 + ((i * 3 + ci) % 8)}`;
      const ended = visit < today;
      const plan = await store.insertPlan({
        code,
        secret_hash: hashSecret(newSecret()),
        clinic_id: clinic.id,
        group_ids: groupIds,
        posture_ids: posturesForGroups(groupIds),
        days_per_week: days,
        remind_time: pick(["07:00", "12:00", "19:00", "20:00"]),
        start_date: start,
        next_visit_date: visit,
      });
      plansMade++;
      await store.updatePlan(plan.id, {
        consent_at: `${start}T03:00:00Z`,
        ...(ended ? { status: rnd() < 0.8 ? "completed" : "stopped", closed_at: `${visit}T09:00:00Z` } : {}),
      });

      // Adherence starts high and fades, like real home programmes.
      const p0 = 0.6 + rnd() * 0.35;
      const lastDay = ended ? visit : today;
      let pain = 4 + Math.floor(rnd() * 4);
      for (let d = 0; d <= daysBetween(start, lastDay); d++) {
        const on = addDays(start, d);
        if (rnd() > (days / 7) * p0 * Math.exp(-d / 40)) continue;
        const before = Math.max(0, Math.min(10, pain + Math.round(rnd() * 2 - 1)));
        const after = Math.max(0, Math.min(10, before + Math.round(rnd() * 2 - 1.2)));
        if (rnd() < 0.15 && pain > 1) pain--;
        const results: PostureResult[] = plan.posture_ids.map((pid) => {
          const camera = rnd() < 0.7;
          return { posture_id: pid, method: camera ? "camera" : "button", units_done: 3, units_target: 3, seconds_held: camera ? 30 : 0 };
        });
        const answers: Record<string, boolean> = {};
        const flags: Omit<NewFlag, "session_id">[] = [];
        const r = rnd();
        if (r < 0.06) {
          answers.RF09 = true;
          flags.push({ plan_id: plan.id, rule_id: "RF09", level: "note_for_next_visit", posture_id: null });
        } else if (r < 0.075) {
          answers.RF04 = true;
          flags.push({ plan_id: plan.id, rule_id: "RF04", level: "stop_and_contact_clinic", posture_id: plan.posture_ids[0] });
        } else if (r < 0.09) {
          answers.RF11 = true;
          flags.push({ plan_id: plan.id, rule_id: "RF11", level: "pause_posture", posture_id: plan.posture_ids[plan.posture_ids.length - 1] });
        }
        const { row } = await store.insertSession({
          plan_id: plan.id, performed_on: on, pain_before: before, pain_after: after, results, answers, client_id: `seed-${code}-${d}`,
        });
        sessionsMade++;
        if (flags.length) {
          const inserted = await store.insertFlags(flags.map((f) => ({ ...f, session_id: row.id })));
          flagsMade += inserted.length;
          // Older flags were already seen by the clinic.
          for (const f of inserted) if (daysBetween(on, today) > 3) await store.acknowledgeFlag(f.id, clinic.id, `${on}T10:00:00Z`);
        }
      }
    }
  }
  return { clinics: DEMO_CLINICS.length, plans: plansMade, sessions: sessionsMade, flags: flagsMade };
}
```

- [ ] **Step 5: รันให้ผ่าน**

Run: `npx vitest run tests/aggregate.test.ts`
Expected: PASS 12 tests (ข้อมูลจำลองได้ 3 ศูนย์ 60 แผน และได้ผลเดิมทุกครั้ง)

- [ ] **Step 6: Commit**

```bash
git add lib/db lib/aggregate.ts lib/auth.ts lib/seed.ts supabase tests/aggregate.test.ts
git commit -m "feat(data): store (memory + Supabase), aggregates, PIN/session auth and demo seed"
```

---

### Task 8: API ทั้งหมด

**Files:**
- Create: `lib/http.ts`, `lib/api/schemas.ts`, `lib/api/guards.ts`, `app/api/clinic/login/route.ts`, `app/api/clinic/logout/route.ts`, `app/api/clinic/dashboard/route.ts`, `app/api/clinic/settings/route.ts`, `app/api/plans/route.ts`, `app/api/plans/[code]/route.ts`, `app/api/plans/[code]/reissue/route.ts`, `app/api/flags/[id]/ack/route.ts`, `app/api/p/[code]/plan/route.ts`, `app/api/p/[code]/consent/route.ts`, `app/api/p/[code]/sessions/route.ts`, `app/api/p/[code]/delete/route.ts`, `app/api/p/[code]/calendar/route.ts`, `app/api/dtam/login/route.ts`, `app/api/dtam/summary/route.ts`, `app/api/demo/reset/route.ts`, `tests/api.test.ts`

**Interfaces:**
- Consumes: ทุกอย่างจาก Task 2–7
- Produces: HTTP API ตามสเปกข้อ 7 ข้อผิดพลาดตอบรูปแบบ `{error, message_th}` เสมอ

- [ ] **Step 1: เทสต์** (เรียก handler ตรง ๆ ด้วย `Request` และใช้ `MemoryStore`)

`tests/api.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { hashPin } from "@/lib/auth";
import { setStore } from "@/lib/db";
import { MemoryStore } from "@/lib/db/memory";
import { addDays } from "@/lib/aggregate";
import { bangkokToday, resetRateLimits } from "@/lib/http";
import { POST as login } from "@/app/api/clinic/login/route";
import { POST as createPlan } from "@/app/api/plans/route";
import { PATCH as patchPlan } from "@/app/api/plans/[code]/route";
import { POST as reissue } from "@/app/api/plans/[code]/reissue/route";
import { GET as dashboard } from "@/app/api/clinic/dashboard/route";
import { PUT as putSettings } from "@/app/api/clinic/settings/route";
import { POST as ack } from "@/app/api/flags/[id]/ack/route";
import { POST as getPlan } from "@/app/api/p/[code]/plan/route";
import { POST as consent } from "@/app/api/p/[code]/consent/route";
import { POST as postSession } from "@/app/api/p/[code]/sessions/route";
import { POST as deleteMine } from "@/app/api/p/[code]/delete/route";
import { GET as calendar } from "@/app/api/p/[code]/calendar/route";
import { POST as dtamLogin } from "@/app/api/dtam/login/route";
import { GET as dtamSummaryRoute } from "@/app/api/dtam/summary/route";
import { POST as demoReset } from "@/app/api/demo/reset/route";

process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-123";
process.env.DTAM_DEMO_PASSWORD = "dtam-demo";

const BASE = "http://localhost:3000";
const post = (path: string, body: unknown, cookie = "") =>
  new Request(`${BASE}${path}`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) });
const get = (path: string, cookie = "") => new Request(`${BASE}${path}`, { headers: { cookie } });
const params = <T,>(p: T) => ({ params: Promise.resolve(p) });
const cookieOf = (res: Response) => (res.headers.get("set-cookie") ?? "").split(";")[0];

let store: MemoryStore;
let clinicCookie: string;
const today = bangkokToday();

beforeEach(async () => {
  resetRateLimits();
  store = new MemoryStore();
  setStore(store);
  await store.insertClinic({ code: "CLINIC1", name: "คลินิกทดสอบ", pin_hash: hashPin("123456"), phone: "02-111-1111", is_demo: false, settings: { disabled: [], thresholds: {} } });
  await store.insertClinic({ code: "CLINIC2", name: "คลินิกอื่น", pin_hash: hashPin("654321"), phone: null, is_demo: false, settings: { disabled: [], thresholds: {} } });
  const res = await login(post("/api/clinic/login", { code: "clinic1", pin: "123456" }));
  clinicCookie = cookieOf(res);
});

async function newPlan(cookie = clinicCookie) {
  const res = await createPlan(post("/api/plans", {
    group_ids: ["knee"], posture_ids: ["kae-klon", "damrong-kai-ayu-yuen"], days_per_week: 7, remind_time: "19:00",
    start_date: today, next_visit_date: addDays(today, 14),
  }, cookie));
  return { res, body: (await res.json()) as { code: string; secret: string } };
}

const session = (over: Record<string, unknown> = {}) => ({
  client_id: "client-0001", performed_on: today, pain_before: 4, pain_after: 4,
  results: [{ posture_id: "kae-klon", method: "camera", units_done: 3, units_target: 3, seconds_held: 31 }],
  answers: {}, posture_flags: [], ...over,
});

describe("clinic auth", () => {
  it("logs in with code + pin and sets an httpOnly cookie", async () => {
    const res = await login(post("/api/clinic/login", { code: "CLINIC1", pin: "123456" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/hp_clinic=.+HttpOnly/);
  });
  it("rejects a wrong pin and locks after 5 failures", async () => {
    for (let i = 0; i < 5; i++) expect((await login(post("/api/clinic/login", { code: "CLINIC2", pin: "000000" }))).status).toBe(401);
    expect((await login(post("/api/clinic/login", { code: "CLINIC2", pin: "654321" }))).status).toBe(429);
  });
  it("requires login for clinic routes", async () => {
    expect((await dashboard(get("/api/clinic/dashboard"))).status).toBe(401);
    expect((await newPlan("")).res.status).toBe(401);
  });
});

describe("plans", () => {
  it("creates a plan and returns the secret once; only its hash is stored", async () => {
    const { res, body } = await newPlan();
    expect(res.status).toBe(201);
    expect(body.code).toMatch(/^[A-Z]{3}-\d{2}$/);
    const row = store.plans[0];
    expect(row.secret_hash).not.toContain(body.secret);
    expect(JSON.stringify(store.plans)).not.toContain(body.secret);
  });
  it("rejects postures outside the content and a visit before the start", async () => {
    const bad = await createPlan(post("/api/plans", { group_ids: ["knee"], posture_ids: ["made-up"], days_per_week: 7, remind_time: "19:00", start_date: today, next_visit_date: addDays(today, 7) }, clinicCookie));
    expect(bad.status).toBe(400);
    const bad2 = await createPlan(post("/api/plans", { group_ids: ["knee"], posture_ids: ["kae-klon"], days_per_week: 7, remind_time: "19:00", start_date: today, next_visit_date: today }, clinicCookie));
    expect(bad2.status).toBe(400);
  });
  it("another clinic cannot touch the plan", async () => {
    const { body } = await newPlan();
    const other = cookieOf(await login(post("/api/clinic/login", { code: "CLINIC2", pin: "654321" })));
    const res = await patchPlan(new Request(`${BASE}/api/plans/${body.code}`, { method: "PATCH", headers: { cookie: other }, body: JSON.stringify({ status: "stopped" }) }), params({ code: body.code }));
    expect(res.status).toBe(404);
  });
  it("reissuing a slip invalidates the old secret", async () => {
    const { body } = await newPlan();
    const re = await (await reissue(post(`/api/plans/${body.code}/reissue`, {}, clinicCookie), params({ code: body.code }))).json();
    expect((await getPlan(post(`/api/p/${body.code}/plan`, { secret: body.secret }), params({ code: body.code }))).status).toBe(401);
    expect((await getPlan(post(`/api/p/${body.code}/plan`, { secret: re.secret }), params({ code: body.code }))).status).toBe(200);
  });
});

describe("patient flow", () => {
  it("needs the right secret (same answer for wrong code and wrong secret)", async () => {
    const { body } = await newPlan();
    const wrong = await getPlan(post(`/api/p/${body.code}/plan`, { secret: "A".repeat(22) }), params({ code: body.code }));
    const nocode = await getPlan(post(`/api/p/ZZZ-99/plan`, { secret: body.secret }), params({ code: "ZZZ-99" }));
    expect(wrong.status).toBe(401);
    expect(nocode.status).toBe(401);
    expect(await wrong.json()).toEqual(await nocode.json());
  });

  it("requires consent before sessions, then stores the session", async () => {
    const { body } = await newPlan();
    const p = params({ code: body.code });
    expect((await postSession(post(`/api/p/${body.code}/sessions`, { secret: body.secret, session: session() }), p)).status).toBe(403);
    expect((await consent(post(`/api/p/${body.code}/consent`, { secret: body.secret }), p)).status).toBe(200);
    const res = await postSession(post(`/api/p/${body.code}/sessions`, { secret: body.secret, session: session() }), p);
    expect(res.status).toBe(201);
    expect(store.sessions).toHaveLength(1);
  });

  it("is idempotent on client_id (offline retries)", async () => {
    const { body } = await newPlan();
    const p = params({ code: body.code });
    await consent(post(`/api/p/${body.code}/consent`, { secret: body.secret }), p);
    await postSession(post(`/api/p/${body.code}/sessions`, { secret: body.secret, session: session({ answers: { RF04: true } }) }), p);
    const again = await postSession(post(`/api/p/${body.code}/sessions`, { secret: body.secret, session: session({ answers: { RF04: true } }) }), p);
    expect(again.status).toBe(200);
    expect((await again.json()).duplicate).toBe(true);
    expect(store.sessions).toHaveLength(1);
    expect(store.flags).toHaveLength(1);
  });

  it("re-evaluates red flags on the server and attaches the posture", async () => {
    const { body } = await newPlan();
    const p = params({ code: body.code });
    await consent(post(`/api/p/${body.code}/consent`, { secret: body.secret }), p);
    const res = await postSession(post(`/api/p/${body.code}/sessions`, {
      secret: body.secret,
      session: session({ answers: { RF04: true }, posture_flags: [{ rule_id: "RF04", posture_id: "kae-klon" }] }),
    }), p);
    const out = await res.json();
    expect(out.worst).toMatchObject({ rule_id: "RF04", level: "stop_and_contact_clinic", posture_id: "kae-klon" });
    expect(store.flags[0]).toMatchObject({ rule_id: "RF04", posture_id: "kae-klon" });
  });

  it("rejects results for postures that are not in the plan", async () => {
    const { body } = await newPlan();
    const p = params({ code: body.code });
    await consent(post(`/api/p/${body.code}/consent`, { secret: body.secret }), p);
    const res = await postSession(post(`/api/p/${body.code}/sessions`, {
      secret: body.secret, session: session({ results: [{ posture_id: "kae-kiat", method: "button", units_done: 6, units_target: 6, seconds_held: 0 }] }),
    }), p);
    expect(res.status).toBe(400);
  });

  it("serves a calendar file only with the secret", async () => {
    const { body } = await newPlan();
    const ok = await calendar(get(`/api/p/${body.code}/calendar?k=${body.secret}`), params({ code: body.code }));
    expect(ok.headers.get("content-type")).toContain("text/calendar");
    expect(await ok.text()).toContain("RRULE:FREQ=DAILY");
    expect((await calendar(get(`/api/p/${body.code}/calendar?k=bad`), params({ code: body.code }))).status).toBe(401);
  });

  it("'ลบข้อมูลของฉัน' deletes sessions and flags and stops the plan", async () => {
    const { body } = await newPlan();
    const p = params({ code: body.code });
    await consent(post(`/api/p/${body.code}/consent`, { secret: body.secret }), p);
    await postSession(post(`/api/p/${body.code}/sessions`, { secret: body.secret, session: session({ answers: { RF04: true } }) }), p);
    expect((await deleteMine(post(`/api/p/${body.code}/delete`, { secret: body.secret }), p)).status).toBe(200);
    expect(store.sessions).toHaveLength(0);
    expect(store.flags).toHaveLength(0);
    expect(store.plans[0].status).toBe("stopped");
    expect(store.plans[0].consent_at).toBeNull();
  });
});

describe("clinic dashboard and settings", () => {
  it("shows the flag and lets the clinic acknowledge it", async () => {
    const { body } = await newPlan();
    const p = params({ code: body.code });
    await consent(post(`/api/p/${body.code}/consent`, { secret: body.secret }), p);
    await postSession(post(`/api/p/${body.code}/sessions`, { secret: body.secret, session: session({ answers: { RF04: true } }) }), p);
    const dash = await (await dashboard(get("/api/clinic/dashboard", clinicCookie))).json();
    expect(dash.items[0].open_flags[0].rule_id).toBe("RF04");
    expect(dash.items[0].priority).toBe(0);
    const id = dash.items[0].open_flags[0].id;
    expect((await ack(post(`/api/flags/${id}/ack`, {}, clinicCookie), params({ id }))).status).toBe(200);
    const after = await (await dashboard(get("/api/clinic/dashboard", clinicCookie))).json();
    expect(after.items[0].open_flags).toEqual([]);
  });

  it("refuses to disable emergency rules", async () => {
    const put = (b: unknown) => putSettings(new Request(`${BASE}/api/clinic/settings`, { method: "PUT", headers: { cookie: clinicCookie }, body: JSON.stringify(b) }));
    expect((await put({ disabled: ["RF01"], thresholds: {} })).status).toBe(400);
    expect((await put({ disabled: ["RF09"], thresholds: { RF08: 4 } })).status).toBe(200);
  });
});

describe("DTAM and demo", () => {
  it("DTAM summary needs the demo password", async () => {
    expect((await dtamSummaryRoute(get("/api/dtam/summary"))).status).toBe(401);
    expect((await dtamLogin(post("/api/dtam/login", { password: "nope" }))).status).toBe(401);
    const c = cookieOf(await dtamLogin(post("/api/dtam/login", { password: "dtam-demo" })));
    const res = await dtamSummaryRoute(get("/api/dtam/summary", c));
    expect(res.status).toBe(200);
    expect((await res.json()).clinics).toHaveLength(2);
  });

  it("demo reset is off without a token and reseeds with one", async () => {
    delete process.env.DEMO_RESET_TOKEN;
    expect((await demoReset(post("/api/demo/reset", { token: "whatever-token" }))).status).toBe(404);
    process.env.DEMO_RESET_TOKEN = "reset-token-123";
    const res = await demoReset(post("/api/demo/reset", { token: "reset-token-123" }));
    expect(res.status).toBe(200);
    expect(store.clinics.map((c) => c.code)).toEqual(["DEMO-A", "DEMO-B", "DEMO-C"]);
  });
});

describe("privacy", () => {
  it("stores no field that could hold a name, phone of a patient or HN", () => {
    const planKeys = ["id", "code", "secret_hash", "clinic_id", "group_ids", "posture_ids", "days_per_week", "remind_time", "start_date", "next_visit_date", "status", "consent_at", "closed_at", "created_at"];
    for (const k of planKeys) expect(k).not.toMatch(/name|phone|hn|citizen|id_card/i);
  });
});
```

- [ ] **Step 2: รันให้ fail**

Run: `npx vitest run tests/api.test.ts`
Expected: FAIL

- [ ] **Step 3: ตัวช่วย HTTP สคีมา และ guard**

`lib/http.ts`:

```ts
import type { z } from "zod";
import { CLINIC_COOKIE, DTAM_COOKIE, cookieOptions, readSession } from "@/lib/auth";

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });

/** Thai error message for people, short code for the app. Never includes stack traces. */
export const fail = (status: number, code: string, message_th: string) => json({ error: code, message_th }, status);

export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T> | Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail(400, "bad_json", "ข้อมูลไม่ถูกต้อง");
  }
  const r = schema.safeParse(raw);
  return r.success ? r.data : fail(400, "bad_request", "ข้อมูลไม่ครบหรือไม่ถูกต้อง");
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function setCookie(name: string, value: string, maxAge = cookieOptions.maxAge): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${cookieOptions.path}`, `Max-Age=${maxAge}`, "HttpOnly", "SameSite=Lax"];
  if (cookieOptions.secure) parts.push("Secure");
  return parts.join("; ");
}

export async function clinicIdFrom(req: Request): Promise<string | null> {
  const s = await readSession(readCookie(req, CLINIC_COOKIE));
  return s?.role === "clinic" ? s.clinicId : null;
}

export async function isDtam(req: Request): Promise<boolean> {
  const s = await readSession(readCookie(req, DTAM_COOKIE));
  return s?.role === "dtam";
}

// --- rate limiting (per server instance; good enough for a prototype) ---
const hits = new Map<string, number[]>();

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

/** true when the caller is still under `limit` requests per `windowMs` for this bucket. */
export function allow(bucket: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const list = (hits.get(bucket) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= limit) {
    hits.set(bucket, list);
    return false;
  }
  list.push(now);
  hits.set(bucket, list);
  return true;
}

// --- PIN lockout: 5 wrong PINs lock a clinic code for 5 minutes ---
const failures = new Map<string, { count: number; until: number }>();

export function isLocked(code: string, now = Date.now()): boolean {
  const f = failures.get(code);
  return !!f && f.until > now;
}

export function recordFailure(code: string, now = Date.now()): void {
  const count = (failures.get(code)?.count ?? 0) + 1;
  failures.set(code, { count, until: count >= 5 ? now + 5 * 60_000 : 0 });
}

export function clearFailures(code: string): void {
  failures.delete(code);
}

export function resetRateLimits(): void {
  hits.clear();
  failures.clear();
}

/** Today in Thailand (UTC+7) as YYYY-MM-DD. */
export function bangkokToday(now = Date.now()): string {
  return new Date(now + 7 * 3600_000).toISOString().slice(0, 10);
}
```

`lib/api/schemas.ts` (`answers` ต้องใช้ `z.partialRecord` เพราะ `z.record` กับ enum ใน zod 4 บังคับให้มีครบทุก key):

```ts
import { z } from "zod";
import { activeGroups, postures, redflags } from "@/lib/content";
import { PLAN_CODE_RE } from "@/lib/plan";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const postureId = z.enum(postures.map((p) => p.id) as [string, ...string[]]);
const groupId = z.enum(activeGroups().map((g) => g.id) as [string, ...string[]]);
const ruleId = z.enum(redflags.rules.map((r) => r.id) as [string, ...string[]]);
const adjustable = redflags.rules.filter((r) => r.clinic_adjustable).map((r) => r.id);

export const LoginBody = z.object({ code: z.string().min(2).max(20), pin: z.string().regex(/^\d{6}$/) });
export const DtamLoginBody = z.object({ password: z.string().min(1).max(100) });

export const CreatePlanBody = z
  .object({
    group_ids: z.array(groupId).min(1).max(3),
    posture_ids: z.array(postureId).min(1).max(13),
    days_per_week: z.number().int().min(1).max(7),
    remind_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    start_date: date,
    next_visit_date: date,
  })
  .refine((b) => b.next_visit_date > b.start_date, { message: "next visit must be after start" });

export const PatchPlanBody = z.object({
  status: z.enum(["completed", "stopped"]).optional(),
  next_visit_date: date.optional(),
});

export const SettingsBody = z.object({
  disabled: z.array(z.string()).refine((ids) => ids.every((id) => adjustable.includes(id)), "only adjustable rules"),
  thresholds: z.record(z.string(), z.number().min(1).max(10)).refine((t) => Object.keys(t).every((id) => adjustable.includes(id)), "only adjustable rules"),
});

export const SecretBody = z.object({ secret: z.string().regex(/^[A-Za-z0-9_-]{22}$/) });

export const PostureResultSchema = z.object({
  posture_id: postureId,
  method: z.enum(["camera", "button", "skipped"]),
  units_done: z.number().int().min(0).max(20),
  units_target: z.number().int().min(1).max(20),
  seconds_held: z.number().min(0).max(3600),
});

export const SessionBody = SecretBody.extend({
  session: z.object({
    client_id: z.string().min(8).max(64),
    performed_on: date,
    pain_before: z.number().int().min(0).max(10).nullable(),
    pain_after: z.number().int().min(0).max(10).nullable(),
    results: z.array(PostureResultSchema).max(13),
    answers: z.partialRecord(ruleId, z.boolean()),
    posture_flags: z.array(z.object({ rule_id: ruleId, posture_id: postureId })).max(30).default([]),
  }),
});

export const ResetBody = z.object({ token: z.string().min(8) });

export const planCodeOk = (code: string) => PLAN_CODE_RE.test(code);
```

`lib/api/guards.ts`:

```ts
import { getStore } from "@/lib/db";
import type { PlanRow } from "@/lib/db/types";
import { allow, clientIp, clinicIdFrom, fail } from "@/lib/http";
import { secretMatches } from "@/lib/plan";
import { planCodeOk } from "./schemas";

/** Plan owned by the logged-in clinic, or an error response. */
export async function ownedPlan(req: Request, code: string): Promise<{ plan: PlanRow; clinicId: string } | Response> {
  const clinicId = await clinicIdFrom(req);
  if (!clinicId) return fail(401, "unauthorized", "โปรดเข้าสู่ระบบคลินิก");
  const plan = planCodeOk(code) ? await getStore().getPlanByCode(code) : null;
  if (!plan || plan.clinic_id !== clinicId) return fail(404, "not_found", "ไม่พบแผนนี้");
  return { plan, clinicId };
}

/** Plan for a patient presenting the secret from the QR. Same answer for "wrong code" and "wrong secret". */
export async function patientPlan(req: Request, code: string, secret: string, opts: { allowClosed?: boolean } = {}): Promise<PlanRow | Response> {
  if (!allow(`patient:${clientIp(req)}`, 120, 60_000)) return fail(429, "rate_limited", "ลองใหม่อีกครั้งในอีกสักครู่");
  const plan = planCodeOk(code) ? await getStore().getPlanByCode(code) : null;
  if (!plan || !secretMatches(secret, plan.secret_hash)) return fail(401, "bad_link", "ลิงก์นี้ใช้ไม่ได้แล้ว โปรดติดต่อคลินิก");
  if (!opts.allowClosed && plan.status !== "active") return fail(410, "closed", "แผนนี้ปิดแล้ว โปรดติดต่อคลินิก");
  return plan;
}
```

- [ ] **Step 4: routes ฝั่งคลินิก**

`app/api/clinic/login/route.ts`:

```ts
import { CLINIC_COOKIE, signSession, verifyPin } from "@/lib/auth";
import { LoginBody } from "@/lib/api/schemas";
import { getStore } from "@/lib/db";
import { allow, clearFailures, clientIp, fail, isLocked, json, parseBody, recordFailure, setCookie } from "@/lib/http";

export async function POST(req: Request) {
  if (!allow(`login:${clientIp(req)}`, 20, 60_000)) return fail(429, "rate_limited", "ลองใหม่อีกครั้งในอีกสักครู่");
  const body = await parseBody(req, LoginBody);
  if (body instanceof Response) return body;
  const code = body.code.trim().toUpperCase();
  if (isLocked(code)) return fail(429, "locked", "ใส่ PIN ผิดหลายครั้ง โปรดรอ 5 นาที");

  const clinic = await getStore().getClinicByCode(code);
  if (!clinic || !verifyPin(body.pin, clinic.pin_hash)) {
    recordFailure(code);
    return fail(401, "bad_login", "รหัสคลินิกหรือ PIN ไม่ถูกต้อง");
  }
  clearFailures(code);
  const token = await signSession({ role: "clinic", clinicId: clinic.id });
  return json({ ok: true, clinic: { code: clinic.code, name: clinic.name } }, 200, { "set-cookie": setCookie(CLINIC_COOKIE, token) });
}
```

`app/api/clinic/logout/route.ts`:

```ts
import { CLINIC_COOKIE } from "@/lib/auth";
import { json, setCookie } from "@/lib/http";

export async function POST() {
  return json({ ok: true }, 200, { "set-cookie": setCookie(CLINIC_COOKIE, "", 0) });
}
```

`app/api/clinic/dashboard/route.ts`:

```ts
import { clinicDashboard } from "@/lib/aggregate";
import { getStore, usingMemoryStore } from "@/lib/db";
import { bangkokToday, clinicIdFrom, fail, json } from "@/lib/http";

export async function GET(req: Request) {
  const clinicId = await clinicIdFrom(req);
  if (!clinicId) return fail(401, "unauthorized", "โปรดเข้าสู่ระบบคลินิก");
  const store = getStore();
  const clinic = await store.getClinic(clinicId);
  if (!clinic) return fail(401, "unauthorized", "โปรดเข้าสู่ระบบคลินิก");
  const plans = await store.listPlans({ clinicId });
  const ids = plans.map((p) => p.id);
  const [sessions, flags] = await Promise.all([store.listSessions({ planIds: ids }), store.listFlags({ planIds: ids })]);
  return json({
    clinic: { code: clinic.code, name: clinic.name, phone: clinic.phone, is_demo: clinic.is_demo, settings: clinic.settings },
    items: clinicDashboard(plans, sessions, flags, bangkokToday()),
    data_as_of: new Date().toISOString(),
    memory_store: usingMemoryStore(),
  });
}
```

`app/api/clinic/settings/route.ts`:

```ts
import { SettingsBody } from "@/lib/api/schemas";
import { getStore } from "@/lib/db";
import { clinicIdFrom, fail, json, parseBody } from "@/lib/http";

/** Clinics may only change rules marked clinic_adjustable (🟡/⚪). */
export async function PUT(req: Request) {
  const clinicId = await clinicIdFrom(req);
  if (!clinicId) return fail(401, "unauthorized", "โปรดเข้าสู่ระบบคลินิก");
  const body = await parseBody(req, SettingsBody);
  if (body instanceof Response) return body;
  await getStore().updateClinicSettings(clinicId, body);
  return json({ ok: true, settings: body });
}
```

`app/api/plans/route.ts`:

```ts
import { CreatePlanBody } from "@/lib/api/schemas";
import { getStore } from "@/lib/db";
import { DuplicateCodeError } from "@/lib/db/types";
import { allow, clientIp, clinicIdFrom, fail, json, parseBody } from "@/lib/http";
import { hashSecret, newPlanCode, newSecret } from "@/lib/plan";

/** Clinic creates a plan. The secret is returned once (for the QR) and only its hash is stored. */
export async function POST(req: Request) {
  const clinicId = await clinicIdFrom(req);
  if (!clinicId) return fail(401, "unauthorized", "โปรดเข้าสู่ระบบคลินิก");
  if (!allow(`plans:${clientIp(req)}`, 60, 60_000)) return fail(429, "rate_limited", "ลองใหม่อีกครั้งในอีกสักครู่");
  const body = await parseBody(req, CreatePlanBody);
  if (body instanceof Response) return body;

  const secret = newSecret();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const plan = await getStore().insertPlan({ ...body, code: newPlanCode(), secret_hash: hashSecret(secret), clinic_id: clinicId });
      return json({ code: plan.code, secret }, 201);
    } catch (e) {
      if (!(e instanceof DuplicateCodeError)) throw e;
    }
  }
  return fail(503, "code_exhausted", "สร้างรหัสแผนไม่สำเร็จ โปรดลองใหม่");
}
```

`app/api/plans/[code]/route.ts`:

```ts
import { ownedPlan } from "@/lib/api/guards";
import { PatchPlanBody } from "@/lib/api/schemas";
import { getStore } from "@/lib/db";
import { json, parseBody } from "@/lib/http";

/** Clinic closes a plan (completed / stopped) or moves the next visit. */
export async function PATCH(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const owned = await ownedPlan(req, code);
  if (owned instanceof Response) return owned;
  const body = await parseBody(req, PatchPlanBody);
  if (body instanceof Response) return body;
  const patch: Parameters<ReturnType<typeof getStore>["updatePlan"]>[1] = {};
  if (body.next_visit_date) patch.next_visit_date = body.next_visit_date;
  if (body.status) {
    patch.status = body.status;
    patch.closed_at = new Date().toISOString();
  }
  await getStore().updatePlan(owned.plan.id, patch);
  return json({ ok: true });
}
```

`app/api/plans/[code]/reissue/route.ts`:

```ts
import { ownedPlan } from "@/lib/api/guards";
import { getStore } from "@/lib/db";
import { json } from "@/lib/http";
import { hashSecret, newSecret } from "@/lib/plan";

/** New slip for a lost QR: replaces the secret, so the old link stops working. */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const owned = await ownedPlan(req, code);
  if (owned instanceof Response) return owned;
  const secret = newSecret();
  await getStore().updatePlan(owned.plan.id, { secret_hash: hashSecret(secret) });
  return json({ code, secret });
}
```

`app/api/flags/[id]/ack/route.ts`:

```ts
import { getStore } from "@/lib/db";
import { clinicIdFrom, fail, json } from "@/lib/http";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const clinicId = await clinicIdFrom(req);
  if (!clinicId) return fail(401, "unauthorized", "โปรดเข้าสู่ระบบคลินิก");
  const { id } = await ctx.params;
  const ok = await getStore().acknowledgeFlag(id, clinicId, new Date().toISOString());
  return ok ? json({ ok: true }) : fail(404, "not_found", "ไม่พบรายการนี้");
}
```

- [ ] **Step 5: routes ฝั่งผู้ป่วย กรมฯ และเดโม**

`app/api/p/[code]/plan/route.ts`:

```ts
import { patientPlan } from "@/lib/api/guards";
import { SecretBody } from "@/lib/api/schemas";
import { getStore } from "@/lib/db";
import { json, parseBody } from "@/lib/http";

/** What the patient's phone needs to run the plan. No clinic-internal data. */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const body = await parseBody(req, SecretBody);
  if (body instanceof Response) return body;
  const plan = await patientPlan(req, code, body.secret, { allowClosed: true });
  if (plan instanceof Response) return plan;
  const clinic = await getStore().getClinic(plan.clinic_id);
  return json({
    code: plan.code,
    status: plan.status,
    group_ids: plan.group_ids,
    posture_ids: plan.posture_ids,
    days_per_week: plan.days_per_week,
    remind_time: plan.remind_time,
    start_date: plan.start_date,
    next_visit_date: plan.next_visit_date,
    consent_at: plan.consent_at,
    clinic: { name: clinic?.name ?? "", phone: clinic?.phone ?? null },
    settings: clinic?.settings ?? { disabled: [], thresholds: {} },
  });
}
```

`app/api/p/[code]/consent/route.ts`:

```ts
import { patientPlan } from "@/lib/api/guards";
import { SecretBody } from "@/lib/api/schemas";
import { getStore } from "@/lib/db";
import { json, parseBody } from "@/lib/http";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const body = await parseBody(req, SecretBody);
  if (body instanceof Response) return body;
  const plan = await patientPlan(req, code, body.secret);
  if (plan instanceof Response) return plan;
  const at = plan.consent_at ?? new Date().toISOString();
  if (!plan.consent_at) await getStore().updatePlan(plan.id, { consent_at: at });
  return json({ ok: true, consent_at: at });
}
```

`app/api/p/[code]/sessions/route.ts`:

```ts
import { patientPlan } from "@/lib/api/guards";
import { SessionBody } from "@/lib/api/schemas";
import { addDays } from "@/lib/aggregate";
import { getStore } from "@/lib/db";
import { bangkokToday, fail, json, parseBody } from "@/lib/http";
import { evaluateRedFlags, worst } from "@/lib/redflags";

/**
 * Patient submits one session. The server re-evaluates the red flags with the same rules the phone used,
 * stores the session and the flags, and returns the response the phone should show.
 */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const body = await parseBody(req, SessionBody);
  if (body instanceof Response) return body;
  const plan = await patientPlan(req, code, body.secret);
  if (plan instanceof Response) return plan;
  if (!plan.consent_at) return fail(403, "no_consent", "โปรดกดยินยอมก่อนเริ่มใช้งาน");

  const s = body.session;
  const today = bangkokToday();
  if (s.performed_on > addDays(today, 1) || s.performed_on < addDays(plan.start_date, -1)) {
    return fail(400, "bad_date", "วันที่ไม่ถูกต้อง");
  }
  const allowed = new Set(plan.posture_ids);
  if (s.results.some((r) => !allowed.has(r.posture_id))) return fail(400, "bad_posture", "มีท่าที่ไม่อยู่ในแผน");

  const store = getStore();
  const clinic = await store.getClinic(plan.clinic_id);
  const fired = evaluateRedFlags({ answers: s.answers, painBefore: s.pain_before, painAfter: s.pain_after }, clinic?.settings);
  const postureOf = new Map(s.posture_flags.map((p) => [p.rule_id, p.posture_id]));
  const flags = fired.map((f) => ({ ...f, posture_id: postureOf.get(f.rule_id) ?? null }));

  const { row, created } = await store.insertSession({
    plan_id: plan.id,
    performed_on: s.performed_on,
    pain_before: s.pain_before,
    pain_after: s.pain_after,
    results: s.results,
    answers: s.answers,
    client_id: s.client_id,
  });
  if (created && flags.length) {
    await store.insertFlags(flags.map((f) => ({ plan_id: plan.id, session_id: row.id, rule_id: f.rule_id, level: f.level, posture_id: f.posture_id })));
  }
  return json({ ok: true, duplicate: !created, flags, worst: worst(flags) }, created ? 201 : 200);
}
```

`app/api/p/[code]/delete/route.ts`:

```ts
import { patientPlan } from "@/lib/api/guards";
import { SecretBody } from "@/lib/api/schemas";
import { getStore } from "@/lib/db";
import { json, parseBody } from "@/lib/http";

/** "ลบข้อมูลของฉัน": withdraw consent, delete every session and flag of the plan, stop the plan. */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const body = await parseBody(req, SecretBody);
  if (body instanceof Response) return body;
  const plan = await patientPlan(req, code, body.secret, { allowClosed: true });
  if (plan instanceof Response) return plan;
  const store = getStore();
  await store.deletePlanData(plan.id);
  await store.updatePlan(plan.id, { status: "stopped", consent_at: null, closed_at: new Date().toISOString() });
  return json({ ok: true });
}
```

`app/api/p/[code]/calendar/route.ts`:

```ts
import { patientPlan } from "@/lib/api/guards";
import { fail } from "@/lib/http";
import { buildIcs } from "@/lib/ics";
import { patientUrl } from "@/lib/plan";

/**
 * Calendar file for "เพิ่มลงปฏิทิน". The secret is in the query string here because calendar apps open the
 * link directly (the one exception to "secret only after #", accepted in the spec).
 */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const url = new URL(req.url);
  const secret = url.searchParams.get("k") ?? "";
  if (!/^[A-Za-z0-9_-]{22}$/.test(secret)) return fail(401, "bad_link", "ลิงก์นี้ใช้ไม่ได้แล้ว โปรดติดต่อคลินิก");
  const plan = await patientPlan(req, code, secret);
  if (plan instanceof Response) return plan;
  const ics = buildIcs({
    code: plan.code,
    daysPerWeek: plan.days_per_week,
    remindTime: plan.remind_time,
    startDate: plan.start_date,
    untilDate: plan.next_visit_date,
    url: patientUrl(url.origin, plan.code, secret),
  });
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="homework-${plan.code}.ics"`,
      "cache-control": "no-store",
    },
  });
}
```

`app/api/dtam/login/route.ts`:

```ts
import { timingSafeEqual } from "node:crypto";
import { DTAM_COOKIE, signSession } from "@/lib/auth";
import { DtamLoginBody } from "@/lib/api/schemas";
import { allow, clientIp, fail, json, parseBody, setCookie } from "@/lib/http";

/** Single demo password for the DTAM overview (DTAM_DEMO_PASSWORD). */
export async function POST(req: Request) {
  if (!allow(`dtam:${clientIp(req)}`, 10, 60_000)) return fail(429, "rate_limited", "ลองใหม่อีกครั้งในอีกสักครู่");
  const body = await parseBody(req, DtamLoginBody);
  if (body instanceof Response) return body;
  const want = Buffer.from(process.env.DTAM_DEMO_PASSWORD ?? "");
  const got = Buffer.from(body.password);
  if (want.length === 0 || want.length !== got.length || !timingSafeEqual(want, got)) return fail(401, "bad_login", "รหัสผ่านไม่ถูกต้อง");
  return json({ ok: true }, 200, { "set-cookie": setCookie(DTAM_COOKIE, await signSession({ role: "dtam" })) });
}
```

`app/api/dtam/summary/route.ts`:

```ts
import { dtamSummary } from "@/lib/aggregate";
import { getStore } from "@/lib/db";
import { bangkokToday, fail, isDtam, json } from "@/lib/http";

export async function GET(req: Request) {
  if (!(await isDtam(req))) return fail(401, "unauthorized", "โปรดเข้าสู่ระบบ");
  const store = getStore();
  const [clinics, plans, sessions, flags] = await Promise.all([store.listClinics(), store.listPlans(), store.listSessions(), store.listFlags()]);
  return json(dtamSummary(clinics, plans, sessions, flags, bangkokToday()));
}
```

`app/api/demo/reset/route.ts`:

```ts
import { timingSafeEqual } from "node:crypto";
import { ResetBody } from "@/lib/api/schemas";
import { getStore } from "@/lib/db";
import { bangkokToday, fail, json, parseBody } from "@/lib/http";
import { seedDemo } from "@/lib/seed";

/** Wipe and re-create the demo data. Disabled unless DEMO_RESET_TOKEN is set. */
export async function POST(req: Request) {
  const token = process.env.DEMO_RESET_TOKEN;
  if (!token) return fail(404, "not_found", "ไม่พบ");
  const body = await parseBody(req, ResetBody);
  if (body instanceof Response) return body;
  const a = Buffer.from(token);
  const b = Buffer.from(body.token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return fail(401, "bad_token", "โทเคนไม่ถูกต้อง");
  const store = getStore();
  await store.resetAll();
  const counts = await seedDemo(store, bangkokToday(), process.env.DEMO_CLINIC_PIN ?? "246810");
  return json({ ok: true, ...counts });
}
```

- [ ] **Step 6: รันให้ผ่าน**

Run: `npx vitest run`
Expected: PASS ทุกไฟล์ (api.test.ts 19 tests)

- [ ] **Step 7: Commit**

```bash
git add lib/http.ts lib/api app/api tests/api.test.ts
git commit -m "feat(api): clinic, patient, DTAM and demo routes with server-side red-flag re-evaluation"
```

---

### Task 9: เสียง คิวออฟไลน์ และสคริปต์สร้างเสียง

**Files:**
- Create: `lib/audio-keys.ts`, `lib/wav.ts`, `lib/audio.ts`, `lib/offline.ts`, `scripts/gen-tts.mts`, `public/audio/manifest.json`, `tests/audio.test.ts`

**Interfaces:**
- Produces: `textKey(text)` (FNV-1a 8 hex), `THAI_NUMBERS`, `CUES`, `allSpokenTexts()`; `pcmToWav`, `rateFromMime`; `speak(text)`, `unlockAudio()`, `stopSpeaking()`; `enqueue`, `flush(code, secret)`, `pendingCount`, `savePlan`, `loadPlan`, `forgetPlan`

- [ ] **Step 1: เทสต์**

`tests/audio.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { allSpokenTexts, CUES, textKey, THAI_NUMBERS } from "@/lib/audio-keys";
import { postures } from "@/lib/content";
import { pcmToWav, rateFromMime } from "@/lib/wav";

describe("audio keys", () => {
  it("is stable, 8 hex chars, and NFC-normalised", () => {
    expect(textKey("ครบแล้ว เก่งมาก")).toMatch(/^[0-9a-f]{8}$/);
    expect(textKey("ครบแล้ว เก่งมาก")).toBe(textKey("ครบแล้ว เก่งมาก"));
    expect(textKey("a")).not.toBe(textKey("b"));
  });

  it("covers every step, question, number and cue, without duplicates", () => {
    const texts = allSpokenTexts();
    expect(new Set(texts).size).toBe(texts.length);
    for (const p of postures) for (const s of p.steps_th) expect(texts).toContain(s);
    for (const n of THAI_NUMBERS) expect(texts).toContain(n);
    for (const c of Object.values(CUES)) expect(texts).toContain(c);
    expect(new Set(texts.map(textKey)).size).toBe(texts.length); // no hash collisions
  });
});

describe("wav", () => {
  it("writes a 44-byte PCM header", () => {
    const wav = pcmToWav(Buffer.alloc(480), 24000);
    expect(wav.length).toBe(524);
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
    expect(wav.readUInt32LE(24)).toBe(24000);
    expect(wav.readUInt32LE(40)).toBe(480);
  });
  it("reads the sample rate from the mime type", () => {
    expect(rateFromMime("audio/L16;codec=pcm;rate=16000")).toBe(16000);
    expect(rateFromMime(undefined)).toBe(24000);
  });
});
```

- [ ] **Step 2: รันให้ fail**

Run: `npx vitest run tests/audio.test.ts`
Expected: FAIL

- [ ] **Step 3: เขียนโค้ด**

`lib/audio-keys.ts`:

```ts
import { postures, redflags } from "@/lib/content";

/** FNV-1a 32-bit hash: the same in Node (build script) and the browser. Used as the audio file name. */
export function textKey(text: string): string {
  let h = 0x811c9dc5;
  for (const ch of new TextEncoder().encode(text.normalize("NFC"))) {
    h ^= ch;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export const THAI_NUMBERS = ["หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า", "สิบ"];

export const CUES = {
  start_hold: "เริ่มค้างท่า",
  release: "คลายท่า กลับสู่ท่าเตรียม",
  switch_side: "เปลี่ยนข้าง",
  unit_done: "ครบหนึ่งรอบ",
  posture_done: "ครบแล้ว เก่งมาก",
  get_in_frame: "ถอยออกให้กล้องเห็นทั้งตัว",
  hold_still: "อยู่นิ่ง ๆ ในท่าเตรียมสักครู่",
  chair_nearby: "มีเก้าอี้หรือผนังไว้ใกล้ ๆ เพื่อกันล้ม",
  session_done: "วันนี้ทำครบแล้ว ขอบคุณที่ทำการบ้าน",
} as const;

/** Every sentence the app may speak. scripts/gen-tts.ts turns these into audio files. */
export function allSpokenTexts(): string[] {
  const texts = new Set<string>();
  for (const p of postures) {
    texts.add(p.name_th);
    for (const s of p.steps_th) texts.add(s);
  }
  for (const r of redflags.rules) {
    texts.add(r.question_th);
    texts.add(r.patient_message_th);
  }
  for (const n of THAI_NUMBERS) texts.add(n);
  for (const c of Object.values(CUES)) texts.add(c);
  return [...texts];
}
```

`lib/wav.ts`:

```ts
/** Wrap raw 16-bit little-endian mono PCM in a WAV header (Gemini TTS returns raw PCM). */
export function pcmToWav(pcm: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** "audio/L16;codec=pcm;rate=24000" → 24000 */
export function rateFromMime(mime: string | undefined, fallback = 24000): number {
  const m = /rate=(\d+)/.exec(mime ?? "");
  return m ? Number(m[1]) : fallback;
}
```

`lib/audio.ts`:

```ts
"use client";
import { textKey } from "@/lib/audio-keys";

type Manifest = Record<string, string>; // key → file under /audio

let manifest: Manifest | null = null;
let current: HTMLAudioElement | null = null;
let unlocked = false;

async function loadManifest(): Promise<Manifest> {
  if (manifest) return manifest;
  try {
    const res = await fetch("/audio/manifest.json", { cache: "force-cache" });
    manifest = res.ok ? ((await res.json()) as Manifest) : {};
  } catch {
    manifest = {};
  }
  return manifest;
}

/** iOS only plays sound started from a tap: call this inside the "เริ่ม" button handler. */
export function unlockAudio(): void {
  if (unlocked) return;
  unlocked = true;
  const a = new Audio();
  a.muted = true;
  a.play().catch(() => {});
  if ("speechSynthesis" in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
}

export function stopSpeaking(): void {
  current?.pause();
  current = null;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

function speakWithDevice(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "th-TH";
    const thai = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("th"));
    if (!thai) return resolve(); // no Thai voice on this phone: text only
    u.voice = thai;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

/** Speak a sentence: pre-generated file if present, else the phone's Thai voice, else silence. */
export async function speak(text: string): Promise<void> {
  stopSpeaking();
  const m = await loadManifest();
  const file = m[textKey(text)];
  if (file) {
    const a = new Audio(`/audio/${file}`);
    current = a;
    try {
      await a.play();
      await new Promise<void>((resolve) => {
        a.onended = () => resolve();
        a.onerror = () => resolve();
      });
      return;
    } catch {
      // fall through to the device voice
    }
  }
  await speakWithDevice(text);
}
```

`lib/offline.ts`:

```ts
"use client";
import { del, get, set } from "idb-keyval";

export interface QueuedSession {
  code: string;
  body: unknown; // the JSON body for POST /api/p/:code/sessions (without the secret)
}

const KEY = "hp:outbox";
const planKey = (code: string) => `hp:plan:${code}`;

async function read(): Promise<QueuedSession[]> {
  try {
    return ((await get(KEY)) as QueuedSession[] | undefined) ?? [];
  } catch {
    return [];
  }
}

export async function enqueue(item: QueuedSession): Promise<void> {
  const list = await read();
  list.push(item);
  await set(KEY, list);
}

export async function pendingCount(code: string): Promise<number> {
  return (await read()).filter((q) => q.code === code).length;
}

/**
 * Send every queued session for this plan. Sessions carry a client_id, so a retry that the server
 * already stored comes back as a duplicate instead of being counted twice.
 */
export async function flush(code: string, secret: string): Promise<number> {
  const list = await read();
  const keep: QueuedSession[] = [];
  let sent = 0;
  for (const q of list) {
    if (q.code !== code) {
      keep.push(q);
      continue;
    }
    try {
      const res = await fetch(`/api/p/${code}/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret, session: q.body }),
      });
      if (res.ok || res.status === 400 || res.status === 410) sent++; // 400/410 will never succeed: drop
      else keep.push(q);
    } catch {
      keep.push(q);
    }
  }
  await set(KEY, keep);
  return sent;
}

/** Last plan seen online, so the patient can still open it offline. */
export async function savePlan(code: string, plan: unknown): Promise<void> {
  try {
    await set(planKey(code), plan);
  } catch {}
}

export async function loadPlan<T>(code: string): Promise<T | null> {
  try {
    return ((await get(planKey(code))) as T | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function forgetPlan(code: string): Promise<void> {
  await del(planKey(code));
  await set(KEY, (await read()).filter((q) => q.code !== code));
}
```

`scripts/gen-tts.mts` (รูปแบบคำขอ Gemini TTS ต้องตรวจกับเอกสารปัจจุบันตอนรันจริง: `generateContent` + `responseModalities: ["AUDIO"]` + `speechConfig` และได้ PCM 16-bit กลับมา):

```ts
// Pre-generate Thai voice files from DTAM sheet text and system cues with Gemini TTS (free tier).
// Only content text is sent — never patient data. Run on your own machine:
//   GEMINI_API_KEY=... GEMINI_TTS_MODEL=... npm run tts            (all texts)
//   npm run tts -- --sample                                           (first 3 texts, to listen first)
// Re-running only generates texts whose key is missing from public/audio/manifest.json.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { allSpokenTexts, textKey } from "../lib/audio-keys.ts";
import { pcmToWav, rateFromMime } from "../lib/wav.ts";

const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_TTS_MODEL;
const VOICE = process.env.GEMINI_TTS_VOICE ?? "Kore";
if (!KEY || !MODEL) {
  console.error("Set GEMINI_API_KEY and GEMINI_TTS_MODEL (a TTS model that supports Thai) in .env.local first.");
  process.exit(1);
}

const outDir = path.resolve(import.meta.dirname, "..", "public", "audio");
mkdirSync(outDir, { recursive: true });
const manifestPath = path.join(outDir, "manifest.json");
const manifest: Record<string, string> = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};

async function synth(text: string): Promise<Buffer> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": KEY! },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `อ่านออกเสียงภาษาไทยช้า ๆ ชัด ๆ น้ำเสียงอบอุ่น สำหรับผู้สูงอายุ: ${text}` }] }],
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } },
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data: string; mimeType?: string } }[] } }[] };
  const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!part) throw new Error("no audio in response");
  return pcmToWav(Buffer.from(part.data, "base64"), rateFromMime(part.mimeType));
}

const sample = process.argv.includes("--sample");
const todo = allSpokenTexts().filter((t) => !manifest[textKey(t)]);
const batch = sample ? todo.slice(0, 3) : todo;
console.log(`${allSpokenTexts().length} texts, ${todo.length} missing, generating ${batch.length}`);

for (const [i, text] of batch.entries()) {
  const key = textKey(text);
  for (let attempt = 1; ; attempt++) {
    try {
      writeFileSync(path.join(outDir, `${key}.wav`), await synth(text));
      manifest[key] = `${key}.wav`;
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
      console.log(`[${i + 1}/${batch.length}] ${key} ${text.slice(0, 40)}`);
      break;
    } catch (e) {
      if (attempt >= 4) throw e;
      const wait = 15_000 * attempt; // free tier rate limits: back off
      console.warn(`retry in ${wait / 1000}s: ${(e as Error).message.slice(0, 120)}`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}
console.log("done. Listen to the files in public/audio before generating everything.");
```

`public/audio/manifest.json`:

```json
{}
```

- [ ] **Step 4: รันให้ผ่าน**

Run: `npx vitest run tests/audio.test.ts`
Expected: PASS 4 tests

- [ ] **Step 5: Commit**

```bash
git add lib/audio-keys.ts lib/wav.ts lib/audio.ts lib/offline.ts scripts/gen-tts.mts public/audio tests/audio.test.ts
git commit -m "feat(audio): text keys, WAV wrapper, voice player with device fallback, offline queue, TTS script"
```

---

### Task 10: หน้าคลินิก

**Files:**
- Create: `lib/client.ts`, `components/LevelBadge.tsx`, `app/clinic/page.tsx`, `app/clinic/new/page.tsx`, `app/clinic/slip/[code]/page.tsx`, `app/clinic/settings/page.tsx`

**Interfaces:**
- Consumes: API (Task 8), `DashboardItem` (Task 7), content (Task 2)
- Produces: `api(path, {method, body})`, `todayLocal()`, `addDaysLocal()`, `thaiDate()`, `pct()`; `LevelBadge`, `LEVEL_TH`

- [ ] **Step 1: เขียนโค้ด**

`lib/client.ts`:

```ts
"use client";

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T;
  message_th?: string;
}

/** fetch + JSON for our own API. Network errors come back as status 0 instead of throwing. */
export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: init.body === undefined ? undefined : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "same-origin",
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as T & { message_th?: string };
    return { ok: res.ok, status: res.status, data, message_th: data?.message_th };
  } catch {
    return { ok: false, status: 0, data: {} as T, message_th: "เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ต" };
  }
}

export function todayLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDaysLocal(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 2026-10-05 → "5 ต.ค. 2569" */
export function thaiDate(day: string): string {
  const m = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const [y, mo, d] = day.split("-").map(Number);
  return `${d} ${m[mo - 1]} ${y + 543}`;
}

export const pct = (x: number | null | undefined) => (x === null || x === undefined ? "–" : `${Math.round(x * 100)}%`);
```

`components/LevelBadge.tsx`:

```tsx
import type { RedFlagLevel } from "@/lib/content/schema";

export const LEVEL_TH: Record<RedFlagLevel, { label: string; icon: string; cls: string }> = {
  call_1669: { label: "โทร 1669", icon: "🔴", cls: "bg-red-100 text-red-800 border-red-300" },
  stop_and_contact_clinic: { label: "หยุดและติดต่อคลินิก", icon: "🟠", cls: "bg-orange-100 text-orange-800 border-orange-300" },
  pause_posture: { label: "พักท่านี้", icon: "🟡", cls: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  note_for_next_visit: { label: "บันทึกไว้", icon: "⚪", cls: "bg-stone-100 text-stone-700 border-stone-300" },
};

export function LevelBadge({ level }: { level: RedFlagLevel }) {
  const l = LEVEL_TH[level];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm ${l.cls}`}>
      {l.icon} {l.label}
    </span>
  );
}
```

`app/clinic/page.tsx`:

```tsx
"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { DashboardItem } from "@/lib/aggregate";
import { api, pct, thaiDate } from "@/lib/client";
import { getGroup, getPosture } from "@/lib/content";
import { ruleById } from "@/lib/redflags";
import { LevelBadge } from "@/components/LevelBadge";

interface Dashboard {
  clinic: { code: string; name: string; phone: string | null; is_demo: boolean };
  items: DashboardItem[];
  data_as_of: string;
  memory_store: boolean;
}

function Login({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card space-y-3 max-w-sm mx-auto"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await api("/api/clinic/login", { body: { code, pin } });
        setBusy(false);
        if (r.ok) onDone();
        else setErr(r.message_th ?? "เข้าสู่ระบบไม่สำเร็จ");
      }}
    >
      <h1 className="text-2xl font-bold">เข้าสู่ระบบคลินิก</h1>
      <label className="block">
        รหัสคลินิก
        <input className="input" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" required />
      </label>
      <label className="block">
        PIN 6 หลัก
        <input className="input" value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" pattern="\d{6}" type="password" required />
      </label>
      {err && <p className="text-red-700">{err}</p>}
      <button className="btn w-full" disabled={busy}>
        เข้าสู่ระบบ
      </button>
    </form>
  );
}

function PainSpark({ pain }: { pain: DashboardItem["pain"] }) {
  const pts = pain.slice(-14);
  if (pts.length < 2) return <span className="text-stone-400 text-sm">ยังมีข้อมูลน้อย</span>;
  const W = 160;
  const H = 40;
  const line = (key: "before" | "after") =>
    pts
      .map((p, i) => (p[key] === null ? null : `${(i / (pts.length - 1)) * W},${H - ((p[key] as number) / 10) * H}`))
      .filter(Boolean)
      .join(" ");
  return (
    <svg width={W} height={H} className="overflow-visible" aria-label="กราฟระดับปวด">
      <polyline points={line("before")} fill="none" stroke="#a8a29e" strokeWidth="2" />
      <polyline points={line("after")} fill="none" stroke="#7c2d12" strokeWidth="2" />
    </svg>
  );
}

function Row({ item, reload }: { item: DashboardItem; reload: () => void }) {
  const [open, setOpen] = useState(item.priority <= 1);
  const urgent = item.priority === 0 ? "border-red-400" : item.priority === 1 ? "border-yellow-400" : "border-stone-200";
  return (
    <li className={`card border-2 ${urgent}`}>
      <button className="w-full text-left flex flex-wrap items-center gap-x-4 gap-y-1" onClick={() => setOpen(!open)}>
        <span className="font-mono text-xl font-bold">{item.code}</span>
        <span>{item.group_ids.map((g) => getGroup(g).name_th).join(" + ")}</span>
        <span className="text-stone-600">ทำตามแผน 7 วัน: {pct(item.adherence_7d)}</span>
        <span className="text-stone-600">นัด {thaiDate(item.next_visit_date)}</span>
        <span className="ml-auto text-sm">{item.priority_reason}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3 border-t pt-3">
          {item.open_flags.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-2">
              <LevelBadge level={f.level} />
              <span>{ruleById(f.rule_id).question_th}</span>
              {f.posture_id && <span className="text-stone-500">(ท่า{getPosture(f.posture_id).name_th.replace(/^ท่า/, "")})</span>}
              <button
                className="btn-ghost py-1"
                onClick={async () => {
                  await api(`/api/flags/${f.id}/ack`, { body: {} });
                  reload();
                }}
              >
                รับทราบ
              </button>
            </div>
          ))}
          {item.notes.length > 0 && <p className="text-sm text-stone-600">⚪ หมายเหตุ: ตึงเมื่อยเล็กน้อย {item.notes.length} ครั้ง</p>}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span>ทั้งแผน {pct(item.adherence_all)}</span>
            <span>ทำล่าสุด {item.last_session_on ? thaiDate(item.last_session_on) : "ยังไม่เคย"}</span>
            <span>นับด้วยกล้อง {pct(item.camera_share)}</span>
            <span className="flex items-center gap-2">
              ระดับปวด (เทา=ก่อน, น้ำตาล=หลัง) <PainSpark pain={item.pain} />
            </span>
          </div>
          {item.status === "active" && (
            <div className="flex flex-wrap gap-2">
              <button
                className="btn-ghost"
                onClick={async () => {
                  const r = await api<{ secret: string }>(`/api/plans/${item.code}/reissue`, { body: {} });
                  if (r.ok) window.location.href = `/clinic/slip/${item.code}#${r.data.secret}`;
                }}
              >
                ออกใบนัดใหม่ (QR เดิมใช้ไม่ได้)
              </button>
              <button
                className="btn-ghost"
                onClick={async () => {
                  await api(`/api/plans/${item.code}`, { method: "PATCH", body: { status: "completed" } });
                  reload();
                }}
              >
                ครบคอร์ส
              </button>
              <button
                className="btn-ghost"
                onClick={async () => {
                  await api(`/api/plans/${item.code}`, { method: "PATCH", body: { status: "stopped" } });
                  reload();
                }}
              >
                หยุดแผน
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export default function ClinicPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    const r = await api<Dashboard>("/api/clinic/dashboard");
    if (r.status === 401) return setNeedLogin(true);
    if (!r.ok) return setOffline(true);
    setNeedLogin(false);
    setOffline(false);
    setData(r.data);
  }, []);

  useEffect(() => {
    // Initial fetch + refresh every 30 s so new red flags appear without reloading.
    const first = setTimeout(load, 0);
    const timer = setInterval(load, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  if (needLogin) return <main className="px-4 py-10"><Login onDone={load} /></main>;
  if (!data) return <main className="px-4 py-10 text-center">{offline ? "เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง" : "กำลังโหลด…"}</main>;

  const active = data.items.filter((i) => i.status === "active");
  const closed = data.items.filter((i) => i.status !== "active");
  return (
    <main className="mx-auto max-w-4xl px-4 py-6 space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">{data.clinic.name}</h1>
          <p className="text-sm text-stone-500">
            ข้อมูลล่าสุดเมื่อ {new Date(data.data_as_of).toLocaleTimeString("th-TH")}
            {data.memory_store && " · โหมดทดลอง (ข้อมูลไม่ถูกบันทึกถาวร)"}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Link href="/clinic/new" className="btn">
            + สร้างแผน
          </Link>
          <Link href="/clinic/settings" className="btn-ghost">
            ตั้งค่ากฎ
          </Link>
          <button
            className="btn-ghost"
            onClick={async () => {
              await api("/api/clinic/logout", { body: {} });
              setNeedLogin(true);
            }}
          >
            ออก
          </button>
        </div>
      </header>
      {offline && <p className="text-orange-700">เชื่อมต่อไม่ได้ แสดงข้อมูลล่าสุดที่โหลดไว้</p>}
      <ul className="space-y-3">
        {active.map((i) => (
          <Row key={i.code} item={i} reload={load} />
        ))}
        {active.length === 0 && <li className="card text-stone-500">ยังไม่มีแผน กด “สร้างแผน” เพื่อเริ่ม</li>}
      </ul>
      {closed.length > 0 && (
        <details>
          <summary className="cursor-pointer text-stone-600">แผนที่ปิดแล้ว ({closed.length})</summary>
          <ul className="space-y-3 mt-3">
            {closed.map((i) => (
              <Row key={i.code} item={i} reload={load} />
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}
```

`app/clinic/new/page.tsx`:

```tsx
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { addDaysLocal, api, todayLocal } from "@/lib/client";
import { activeGroups, getPosture, groupsFile, posturesForGroups } from "@/lib/content";

const POSITION_TH = { sitting_floor: "นั่งพื้น", standing: "ยืน", kneeling: "คุกเข่า" } as const;

export default function NewPlanPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [days, setDays] = useState(7);
  const [time, setTime] = useState("19:00");
  const [start, setStart] = useState(todayLocal());
  const [visit, setVisit] = useState(addDaysLocal(todayLocal(), 14));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const postureIds = posturesForGroups(groups).filter((id) => !removed.includes(id));

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 space-y-5">
      <Link href="/clinic" className="text-stone-600">
        ← กลับ
      </Link>
      <h1 className="text-2xl font-bold">สร้างแผนการบ้านหลังนวด</h1>

      <section className="card space-y-2">
        <h2 className="font-semibold">1. กลุ่มอาการ</h2>
        <div className="flex flex-wrap gap-2">
          {activeGroups().map((g) => (
            <label key={g.id} className={`btn-ghost cursor-pointer ${groups.includes(g.id) ? "border-brand bg-orange-50" : ""}`}>
              <input
                type="checkbox"
                className="mr-2"
                checked={groups.includes(g.id)}
                onChange={(e) => setGroups(e.target.checked ? [...groups, g.id] : groups.filter((x) => x !== g.id))}
              />
              {g.name_th}
            </label>
          ))}
        </div>
        <p className="text-sm text-stone-500">
          กลุ่มอื่นยังไม่เปิดใช้กล้อง:{" "}
          {groupsFile.groups
            .filter((g) => !g.active)
            .map((g) => (
              <a key={g.id} className="underline mr-2" href={groupsFile.sheets[String(g.sheet)].url} target="_blank" rel="noreferrer">
                {g.name_th}
              </a>
            ))}
        </p>
      </section>

      {groups.length > 0 && (
        <section className="card space-y-3">
          <h2 className="font-semibold">2. ท่า (ตามแผ่นกรมฯ เอาออกได้) · ตรวจข้อห้ามก่อนสั่ง</h2>
          {posturesForGroups(groups).map((id) => {
            const p = getPosture(id);
            const on = !removed.includes(id);
            return (
              <div key={id} className={`rounded-xl border p-3 ${on ? "border-stone-300" : "border-dashed opacity-60"}`}>
                <label className="flex items-center gap-2 font-semibold">
                  <input type="checkbox" checked={on} onChange={() => setRemoved(on ? [...removed, id] : removed.filter((x) => x !== id))} />
                  {p.name_th} <span className="text-sm font-normal text-stone-500">({POSITION_TH[p.position]})</span>
                </label>
                {p.contraindications_th.length > 0 && (
                  <p className="text-sm text-red-800 mt-1">ข้อห้าม: {p.contraindications_th.join(" / ")}</p>
                )}
                {p.cautions_th.length > 0 && <p className="text-sm text-orange-800">ข้อควรระวัง: {p.cautions_th.join(" / ")}</p>}
              </div>
            );
          })}
        </section>
      )}

      <section className="card grid gap-3 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">3. ความถี่และวันนัด</h2>
        <label>
          วันละ 1 รอบ สัปดาห์ละ
          <select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[7, 6, 5, 4, 3, 2, 1].map((d) => (
              <option key={d} value={d}>
                {d === 7 ? "ทุกวัน" : `${d} วัน`}
              </option>
            ))}
          </select>
        </label>
        <label>
          เวลาเตือน
          <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label>
          เริ่ม
          <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label>
          นัดครั้งถัดไป
          <input className="input" type="date" value={visit} onChange={(e) => setVisit(e.target.value)} />
        </label>
      </section>

      {err && <p className="text-red-700">{err}</p>}
      <button
        className="btn w-full text-xl"
        disabled={busy || postureIds.length === 0}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          const r = await api<{ code: string; secret: string }>("/api/plans", {
            body: { group_ids: groups, posture_ids: postureIds, days_per_week: days, remind_time: time, start_date: start, next_visit_date: visit },
          });
          setBusy(false);
          if (r.ok) router.push(`/clinic/slip/${r.data.code}#${r.data.secret}`);
          else setErr(r.status === 401 ? "โปรดเข้าสู่ระบบใหม่" : (r.message_th ?? "สร้างแผนไม่สำเร็จ"));
        }}
      >
        ออกใบนัดพร้อม QR
      </button>
      <p className="text-sm text-stone-500">ไม่ต้องกรอกชื่อหรือ HN จดรหัสแผนบนใบนัดคู่กับ HN ในระบบของคลินิกเอง</p>
    </main>
  );
}
```

`app/clinic/slip/[code]/page.tsx`:

```tsx
"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { api, thaiDate } from "@/lib/client";
import { getPosture, groupsFile } from "@/lib/content";

interface PlanView {
  code: string;
  posture_ids: string[];
  days_per_week: number;
  remind_time: string;
  start_date: string;
  next_visit_date: string;
  clinic: { name: string; phone: string | null };
}

/** A6 appointment slip with the QR. The secret only lives in this page's URL fragment and in the QR. */
export default function SlipPage() {
  const { code } = useParams<{ code: string }>();
  const [qr, setQr] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanView | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const secret = window.location.hash.slice(1);
    if (!secret) {
      Promise.resolve().then(() => setErr("ไม่มีรหัสลับในลิงก์ ให้กด “ออกใบนัดใหม่” จากหน้าคลินิก"));
      return;
    }
    const url = `${window.location.origin}/p/${code}#${secret}`;
    QRCode.toDataURL(url, { margin: 1, width: 360, errorCorrectionLevel: "M" }).then(setQr);
    api<PlanView>(`/api/p/${code}/plan`, { body: { secret } }).then((r) => (r.ok ? setPlan(r.data) : setErr(r.message_th ?? "โหลดแผนไม่ได้")));
  }, [code]);

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <div className="no-print flex gap-2 mb-4">
        <Link href="/clinic" className="btn-ghost">
          ← คลินิก
        </Link>
        <button className="btn" onClick={() => window.print()}>
          พิมพ์ใบนัด
        </button>
      </div>
      {err && <p className="text-red-700">{err}</p>}
      <section className="card space-y-2 print:shadow-none print:border-black" style={{ width: "105mm", minHeight: "148mm" }}>
        <h1 className="text-lg font-bold">การบ้านหลังนวด · {plan?.clinic.name}</h1>
        <div className="flex items-center gap-3">
          {qr && <img src={qr} alt="QR เปิดแผนการบ้าน" className="w-36 h-36" />}
          <div>
            <div className="text-sm text-stone-600">รหัสแผน</div>
            <div className="font-mono text-3xl font-bold">{code}</div>
            {plan && (
              <div className="text-sm">
                {plan.days_per_week === 7 ? "ทุกวัน" : `สัปดาห์ละ ${plan.days_per_week} วัน`} เวลา {plan.remind_time}
                <br />
                นัดครั้งถัดไป {thaiDate(plan.next_visit_date)}
              </div>
            )}
          </div>
        </div>
        {plan && (
          <ol className="list-decimal pl-5 text-sm">
            {plan.posture_ids.map((id) => (
              <li key={id}>{getPosture(id).name_th}</li>
            ))}
          </ol>
        )}
        <p className="text-xs">สแกน QR ด้วยกล้องมือถือ (ให้ลูกหลานช่วยได้) ไม่ต้องติดตั้งแอป · มีอาการผิดปกติโทรคลินิก {plan?.clinic.phone ?? ""} · ฉุกเฉินโทร 1669</p>
        <p className="text-[10px] text-stone-500">
          ท่าจาก “{groupsFile.series_title_th}” {groupsFile.publisher_th} {groupsFile.year_be}
        </p>
      </section>
    </main>
  );
}
```

`app/clinic/settings/page.tsx`:

```tsx
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { redflags } from "@/lib/content";
import type { ClinicRuleSettings } from "@/lib/redflags";
import { LevelBadge } from "@/components/LevelBadge";

const STRENGTH_TH = { stated: "เอกสารเขียนไว้", derived: "อนุมานจากเอกสาร", team: "ข้อเสนอของทีม" } as const;

export default function SettingsPage() {
  const [settings, setSettings] = useState<ClinicRuleSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<{ clinic: { settings: ClinicRuleSettings } }>("/api/clinic/dashboard").then((r) => {
      if (r.ok) setSettings(r.data.clinic.settings);
      else if (r.status === 401) window.location.href = "/clinic";
    });
  }, []);

  if (!settings) return <main className="px-4 py-10 text-center">กำลังโหลด…</main>;
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 space-y-4">
      <Link href="/clinic" className="text-stone-600">
        ← กลับ
      </Link>
      <h1 className="text-2xl font-bold">กฎธงแดง</h1>
      <p className="text-sm bg-yellow-50 border border-yellow-300 rounded-xl p-3">{redflags.label_th}</p>
      <ul className="space-y-2">
        {redflags.rules.map((r) => {
          const off = settings.disabled.includes(r.id);
          return (
            <li key={r.id} className="card space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono">{r.id}</span>
                <LevelBadge level={r.level} />
                <span className="text-xs text-stone-500">หลักฐาน: {STRENGTH_TH[r.strength]}</span>
                {r.clinic_adjustable ? (
                  <label className="ml-auto flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!off}
                      onChange={() =>
                        setSettings({ ...settings, disabled: off ? settings.disabled.filter((x) => x !== r.id) : [...settings.disabled, r.id] })
                      }
                    />
                    ใช้กฎนี้
                  </label>
                ) : (
                  <span className="ml-auto text-xs text-stone-500">ปิดไม่ได้ (ความปลอดภัย)</span>
                )}
              </div>
              <p>{r.question_th}</p>
              {r.trigger.type === "pain_delta_gte" && (
                <label className="text-sm">
                  เกณฑ์ปวดเพิ่ม ≥{" "}
                  <input
                    type="number"
                    min={1}
                    max={10}
                    className="w-16 rounded border px-2"
                    value={settings.thresholds[r.id] ?? r.trigger.value}
                    onChange={(e) => setSettings({ ...settings, thresholds: { ...settings.thresholds, [r.id]: Number(e.target.value) } })}
                  />{" "}
                  ระดับ
                </label>
              )}
              <p className="text-xs text-stone-500">ที่มา: {r.source_th}</p>
            </li>
          );
        })}
      </ul>
      <button
        className="btn w-full"
        onClick={async () => {
          const r = await api("/api/clinic/settings", { method: "PUT", body: settings });
          setSaved(r.ok);
        }}
      >
        บันทึก
      </button>
      {saved && <p className="text-green-700">บันทึกแล้ว</p>}
    </main>
  );
}
```

- [ ] **Step 2: typecheck และ lint**

Run: `npx tsc --noEmit && npx eslint app components lib`
Expected: ไม่มี error (warning เรื่อง `<img>` และ `window.location.href` ยอมรับได้)

- [ ] **Step 3: Commit**

```bash
git add lib/client.ts components/LevelBadge.tsx app/clinic
git commit -m "feat(clinic): login, urgency-sorted dashboard, plan builder with contraindications, A6 QR slip, rule settings"
```

---

### Task 11: หน้าผู้ป่วยและกล้อง

**Files:**
- Create: `scripts/fetch-mediapipe.mjs`, `lib/pose/camera.ts`, `components/patient/Questions.tsx`, `components/patient/Outcome.tsx`, `components/patient/PostureRunner.tsx`, `app/p/[code]/page.tsx`, `app/lab/page.tsx`

**Interfaces:**
- Consumes: ทุก Task ก่อนหน้า
- Produces: `loadLandmarker()`, `openCamera(video)`, `closeCamera(stream)`, `runLoop(video, landmarker, onFrame)`, `drawSkeleton(canvas, frame, ok)`; `PostureRunner({posture, onDone, onButton})`, `DuringButton`

- [ ] **Step 1: ไฟล์ MediaPipe แบบ self-host**

`scripts/fetch-mediapipe.mjs`:

```js
// Copy the MediaPipe wasm files and download the pose model into public/mediapipe/ (self-hosted, pinned).
// Run: node scripts/fetch-mediapipe.mjs
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "public", "mediapipe");
const wasmSrc = path.join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
mkdirSync(path.join(out, "wasm"), { recursive: true });
for (const f of readdirSync(wasmSrc)) copyFileSync(path.join(wasmSrc, f), path.join(out, "wasm", f));

const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const modelPath = path.join(out, "pose_landmarker_lite.task");
if (!existsSync(modelPath)) {
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`model download failed: ${res.status}`);
  writeFileSync(modelPath, Buffer.from(await res.arrayBuffer()));
}
console.log("mediapipe ready:", readdirSync(path.join(out, "wasm")).length, "wasm files + pose_landmarker_lite.task");
```

Run: `node scripts/fetch-mediapipe.mjs`
Expected: `mediapipe ready: 6 wasm files + pose_landmarker_lite.task`

- [ ] **Step 2: กล้อง**

`lib/pose/camera.ts`:

```ts
"use client";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import type { Frame } from "./landmarks";

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

/** Load the pose model once (self-hosted under /mediapipe). GPU first, CPU if the GPU path fails. */
export function loadLandmarker(): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      const make = (delegate: "GPU" | "CPU") =>
        PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: "/mediapipe/pose_landmarker_lite.task", delegate },
          runningMode: "VIDEO",
          numPoses: 1,
        });
      try {
        return await make("GPU");
      } catch {
        return await make("CPU");
      }
    })();
    landmarkerPromise.catch(() => {
      landmarkerPromise = null;
    });
  }
  return landmarkerPromise;
}

/** Front camera stream. Throws if the user denies permission. */
export async function openCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true; // iOS: never hide the <video> with display:none
  await video.play();
  return stream;
}

export function closeCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

/**
 * Run the model on every animation frame and hand each Frame to `onFrame`.
 * Frames stay on the device: nothing here is uploaded. Returns a stop function.
 */
export function runLoop(video: HTMLVideoElement, landmarker: PoseLandmarker, onFrame: (f: Frame | null, fps: number) => void): () => void {
  let raf = 0;
  let stopped = false;
  let lastTs = -1;
  const times: number[] = [];
  const tick = () => {
    if (stopped) return;
    const now = performance.now();
    if (video.readyState >= 2 && now !== lastTs) {
      lastTs = now;
      const res = landmarker.detectForVideo(video, now);
      times.push(now);
      while (times.length && now - times[0] > 1000) times.shift();
      const lm = res.landmarks[0];
      const frame: Frame | null = lm
        ? { t: now, width: video.videoWidth, height: video.videoHeight, points: lm.map((p) => ({ x: p.x, y: p.y, visibility: p.visibility ?? 0 })) }
        : null;
      onFrame(frame, times.length);
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}

/** Draw the skeleton over the video (mirrored like a selfie view). */
const BONES: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
];

export function drawSkeleton(canvas: HTMLCanvasElement, frame: Frame | null, ok: boolean): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!frame) return;
  const X = (x: number) => (1 - x) * canvas.width;
  const Y = (y: number) => y * canvas.height;
  ctx.lineWidth = 6;
  ctx.strokeStyle = ok ? "#16a34a" : "#f59e0b";
  for (const [a, b] of BONES) {
    const p = frame.points[a];
    const q = frame.points[b];
    if (p.visibility < 0.5 || q.visibility < 0.5) continue;
    ctx.beginPath();
    ctx.moveTo(X(p.x), Y(p.y));
    ctx.lineTo(X(q.x), Y(q.y));
    ctx.stroke();
  }
}
```

- [ ] **Step 3: components ผู้ป่วย**

`components/patient/Questions.tsx` (ใช้ `setAnswers((a) => ...)` เพราะการกดเร็ว ๆ ติดกันกับ state เก่าทำให้คำตอบหาย พบตอนทดลองในเบราว์เซอร์):

```tsx
"use client";
import { useState } from "react";
import { speak } from "@/lib/audio";
import type { RedFlagRule } from "@/lib/content/schema";
import type { Answers } from "@/lib/redflags";

/** Big yes/no buttons, one question per card, each with a "ฟัง" button. */
export function YesNoQuestions({ rules, onDone }: { rules: RedFlagRule[]; onDone: (a: Answers) => void }) {
  const [answers, setAnswers] = useState<Answers>({});
  const complete = rules.every((r) => answers[r.id] !== undefined);
  return (
    <div className="space-y-3">
      {rules.map((r) => (
        <div key={r.id} className="card space-y-2">
          <p className="text-lg">{r.question_th}</p>
          <div className="flex gap-2">
            <button className={`btn-ghost flex-1 text-xl ${answers[r.id] === true ? "bg-red-100 border-red-500" : ""}`} onClick={() => setAnswers((a) => ({ ...a, [r.id]: true }))}>
              ใช่
            </button>
            <button className={`btn-ghost flex-1 text-xl ${answers[r.id] === false ? "bg-green-100 border-green-500" : ""}`} onClick={() => setAnswers((a) => ({ ...a, [r.id]: false }))}>
              ไม่ใช่
            </button>
            <button className="btn-ghost" aria-label="ฟังคำถาม" onClick={() => speak(r.question_th)}>
              🔊
            </button>
          </div>
        </div>
      ))}
      <button className="btn w-full text-xl" disabled={!complete} onClick={() => onDone(answers)}>
        ถัดไป
      </button>
    </div>
  );
}

/** 0–10 pain scale with big buttons. */
export function PainScale({ title, onDone }: { title: string; onDone: (v: number) => void }) {
  const [v, setV] = useState<number | null>(null);
  const color = (n: number) => (n <= 3 ? "bg-green-100" : n <= 6 ? "bg-yellow-100" : "bg-red-100");
  return (
    <div className="card space-y-3">
      <p className="text-lg font-semibold">{title}</p>
      <p className="text-sm text-stone-600">0 = ไม่ปวดเลย · 10 = ปวดมากที่สุด</p>
      <div className="grid grid-cols-6 gap-2">
        {Array.from({ length: 11 }, (_, n) => (
          <button key={n} className={`rounded-xl border-2 py-3 text-xl font-bold ${color(n)} ${v === n ? "border-stone-900" : "border-transparent"}`} onClick={() => setV(n)}>
            {n}
          </button>
        ))}
      </div>
      <button className="btn w-full text-xl" disabled={v === null} onClick={() => v !== null && onDone(v)}>
        ถัดไป
      </button>
    </div>
  );
}
```

`components/patient/Outcome.tsx`:

```tsx
"use client";
import { useEffect } from "react";
import { speak } from "@/lib/audio";
import type { FiredFlag } from "@/lib/redflags";
import { ruleById } from "@/lib/redflags";
import { LevelBadge } from "@/components/LevelBadge";

/** What the patient sees after a red flag (fixed text from redflags.json — never generated). */
export function FlagMessage({ flag, clinicPhone }: { flag: FiredFlag; clinicPhone: string | null }) {
  const rule = ruleById(flag.rule_id);
  useEffect(() => {
    speak(rule.patient_message_th);
  }, [rule.patient_message_th]);
  const emergency = flag.level === "call_1669";
  return (
    <div className={`card space-y-3 border-2 ${emergency ? "border-red-600 bg-red-50" : "border-orange-400"}`}>
      <LevelBadge level={flag.level} />
      <p className="text-xl">{rule.patient_message_th}</p>
      {emergency && (
        <a href="tel:1669" className="btn w-full text-2xl bg-red-700">
          📞 โทร 1669
        </a>
      )}
      {flag.level === "stop_and_contact_clinic" && clinicPhone && (
        <a href={`tel:${clinicPhone}`} className="btn w-full text-xl">
          📞 โทรคลินิก {clinicPhone}
        </a>
      )}
    </div>
  );
}
```

`components/patient/PostureRunner.tsx`:

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { CUES, THAI_NUMBERS } from "@/lib/audio-keys";
import { speak, stopSpeaking } from "@/lib/audio";
import { creditLine, sheetUrl } from "@/lib/content";
import type { Posture } from "@/lib/content/schema";
import { closeCamera, drawSkeleton, loadLandmarker, openCamera, runLoop } from "@/lib/pose/camera";
import { medianFrame } from "@/lib/pose/geometry";
import type { Frame, Side } from "@/lib/pose/landmarks";
import { calibrate, evaluate, requiredVisible, type Calibration } from "@/lib/pose/rules";
import { startSession, step, toResult, type PostureResult, type SessionState } from "@/lib/pose/session";

export type DuringButton = "sharp_pain" | "dizzy" | "unsteady";

const SIDE_TH: Record<Side, string> = { L: "ข้างซ้าย", R: "ข้างขวา" };
const POSITION_TH = { sitting_floor: "นั่งพื้น", standing: "ยืน", kneeling: "คุกเข่า" } as const;

function setupTip(p: Posture): string {
  const low = p.position !== "standing";
  const where = low ? "วางมือถือตั้งพิงกับของบนพื้นหรือเก้าอี้เตี้ย สูงจากพื้นราว 20–50 ซม." : "วางมือถือตั้งพิงบนโต๊ะหรือชั้น สูงราวระดับอก";
  const view = p.detector.view === "side" ? "หันด้านข้างให้กล้อง" : "หันหน้าเข้าหากล้อง";
  return `${where} ถอยห่างราว 2 เมตร ${view} ให้เห็นทั้งตัว`;
}

type Mode = "intro" | "loading" | "setup" | "calibrate" | "run" | "button";

/** One posture: instructions → camera (setup, calibrate, hold timer) or the "ทำแล้ว" fallback. */
export function PostureRunner({ posture, onDone, onButton }: { posture: Posture; onDone: (r: PostureResult) => void; onButton: (b: DuringButton) => void }) {
  const det = posture.detector;
  const [mode, setMode] = useState<Mode>("intro");
  const [view, setView] = useState<SessionState>(() => startSession(det));
  const [inPose, setInPose] = useState(false);
  const [fps, setFps] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [offerButton, setOfferButton] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      stopRef.current?.();
      closeCamera(streamRef.current);
      stopSpeaking();
    },
    [],
  );

  async function startCamera() {
    setMode("loading");
    try {
      const landmarker = await Promise.race([
        loadLandmarker(),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 20_000)),
      ]);
      setMode("setup");
      const video = videoRef.current!;
      streamRef.current = await openCamera(video);
      speak(setupTip(posture));
      let buf: Frame[] = [];
      let calibFrames: Frame[] = [];
      let calib: Calibration | null = null;
      let session = startSession(det);
      let visibleSince: number | null = null;
      let lowFpsSince: number | null = null;
      let lastInPose = performance.now();
      let lastSpoken = -1;
      let lastPhase = session.phase;
      let lastUi = 0;
      const t0 = performance.now();
      stopRef.current = runLoop(video, landmarker, (frame, fpsNow) => {
        const now = performance.now();
        if (canvasRef.current && video.videoWidth) {
          canvasRef.current.width = video.videoWidth;
          canvasRef.current.height = video.videoHeight;
        }
        if (fpsNow < 8 && now - t0 > 3000) lowFpsSince ??= now;
        else lowFpsSince = null;
        if (lowFpsSince && now - lowFpsSince > 5000) setOfferButton(true);
        if (!frame) {
          drawSkeleton(canvasRef.current!, null, false);
          if (now - lastInPose > 15_000) setOfferButton(true);
          return;
        }
        buf = [...buf.slice(-4), frame];
        const f = medianFrame(buf);
        const seeAll = requiredVisible(det, f, session.side);

        if (!calib) {
          drawSkeleton(canvasRef.current!, f, seeAll);
          if (!seeAll) {
            visibleSince = null;
            calibFrames = [];
            setHint(CUES.get_in_frame);
            if (now - t0 > 15_000) setOfferButton(true);
            return;
          }
          visibleSince ??= now;
          if (now - visibleSince < 1000) return;
          if (calibFrames.length === 0) {
            setMode("calibrate");
            setHint(CUES.hold_still);
            speak(CUES.hold_still);
          }
          calibFrames.push(f);
          if (now - visibleSince >= 3000) {
            calib = calibrate(calibFrames);
            if (calib) {
              setMode("run");
              setHint(null);
              speak(posture.steps_th[1] ?? posture.name_th);
            } else {
              visibleSince = null;
              calibFrames = [];
            }
          }
          return;
        }

        const ok = evaluate(det.in_pose, { frame: f, calib, side: session.side });
        if (ok) lastInPose = now;
        session = step(det, session, now, ok);
        drawSkeleton(canvasRef.current!, f, ok);

        if (session.phase === "hold" && det.mode === "hold") {
          const sec = Math.floor(session.heldMs / 1000);
          if (sec !== lastSpoken && sec >= 1 && sec <= THAI_NUMBERS.length) {
            lastSpoken = sec;
            speak(THAI_NUMBERS[sec - 1]);
          }
        }
        if (session.phase !== lastPhase) {
          if (session.phase === "hold" && lastPhase === "ready") {
            lastSpoken = 0;
            speak(det.mode === "hold" ? CUES.start_hold : posture.name_th);
          }
          if (session.phase === "release") speak(det.sides === "alternate" ? `${CUES.release} ${CUES.switch_side}` : CUES.release);
          if (session.phase === "done") {
            speak(CUES.posture_done);
            stopRef.current?.();
            closeCamera(streamRef.current);
            onDone(toResult(posture.id, session));
          }
          lastPhase = session.phase;
        }
        if (session.phase === "ready" && now - lastInPose > 15_000) setOfferButton(true);
        if (now - lastUi > 100) {
          lastUi = now;
          setView(session);
          setInPose(ok);
          setFps(fpsNow);
        }
      });
    } catch {
      setMode("button");
    }
  }

  function useButtons() {
    stopRef.current?.();
    closeCamera(streamRef.current);
    setMode("button");
  }

  const holdMs = det.hold_seconds * 1000;
  const progress = Math.min(1, view.heldMs / holdMs);

  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-bold">{posture.name_th}</h2>
      <p className="text-sm text-stone-600">
        {POSITION_TH[posture.position]} · {det.mode === "hold" ? `ค้าง ${det.hold_seconds} วินาที` : "นับเป็นครั้ง"} · {det.units}{" "}
        {det.sides === "alternate" ? "ครั้ง (สลับซ้าย-ขวา)" : "รอบ"}
        {det.difficulty === "hard" && " · กล้องช่วยนับ (ทดลอง)"}
      </p>

      {(mode === "intro" || mode === "button") && (
        <>
          <a href={`/postures/${posture.id}.webp`} target="_blank" rel="noreferrer">
            <img src={`/postures/${posture.id}.webp`} alt={`แผ่นท่า${posture.name_th}`} className="w-full rounded-xl border" />
          </a>
          <ol className="list-decimal pl-6 space-y-1">
            {posture.steps_th.map((s, i) => (
              <li key={i}>
                {s}{" "}
                <button className="text-brand" aria-label="ฟัง" onClick={() => speak(s)}>
                  🔊
                </button>
              </li>
            ))}
          </ol>
          {posture.note_th && <p className="text-sm text-stone-600">{posture.note_th}</p>}
          {posture.cautions_th.length > 0 && <p className="text-sm text-orange-800">ข้อควรระวัง: {posture.cautions_th.join(" / ")}</p>}
          <p className="text-xs text-stone-500">
            {creditLine(posture)} ·{" "}
            <a className="underline" href={sheetUrl(posture.source.sheet)} target="_blank" rel="noreferrer">
              ดูต้นฉบับ
            </a>
          </p>
        </>
      )}

      {mode === "intro" && (
        <div className="grid gap-2">
          <button className="btn text-xl" onClick={startCamera}>
            📷 เริ่มโดยใช้กล้องช่วยนับ
          </button>
          <button className="btn-ghost" onClick={useButtons}>
            ไม่ใช้กล้อง
          </button>
          <p className="text-xs text-stone-500">ภาพจากกล้องประมวลผลในมือถือเท่านั้น ไม่ถูกบันทึกหรือส่งออก</p>
        </div>
      )}

      {(mode === "loading" || mode === "setup" || mode === "calibrate" || mode === "run") && (
        <div className="space-y-2">
          {mode === "loading" && <p>กำลังเตรียมกล้อง…</p>}
          {mode !== "loading" && <p className="text-sm">{setupTip(posture)}</p>}
          <div className="relative w-full overflow-hidden rounded-xl bg-black">
            {/* iOS: keep the video visible (never display:none) */}
            <video ref={videoRef} className="w-full -scale-x-100" playsInline muted />
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
            {mode === "run" && (
              <div className="absolute left-3 top-3 rounded-xl bg-white/90 px-3 py-2 text-lg font-semibold">
                {inPose ? "✅ อยู่ในท่า" : "ยังไม่อยู่ในท่า"} · {view.unitsDone}/{view.unitsTarget}
                {view.side && ` · ${SIDE_TH[view.side]}`}
              </div>
            )}
            {mode === "run" && det.mode === "hold" && (
              <svg className="absolute right-3 top-3" width="88" height="88" viewBox="0 0 88 88" aria-label="เวลาค้างท่า">
                <circle cx="44" cy="44" r="38" stroke="#ffffff88" strokeWidth="10" fill="none" />
                <circle
                  cx="44" cy="44" r="38" stroke="#16a34a" strokeWidth="10" fill="none"
                  strokeDasharray={`${2 * Math.PI * 38}`} strokeDashoffset={`${2 * Math.PI * 38 * (1 - progress)}`}
                  transform="rotate(-90 44 44)"
                />
                <text x="44" y="52" textAnchor="middle" fontSize="24" fill="white" fontWeight="700">
                  {Math.ceil((holdMs - view.heldMs) / 1000)}
                </text>
              </svg>
            )}
          </div>
          {hint && <p className="text-lg font-semibold">{hint}</p>}
          {mode === "run" && view.phase === "paused" && <p className="text-orange-700">หยุดเวลาไว้ กลับเข้าท่าเพื่อนับต่อ</p>}
          <p className="text-xs text-stone-500">{fps} ภาพ/วินาที</p>
          {offerButton && (
            <button className="btn-ghost w-full" onClick={useButtons}>
              กล้องจับไม่ได้? ใช้ปุ่ม “ทำแล้ว” แทน
            </button>
          )}
        </div>
      )}

      {mode === "button" && <ButtonMode posture={posture} onDone={onDone} />}

      <div className="grid grid-cols-3 gap-2 pt-2">
        <button className="btn-ghost border-red-400 text-red-800" onClick={() => onButton("sharp_pain")}>
          ปวดแปล๊บ
        </button>
        <button className="btn-ghost border-orange-400 text-orange-800" onClick={() => onButton("dizzy")}>
          เวียนหัว
        </button>
        <button className="btn-ghost border-yellow-500 text-yellow-800" disabled={posture.position !== "standing"} onClick={() => onButton("unsteady")}>
          เซ
        </button>
      </div>
    </div>
  );
}

/** Fallback without camera: a plain timer per unit, then "ทำแล้ว". */
function ButtonMode({ posture, onDone }: { posture: Posture; onDone: (r: PostureResult) => void }) {
  const det = posture.detector;
  const [unit, setUnit] = useState(0);
  const [left, setLeft] = useState<number | null>(null);
  const finish = (units: number) =>
    onDone({ posture_id: posture.id, method: "button", units_done: units, units_target: det.units, seconds_held: units * det.hold_seconds });

  useEffect(() => {
    if (left === null) return;
    if (left === 0) {
      speak(CUES.release);
      const t = setTimeout(() => {
        setLeft(null);
        setUnit((u) => u + 1);
      }, 0);
      return () => clearTimeout(t);
    }
    if (left <= THAI_NUMBERS.length) speak(THAI_NUMBERS[det.hold_seconds - left] ?? "");
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left, det.hold_seconds]);

  const side = det.sides === "alternate" && det.first_side ? (unit % 2 === 0 ? det.first_side : det.first_side === "L" ? "R" : "L") : null;
  return (
    <div className="card space-y-3">
      <p className="text-lg">
        ครั้งที่ {Math.min(unit + 1, det.units)} จาก {det.units}
        {side && ` · ${SIDE_TH[side]}`}
      </p>
      {unit < det.units ? (
        <button
          className="btn w-full text-xl"
          disabled={left !== null}
          onClick={() => {
            speak(CUES.start_hold);
            setLeft(det.hold_seconds);
          }}
        >
          {left !== null ? `ค้างไว้… ${left}` : det.mode === "hold" ? `เริ่มค้าง ${det.hold_seconds} วินาที` : "เริ่มครั้งนี้"}
        </button>
      ) : (
        <button className="btn w-full text-xl" onClick={() => finish(det.units)}>
          ✅ ทำครบแล้ว
        </button>
      )}
      <button className="btn-ghost w-full" onClick={() => finish(det.units)}>
        ทำครบแล้ว (ข้ามตัวจับเวลา)
      </button>
    </div>
  );
}
```

- [ ] **Step 4: หน้าผู้ป่วยและหน้า lab**

`app/p/[code]/page.tsx`:

```tsx
"use client";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CUES } from "@/lib/audio-keys";
import { speak, unlockAudio } from "@/lib/audio";
import { api, thaiDate, todayLocal } from "@/lib/client";
import { getGroup, getPosture, rulesAskedAt } from "@/lib/content";
import { enqueue, flush, forgetPlan, loadPlan, pendingCount, savePlan } from "@/lib/offline";
import type { PostureResult } from "@/lib/pose/session";
import { evaluateRedFlags, stopsSession, worst, type Answers, type ClinicRuleSettings, type FiredFlag } from "@/lib/redflags";
import { PostureRunner, type DuringButton } from "@/components/patient/PostureRunner";
import { PainScale, YesNoQuestions } from "@/components/patient/Questions";
import { FlagMessage } from "@/components/patient/Outcome";

interface Plan {
  code: string;
  status: "active" | "completed" | "stopped";
  group_ids: string[];
  posture_ids: string[];
  days_per_week: number;
  remind_time: string;
  start_date: string;
  next_visit_date: string;
  consent_at: string | null;
  clinic: { name: string; phone: string | null };
  settings: ClinicRuleSettings;
}

type Stage =
  | { s: "loading" }
  | { s: "error"; msg: string }
  | { s: "consent" }
  | { s: "home" }
  | { s: "pre" }
  | { s: "pain_before" }
  | { s: "ask_before_posture"; i: number }
  | { s: "posture"; i: number }
  | { s: "dizzy_check"; i: number }
  | { s: "pain_after" }
  | { s: "post" }
  | { s: "result"; flags: FiredFlag[]; queued: boolean };

const lastDoneKey = (code: string) => `hp:last:${code}`;

export default function PatientPage() {
  const { code } = useParams<{ code: string }>();
  const [secret, setSecret] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [stage, setStage] = useState<Stage>({ s: "loading" });
  const [answers, setAnswers] = useState<Answers>({});
  const [postureFlags, setPostureFlags] = useState<{ rule_id: string; posture_id: string }[]>([]);
  const [results, setResults] = useState<PostureResult[]>([]);
  const [painBefore, setPainBefore] = useState<number | null>(null);
  const [painAfter, setPainAfter] = useState<number | null>(null);
  const [pending, setPending] = useState(0);
  const [offline, setOffline] = useState(false);
  const [doneToday, setDoneToday] = useState(false);

  const load = useCallback(async (sec: string) => {
    const r = await api<Plan>(`/api/p/${code}/plan`, { body: { secret: sec } });
    let p: Plan | null = null;
    if (r.ok) {
      p = r.data;
      await savePlan(code, p);
      setOffline(false);
      await flush(code, sec);
    } else if (r.status === 0) {
      p = await loadPlan<Plan>(code); // offline: last plan seen online
      setOffline(true);
    } else {
      return setStage({ s: "error", msg: r.message_th ?? "ลิงก์นี้ใช้ไม่ได้แล้ว โปรดติดต่อคลินิก" });
    }
    if (!p) return setStage({ s: "error", msg: "ยังไม่มีอินเทอร์เน็ต เปิดลิงก์นี้อีกครั้งเมื่อออนไลน์" });
    setPlan(p);
    setPending(await pendingCount(code));
    try {
      setDoneToday(localStorage.getItem(lastDoneKey(code)) === todayLocal());
    } catch {}
    if (p.status !== "active") return setStage({ s: "error", msg: "แผนนี้ปิดแล้ว ขอบคุณที่ทำการบ้าน หากมีอาการผิดปกติโปรดติดต่อคลินิก" });
    setStage(p.consent_at ? { s: "home" } : { s: "consent" });
  }, [code]);

  useEffect(() => {
    const sec = window.location.hash.slice(1);
    const t = setTimeout(() => {
      if (!sec) return setStage({ s: "error", msg: "ลิงก์ไม่ครบ โปรดสแกน QR บนใบนัดอีกครั้ง" });
      setSecret(sec);
      load(sec);
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  /** Submit (or queue when offline) and show the outcome. */
  async function finish(extra: { answers?: Answers; painBefore?: number | null; painAfter?: number | null; results?: PostureResult[] }) {
    if (!plan) return;
    const a = { ...answers, ...(extra.answers ?? {}) };
    const before = extra.painBefore !== undefined ? extra.painBefore : painBefore;
    const res = extra.results ?? results;
    const body = {
      client_id: crypto.randomUUID(),
      performed_on: todayLocal(),
      pain_before: before,
      pain_after: extra.painAfter ?? null,
      results: res,
      answers: a,
      posture_flags: postureFlags,
    };
    const flags = evaluateRedFlags({ answers: a, painBefore: before, painAfter: extra.painAfter ?? null }, plan.settings);
    let queued = false;
    const r = await api(`/api/p/${code}/sessions`, { body: { secret, session: body } });
    if (!r.ok && (r.status === 0 || r.status >= 500)) {
      await enqueue({ code, body });
      queued = true;
      setPending(await pendingCount(code));
    }
    if (res.some((x) => x.method !== "skipped")) {
      try {
        localStorage.setItem(lastDoneKey(code), todayLocal());
      } catch {}
      setDoneToday(true);
    }
    if (!flags.length) speak(CUES.session_done);
    setStage({ s: "result", flags, queued });
  }

  /** A red flag answered mid-session: stop everything, or pause just this posture. */
  function raise(ruleId: string, postureIndex: number | null) {
    if (!plan) return;
    const next = { ...answers, [ruleId]: true };
    setAnswers(next);
    const postureId = postureIndex !== null ? plan.posture_ids[postureIndex] : null;
    if (postureId) setPostureFlags((f) => [...f, { rule_id: ruleId, posture_id: postureId }]);
    const flags = evaluateRedFlags({ answers: next, painBefore }, plan.settings);
    const w = worst(flags);
    if (w && stopsSession(w.level)) {
      const skipped = plan.posture_ids.slice(results.length).map((id) => ({ posture_id: id, method: "skipped" as const, units_done: 0, units_target: getPosture(id).detector.units, seconds_held: 0 }));
      return finish({ answers: next, results: [...results, ...skipped] });
    }
    if (postureIndex !== null) skipPosture(postureIndex, next);
  }

  function skipPosture(i: number, a = answers) {
    if (!plan) return;
    const id = plan.posture_ids[i];
    const r: PostureResult = { posture_id: id, method: "skipped", units_done: 0, units_target: getPosture(id).detector.units, seconds_held: 0 };
    next(i, [...results, r], a);
  }

  function next(i: number, res: PostureResult[], a = answers) {
    setResults(res);
    setAnswers(a);
    if (!plan) return;
    if (i + 1 < plan.posture_ids.length) setStage(beforePosture(i + 1));
    else setStage({ s: "pain_after" });
  }

  function beforePosture(i: number): Stage {
    const id = plan!.posture_ids[i];
    if (rulesAskedAt("before_posture", id).length) return { s: "ask_before_posture", i };
    if (getPosture(id).position === "standing") speak(CUES.chair_nearby);
    return { s: "posture", i };
  }

  if (stage.s === "loading") return <main className="p-6 text-center">กำลังเปิดแผน…</main>;
  if (stage.s === "error") return <main className="p-6"><p className="card text-xl">{stage.msg}</p></main>;
  if (!plan) return null;

  return (
    <main className="mx-auto max-w-xl px-4 py-5 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-sm text-stone-500">{plan.clinic.name}</div>
          <div className="font-semibold">การบ้านหลังนวด · {plan.code}</div>
        </div>
        {offline && <span className="rounded-full bg-orange-100 px-3 py-1 text-sm">ออฟไลน์</span>}
      </header>

      {stage.s === "consent" && (
        <section className="card space-y-3">
          <h1 className="text-xl font-bold">ก่อนเริ่ม โปรดอ่าน</h1>
          <ul className="list-disc pl-5 space-y-1">
            <li>แอปจะเก็บ: วันที่ทำ ท่าที่ทำ ค้างครบหรือไม่ ระดับปวด และคำตอบเรื่องอาการ</li>
            <li>แอปไม่เก็บ: ภาพจากกล้อง ชื่อ เบอร์โทร หรือเลขประจำตัวผู้ป่วย ภาพจากกล้องประมวลผลในมือถือเท่านั้น</li>
            <li>ข้อมูลเก็บที่เซิร์ฟเวอร์ในสิงคโปร์ (ต่างประเทศ) และลบเมื่อปิดแผนครบ 90 วัน</li>
            <li>คลินิกที่ออกใบนัดเห็นข้อมูลของแผนนี้ กรมการแพทย์แผนไทยฯ เห็นเฉพาะตัวเลขรวม</li>
            <li>ถอนความยินยอมและลบข้อมูลได้ทุกเมื่อ ที่ปุ่ม “ลบข้อมูลของฉัน”</li>
            <li>แอปนี้ไม่ใช่การวินิจฉัยหรือรักษา ท่าทั้งหมดมาจากแผ่นของกรมฯ ตามที่แพทย์แผนไทยสั่ง</li>
            <li>ผู้ป่วยอายุต่ำกว่า 18 ปี ให้ผู้ปกครองเป็นผู้กดยินยอม</li>
          </ul>
          <button
            className="btn w-full text-xl"
            onClick={async () => {
              const r = await api<{ consent_at: string }>(`/api/p/${code}/consent`, { body: { secret } });
              if (r.ok) {
                setPlan({ ...plan, consent_at: r.data.consent_at });
                setStage({ s: "home" });
              }
            }}
          >
            ยินยอมและเริ่มใช้งาน
          </button>
        </section>
      )}

      {stage.s === "home" && (
        <section className="space-y-3">
          <div className="card space-y-2">
            <p>
              {plan.group_ids.map((g) => getGroup(g).name_th).join(" + ")} ·{" "}
              {plan.days_per_week === 7 ? "ทุกวัน" : `สัปดาห์ละ ${plan.days_per_week} วัน`} เวลา {plan.remind_time}
            </p>
            <p>นัดครั้งถัดไป {thaiDate(plan.next_visit_date)}</p>
            <ol className="list-decimal pl-6">
              {plan.posture_ids.map((id) => (
                <li key={id}>{getPosture(id).name_th}</li>
              ))}
            </ol>
            {doneToday && <p className="text-green-700 font-semibold">✅ วันนี้ทำแล้ว</p>}
          </div>
          <button
            className="btn w-full text-2xl py-5"
            onClick={() => {
              unlockAudio();
              setAnswers({});
              setResults([]);
              setPostureFlags([]);
              setStage({ s: "pre" });
            }}
          >
            ▶ เริ่มทำการบ้านวันนี้
          </button>
          <a className="btn-ghost w-full" href={`/api/p/${code}/calendar?k=${encodeURIComponent(secret)}`}>
            📅 เพิ่มลงปฏิทิน (เตือนทุกครั้ง)
          </a>
          {pending > 0 && (
            <button className="btn-ghost w-full" onClick={async () => { await flush(code, secret); setPending(await pendingCount(code)); }}>
              ส่งผลที่ค้างอยู่ ({pending})
            </button>
          )}
          <details className="text-sm text-stone-600">
            <summary>ตั้งค่า</summary>
            <button
              className="btn-ghost mt-2 border-red-300 text-red-800"
              onClick={async () => {
                if (!confirm("ลบข้อมูลทั้งหมดของแผนนี้และหยุดใช้งาน?")) return;
                const r = await api(`/api/p/${code}/delete`, { body: { secret } });
                if (r.ok) {
                  await forgetPlan(code);
                  setStage({ s: "error", msg: "ลบข้อมูลของคุณแล้ว แผนนี้หยุดใช้งาน" });
                }
              }}
            >
              ลบข้อมูลของฉัน
            </button>
          </details>
        </section>
      )}

      {stage.s === "pre" && (
        <section className="space-y-3">
          <h1 className="text-xl font-bold">ก่อนเริ่ม ตอบคำถามเรื่องอาการ</h1>
          <YesNoQuestions
            rules={rulesAskedAt("pre")}
            onDone={(a) => {
              setAnswers(a);
              const w = worst(evaluateRedFlags({ answers: a }, plan.settings));
              if (w && stopsSession(w.level)) return finish({ answers: a, results: [] });
              setStage({ s: "pain_before" });
            }}
          />
        </section>
      )}

      {stage.s === "pain_before" && (
        <PainScale
          title="ตอนนี้ปวดแค่ไหน (ก่อนทำท่า)"
          onDone={(v) => {
            setPainBefore(v);
            const w = worst(evaluateRedFlags({ answers, painBefore: v }, plan.settings));
            if (w && stopsSession(w.level)) return finish({ painBefore: v, results: [] });
            setStage(beforePosture(0));
          }}
        />
      )}

      {stage.s === "ask_before_posture" && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">ก่อนท่า{getPosture(plan.posture_ids[stage.i]).name_th.replace(/^ท่า/, "")}</h2>
          <YesNoQuestions
            rules={rulesAskedAt("before_posture", plan.posture_ids[stage.i])}
            onDone={(a) => {
              const yes = Object.entries(a).find(([, v]) => v)?.[0];
              if (yes) return raise(yes, stage.i);
              setStage({ s: "posture", i: stage.i });
            }}
          />
        </section>
      )}

      {stage.s === "posture" && (
        <PostureRunner
          key={plan.posture_ids[stage.i]}
          posture={getPosture(plan.posture_ids[stage.i])}
          onDone={(r) => next(stage.i, [...results, r])}
          onButton={(b: DuringButton) => {
            if (b === "sharp_pain") raise("RF04", stage.i);
            else if (b === "unsteady") raise("RF11", stage.i);
            else setStage({ s: "dizzy_check", i: stage.i });
          }}
        />
      )}

      {stage.s === "dizzy_check" && (
        <section className="card space-y-3">
          <p className="text-xl">อาการเวียนหัว เกิดขึ้นทันทีและรุนแรง หรือมีหน้าเบี้ยว แขนขาอ่อนแรง พูดไม่ชัด ร่วมด้วยไหม</p>
          <button className="btn w-full bg-red-700 text-xl" onClick={() => raise("RF01", stage.i)}>
            ใช่
          </button>
          <button className="btn-ghost w-full text-xl" onClick={() => raise("RF10", stage.i)}>
            ไม่ใช่ เวียนหัวเล็กน้อย
          </button>
        </section>
      )}

      {stage.s === "pain_after" && <PainScale title="หลังทำท่า ตอนนี้ปวดแค่ไหน" onDone={(v) => { setPainAfter(v); setStage({ s: "post" }); }} />}

      {stage.s === "post" && (
        <section className="space-y-3">
          <h1 className="text-xl font-bold">หลังทำท่า</h1>
          <YesNoQuestions rules={rulesAskedAt("post")} onDone={(a) => finish({ answers: a, painAfter })} />
        </section>
      )}

      {stage.s === "result" && (
        <section className="space-y-3">
          {stage.flags.length === 0 && <p className="card text-xl">✅ {CUES.session_done}</p>}
          {worst(stage.flags) && <FlagMessage flag={worst(stage.flags)!} clinicPhone={plan.clinic.phone} />}
          {stage.flags.slice(1).map((f) => (
            <FlagMessage key={f.rule_id} flag={f} clinicPhone={plan.clinic.phone} />
          ))}
          {stage.queued && <p className="text-orange-700">ยังส่งผลไม่ได้ (ไม่มีอินเทอร์เน็ต) แอปจะส่งให้อัตโนมัติเมื่อเปิดลิงก์อีกครั้ง</p>}
          <button className="btn-ghost w-full" onClick={() => setStage({ s: "home" })}>
            กลับหน้าแรก
          </button>
        </section>
      )}
    </main>
  );

}
```

`app/lab/page.tsx`:

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { postures } from "@/lib/content";
import { drawSkeleton, loadLandmarker, openCamera, runLoop } from "@/lib/pose/camera";
import { medianFrame } from "@/lib/pose/geometry";
import type { Frame, Side } from "@/lib/pose/landmarks";
import { calibrate, evaluate, type Calibration } from "@/lib/pose/rules";

/**
 * Tuning tool for the team (not linked from the app): live in-pose result for every posture,
 * and "record" to download the landmark JSON (no images) for tests/fixtures/clips/.
 */
export default function LabPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const [side, setSide] = useState<Side>("R");
  const [recording, setRecording] = useState(false);
  const calibRef = useRef<Calibration | null>(null);
  const bufRef = useRef<Frame[]>([]);
  const recRef = useRef<Frame[]>([]);
  const sideRef = useRef<Side>("R");
  const recordingRef = useRef(false);

  useEffect(() => {
    sideRef.current = side;
    recordingRef.current = recording;
  }, [side, recording]);

  async function start(file?: File) {
    const video = videoRef.current!;
    const lm = await loadLandmarker();
    if (file) {
      video.src = URL.createObjectURL(file);
      video.muted = true;
      await video.play();
    } else {
      await openCamera(video);
    }
    runLoop(video, lm, (frame) => {
      if (!frame) return;
      bufRef.current = [...bufRef.current.slice(-4), frame];
      const f = medianFrame(bufRef.current);
      if (canvasRef.current) {
        canvasRef.current.width = video.videoWidth;
        canvasRef.current.height = video.videoHeight;
        drawSkeleton(canvasRef.current, f, true);
      }
      if (recordingRef.current) recRef.current.push(frame);
      const calib = calibRef.current;
      if (!calib) return;
      const next: Record<string, boolean> = {};
      for (const p of postures) next[p.id] = evaluate(p.detector.in_pose, { frame: f, calib, side: sideRef.current });
      setStatus(next);
    });
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-4 space-y-3">
      <h1 className="text-xl font-bold">Lab: ปรับเกณฑ์กล้อง</h1>
      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={() => start()}>เปิดกล้อง</button>
        <label className="btn-ghost cursor-pointer">
          เปิดไฟล์วิดีโอ
          <input type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && start(e.target.files[0])} />
        </label>
        <button className="btn-ghost" onClick={() => (calibRef.current = calibrate(bufRef.current))}>คาลิเบรต (ท่าเตรียม)</button>
        <button className="btn-ghost" onClick={() => setSide(side === "L" ? "R" : "L")}>ข้างที่ทำ: {side}</button>
        <button
          className="btn-ghost"
          onClick={() => {
            if (recording) {
              const blob = new Blob([JSON.stringify(recRef.current)], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `landmarks-${Date.now()}.json`;
              a.click();
              recRef.current = [];
            }
            setRecording(!recording);
          }}
        >
          {recording ? "หยุดและดาวน์โหลด" : "บันทึกจุดข้อต่อ"}
        </button>
      </div>
      <div className="relative">
        <video ref={videoRef} className="w-full -scale-x-100" playsInline muted />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      </div>
      <ul className="grid grid-cols-2 gap-1 text-sm">
        {postures.map((p) => (
          <li key={p.id} className={status[p.id] ? "text-green-700 font-bold" : "text-stone-500"}>
            {status[p.id] ? "✅" : "·"} {p.id}
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 5: build และทดลองทั้งเส้นด้วย MemoryStore**

```bash
npx tsc --noEmit && npx eslint . && npm test && npm run build
node -e "const c=require('crypto');const r=()=>c.randomBytes(24).toString('base64url');require('fs').appendFileSync('.env.local',`SESSION_SECRET=${r()}${r()}\nDTAM_DEMO_PASSWORD=${r()}\nDEMO_RESET_TOKEN=${r()}\nDEMO_CLINIC_PIN=246810\n`)"
npx next start -p 3123
```

(ถ้า `.env.local` มีค่าเหล่านี้แล้ว ไม่ต้องรันบรรทัด `node -e`) ใส่ข้อมูลจำลอง: `POST /api/demo/reset` ด้วย `DEMO_RESET_TOKEN` แล้วทดลองในเบราว์เซอร์:
1. `/clinic` เข้า `DEMO-A` → เห็นแผนเรียงตามความเร่งด่วน
2. สร้างแผนกลุ่มเข่าเสื่อม → ใบนัดมี QR และรหัสแผน
3. เปิด `/p/{code}#{secret}` → ยินยอม → ตอบ "ไม่ใช่" ทั้งหมด → ปวด 3 → ท่าแรกกด "ไม่ใช้กล้อง" → "ทำครบแล้ว" ทุกท่า → ปวดหลังทำ 6 → ต้องขึ้น 🟡 RF08
4. `/clinic` → แผนนั้นมีธง RF08
5. `/dtam` → เข้าด้วย `DTAM_DEMO_PASSWORD` → เห็นยอดรวม

Expected: ทุกข้อผ่าน และ console มี `Graph successfully started running` เมื่อกดใช้กล้อง

- [ ] **Step 6: ปรับเกณฑ์กล้องด้วยคลิปของทีม** (ต้องมีคนทำท่าจริง)
1. เปิด `/lab` บนเครื่องที่มีกล้อง
2. ทำท่าเตรียม → กด "คาลิเบรต" → ทำแต่ละท่า และดูว่าท่านั้นเป็น ✅ เมื่ออยู่ในท่า และไม่เป็น ✅ ตอนท่าเตรียม
3. ท่าที่จับไม่ติด: กด "บันทึกจุดข้อต่อ" ทั้งช่วงทำท่า ดาวน์โหลด JSON ใส่ `tests/fixtures/clips/{posture-id}-{in|out}.json` แล้วปรับตัวเลขใน `content/postures.json` ทีละน้อย
4. เพิ่มเทสต์ใน `tests/pose-rules.test.ts` ให้รันกฎกับคลิปจริง: ท่าง่ายและปานกลางต้องนับครบทุกคลิป `in` ส่วนคลิป `out` ต้องไม่ถูกนับเลย

Expected: ท่าง่ายและปานกลางจับได้บนมือถือของทีม ท่ายากใช้ป้าย "ทดลอง" และมีปุ่มสำรองได้

- [ ] **Step 7: Commit**

```bash
git add scripts/fetch-mediapipe.mjs lib/pose/camera.ts components/patient app/p app/lab content tests
git commit -m "feat(patient): QR plan flow with consent, pre-check, camera hold timer, button fallback, offline queue"
```

---

### Task 12: หน้ากรมฯ สคริปต์ Supabase และ README

**Files:**
- Create: `app/dtam/page.tsx`, `scripts/seed.mts`, `scripts/purge.mts`, `README.md`

**Interfaces:**
- Consumes: `/api/dtam/*`, `DtamSummary`, `SupabaseStore`, `seedDemo`

- [ ] **Step 1: หน้ากรมฯ**

`app/dtam/page.tsx`:

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import type { DtamSummary } from "@/lib/aggregate";
import { api, pct, thaiDate } from "@/lib/client";
import { getGroup } from "@/lib/content";
import type { RedFlagLevel } from "@/lib/content/schema";
import { LEVEL_TH } from "@/components/LevelBadge";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="text-sm text-stone-600">{label}</div>
      <div className="text-3xl font-bold text-brand">{value}</div>
    </div>
  );
}

function WeeklyBars({ weeks }: { weeks: DtamSummary["weekly_adherence"] }) {
  return (
    <div className="flex items-end gap-2 h-40" aria-label="อัตราทำตามแผนรายสัปดาห์">
      {weeks.map((w) => (
        <div key={w.week_start} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-xs">{pct(w.adherence)}</span>
          <div className="w-full rounded-t bg-brand" style={{ height: `${Math.round((w.adherence ?? 0) * 110)}px` }} />
          <span className="text-[10px] text-stone-500">{thaiDate(w.week_start).replace(/ \d{4}$/, "")}</span>
        </div>
      ))}
    </div>
  );
}

export default function DtamPage() {
  const [data, setData] = useState<DtamSummary | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api<DtamSummary>("/api/dtam/summary");
    if (r.status === 401) return setNeedLogin(true);
    if (r.ok) {
      setNeedLogin(false);
      setData(r.data);
    }
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  if (needLogin)
    return (
      <main className="px-4 py-10">
        <form
          className="card mx-auto max-w-sm space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await api("/api/dtam/login", { body: { password } });
            if (r.ok) load();
            else setErr(r.message_th ?? "เข้าสู่ระบบไม่สำเร็จ");
          }}
        >
          <h1 className="text-2xl font-bold">ภาพรวมสำหรับกรมฯ</h1>
          <input className="input" type="password" placeholder="รหัสผ่านเดโม" value={password} onChange={(e) => setPassword(e.target.value)} />
          {err && <p className="text-red-700">{err}</p>}
          <button className="btn w-full">เข้าดู</button>
        </form>
      </main>
    );
  if (!data) return <main className="p-10 text-center">กำลังโหลด…</main>;

  const levels: RedFlagLevel[] = ["call_1669", "stop_and_contact_clinic", "pause_posture", "note_for_next_visit"];
  const groups = [...new Set(data.flags_by_group.map((f) => f.group_id))];
  const demo = data.clinics.some((c) => c.is_demo);
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 space-y-5">
      <header>
        <h1 className="text-2xl font-bold">ท่าฤๅษีดัดตนที่แจกไป มีคนทำจริงกี่ %</h1>
        <p className="text-sm text-stone-600">
          ตัวเลขรวมเท่านั้น ไม่มีข้อมูลรายคน · ศูนย์ที่มีผู้ป่วยน้อยกว่า 5 คนจะไม่แสดงตัวเลข · ณ {thaiDate(data.generated_on)}
          {demo && <span className="ml-2 rounded bg-yellow-100 px-2">ข้อมูลจำลอง</span>}
        </p>
      </header>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="แผนที่ออก" value={String(data.totals.plans)} />
        <Stat label="ผู้ป่วยที่ยังทำอยู่ (14 วัน)" value={String(data.totals.active_patients)} />
        <Stat label="ทำตามแผน" value={pct(data.totals.adherence)} />
        <Stat label="มาครบคอร์ส" value={pct(data.totals.completion_rate)} />
        <Stat label="นับด้วยกล้อง" value={pct(data.totals.camera_share)} />
      </div>
      <section className="card">
        <h2 className="font-semibold mb-2">อัตราทำตามแผนรายสัปดาห์ (8 สัปดาห์)</h2>
        <WeeklyBars weeks={data.weekly_adherence} />
      </section>
      <section className="card overflow-x-auto">
        <h2 className="font-semibold mb-2">ธงแดงตามกลุ่มอาการ</h2>
        <table className="w-full text-left">
          <thead>
            <tr>
              <th>กลุ่ม</th>
              {levels.map((l) => (
                <th key={l}>
                  {LEVEL_TH[l].icon} {LEVEL_TH[l].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g} className="border-t">
                <td>{getGroup(g).name_th}</td>
                {levels.map((l) => (
                  <td key={l}>{data.flags_by_group.find((f) => f.group_id === g && f.level === l)?.count ?? 0}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card overflow-x-auto">
        <h2 className="font-semibold mb-2">เทียบรายศูนย์</h2>
        <table className="w-full text-left">
          <thead>
            <tr>
              <th>ศูนย์</th>
              <th>แผน</th>
              <th>ยังทำอยู่</th>
              <th>ทำตามแผน</th>
              <th>ครบคอร์ส</th>
              <th>กล้อง</th>
            </tr>
          </thead>
          <tbody>
            {data.clinics.map((c) => (
              <tr key={c.clinic_code} className="border-t">
                <td>{c.clinic_name}</td>
                {c.hidden ? (
                  <td colSpan={5} className="text-stone-500">
                    &lt; 5 ราย (ไม่แสดง)
                  </td>
                ) : (
                  <>
                    <td>{c.plans}</td>
                    <td>{c.active_patients}</td>
                    <td>{pct(c.adherence)}</td>
                    <td>{pct(c.completion_rate)}</td>
                    <td>{pct(c.camera_share)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="text-sm text-stone-500">ขั้นต่อไป (เฟส 2): ส่งออกข้อมูลตามมาตรฐาน HDC / 43 แฟ้ม เพื่อรวมกับระบบรายงานของกระทรวง</p>
    </main>
  );
}
```

- [ ] **Step 2: สคริปต์** (เป็น `.mts` เพราะใช้ top-level await)

`scripts/seed.mts`:

```ts
// Put the demo data (3 demo clinics, ~60 plans, 8 weeks) into Supabase.
// Run: npm run seed            (refuses if demo clinics already exist)
//      npm run seed -- --reset (deletes EVERYTHING in the database first)
import { SupabaseStore } from "../lib/db/supabase.ts";
import { seedDemo } from "../lib/seed.ts";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}
const store = new SupabaseStore(url, key);
const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

if (process.argv.includes("--reset")) {
  await store.resetAll();
  console.log("database cleared");
} else if ((await store.listClinics()).some((c) => c.is_demo)) {
  console.error("Demo clinics already exist. Use --reset to start over.");
  process.exit(1);
}
const counts = await seedDemo(store, today, process.env.DEMO_CLINIC_PIN ?? "246810");
console.log("seeded", counts);
```

`scripts/purge.mts`:

```ts
// Delete plans closed more than 90 days ago, with their sessions and flags (retention promise on the consent page).
// Phase 1: run by hand (npm run purge). A real deployment must schedule it.
import { SupabaseStore } from "../lib/db/supabase.ts";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}
const cutoff = new Date(Date.now() - 90 * 86_400_000).toISOString();
const n = await new SupabaseStore(url, key).purgeClosedBefore(cutoff);
console.log(`deleted ${n} plan(s) closed before ${cutoff}`);
```

Run: `npm run seed`
Expected (ถ้ายังไม่มีคีย์ Supabase): `Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.`

- [ ] **Step 3: README**

`README.md`:

````markdown
# การบ้านหลังนวด (TTM Home Program)

ต้นแบบสำหรับ Thai Traditional Medicine Digital Health & AI Hackathon 2026 (Track 4 นวดไทยและเวลเนส)

แพทย์แผนไทยสั่งท่าฤๅษีดัดตนของกรมการแพทย์แผนไทยฯ ให้ผู้ป่วยรายคนผ่าน QR → ผู้ป่วยทำที่บ้านตามเสียงไทย กล้องมือถือช่วยนับเวลาค้างท่า → ผลและธงแดงกลับถึงคลินิกก่อนนัดครั้งถัดไป → กรมฯ เห็นภาพรวมว่ามีคนทำจริงกี่ %

สเปก: `docs/superpowers/specs/2026-10-04-home-program-design.md`

## หน้าเว็บ

| หน้า | ใคร | ทำอะไร |
|---|---|---|
| `/clinic` | คลินิก (รหัสคลินิก + PIN) | สร้างแผน, ใบนัด A6 พร้อม QR, dashboard เรียงความเร่งด่วน, รับทราบธง, ตั้งค่ากฎ 🟡/⚪ |
| `/p/{code}#{secret}` | ผู้ป่วย (สแกน QR) | ยินยอม, เพิ่มลงปฏิทิน, คัดกรองก่อนเริ่ม, ทำท่าพร้อมกล้อง/ปุ่ม, ระดับปวด, ลบข้อมูลของฉัน |
| `/dtam` | กรมฯ (รหัสผ่านเดโม) | ยอดรวมเท่านั้น ศูนย์ที่มีน้อยกว่า 5 คนไม่แสดงตัวเลข |
| `/lab` | ทีม | ปรับเกณฑ์กล้อง และบันทึกจุดข้อต่อเป็น JSON |

## AI ในระบบ (อธิบายกรรมการ)

| จุด | AI | Input → Process → Output | ข้อมูลไปไหน |
|---|---|---|---|
| นับเวลาค้างท่า | MediaPipe Pose (โมเดลเปิด รันในเบราว์เซอร์) | ภาพกล้อง → จุดข้อต่อ 33 จุด → กฎเรขาคณิตของแต่ละท่า (`content/postures.json`) → "อยู่ในท่า/ยังไม่อยู่" + ตัวนับเวลา | อยู่ในมือถือ ไม่บันทึกภาพ |
| เสียงไทย | Gemini TTS (สร้างไว้ล่วงหน้าตอน build) | ข้อความจากแผ่นกรมฯ → ไฟล์เสียง | ส่งเฉพาะข้อความของกรมฯ ไม่มีข้อมูลผู้ป่วย |
| ธงแดง | ไม่ใช่ AI | คำตอบ + ระดับปวด → กฎตายตัว 16 ข้อ (`content/redflags.json`) พร้อมแหล่งอ้างอิง | รันทั้งบนมือถือและเซิร์ฟเวอร์ |

แอปไม่วินิจฉัย ไม่เลือกท่าเอง และไม่ตัดสินว่าท่าถูกหรือผิด แพทย์แผนไทยเป็นผู้สั่งทุกครั้ง

## เริ่มใช้งานบนเครื่อง

```bash
npm install
cp .env.example .env.local      # ใส่ค่าเอง (ดูในไฟล์)
npm run dev                     # ดาวน์โหลดโมเดล MediaPipe ให้อัตโนมัติ
```

ถ้ายังไม่ใส่ Supabase แอปจะใช้ที่เก็บข้อมูลในหน่วยความจำ (หายเมื่อรีสตาร์ต) ใส่ข้อมูลจำลองด้วย:

```bash
curl -X POST http://localhost:3000/api/demo/reset -H "content-type: application/json" -d "{\"token\":\"<DEMO_RESET_TOKEN>\"}"
```

คลินิกเดโม: `DEMO-A`, `DEMO-B`, `DEMO-C` PIN = `DEMO_CLINIC_PIN`

## คำสั่ง

| คำสั่ง | ทำอะไร |
|---|---|
| `npm test` | เทสต์ทั้งหมด (Vitest) |
| `npm run typecheck` / `npm run lint` | ตรวจ type และ lint |
| `npm run build` | build (ดาวน์โหลด MediaPipe ก่อน) |
| `npm run seed` | ใส่ข้อมูลจำลองลง Supabase (`-- --reset` ล้างก่อน) |
| `npm run tts -- --sample` | สร้างเสียงตัวอย่าง 3 ไฟล์ (ฟังก่อน) แล้ว `npm run tts` สร้างที่เหลือ |
| `npm run images` | สร้างภาพแผ่นท่า `public/postures/*.webp` จาก `../research/content/sources` |
| `npm run purge` | ลบแผนที่ปิดครบ 90 วัน |

## Supabase

1. สร้างโปรเจกต์ region Singapore
2. SQL Editor → วาง `supabase/schema.sql` → Run
3. Settings → API → คัดลอก URL และ service_role key ใส่ `.env.local` และ Vercel (ห้ามวางใน chat)

## ที่มาของเนื้อหา

ท่าและภาพจากแผ่น "ยืดเหยียด...ดัดตน...พ้นโรค ด้วยท่าฤๅษีดัดตน" กรมการแพทย์แผนไทยและการแพทย์ทางเลือก 2569 ชุดที่ 1 (Office syndrome), 2 (หัวไหล่ติด), 6 (เข่าเสื่อม) ทุกท่าในแอปแสดงที่มาและลิงก์ต้นฉบับ กฎธงแดงร่างโดยทีมจากเอกสารกรมฯ (CPG_PCU, แนวทาง IMC แผนไทย) รอผู้ประกอบวิชาชีพรับรอง
````

- [ ] **Step 4: ตรวจทั้งหมด**

Run: `npx tsc --noEmit && npx eslint . && npm test && npm run build`
Expected: test 107 ผ่าน, build สำเร็จ, มี route `/dtam`

- [ ] **Step 5: Commit**

```bash
git add app/dtam scripts/seed.mts scripts/purge.mts README.md
git commit -m "feat(dtam): aggregate-only overview; Supabase seed/purge scripts; README with AI card"
```

---

### Task 13: Supabase, เสียงจริง, deploy และทดสอบมือถือจริง (ต้องใช้บัญชีของผู้ใช้)

**Files:**
- Modify: `public/audio/*` (ไฟล์เสียงที่สร้าง), `C:\HACKATHON\Progress.md`

ขั้นที่ต้องใช้บัญชีหรือ key ให้ผู้ใช้ทำเอง Claude ห้ามพิมพ์ key และห้าม push โดยไม่ได้รับอนุญาต

- [ ] **Step 1: ผู้ใช้สร้าง Supabase**
1. supabase.com → New project → Region: Southeast Asia (Singapore)
2. SQL Editor → วางเนื้อหา `supabase/schema.sql` → Run
3. Project Settings → API → คัดลอก Project URL และ `service_role` key ใส่ `.env.local` เป็น `SUPABASE_URL` และ `SUPABASE_SERVICE_ROLE_KEY`

แล้ว Claude รัน: `npm run seed`
Expected: `seeded { clinics: 3, plans: 60, sessions: ~440, flags: ~40 }`

- [ ] **Step 2: ผู้ใช้สร้าง Gemini API key** ที่ aistudio.google.com แล้วใส่ `GEMINI_API_KEY` และ `GEMINI_TTS_MODEL` (รุ่น TTS ที่รองรับภาษาไทย ตรวจในเอกสาร Gemini speech generation) ใน `.env.local`

แล้ว Claude รัน: `npm run tts -- --sample` → ให้ผู้ใช้ฟัง 3 ไฟล์ใน `public/audio/`
- ถ้าโอเค: `npm run tts` (101 ข้อความ ถ้าโดน rate limit สคริปต์จะรอแล้วลองใหม่เอง)
- ถ้าไม่ชอบ: ทีมอัดเสียงเองโดยใช้ชื่อไฟล์ตาม `manifest.json`

```bash
git add public/audio && git commit -m "chore(audio): pre-generated Thai voice files"
```

- [ ] **Step 3: GitHub** (หลังผู้ใช้ยืนยันให้ push)

```bash
"C:/Program Files/GitHub CLI/gh.exe" repo create home-program --private --source=. --remote=origin
git push -u origin main
```

- [ ] **Step 4: ผู้ใช้ import ใน Vercel**
1. vercel.com → Add New → Project → เลือก repo `home-program`
2. Environment Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `DTAM_DEMO_PASSWORD`, `DEMO_RESET_TOKEN`, `DEMO_CLINIC_PIN` (ไม่ต้องใส่ Gemini)
3. Deploy แล้วส่ง URL มา

- [ ] **Step 5: ทดสอบ URL จริง**

```bash
URL=https://<project>.vercel.app
for p in / /clinic /dtam /lab /mediapipe/pose_landmarker_lite.task /postures/kae-kiat.webp /audio/manifest.json; do echo "$p $(curl -s --ssl-no-revoke -o /dev/null -w '%{http_code}' $URL$p)"; done
```

Expected: ทุกบรรทัด 200

- [ ] **Step 6: ทดสอบบนมือถือจริง** (Android 1 + iPhone 1)
- สแกน QR จากใบนัด → ยินยอม → ทำท่ายืนง่าย 1 ท่าด้วยกล้องจนครบ → ธงขึ้นบนคอมของคลินิก
- จดเวลาโหลดโมเดล, FPS ที่หน้าจอแสดง, เสียงเล่นได้ไหม (iPhone ต้องแตะ "เริ่ม" ก่อน), นำ `.ics` เข้าปฏิทินได้ไหม
- เปิดโหมดเครื่องบินกลางรอบ → ทำจนจบ → ปิดโหมดเครื่องบิน → เปิดลิงก์อีกครั้ง → ผลถูกส่ง (dashboard เห็น)

- [ ] **Step 7: อัปเดต Progress.md**
- ใส่ Demo URL, ผลทดสอบมือถือ, ท่าที่กล้องจับได้หรือไม่ได้
- บอกผู้ใช้ว่าพร้อมทำ Concept Paper และอัดวิดีโอ
