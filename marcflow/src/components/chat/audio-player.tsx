"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Mic, Pause, Play } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const BARS = 42;
const SPEEDS = [1, 1.5, 2];

// Only one voice note plays at a time, like WhatsApp
let current: HTMLAudioElement | null = null;

const fmt = (s: number) => (isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");

/** Deterministic fallback bars when the audio can't be decoded. */
function pseudoBars(seed: string) {
    let h = 0;
    for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return Array.from({ length: BARS }, () => { h = (h * 1103515245 + 12345) >>> 0; return 0.25 + ((h >>> 16) % 1000) / 1400; });
}

async function decodePeaks(src: string): Promise<number[] | null> {
    try {
        const buf = await (await fetch(src)).arrayBuffer();
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const audio = await ctx.decodeAudioData(buf);
        ctx.close();
        const data = audio.getChannelData(0);
        const step = Math.floor(data.length / BARS) || 1;
        const peaks = Array.from({ length: BARS }, (_, i) => {
            let max = 0;
            for (let j = i * step; j < Math.min((i + 1) * step, data.length); j += 16) max = Math.max(max, Math.abs(data[j]));
            return max;
        });
        const top = Math.max(...peaks) || 1;
        return peaks.map(p => Math.max(0.12, p / top));
    } catch {
        return null;
    }
}

export function AudioPlayer({ src, avatarSrc, fallback, fromMe, meta }: { src: string; avatarSrc?: string; fallback: string; fromMe: boolean; meta: ReactNode }) {
    const ref = useRef<HTMLAudioElement>(null);
    const box = useRef<HTMLDivElement>(null);
    const [bars, setBars] = useState<number[]>(() => pseudoBars(src));
    const [playing, setPlaying] = useState(false);
    const [time, setTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [speed, setSpeed] = useState(1);
    const [played, setPlayed] = useState(false);

    // Real waveform, decoded only when the bubble scrolls into view
    useEffect(() => {
        const el = box.current;
        if (!el) return;
        let alive = true;
        const obs = new IntersectionObserver(([e]) => {
            if (!e.isIntersecting) return;
            obs.disconnect();
            decodePeaks(src).then(p => { if (alive && p) setBars(p); });
        }, { rootMargin: "300px" });
        obs.observe(el);
        return () => { alive = false; obs.disconnect(); };
    }, [src]);

    const toggle = () => {
        const a = ref.current;
        if (!a) return;
        if (a.paused) {
            if (current && current !== a) current.pause();
            current = a;
            a.playbackRate = speed;
            a.play().catch(() => undefined);
        } else a.pause();
    };

    const seek = (e: React.MouseEvent<HTMLDivElement>) => {
        const a = ref.current;
        if (!a || !duration) return;
        const r = e.currentTarget.getBoundingClientRect();
        a.currentTime = Math.min(duration, Math.max(0, ((e.clientX - r.left) / r.width) * duration));
        setTime(a.currentTime);
    };

    const progress = duration ? time / duration : 0;
    const unplayedColor = fromMe ? "bg-[#8FAF89] dark:bg-[#6E9A8F]" : "bg-[#B6BCC0] dark:bg-[#5E6B73]";

    return (
        <div ref={box} className="flex w-[300px] min-w-[230px] max-w-full items-center gap-2.5 py-1">
            <audio ref={ref} src={src} preload="metadata"
                onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
                onDurationChange={e => isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)}
                onTimeUpdate={e => setTime(e.currentTarget.currentTime)}
                onPlay={() => { setPlaying(true); setPlayed(true); }}
                onPause={() => setPlaying(false)}
                onEnded={() => { setPlaying(false); setTime(0); }} />

            <button type="button" onClick={toggle} title={playing ? "Pausar" : "Ouvir"} className="flex h-9 w-9 shrink-0 items-center justify-center text-[#54656F] dark:text-[#AEBAC1]">
                {playing ? <Pause className="h-7 w-7 fill-current" /> : <Play className="h-7 w-7 fill-current" />}
            </button>

            <div className="min-w-0 flex-1">
                <div className="relative flex h-8 cursor-pointer items-center gap-[2px]" onClick={seek}>
                    {bars.map((b, i) => (
                        <span key={i} className={cn("w-[3px] flex-1 rounded-full", i / BARS < progress ? "bg-[#54656F] dark:bg-[#AEBAC1]" : unplayedColor)} style={{ height: `${Math.round(b * 100)}%` }} />
                    ))}
                    <span className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow" style={{ left: `${progress * 100}%` }} />
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 whitespace-nowrap text-[11px] text-[#667781] dark:text-[#8696A0]">
                    <span>{fmt(playing || time ? time : duration)}</span>
                    <span className="flex items-center gap-1">{meta}</span>
                </div>
            </div>

            {playing ? (
                <button type="button" title="Velocidade" onClick={() => { const n = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; setSpeed(n); if (ref.current) ref.current.playbackRate = n; }}
                    className="flex h-12 w-12 shrink-0 items-center justify-center">
                    <span className="rounded-full bg-black/10 px-2.5 py-1 text-xs font-semibold dark:bg-white/15">{speed}×</span>
                </button>
            ) : (
                <div className="relative shrink-0">
                    <Avatar className="h-12 w-12">
                        {avatarSrc && <AvatarImage src={avatarSrc} alt="" className="object-cover" />}
                        <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-primary/20 to-blue-500/20 text-primary">{fallback}</AvatarFallback>
                    </Avatar>
                    <Mic className={cn("absolute -bottom-0.5 -left-1.5 h-5 w-5 drop-shadow", played ? "text-[#53BDEB]" : "text-primary")} />
                </div>
            )}
        </div>
    );
}
