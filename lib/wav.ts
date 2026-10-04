/**
 * Gemini TTS appends its provenance manifest to the raw PCM as a RIFF-style chunk:
 * "C2PA" + LE uint32 size + payload, ending exactly at the end of the buffer.
 * Played as audio it is a loud burst of noise, so split it off.
 */
export function splitC2pa(raw: Buffer): { audio: Buffer; c2pa: Buffer | null } {
  for (let at = raw.lastIndexOf("C2PA"); at >= 0; at = at > 0 ? raw.lastIndexOf("C2PA", at - 1) : -1) {
    if (at + 8 > raw.length) continue;
    const size = raw.readUInt32LE(at + 4);
    if (at + 8 + size + (size % 2) === raw.length) return { audio: raw.subarray(0, at), c2pa: raw.subarray(at) };
  }
  return { audio: raw, c2pa: null };
}

/** Wrap raw 16-bit little-endian mono PCM in a WAV header (Gemini TTS returns raw PCM). A trailing C2PA chunk is kept as its own chunk. */
export function pcmToWav(raw: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
  const { audio: pcm, c2pa } = splitC2pa(raw);
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length + (c2pa?.length ?? 0), 4);
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
  return Buffer.concat(c2pa ? [header, pcm, c2pa] : [header, pcm]);
}

/** "audio/L16;codec=pcm;rate=24000" → 24000 */
export function rateFromMime(mime: string | undefined, fallback = 24000): number {
  const m = /rate=(\d+)/.exec(mime ?? "");
  return m ? Number(m[1]) : fallback;
}
