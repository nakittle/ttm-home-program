// Pre-generate Thai voice files from DTAM sheet text and system cues with Gemini TTS (free tier).
// Only content text is sent — never patient data. Run on your own machine:
//   GEMINI_API_KEY=... GEMINI_TTS_MODEL=... npm run tts            (all texts)
//   npm run tts -- --sample                                           (first 3 texts, to listen first)
// Re-running only generates texts whose key is missing from public/audio/manifest.json.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { allSpokenTexts, textKey } from "../lib/audio-keys.ts";
import { pcmToMp3 } from "../lib/mp3.mts";
import { rateFromMime, splitC2pa } from "../lib/wav.ts";

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
      // Send only the text: this model reads any style directive aloud ("สิบ" became 8 s of instructions + the word).
      contents: [{ parts: [{ text }] }],
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } },
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data: string; mimeType?: string } }[] } }[] };
  const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!part) throw new Error("no audio in response");
  // MP3 keeps phone downloads small; Gemini's trailing C2PA chunk is not audio, so drop it before encoding.
  const pcm = splitC2pa(Buffer.from(part.data, "base64")).audio;
  const rate = rateFromMime(part.mimeType);
  const seconds = pcm.length / 2 / rate;
  if (seconds > 2 + text.length * 0.3) console.warn(`  ⚠ ${seconds.toFixed(1)}s is long for ${text.length} chars — listen to this one`);
  return pcmToMp3(pcm, rate);
}

const sample = process.argv.includes("--sample");
const todo = allSpokenTexts().filter((t) => !manifest[textKey(t)]);
const batch = sample ? todo.slice(0, 3) : todo;
console.log(`${allSpokenTexts().length} texts, ${todo.length} missing, generating ${batch.length}`);

for (const [i, text] of batch.entries()) {
  const key = textKey(text);
  for (let attempt = 1; ; attempt++) {
    try {
      writeFileSync(path.join(outDir, `${key}.mp3`), await synth(text));
      manifest[key] = `${key}.mp3`;
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
      console.log(`[${i + 1}/${batch.length}] ${key} ${text.slice(0, 40)}`);
      break;
    } catch (e) {
      const msg = (e as Error).message;
      if (/PerDay/i.test(msg)) throw new Error("daily free-tier quota reached; re-run tomorrow (finished files are kept)");
      if (attempt >= 8) throw e;
      // Free tier is limited per minute: wait as long as the server asks (retryDelay), else back off.
      const asked = Number(/"retryDelay":\s*"(\d+)/.exec(msg)?.[1] ?? 0) * 1000;
      const wait = Math.min(Math.max(asked + 2_000, 15_000 * attempt), 120_000);
      console.warn(`rate limited, retry in ${Math.round(wait / 1000)}s`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}
console.log("done. Listen to the files in public/audio before generating everything.");
