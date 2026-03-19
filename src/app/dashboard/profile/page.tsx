'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/components/ui/Toast'

export default function ProfilePage() {
  const { showToast } = useToast()
  
  const [name, setName] = useState('')
  const [examType, setExamType] = useState('')
  const [preferredTime, setPreferredTime] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/profile')
      .then(res => res.json())
      .then(data => {
        if (data.profile) {
          setName(data.profile.name || '')
          setExamType(data.profile.exam_type || '')
          setPreferredTime(data.profile.preferred_time || '')
        }
      })
      .catch(() => showToast('Failed to load profile', '⚠️'))
      .finally(() => setLoading(false))
  }, [showToast])

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Name is required', '⚠️')
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
        showToast('Profile successfully updated! ✦')
      } else {
        const errorData = await res.json()
        showToast(errorData.error || 'Failed to update profile', '⚠️')
      }
    } catch {
      showToast('Network error', '⚠️')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ animation: 'pageIn .4s cubic-bezier(.22,.68,0,1.1) both' }}>
      <div className="page-header">
        <div>
          <div className="page-title">Profile Settings</div>
          <div className="page-sub">Manage your account details and learning preferences.</div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 600 }}>
        {loading ? (
          <div style={{ padding: '20px 0', color: 'var(--text-soft)', fontSize: 14 }}>Loading profile information…</div>
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
              <input 
                className="form-input" 
                value={examType} 
                onChange={(e) => setExamType(e.target.value)} 
                placeholder="E.g. JEE, NEET, USMLE"
              />
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
              <button 
                className="btn-primary" 
                onClick={handleSave} 
                disabled={saving || !name.trim()}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                {saving ? 'Saving Changes…' : 'Save Profile'}
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
