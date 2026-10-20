// Self-check for the iOS voice note fix. Run: npx tsx scripts/test-opus-repack.ts
// Encodes a tone with ffmpeg (code 0 packets), repacks to code 3 and checks the audio decodes bit-identical.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { repackOpusForWhatsApp } from "../src/modules/whatsapp/opus-repack";

const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const run = (args: string[], input?: Buffer) => execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", ...args], { input, maxBuffer: 64 << 20 });

function packetStats(ogg: Buffer) {
    const packets: Buffer[] = [];
    let pos = 0, cur: Buffer[] = [];
    while (pos < ogg.length) {
        assert.equal(ogg.toString("latin1", pos, pos + 4), "OggS");
        const n = ogg[pos + 26];
        let p = pos + 27 + n;
        for (let i = 0; i < n; i++) { const l = ogg[pos + 27 + i]; cur.push(ogg.subarray(p, p + l)); p += l; if (l < 255) { packets.push(Buffer.concat(cur)); cur = []; } }
        pos = p;
    }
    const audio = packets.slice(2);
    return { codes: new Set(audio.map(p => p[0] & 3)), frames: audio.reduce((s, p) => s + ((p[0] & 3) === 3 ? p[1] & 63 : 1), 0), count: audio.length };
}

const ogg = run(["-f", "lavfi", "-i", "sine=frequency=330:duration=3.37", "-ac", "1", "-ar", "48000", "-c:a", "libopus", "-b:a", "32k", "-application", "voip", "-f", "ogg", "pipe:1"]);
const before = packetStats(ogg);
assert.deepEqual([...before.codes], [0], "ffmpeg emits single-frame packets");

const repacked = repackOpusForWhatsApp(ogg);
const after = packetStats(repacked);
assert.ok(after.codes.has(3), "now uses code 3 packets");
assert.equal(after.frames, before.frames, "no frame lost or added");
assert.ok(after.count <= Math.ceil(before.count / 3) + 1, "about three frames per packet");

// ffmpeg checks page CRCs and packet structure; decoded PCM must match sample for sample
const pcm = (b: Buffer) => run(["-f", "ogg", "-i", "pipe:0", "-f", "s16le", "-ac", "1", "-ar", "48000", "pipe:1"], b);
assert.ok(pcm(repacked).equals(pcm(ogg)), "decoded audio is identical");

// Idempotent and safe on other input
assert.ok(repackOpusForWhatsApp(repacked).equals(repacked));
const notOgg = Buffer.from("not an ogg file");
assert.equal(repackOpusForWhatsApp(notOgg), notOgg);

console.log(`opus repack: ok (${before.count} pacotes code 0 -> ${after.count} pacotes code 3, áudio idêntico)`);
