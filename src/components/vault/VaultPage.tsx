'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { BrainIcon, SparklesIcon } from '@/components/ui/AppIcons'

type Flashcard = {
  question: string;
  answer: string;
}

type RecallResponse = {
  flashcard_q: string
  flashcard_a: string
  confidence: number
  is_correct: boolean
  response_time_ms: number
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function VaultPage() {
  const [text, setText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [flippedIndex, setFlippedIndex] = useState<number | null>(null)
  
  // Test Mode State
  const [isTestMode, setIsTestMode] = useState(false)
  const [testIndex, setTestIndex] = useState(0)
  const [isTestCardFlipped, setIsTestCardFlipped] = useState(false)
  const [testResponses, setTestResponses] = useState<RecallResponse[]>([])
  const [cardStartTime, setCardStartTime] = useState(0)
  const [isFinished, setIsFinished] = useState(false)
  
  // Save Session State
  const [subjectId, setSubjectId] = useState('')
  const [topicName, setTopicName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const { showToast } = useToast()

  const { data: subjectsData } = useSWR('/api/subjects', fetcher)
  const subjects = subjectsData?.subjects || []

  const handleGenerate = async () => {
    if (text.trim().length < 50) {
      showToast('Please provide a bit more text (at least 50 characters) to generate a meaningful quiz.', 'info')
      return
    }

    try {
      setIsGenerating(true)
      setFlashcards([])
      setFlippedIndex(null)
      setIsTestMode(false)
      setIsFinished(false)
      
      const response = await fetch('/api/vault/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to generate quiz')

      if (data.quiz && Array.isArray(data.quiz)) {
        setFlashcards(data.quiz)
        showToast('Quiz generated successfully!', 'info')
      } else {
        throw new Error('Unexpected API response format')
      }
    } catch (err) {
      console.error(err)
      showToast('Could not generate quiz. Ensure your text is clear and try again.', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleStartTest = () => {
    setIsTestMode(true)
    setTestIndex(0)
    setIsTestCardFlipped(false)
    setTestResponses([])
    setCardStartTime(Date.now())
    setIsFinished(false)
  }

  const handleRateCard = (confidence: number, is_correct: boolean) => {
    const timeTaken = Date.now() - cardStartTime
    const currentCard = flashcards[testIndex]

    setTestResponses(prev => [
      ...prev,
      {
        flashcard_q: currentCard.question,
        flashcard_a: currentCard.answer,
        confidence,
        is_correct,
        response_time_ms: timeTaken
      }
    ])

    if (testIndex < flashcards.length - 1) {
      setTestIndex(prev => prev + 1)
      setIsTestCardFlipped(false)
      setCardStartTime(Date.now())
    } else {
      setIsFinished(true)
    }
  }

  const handleSaveSession = async () => {
    if (!subjectId || !topicName.trim() || testResponses.length === 0) {
      showToast('Please select a subject and enter a topic name.', 'warning')
      return
    }

    setIsSaving(true)
    try {
      // 1. Create Topic
      const topicRes = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject_id: subjectId, topic_name: topicName, complexity: 'Medium' })
      })
      const topicData = await topicRes.json()
      if (!topicRes.ok) throw new Error(topicData.error || 'Failed to create topic')

      const topic_id = topicData.topic.topic_id

      // 2. Submit Recall Session
      const recallRes = await fetch('/api/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id, responses: testResponses })
      })
      const recallData = await recallRes.json()
      if (!recallRes.ok) throw new Error(recallData.error || 'Failed to save recall session')

      showToast('Recall session saved successfully!', 'success')
      setIsTestMode(false)
      setIsFinished(false)
      setText('')
      setFlashcards([])
    } catch (err) {
      console.error(err)
      showToast(err instanceof Error ? err.message : 'Error saving session', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePastePdf = () => {
    setText('Thermodynamics is the branch of physics that deals with the relationships between heat and other forms of energy. In particular, it describes how thermal energy is converted to and from other forms of energy and how it affects matter. The First Law of Thermodynamics states that energy cannot be created or destroyed, only transformed. The Second Law introduces entropy, stating that the total entropy of an isolated system can never decrease over time.')
  }

  // --- RENDERING --- //

  if (isTestMode) {
    return (
      <div style={{ animation: 'pageIn .4s cubic-bezier(.22,.68,0,1.1) both', maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div className="page-title">Active Recall Session</div>
            <div className="page-sub">Test your knowledge and rate your confidence.</div>
          </div>
          <button className="insight-btn insight-btn-ghost" onClick={() => setIsTestMode(false)}>
            Quit Test
          </button>
        </div>

        {!isFinished ? (
          <Card style={{ padding: 30, minHeight: 400, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <Badge variant={isTestCardFlipped ? 'sage' : 'indigo'} style={{ marginBottom: 20 }}>
                {isTestCardFlipped ? 'Answer' : `Question ${testIndex + 1} of ${flashcards.length}`}
              </Badge>
              
              <div style={{ fontSize: 20, textAlign: 'center', lineHeight: 1.6, maxWidth: 600, fontWeight: 500 }}>
                {isTestCardFlipped ? flashcards[testIndex]?.answer : flashcards[testIndex]?.question}
              </div>
            </div>

            <div style={{ marginTop: 40, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
              {!isTestCardFlipped ? (
                <button 
                  className="insight-btn insight-btn-primary" 
                  style={{ width: '100%', padding: '14px' }}
                  onClick={() => setIsTestCardFlipped(true)}
                >
                  Show Answer
                </button>
              ) : (
                <div>
                  <div style={{ textAlign: 'center', marginBottom: 14, fontSize: 13, color: 'var(--text-soft)', fontWeight: 500 }}>
                    How well did you know this?
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                    <button className="insight-btn" style={{ background: '#FEE2E2', color: '#991B1B', border: 'none' }} onClick={() => handleRateCard(1, false)}>
                      1 - Blank
                    </button>
                    <button className="insight-btn" style={{ background: '#FFEDD5', color: '#9A3412', border: 'none' }} onClick={() => handleRateCard(2, false)}>
                      2 - Vague
                    </button>
                    <button className="insight-btn" style={{ background: '#FEF9C3', color: '#854D0E', border: 'none' }} onClick={() => handleRateCard(3, true)}>
                      3 - Struggled
                    </button>
                    <button className="insight-btn" style={{ background: '#D1FAE5', color: '#065F46', border: 'none' }} onClick={() => handleRateCard(4, true)}>
                      4 - Good
                    </button>
                    <button className="insight-btn" style={{ background: '#CFFAFE', color: '#155E75', border: 'none' }} onClick={() => handleRateCard(5, true)}>
                      5 - Perfect
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ) : (
          <Card style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 50, marginBottom: 20 }}></div>
            <div className="section-title">Session Complete!</div>
            <p style={{ color: 'var(--text-soft)', marginBottom: 30 }}>You reviewed {flashcards.length} cards. Save this session to track your retention and feed your spaced repetition engine.</p>
            
            <div style={{ maxWidth: 400, margin: '0 auto', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-main)' }}>Subject</label>
                <select 
                  value={subjectId} 
                  onChange={e => setSubjectId(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--r-sm)', border: '1.5px solid var(--border)', background: 'var(--bg)' }}
                >
                  <option value="" disabled>Select a subject...</option>
                  {subjects.map((s: any) => (
                    <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-main)' }}>Topic Name</label>
                <input 
                  type="text" 
                  value={topicName}
                  onChange={e => setTopicName(e.target.value)}
                  placeholder="e.g. Thermodynamics Laws"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--r-sm)', border: '1.5px solid var(--border)', background: 'var(--bg)' }}
                />
              </div>

              <button 
                className="insight-btn insight-btn-primary"
                onClick={handleSaveSession}
                disabled={isSaving || !subjectId || !topicName.trim()}
                style={{ marginTop: 10, padding: 14 }}
              >
                {isSaving ? 'Saving...' : 'Save Session to Study History'}
              </button>
            </div>
          </Card>
        )}
      </div>
    )
  }

  // --- REGULAR VIEW --- //

  return (
    <div style={{ animation: 'pageIn .4s cubic-bezier(.22,.68,0,1.1) both' }}>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <div className="page-title">Knowledge Vault</div>
          <div className="page-sub">Upload notes and let AI instantly generate your study materials.</div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="section-title" style={{ margin: 0 }}>Source Material</div>
            <button className="insight-btn insight-btn-ghost" onClick={handlePastePdf} style={{ fontSize: '12px', padding: '4px 10px' }}>
              Try sample text
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your study notes, textbook paragraphs, or PDF content here..."
            style={{
              width: '100%',
              height: 250,
              padding: 12,
              borderRadius: 'var(--r-sm)',
              border: '1.5px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text-main)',
              fontFamily: 'inherit',
              fontSize: '13.5px',
              resize: 'none',
              outline: 'none'
            }}
          />
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              className="insight-btn insight-btn-primary" 
              onClick={handleGenerate}
              disabled={isGenerating || text.trim().length === 0}
              style={{ padding: '8px 24px', opacity: (isGenerating || text.trim().length === 0) ? 0.6 : 1 }}
            >
              {isGenerating ? 'Generating...' : 'Generate Flashcards'}
            </button>
          </div>
        </Card>

        <div>
          {flashcards.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="section-title" style={{ margin: 0 }}>AI Generated Flashcards</div>
                <button 
                  className="insight-btn insight-btn-primary" 
                  onClick={handleStartTest}
                  style={{ padding: '6px 16px' }}
                >
                  Start Recall Test
                </button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
                {flashcards.map((fc, idx) => {
                  const isFlipped = flippedIndex === idx
                  return (
                    <div 
                      key={idx} 
                      onClick={() => setFlippedIndex(isFlipped ? null : idx)}
                      style={{
                        padding: 16,
                        background: isFlipped ? 'var(--cream)' : '#ffffff',
                        borderRadius: 'var(--r-md)',
                        border: '1.5px solid var(--border)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Badge variant={isFlipped ? 'sage' : 'indigo'} style={{ fontSize: 11 }}>
                          {isFlipped ? 'Answer' : `Question ${idx + 1}`}
                        </Badge>
                        <span style={{ fontSize: 11, color: 'var(--text-soft)' }}>
                          {isFlipped ? 'Click to show question' : 'Click to flip'}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: isFlipped ? 400 : 500, lineHeight: 1.5 }}>
                        {isFlipped ? fc.answer : fc.question}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <Card style={{ padding: '40px 20px', textAlign: 'center', borderStyle: 'dashed', background: 'transparent' }}>
                 <div style={{ fontSize: 40, marginBottom: 10 }}></div>
                 <div style={{ fontWeight: 600, color: 'var(--text-mid)', marginBottom: 6 }}>Ready to Test You</div>
                 <div style={{ fontSize: '13px', color: 'var(--text-soft)' }}>
                   Paste your notes on the left and click generate.<br/>Our AI will extract the most important concepts into a flashcard deck.
                 </div>
               </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
