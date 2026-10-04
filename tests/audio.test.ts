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
  it("moves a trailing C2PA chunk out of the audio data so it is not played as noise", () => {
    // Gemini TTS appends a RIFF-style "C2PA" chunk (id + LE size + payload) after the raw PCM.
    const audio = Buffer.alloc(480, 1);
    const payload = Buffer.from("jumbdata");
    const size = Buffer.alloc(4);
    size.writeUInt32LE(payload.length);
    const wav = pcmToWav(Buffer.concat([audio, Buffer.from("C2PA"), size, payload]), 24000);
    expect(wav.readUInt32LE(40)).toBe(480); // data chunk holds only the audio
    expect(wav.toString("ascii", 44 + 480, 44 + 484)).toBe("C2PA");
    expect(wav.readUInt32LE(44 + 484)).toBe(payload.length);
    expect(wav.readUInt32LE(4)).toBe(wav.length - 8); // RIFF size covers both chunks
  });
  it("keeps audio that merely contains the bytes C2PA", () => {
    const pcm = Buffer.concat([Buffer.from("C2PA"), Buffer.alloc(476)]);
    expect(pcmToWav(pcm).readUInt32LE(40)).toBe(480);
  });
  it("reads the sample rate from the mime type", () => {
    expect(rateFromMime("audio/L16;codec=pcm;rate=16000")).toBe(16000);
    expect(rateFromMime(undefined)).toBe(24000);
  });
});

describe("textKey golden values", () => {
  it("pins the hash so existing audio files keep matching", () => {
    expect(textKey("a")).toBe("e40c292c");
  });
  it("treats decomposed and composed text as the same key (NFC)", () => {
    expect(textKey("é")).toBe(textKey("é"));
  });
});
