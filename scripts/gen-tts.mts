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
