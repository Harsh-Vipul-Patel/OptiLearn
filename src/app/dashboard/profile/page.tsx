'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/components/ui/Toast'

type ProfileData = {
  user_id?: string
  email?: string
  name?: string
  exam_type?: string
  preferred_time?: string
  created_at?: string
}

export default function ProfilePage() {
  const { showToast } = useToast()
  const [profile, setProfile] = useState<ProfileData | null>(null)

  const [name, setName] = useState('')
  const [examType, setExamType] = useState('')
  const [preferredTime, setPreferredTime] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    fetch('/api/profile')
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
              </div>

              <div className="profile-id-actions">
                <button className="btn-primary" onClick={() => setIsEditing(true)}>
                  Edit Profile
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
              <select
                className="form-select"
                value={examType}
                onChange={(e) => setExamType(e.target.value)}
              >
                <option value="">-- Select exam goal --</option>
                <option value="JEE">JEE</option>
                <option value="NEET">NEET</option>
                <option value="Boards">Boards</option>
                <option value="Others">Others</option>
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', flexDirection: 'column' }}>
                <span>Preferred Study Time</span>
                <span style={{ fontSize: 11, color: 'var(--text-soft)', fontWeight: 400, marginTop: 3 }}>
                  When do you feel most productive?
                </span>
              </label>
              <select 
                className="form-select" 
                value={preferredTime} 
                onChange={(e) => setPreferredTime(e.target.value)}
              >
                <option value="">-- Let AI determine from logs --</option>
                <option value="Morning">Morning (6 AM - 12 PM)</option>
                <option value="Afternoon">Afternoon (12 PM - 6 PM)</option>
                <option value="Evening">Evening (6 PM - 12 AM)</option>
                <option value="Night">Night Owl (12 AM - 6 AM)</option>
              </select>
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
    </div>
  )
}
