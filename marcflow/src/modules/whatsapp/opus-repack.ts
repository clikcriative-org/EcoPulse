// iOS WhatsApp refuses voice notes ("audio no longer available") whose Opus packets carry one frame each
// (TOC code 0), which is what libopus/ffmpeg emit. Native voice notes group several 20 ms frames per packet
// (code 3). This regroups the frames without re-encoding, so the audio is bit-identical.
// Packet format: RFC 6716 §3.1-3.2. Ogg encapsulation: RFC 7845. See Baileys PR #2648.

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let r = i << 24;
        for (let j = 0; j < 8; j++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1;
        t[i] = r >>> 0;
    }
    return t;
})();

function oggCrc(page: Buffer): number {
    let crc = 0;
    for (const b of page) crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ b) & 0xff]) >>> 0;
    return crc;
}

interface Page { granule: bigint; serial: number; packets: Buffer[]; headerType: number }

function readPages(buf: Buffer): Page[] | null {
    const pages: Page[] = [];
    let pos = 0;
    let partial: Buffer[] = [];
    while (pos < buf.length) {
        if (buf.toString("latin1", pos, pos + 4) !== "OggS") return null;
        const headerType = buf[pos + 5];
        const granule = buf.readBigInt64LE(pos + 6);
        const serial = buf.readUInt32LE(pos + 14);
        const nseg = buf[pos + 26];
        let p = pos + 27 + nseg;
        const packets: Buffer[] = [];
        for (let i = 0; i < nseg; i++) {
            const len = buf[pos + 27 + i];
            partial.push(buf.subarray(p, p + len));
            p += len;
            if (len < 255) { packets.push(Buffer.concat(partial)); partial = []; }
        }
        pages.push({ granule, serial, packets, headerType });
        pos = p;
    }
    return pages;
}

function writePage(packets: Buffer[], granule: bigint, serial: number, seq: number, headerType: number): Buffer {
    const lacing: number[] = [];
    for (const pk of packets) {
        let n = pk.length;
        while (n >= 255) { lacing.push(255); n -= 255; }
        lacing.push(n);
    }
    const header = Buffer.alloc(27 + lacing.length);
    header.write("OggS", 0, "latin1");
    header[4] = 0;
    header[5] = headerType;
    header.writeBigInt64LE(granule, 6);
    header.writeUInt32LE(serial, 14);
    header.writeUInt32LE(seq, 18);
    header[26] = lacing.length;
    lacing.forEach((v, i) => { header[27 + i] = v; });
    const page = Buffer.concat([header, ...packets]);
    page.writeUInt32LE(oggCrc(page), 22);
    return page;
}

/** Samples (48 kHz) per frame for a TOC config number (RFC 6716 table 2). */
function frameSamples(config: number): number {
    if (config < 12) return [480, 960, 1920, 2880][config % 4];   // SILK 10/20/40/60 ms
    if (config < 16) return [480, 960][config % 2];               // Hybrid 10/20 ms
    return [120, 240, 480, 960][config % 4];                      // CELT 2.5/5/10/20 ms
}

/** Code 3 packet (VBR) carrying `frames` (each a code-0 payload without its TOC byte). */
function code3Packet(config: number, frames: Buffer[]): Buffer {
    const parts: Buffer[] = [Buffer.from([(config << 3) | 3, 0x80 | frames.length])];
    for (const f of frames.slice(0, -1)) {
        const n = f.length;
        parts.push(n < 252 ? Buffer.from([n]) : Buffer.from([252 + (n & 3), (n - (252 + (n & 3))) >> 2]));
    }
    return Buffer.concat([...parts, ...frames]);
}

/**
 * Regroups a single-frame (code 0) Ogg/Opus stream into code 3 packets of `framesPerPacket` frames.
 * Returns the input untouched when it isn't Ogg/Opus or isn't all code 0 (already fine, or unknown layout).
 */
export function repackOpusForWhatsApp(input: Buffer, framesPerPacket = 3): Buffer {
    const pages = readPages(input);
    if (!pages || pages.length < 3) return input;
    const all = pages.flatMap(p => p.packets);
    if (all[0]?.toString("latin1", 0, 8) !== "OpusHead" || all[1]?.toString("latin1", 0, 8) !== "OpusTags") return input;
    const audio = all.slice(2).filter(p => p.length > 0);
    if (!audio.length || audio.some(p => (p[0] & 3) !== 0)) return input;
    const serial = pages[0].serial;
    const finalGranule = pages[pages.length - 1].granule;

    // Group consecutive frames that share a config (all frames in one packet must)
    const grouped: { packet: Buffer; samples: number }[] = [];
    let run: Buffer[] = [];
    let runConfig = -1;
    const flush = () => {
        if (!run.length) return;
        grouped.push({
            packet: run.length === 1 ? Buffer.concat([Buffer.from([runConfig << 3]), run[0]]) : code3Packet(runConfig, run),
            samples: frameSamples(runConfig) * run.length,
        });
        run = [];
    };
    for (const pk of audio) {
        const config = pk[0] >> 3;
        // 120 ms is the maximum duration of one Opus packet
        if (config !== runConfig || run.length >= framesPerPacket || (run.length + 1) * frameSamples(config) > 5760) flush();
        runConfig = config;
        run.push(pk.subarray(1));
    }
    flush();

    const out: Buffer[] = [writePage([all[0]], BigInt(0), serial, 0, 0x02), writePage([all[1]], BigInt(0), serial, 1, 0)];
    let samples = BigInt(0);
    grouped.forEach((g, i) => {
        samples += BigInt(g.samples);
        const last = i === grouped.length - 1;
        // Keep the original end trim on the last page; elsewhere the granule is the running sample count
        const granule = last ? finalGranule : samples;
        out.push(writePage([g.packet], granule, serial, i + 2, last ? 0x04 : 0));
    });
    return Buffer.concat(out);
}
