'use client'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function DependencyMap() {
  const { data: depsData, mutate } = useSWR('/api/topics/dependencies', fetcher)
  const { data: subjectsData } = useSWR('/api/subjects', fetcher)
  
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)

  const { data: topicsData } = useSWR(selectedSubjectId ? `/api/topics?subject_id=${selectedSubjectId}` : null, fetcher)

  const dependencies = depsData?.dependencies || []
  const subjects = subjectsData?.subjects || []
  const topics = topicsData?.topics || []

  const { showToast } = useToast()

  // Find parents and children of the selected topic
  const parents = dependencies.filter((d: any) => d.child_topic?.topic_id === selectedTopicId)
  const children = dependencies.filter((d: any) => d.parent_topic?.topic_id === selectedTopicId)

  // Eligible for adding as parent (cannot be self, cannot already be parent, cannot create cycle)
  // Simplified cycle check: just prevent direct children from becoming parents
  const eligibleParents = topics.filter((t: any) => 
    t.topic_id !== selectedTopicId && 
    !parents.some((p: any) => p.parent_topic?.topic_id === t.topic_id) &&
    !children.some((c: any) => c.child_topic?.topic_id === t.topic_id)
  )

  const handleAddDependency = async (parentId: string) => {
    if (!selectedTopicId) return
    try {
      const res = await fetch('/api/topics/dependencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_topic_id: parentId, child_topic_id: selectedTopicId })
      })
      if (!res.ok) throw new Error('Failed to add dependency')
      showToast('Dependency added!', 'success')
      mutate()
    } catch {
      showToast('Error adding dependency', 'error')
    }
  }

  const handleRemoveDependency = async (depId: string) => {
    try {
      const res = await fetch(`/api/topics/dependencies?id=${depId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove dependency')
      showToast('Dependency removed', 'success')
      mutate()
    } catch {
      showToast('Error removing dependency', 'error')
    }
  }

  // --- RENDERING ---

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Controls */}
      <Card style={{ padding: 20, display: 'flex', gap: 20, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 13, marginBottom: 8, fontWeight: 500 }}>Select Subject</label>
          <select 
            value={selectedSubjectId} 
            onChange={e => { setSelectedSubjectId(e.target.value); setSelectedTopicId(null) }}
            style={{ width: '100%', padding: '10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--bg)' }}
          >
             <option value="">-- Choose Subject --</option>
             {subjects.map((s: any) => <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 13, marginBottom: 8, fontWeight: 500 }}>Select Topic</label>
          <select 
            value={selectedTopicId || ''} 
            onChange={e => setSelectedTopicId(e.target.value)}
            disabled={!selectedSubjectId}
            style={{ width: '100%', padding: '10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--bg)' }}
          >
             <option value="">-- Choose Topic to inspect --</option>
             {topics.map((t: any) => <option key={t.topic_id} value={t.topic_id}>{t.topic_name}</option>)}
          </select>
        </div>
      </Card>

      {selectedTopicId ? (
         <div style={{ display: 'flex', alignItems: 'stretch', gap: 20 }}>
            {/* PREREQUISITES (Parents) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
               <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-soft)', textAlign: 'center', margin: '0 0 10px 0' }}>Prerequisites</h3>
               
               {parents.length === 0 && <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-soft)', padding: 20 }}>No prerequisites</div>}
               {parents.map((p: any) => (
                 <Card key={p.dependency_id} style={{ padding: '14px 20px', borderLeft: '4px solid var(--terra)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <span style={{ fontSize: 14, fontWeight: 500 }}>{p.parent_topic?.topic_name}</span>
                   <button onClick={() => handleRemoveDependency(p.dependency_id)} style={{ background: 'none', border: 'none', color: 'var(--terra)', cursor: 'pointer', fontSize: 12 }}>Remove</button>
                 </Card>
               ))}

               {/* ADD NEW PARENT */}
               <div style={{ marginTop: 'auto', paddingTop: 20 }}>
                 <select 
                    style={{ width: '100%', padding: 10, fontSize: 12, borderRadius: 6, border: '1px dashed var(--border)', background: 'var(--bg)' }}
                    onChange={e => handleAddDependency(e.target.value)}
                    value=""
                 >
                   <option value="" disabled>+ Add Prerequisite...</option>
                   {eligibleParents.map((ep: any) => (
                     <option key={ep.topic_id} value={ep.topic_id}>{ep.topic_name}</option>
                   ))}
                 </select>
               </div>
            </div>

            {/* ARROW */}
            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--border)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>

            {/* CURRENT TOPIC */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <Card style={{ width: '100%', padding: '40px 20px', textAlign: 'center', background: 'var(--indigo)', color: 'white', borderRadius: 'var(--r-md)' }}>
                 <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                   {topics.find((t: any) => t.topic_id === selectedTopicId)?.topic_name}
                 </h2>
                 <p style={{ margin: '10px 0 0 0', fontSize: 13, opacity: 0.8 }}>Current Focus</p>
               </Card>
            </div>

            {/* ARROW */}
            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--border)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>

            {/* UNLOCKS (Children) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
               <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-soft)', textAlign: 'center', margin: '0 0 10px 0' }}>Unlocks</h3>
               
               {children.length === 0 && <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-soft)', padding: 20 }}>Does not unlock any topics</div>}
               {children.map((c: any) => (
                 <Card key={c.dependency_id} style={{ padding: '14px 20px', borderLeft: '4px solid var(--sage)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <span style={{ fontSize: 14, fontWeight: 500 }}>{c.child_topic?.topic_name}</span>
                   <button onClick={() => setSelectedTopicId(c.child_topic?.topic_id)} style={{ background: 'none', border: 'none', color: 'var(--indigo)', cursor: 'pointer', fontSize: 12 }}>Inspect→</button>
                 </Card>
               ))}
            </div>
         </div>
      ) : (
         <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-soft)', background: 'var(--cream)', borderRadius: 'var(--r-md)' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>🗺️</div>
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 6, color: 'var(--text-mid)' }}>Concept Explorer</div>
            <div style={{ fontSize: 14 }}>Select a topic above to map out its prerequisites and the pathways it unlocks.</div>
         </div>
      )}
    </div>
  )
}
