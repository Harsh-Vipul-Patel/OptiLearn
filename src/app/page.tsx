'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import OLLogo from '@/components/OLLogo';
import { SatIcon, ActIcon, ApExamsIcon, IbDiplomaIcon } from '@/components/ExamIcons';

const ParticleBackground = dynamic(() => import('@/components/ParticleBackground'), { ssr: false });

const EXAM_TARGETS = [
  { id: 'SAT', label: 'SAT', Icon: SatIcon },
  { id: 'ACT', label: 'ACT', Icon: ActIcon },
  { id: 'AP', label: 'AP Exams', Icon: ApExamsIcon },
  { id: 'IB', label: 'IB Diploma', Icon: IbDiplomaIcon },
];

export default function AuthPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedExam, setSelectedExam] = useState('SAT');

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        /* Deep space navy — same as reference */
        background: `
          radial-gradient(ellipse 70% 55% at 15% 50%, rgba(0,80,130,0.22) 0%, transparent 60%),
          radial-gradient(ellipse 70% 55% at 85% 40%, rgba(0,60,110,0.18) 0%, transparent 60%),
          radial-gradient(ellipse 100% 80% at 50% 100%, rgba(0,40,90,0.35) 0%, transparent 60%),
          linear-gradient(180deg, #020b1a 0%, #040f22 40%, #020a18 100%)
        `,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Animated particle canvas */}
      <ParticleBackground />

      {/* Large ambient teal blobs — give the deep-space glow from the image */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
      }}>
        {/* Left cluster */}
        <div style={{
          position: 'absolute', top: '20%', left: '-8%',
          width: 380, height: 380,
          background: 'radial-gradient(circle, rgba(0,180,220,0.14) 0%, transparent 70%)',
          borderRadius: '50%', filter: 'blur(40px)',
        }} />
        {/* Right cluster */}
        <div style={{
          position: 'absolute', bottom: '18%', right: '-6%',
          width: 340, height: 340,
          background: 'radial-gradient(circle, rgba(0,140,200,0.12) 0%, transparent 70%)',
          borderRadius: '50%', filter: 'blur(40px)',
        }} />
        {/* Top-center subtle glow */}
        <div style={{
          position: 'absolute', top: '-5%', left: '30%',
          width: 300, height: 200,
          background: 'radial-gradient(ellipse, rgba(0,160,210,0.09) 0%, transparent 70%)',
          filter: 'blur(30px)',
        }} />
        {/* Bottom glow */}
        <div style={{
          position: 'absolute', bottom: '-8%', left: '20%',
          width: 400, height: 250,
          background: 'radial-gradient(ellipse, rgba(0,100,180,0.10) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }} />
      </div>

      {/* "Auth Portal" — top right */}
      <div style={{
        position: 'fixed', top: 22, right: 28,
        fontSize: 13, fontWeight: 400,
        color: 'rgba(200,230,255,0.45)',
        letterSpacing: '0.04em',
        zIndex: 10,
      }}>
        Auth Portal
      </div>

      {/* ═══════════════════════════════════════════
          AUTH CARD — 3-D floating glass panel
      ═══════════════════════════════════════════ */}
      <div
        className="auth-card"
        style={{
          position: 'relative', zIndex: 5,
          width: '100%', maxWidth: 430,
          borderRadius: 18,
          padding: '34px 34px 26px',
          margin: '0 16px',
        }}
      >
        {/* Inner top specular highlight line */}
        <div style={{
          position: 'absolute', top: 0, left: '10%', right: '10%', height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(0,220,240,0.40), transparent)',
          borderRadius: 1,
        }} />

        {/* Logo */}
        <OLLogo />

        {/* Title */}
        <h1 style={{
          fontSize: 27,
          fontWeight: 800,
          color: '#ffffff',
          textAlign: 'center',
          marginBottom: 22,
          lineHeight: 1.2,
          letterSpacing: '-0.02em',
          textShadow: '0 2px 20px rgba(0,180,220,0.20)',
        }}>
          Log In to Your Portal
        </h1>

        {/* Username / Email */}
        <div style={{ marginBottom: 13 }}>
          <label style={{
            display: 'block', fontSize: 12.5,
            color: 'rgba(200,225,255,0.70)',
            marginBottom: 6, fontWeight: 500,
          }}>
            Username/Email
          </label>
          <input
            type="text"
            placeholder="Username/Email"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="auth-input"
            style={{
              width: '100%', padding: '10px 14px',
              borderRadius: 8, fontSize: 13.5,
            }}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: 5 }}>
          <label style={{
            display: 'block', fontSize: 12.5,
            color: 'rgba(200,225,255,0.70)',
            marginBottom: 6, fontWeight: 500,
          }}>
            Password
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="auth-input"
              style={{
                width: '100%', padding: '10px 42px 10px 14px',
                borderRadius: 8, fontSize: 13.5,
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute', right: 12, top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none',
                cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center',
              }}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="rgba(150,190,220,0.75)" strokeWidth="1.8">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="rgba(150,190,220,0.75)" strokeWidth="1.8">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Forgot Password */}
        <div style={{ textAlign: 'right', marginBottom: 20 }}>
          <a href="#" style={{
            fontSize: 12.5,
            color: 'rgba(0, 210, 240, 1)',
            textDecoration: 'none', fontWeight: 500,
            textShadow: '0 0 12px rgba(0,210,240,0.40)',
          }}>
            Forgot Password?
          </a>
        </div>

        {/* Select Exam Target */}
        <div style={{ marginBottom: 20 }}>
          <p style={{
            textAlign: 'center', fontSize: 14, fontWeight: 700,
            color: 'rgba(230,245,255,0.92)',
            marginBottom: 13, letterSpacing: '0.01em',
          }}>
            Select Your Exam Target
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 10,
          }}>
            {EXAM_TARGETS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setSelectedExam(id)}
                className={`exam-card${selectedExam === id ? ' selected' : ''}`}
                style={{
                  border: 'none', cursor: 'pointer',
                  borderRadius: 10,
                  padding: '16px 6px 12px',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Icon selected={selectedExam === id} />
                <span style={{
                  fontSize: 11.5, fontWeight: 700,
                  color: selectedExam === id
                    ? 'rgba(0,230,250,1)'
                    : 'rgba(190,215,235,0.80)',
                  letterSpacing: '0.03em',
                  textAlign: 'center', lineHeight: 1.2,
                  textShadow: selectedExam === id
                    ? '0 0 10px rgba(0,220,240,0.60)'
                    : 'none',
                }}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* LOG IN */}
        <button
          type="button"
          className="login-btn"
          style={{
            width: '100%',
            padding: '13px 0',
            borderRadius: 50,
            border: 'none',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 800,
            color: '#ffffff',
            marginBottom: 13,
            textShadow: '0 1px 4px rgba(0,0,0,0.40)',
          }}
        >
          LOG IN
        </button>

        {/* Create Account */}
        <div style={{ textAlign: 'center', marginBottom: 15 }}>
          <a href="#" style={{
            fontSize: 13,
            color: 'rgba(0,210,240,0.85)',
            textDecoration: 'none', fontWeight: 500,
            textShadow: '0 0 10px rgba(0,200,230,0.30)',
          }}>
            Create Account
          </a>
        </div>

        {/* Social SSO */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
          <button type="button" className="social-btn" style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '7px 16px',
            borderRadius: 50,
            border: 'none', cursor: 'pointer',
            fontSize: 12, color: 'rgba(200,220,240,0.80)',
            fontWeight: 500,
          }}>
            {/* Google G */}
            <svg width="15" height="15" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Log In with
          </button>

          <button type="button" className="social-btn" style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '7px 16px',
            borderRadius: 50,
            border: 'none', cursor: 'pointer',
            fontSize: 12, color: 'rgba(200,220,240,0.80)',
            fontWeight: 500,
          }}>
            {/* Microsoft */}
            <svg width="14" height="14" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="9" height="9" fill="#f25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
              <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
            </svg>
            Google/Microsoft
          </button>
        </div>

        {/* Bottom specular shine */}
        <div style={{
          position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(0,150,200,0.20), transparent)',
        }} />
      </div>

      {/* Footer */}
      <div style={{
        position: 'fixed', bottom: 14, left: 0, right: 0,
        textAlign: 'center', fontSize: 11.5,
        color: 'rgba(160,200,230,0.30)',
        zIndex: 5, letterSpacing: '0.04em',
      }}>
        OptiLearn © 2024
      </div>
    </div>
  );
}
