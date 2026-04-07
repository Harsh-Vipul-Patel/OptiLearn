'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/components/ui/Toast'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { useSession } from '@/components/Providers'

type ProfileData = {
  user_id?: string
  email?: string
  name?: string
  exam_type?: string
  preferred_time?: string
  created_at?: string
  has_password?: boolean
}

export default function ProfilePage() {
  const { showToast } = useToast()
  const { refreshSession } = useSession()
  const [profile, setProfile] = useState<ProfileData | null>(null)

  const [name, setName] = useState('')
  const [examType, setExamType] = useState('')
  const [preferredTime, setPreferredTime] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Password change state
  const [showPasswordSection, setShowPasswordSection] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  const examOptions = [
    { value: '', label: '-- Select exam goal --' },
    { value: 'JEE', label: 'JEE' },
    { value: 'NEET', label: 'NEET' },
    { value: 'Boards', label: 'Boards' },
    { value: 'Others', label: 'Others' },
  ]

  const preferredTimeOptions = [
    { value: '', label: '-- Let AI determine from logs --' },
    { value: 'Morning', label: 'Morning (6 AM - 12 PM)' },
    { value: 'Afternoon', label: 'Afternoon (12 PM - 6 PM)' },
    { value: 'Evening', label: 'Evening (6 PM - 12 AM)' },
    { value: 'Night', label: 'Night Owl (12 AM - 6 AM)' },
  ]

  useEffect(() => {
    fetch('/api/profile', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data.profile) {
          setProfile(data.profile)
          setName(data.profile.name || '')
          setExamType(data.profile.exam_type || '')
          setPreferredTime(data.profile.preferred_time || '')
        }
      })
      .catch(() => showToast('Failed to load profile', 'warning'))
      .finally(() => setLoading(false))
  }, [showToast])

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Name is required', 'warning')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, exam_type: examType, preferred_time: preferredTime })
      })

      if (res.ok) {
        const data = await res.json()
        if (data.profile) {
          setProfile(data.profile)
          setName(data.profile.name || '')
          setExamType(data.profile.exam_type || '')
          setPreferredTime(data.profile.preferred_time || '')
        }
        await refreshSession()
        setIsEditing(false)
        showToast('Profile successfully updated! ✦')
      } else {
        const errorData = await res.json()
        showToast(errorData.error || 'Failed to update profile', 'warning')
      }
    } catch {
      showToast('Network error', 'warning')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setName(profile?.name || '')
    setExamType(profile?.exam_type || '')
    setPreferredTime(profile?.preferred_time || '')
    setIsEditing(false)
  }

  const handleChangePassword = async () => {
    setPasswordError('')
    setPasswordSuccess('')

    if (profile?.has_password && !currentPassword) {
      setPasswordError('Current password is required.')
      return
    }

    if (!newPassword) {
      setPasswordError('New password is required.')
      return
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.')
      return
    }

    setPasswordLoading(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: profile?.has_password ? currentPassword : undefined,
          newPassword,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setPasswordError(data.error || 'Failed to change password.')
      } else {
        setPasswordSuccess(data.message || 'Password updated successfully!')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        // Update the profile to reflect password is now set
        setProfile(prev => prev ? { ...prev, has_password: true } : prev)
        showToast(profile?.has_password ? 'Password changed! ✦' : 'Password set! You can now log in with email & password. ✦')
        // Collapse the section after a brief delay
        setTimeout(() => {
          setShowPasswordSection(false)
          setPasswordSuccess('')
        }, 2500)
      }
    } catch {
      setPasswordError('Network error. Please try again.')
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleCancelPassword = () => {
    setShowPasswordSection(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError('')
    setPasswordSuccess('')
  }

  const initials = (name || profile?.name || 'Student')
    .split(' ')
    .filter(Boolean)
    .map(word => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const joinedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Recently'

  const hasPassword = profile?.has_password

  return (
    <div style={{ animation: 'pageIn .4s cubic-bezier(.22,.68,0,1.1) both' }}>
      <div className="page-header">
        <div>
          <div className="page-title">Profile Settings</div>
          <div className="page-sub">Manage your account details and learning preferences.</div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: isEditing ? 600 : 420, margin: '0 auto' }}>
        {loading ? (
          <div style={{ padding: '20px 0', color: 'var(--text-soft)', fontSize: 14 }}>Loading profile information…</div>
        ) : !isEditing ? (
          <div className="profile-id-shell">
            <div className="profile-id-card">
              <div className="profile-id-header">OptiLearn Student ID</div>

              <div className="profile-id-top">
                <div className="profile-id-avatar">{initials}</div>
                <div className="profile-id-name">{profile?.name || 'Student'}</div>
                <div className="profile-id-email">{profile?.email || 'No email available'}</div>
              </div>

              <div className="profile-id-grid">
                <div>
                  <span className="profile-id-label">User ID</span>
                  <div className="profile-id-value profile-id-mono">{profile?.user_id || 'N/A'}</div>
                </div>
                <div>
                  <span className="profile-id-label">Target Exam</span>
                  <div className="profile-id-value">{profile?.exam_type || 'Not set'}</div>
                </div>
                <div>
                  <span className="profile-id-label">Preferred Time</span>
                  <div className="profile-id-value">{profile?.preferred_time || 'Auto from logs'}</div>
                </div>
                <div>
                  <span className="profile-id-label">Member Since</span>
                  <div className="profile-id-value">{joinedDate}</div>
                </div>
                <div>
                  <span className="profile-id-label">Login Method</span>
                  <div className="profile-id-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {hasPassword ? (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                        Email & Password
                      </>
                    ) : (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                        Google only
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="profile-id-actions" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button className="btn-primary" onClick={() => setIsEditing(true)}>
                  Edit Profile
                </button>
                <button className="btn-secondary" onClick={() => setShowPasswordSection(!showPasswordSection)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                  {hasPassword ? 'Change Password' : 'Set Password'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input 
                className="form-input" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="E.g. Jane Doe"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', flexDirection: 'column' }}>
                <span>Target Exam / Goal</span>
                <span style={{ fontSize: 11, color: 'var(--text-soft)', fontWeight: 400, marginTop: 3 }}>
                  Helps the AI engine tailor suggestions.
                </span>
              </label>
              <CustomSelect
                value={examType}
                onChange={setExamType}
                options={examOptions}
                ariaLabel="Select target exam goal"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', flexDirection: 'column' }}>
                <span>Preferred Study Time</span>
                <span style={{ fontSize: 11, color: 'var(--text-soft)', fontWeight: 400, marginTop: 3 }}>
                  When do you feel most productive?
                </span>
              </label>
              <CustomSelect
                value={preferredTime}
                onChange={setPreferredTime}
                options={preferredTimeOptions}
                ariaLabel="Select preferred study time"
              />
            </div>

            <div style={{ marginTop: 10 }}>
              <div className="profile-edit-actions">
                <button className="btn-secondary" onClick={handleCancelEdit} disabled={saving}>
                  Cancel
                </button>
                <button 
                  className="btn-primary" 
                  onClick={handleSave} 
                  disabled={saving || !name.trim()}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  {saving ? 'Saving Changes…' : 'Save Profile'}
                </button>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ── Password Change Section ── */}
      {showPasswordSection && !isEditing && (
        <div className="card password-change-card" style={{ maxWidth: 420, margin: '18px auto 0', animation: 'pageIn .35s cubic-bezier(.22,.68,0,1.1) both' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--terra)" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-dark)' }}>
              {hasPassword ? 'Change Password' : 'Set a Password'}
            </span>
          </div>

          {!hasPassword && (
            <div className="password-google-hint">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              <span>You signed up with Google. Set a password to also log in with your email and password.</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
            {hasPassword && (
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input
                  className="form-input"
                  type="password"
                  value={currentPassword}
                  onChange={e => { setCurrentPassword(e.target.value); setPasswordError('') }}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                className="form-input"
                type="password"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setPasswordError('') }}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input
                className="form-input"
                type="password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setPasswordError('') }}
                placeholder="Re-enter new password"
                autoComplete="new-password"
                onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
              />
            </div>

            {passwordError && (
              <div style={{ fontSize: 13, color: '#D04040', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6"/><path d="M9 9l6 6"/></svg>
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div style={{ fontSize: 13, color: '#24745A', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                {passwordSuccess}
              </div>
            )}

            <div className="profile-edit-actions">
              <button className="btn-secondary" onClick={handleCancelPassword} disabled={passwordLoading}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleChangePassword}
                disabled={passwordLoading || !newPassword || !confirmPassword || (hasPassword ? !currentPassword : false)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                {passwordLoading ? 'Updating…' : hasPassword ? 'Update Password' : 'Set Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
