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
