"use client";
import { textKey } from "@/lib/audio-keys";

type Manifest = Record<string, string>; // key → file under /audio

// 44-byte header + 1 sample of 8-bit mono PCM silence: the smallest thing an <audio> element will play.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQIAAACAgA==";

let manifest: Manifest | null = null;
let el: HTMLAudioElement | null = null; // one element for the whole page: iOS unlocks elements, not the page
let unlocked = false;
let token = 0; // bumped by every speak/stopSpeaking so a stale speak can tell it was superseded
let settlePending: (() => void) | null = null;

async function loadManifest(): Promise<Manifest> {
  if (manifest) return manifest;
  try {
    const res = await fetch("/audio/manifest.json");
    if (res.ok) manifest = (await res.json()) as Manifest;
  } catch {
    // offline or bad JSON: not memoised, so the next call retries
  }
  return manifest ?? {};
}

function audioEl(): HTMLAudioElement {
  return (el ??= new Audio());
}

/** iOS only plays sound started from a tap: call this inside the "เริ่ม" button handler. */
export function unlockAudio(): void {
  if (unlocked || typeof window === "undefined") return;
  const a = audioEl();
  a.src = SILENT_WAV;
  a.play().then(
    () => {
      unlocked = true;
    },
    () => {}, // not allowed yet: the next tap tries again
  );
  if ("speechSynthesis" in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
}

export function stopSpeaking(): void {
  token++;
  el?.pause();
  settlePending?.();
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

/** Wait up to 1 s for the browser to load its voice list (it is often empty on first call). */
function findThaiVoice(): Promise<SpeechSynthesisVoice | undefined> {
  const synth = window.speechSynthesis;
  const pick = () => synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("th"));
  if (synth.getVoices().length > 0) return Promise.resolve(pick());
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      synth.removeEventListener("voiceschanged", finish);
      resolve(pick());
    };
    const timer = setTimeout(finish, 1000);
    synth.addEventListener("voiceschanged", finish);
  });
}

async function speakWithDevice(text: string, mine: number): Promise<void> {
  if (!("speechSynthesis" in window)) return;
  const thai = await findThaiVoice();
  if (!thai || mine !== token) return; // no Thai voice on this phone, or superseded: text only
  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "th-TH";
    u.voice = thai;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

/** Play a file on the shared element; resolves when it ends, errors or is paused. Rejects if play() is refused. */
async function playFile(url: string): Promise<void> {
  const a = audioEl();
  a.src = url;
  const finished = new Promise<void>((resolve) => {
    const onPause = () => {
      if (a.paused) done(); // a stale pause event from stopSpeaking arrives while paused is already false
    };
    const done = () => {
      a.removeEventListener("ended", done);
      a.removeEventListener("error", done);
      a.removeEventListener("pause", onPause);
      if (settlePending === done) settlePending = null;
      resolve();
    };
    settlePending = done;
    a.addEventListener("ended", done);
    a.addEventListener("error", done);
    a.addEventListener("pause", onPause);
  });
  try {
    await a.play();
  } catch (e) {
    settlePending?.();
    throw e;
  }
  await finished;
}

/** Speak a sentence: pre-generated file if present, else the phone's Thai voice, else silence. */
export async function speak(text: string): Promise<void> {
  stopSpeaking();
  const mine = token;
  const m = await loadManifest();
  if (mine !== token) return;
  const file = m[textKey(text)];
  if (file) {
    try {
      await playFile(`/audio/${file}`);
      return;
    } catch {
      if (mine !== token) return;
      // fall through to the device voice
    }
  }
  if (mine !== token) return;
  await speakWithDevice(text, mine);
}
