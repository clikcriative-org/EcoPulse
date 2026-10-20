import fs from "fs/promises";
import path from "path";
import { logger } from "@/lib/logger";

// Baileys rarely ships a usable imgUrl with contacts (it is often just "changed"), and WhatsApp's
// picture URLs expire. So we fetch on demand, keep the bytes on disk and serve them ourselves.
const HIT_TTL = 24 * 3600_000;
const MISS_TTL = 12 * 3600_000;      // contact has no picture or hides it
const RETRY_TTL = 10 * 60_000;       // temporary failure (rate limit, offline)
const MAX_CONCURRENT = 2;            // keep WhatsApp queries gentle

const root = () => path.join(process.cwd(), "data", "avatars");
const safe = (s: string) => s.replace(/[^\w.@-]/g, "_");
const files = (sessionId: string, jid: string) => {
    const base = path.join(root(), safe(sessionId), safe(jid));
    return { img: `${base}.jpg`, none: `${base}.none` };
};

const g = global as unknown as { __avatarInflight?: Map<string, Promise<Buffer | null>>; __avatarActive?: number; __avatarWaiters?: (() => void)[] };
const inflight = (g.__avatarInflight ??= new Map());
g.__avatarActive ??= 0;
const waiters = (g.__avatarWaiters ??= []);

async function slot<T>(job: () => Promise<T>): Promise<T> {
    while (g.__avatarActive! >= MAX_CONCURRENT) await new Promise<void>(r => waiters.push(r));
    g.__avatarActive!++;
    try { return await job(); } finally { g.__avatarActive!--; waiters.shift()?.(); }
}

async function age(file: string): Promise<number | null> {
    try { return Date.now() - (await fs.stat(file)).mtimeMs; } catch { return null; }
}

async function markMiss(file: string, ttl: number) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, String(ttl));
}

/** Picture bytes for a contact or group, or null when there is none (or it is hidden). */
export async function getAvatar(sessionId: string, jid: string): Promise<Buffer | null> {
    const f = files(sessionId, jid);
    const imgAge = await age(f.img);
    if (imgAge !== null && imgAge < HIT_TTL) return fs.readFile(f.img);
    const noneAge = await age(f.none);
    if (noneAge !== null) {
        const ttl = Number(await fs.readFile(f.none, "utf8").catch(() => MISS_TTL)) || MISS_TTL;
        if (noneAge < ttl) return imgAge !== null ? fs.readFile(f.img) : null;
    }

    const key = `${sessionId}|${jid}`;
    if (!inflight.has(key)) {
        inflight.set(key, slot(async () => {
            const { waManager } = await import("./manager"); // lazy: avoids a store -> manager import cycle
            const sock = waManager.getInstance(sessionId)?.socket;
            if (!sock) return imgAge !== null ? fs.readFile(f.img) : null; // offline: serve stale copy if any
            try {
                const url = await sock.profilePictureUrl(jid, "preview");
                if (!url) { await markMiss(f.none, MISS_TTL); return null; }
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const buf = Buffer.from(await res.arrayBuffer());
                await fs.mkdir(path.dirname(f.img), { recursive: true });
                await fs.writeFile(f.img, buf);
                await fs.rm(f.none, { force: true });
                return buf;
            } catch (e) {
                const msg = String((e as Error)?.message || e);
                const missing = /not-found|404|item-not-found|not-authorized|401/i.test(msg);
                await markMiss(f.none, missing ? MISS_TTL : RETRY_TTL);
                if (!missing) logger.debug("Avatar", `fetch failed for ${jid}: ${msg}`);
                return imgAge !== null ? fs.readFile(f.img) : null;
            }
        }).finally(() => inflight.delete(key)));
    }
    return inflight.get(key)!;
}

/** Called when WhatsApp says a picture changed: next request fetches it again. */
export async function invalidateAvatar(sessionId: string, jid: string) {
    const f = files(sessionId, jid);
    await Promise.all([fs.rm(f.img, { force: true }), fs.rm(f.none, { force: true })]);
}
