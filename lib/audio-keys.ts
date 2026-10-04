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

/** Every sentence the app may speak. scripts/gen-tts.mts turns these into audio files. */
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
