'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'

type Flashcard = {
  question: string;
  answer: string;
}

export function VaultPage() {
  const [text, setText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [flippedIndex, setFlippedIndex] = useState<number | null>(null)
  const { showToast } = useToast()

  const handleGenerate = async () => {
    if (text.trim().length < 50) {
      showToast('Please provide a bit more text (at least 50 characters) to generate a meaningful quiz.', 'info')
      return
    }

    try {
      setIsGenerating(true)
      setFlashcards([])
      setFlippedIndex(null)
      
      const response = await fetch('/api/vault/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate quiz')
      }

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

  const handlePastePdf = () => {
    // Quick demo inject
    setText('Thermodynamics is the branch of physics that deals with the relationships between heat and other forms of energy. In particular, it describes how thermal energy is converted to and from other forms of energy and how it affects matter. The First Law of Thermodynamics states that energy cannot be created or destroyed, only transformed. The Second Law introduces entropy, stating that the total entropy of an isolated system can never decrease over time.')
  }

  return (
    <div style={{ animation: 'pageIn .4s cubic-bezier(.22,.68,0,1.1) both' }}>
      <div className="page-header">
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
              {isGenerating ? 'Generating...' : '✨ Generate Flashcards'}
            </button>
          </div>
        </Card>

        <div>
          {flashcards.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="section-title">AI Generated Flashcards</div>
              {flashcards.map((fc, idx) => {
                const isFlipped = flippedIndex === idx
                return (
                  <div 
                    key={idx} 
                    onClick={() => setFlippedIndex(isFlipped ? null : idx)}
                    style={{
                      padding: 20,
                      background: isFlipped ? 'var(--cream)' : '#ffffff',
                      borderRadius: 'var(--r-md)',
                      border: '1.5px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      minHeight: 120,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <Badge variant={isFlipped ? 'sage' : 'indigo'}>
                        {isFlipped ? 'Answer' : `Question ${idx + 1}`}
                      </Badge>
                      <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                        {isFlipped ? 'Click to show question' : 'Click to flip'}
                      </span>
                    </div>
                    <div style={{ fontSize: '14.5px', color: 'var(--text-main)', fontWeight: isFlipped ? 400 : 500, lineHeight: 1.6 }}>
                      {isFlipped ? fc.answer : fc.question}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <Card style={{ padding: '40px 20px', textAlign: 'center', borderStyle: 'dashed', background: 'transparent' }}>
                 <div style={{ fontSize: 40, marginBottom: 10 }}>🧠</div>
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
