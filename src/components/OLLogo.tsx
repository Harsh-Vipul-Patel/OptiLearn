export default function OLLogo() {
    return (
        <div className="flex items-center justify-center gap-2 mb-5">
            {/* Circular OL badge */}
            <div
                style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    border: '2px solid rgba(0, 220, 240, 0.9)',
                    background: 'rgba(0, 180, 220, 0.15)',
                    boxShadow: '0 0 12px rgba(0, 220, 240, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                }}
            >
                <span
                    style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: 'rgba(0, 220, 240, 1)',
                        letterSpacing: '0.02em',
                        lineHeight: 1,
                    }}
                >
                    OL
                </span>
            </div>

            {/* OPTILearn wordmark */}
            <span
                style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: '#ffffff',
                    letterSpacing: '0.02em',
                }}
            >
                OPTI<span style={{ color: 'rgba(0, 220, 240, 1)' }}>Learn</span>
            </span>
        </div>
    );
}
