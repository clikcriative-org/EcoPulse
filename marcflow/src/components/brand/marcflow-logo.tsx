import { useId } from "react";

export const BRAND_TAGLINE = "Whatsapp By @marcolamaia";

/** MarcFlow mark: a rounded "M" in a green gradient with a dot on the left foot. */
export function MarcFlowLogo({ className = "h-10 w-10" }: { className?: string }) {
    const id = useId();
    return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
            <defs>
                <linearGradient id={`${id}-g`} x1="4" y1="6" x2="44" y2="42" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#3BE38C" />
                    <stop offset="1" stopColor="#0E9F57" />
                </linearGradient>
            </defs>
            <path d="M10 37V12.5c0-1.6 2-2.3 3-1.1L24 25l11-13.6c1-1.2 3-.5 3 1.1V37"
                fill="none" stroke={`url(#${id}-g)`} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="10" cy="38.5" r="4.6" fill="#1FC873" />
        </svg>
    );
}
