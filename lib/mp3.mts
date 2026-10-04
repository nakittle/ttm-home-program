import { Mp3Encoder } from "@breezystack/lamejs";

/** Encode raw 16-bit little-endian mono PCM to MP3 (about 8× smaller than WAV, plays on every phone). */
export function pcmToMp3(pcm: Buffer, sampleRate = 24000, kbps = 48): Buffer {
  const samples = new Int16Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + (pcm.length & ~1)));
  const encoder = new Mp3Encoder(1, sampleRate, kbps);
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < samples.length; i += 1152) chunks.push(encoder.encodeBuffer(samples.subarray(i, i + 1152)));
  chunks.push(encoder.flush());
  return Buffer.concat(chunks.filter((c) => c.length).map((c) => Buffer.from(c.buffer, c.byteOffset, c.length)));
}
