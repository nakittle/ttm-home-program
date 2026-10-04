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
