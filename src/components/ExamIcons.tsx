'use client';

// Exam target icons — support `selected` prop for cyan vs muted coloring

interface IconProps { selected?: boolean; }

const c = (s: boolean | undefined) => s ? 'rgba(0,230,250,0.95)' : 'rgba(160,200,225,0.80)';
const cf = (s: boolean | undefined) => s ? 'rgba(0,230,250,0.18)' : 'rgba(160,200,225,0.08)';
const sw = '1.6';

export function SatIcon({ selected }: IconProps) {
    const col = c(selected); const fill = cf(selected);
    return (
        <svg width="34" height="34" viewBox="0 0 32 32" fill="none"
            style={{ filter: selected ? 'drop-shadow(0 0 6px rgba(0,220,240,0.70))' : 'none' }}>
            {/* Star burst */}
            <path
                d="M16 3 L18.8 11.5 L28 11.5 L20.8 17 L23.6 25.5 L16 20.5 L8.4 25.5 L11.2 17 L4 11.5 L13.2 11.5 Z"
                stroke={col} strokeWidth={sw} strokeLinejoin="round" fill={fill}
            />
            <circle cx="16" cy="14.5" r="2.2" fill={col} opacity="0.7" />
        </svg>
    );
}

export function ActIcon({ selected }: IconProps) {
    const col = c(selected); const fill = cf(selected);
    return (
        <svg width="34" height="34" viewBox="0 0 32 32" fill="none"
            style={{ filter: selected ? 'drop-shadow(0 0 6px rgba(0,220,240,0.70))' : 'none' }}>
            {/* Rocket body */}
            <path
                d="M16 5 C16 5 23 10 23 19 L16 27 L9 19 C9 10 16 5 16 5Z"
                stroke={col} strokeWidth={sw} fill={fill} strokeLinejoin="round"
            />
            {/* Porthole */}
            <circle cx="16" cy="15" r="2.8" stroke={col} strokeWidth="1.3" />
            {/* Fins */}
            <path d="M9 19 L6 23" stroke={col} strokeWidth="1.4" strokeLinecap="round" />
            <path d="M23 19 L26 23" stroke={col} strokeWidth="1.4" strokeLinecap="round" />
            {/* Flame */}
            <path d="M14.5 27 Q16 30 17.5 27" stroke={col} strokeWidth="1.3"
                fill="none" strokeLinecap="round" />
        </svg>
    );
}

export function ApExamsIcon({ selected }: IconProps) {
    const col = c(selected); const fill = cf(selected);
    return (
        <svg width="34" height="34" viewBox="0 0 32 32" fill="none"
            style={{ filter: selected ? 'drop-shadow(0 0 6px rgba(0,220,240,0.70))' : 'none' }}>
            {/* Open book */}
            <path d="M16 8 L16 24" stroke={col} strokeWidth="1.4" />
            <path d="M16 8 C13 7 8 7.5 6 9 L6 25 C8 23.5 13 23 16 24Z"
                stroke={col} strokeWidth={sw} fill={fill} strokeLinejoin="round" />
            <path d="M16 8 C19 7 24 7.5 26 9 L26 25 C24 23.5 19 23 16 24Z"
                stroke={col} strokeWidth={sw} fill={fill} strokeLinejoin="round" />
            {/* Gear overlay — bottom right */}
            <circle cx="23" cy="23" r="4" fill="rgba(4,14,32,0.95)" stroke={col} strokeWidth="1.3" />
            <circle cx="23" cy="23" r="1.5" fill={col} opacity="0.7" />
            {/* Gear teeth — 4 small lines */}
            {[0, 90, 180, 270].map(deg => (
                <line key={deg}
                    x1={23 + 2.5 * Math.cos(deg * Math.PI / 180)}
                    y1={23 + 2.5 * Math.sin(deg * Math.PI / 180)}
                    x2={23 + 4 * Math.cos(deg * Math.PI / 180)}
                    y2={23 + 4 * Math.sin(deg * Math.PI / 180)}
                    stroke={col} strokeWidth="1.4" strokeLinecap="round"
                />
            ))}
        </svg>
    );
}

export function IbDiplomaIcon({ selected }: IconProps) {
    const col = c(selected); const fill = cf(selected);
    return (
        <svg width="34" height="34" viewBox="0 0 32 32" fill="none"
            style={{ filter: selected ? 'drop-shadow(0 0 6px rgba(0,220,240,0.70))' : 'none' }}>
            {/* Trophy cup */}
            <path
                d="M11 6 H21 V17 C21 20.5 18.3 23 15 23 C11.7 23 10 20.5 10 17 V6Z"
                stroke={col} strokeWidth={sw} fill={fill} strokeLinejoin="round"
            />
            {/* Handles */}
            <path d="M10 8 C8 8.5 7 11 7 13 C7 15.5 8.5 17.5 10 18"
                stroke={col} strokeWidth="1.4" fill="none" strokeLinecap="round" />
            <path d="M21 8 C23 8.5 24 11 24 13 C24 15.5 22.5 17.5 21 18"
                stroke={col} strokeWidth="1.4" fill="none" strokeLinecap="round" />
            {/* Stem */}
            <path d="M15 23 V27" stroke={col} strokeWidth="1.5" strokeLinecap="round" />
            {/* Base */}
            <line x1="11" y1="27" x2="19" y2="27" stroke={col} strokeWidth="1.8" strokeLinecap="round" />
            {/* Star inside trophy */}
            <path d="M15 10 L15.7 12.1 L18 12.1 L16.2 13.4 L16.9 15.5 L15 14.2 L13.1 15.5 L13.8 13.4 L12 12.1 L14.3 12.1 Z"
                fill={col} opacity="0.75" />
        </svg>
    );
}
