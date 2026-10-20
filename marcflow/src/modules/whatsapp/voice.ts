import { spawn } from "child_process";
import { repackOpusForWhatsApp } from "./opus-repack";

/**
 * Browsers record WebM/Opus (Chrome) or Ogg/Opus (Firefox); WhatsApp voice notes must be Ogg/Opus mono.
 * Re-encodes with ffmpeg (FFMPEG_PATH or "ffmpeg" on PATH).
 */
export function toOggOpus(input: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const ff = spawn(process.env.FFMPEG_PATH || "ffmpeg", [
            "-hide_banner", "-loglevel", "error", "-i", "pipe:0",
            // Mic recordings from Chrome can start at a non-zero timestamp, which ends up as a long Opus pre-skip
            "-vn", "-map_metadata", "-1", "-af", "asetpts=PTS-STARTPTS",
            // Super-wideband like the voice notes recorded by the WhatsApp app itself
            "-ac", "1", "-ar", "48000", "-c:a", "libopus", "-b:a", "32k", "-application", "voip", "-cutoff", "12000",
            "-f", "ogg", "pipe:1",
        ]);
        const out: Buffer[] = [];
        let err = "";
        ff.stdout.on("data", d => out.push(d));
        ff.stderr.on("data", d => { err += d; });
        ff.on("error", e => reject(new Error((e as NodeJS.ErrnoException).code === "ENOENT" ? "ffmpeg não encontrado no servidor (defina FFMPEG_PATH)" : e.message)));
        ff.on("close", code => (code === 0 && out.length ? resolve(repackOpusForWhatsApp(Buffer.concat(out))) : reject(new Error(`Falha ao converter o áudio: ${err.trim() || `código ${code}`}`))));
        ff.stdin.on("error", () => undefined);
        ff.stdin.end(input);
    });
}
