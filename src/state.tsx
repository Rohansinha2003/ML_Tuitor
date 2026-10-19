import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type LearningState = {
  completed: string[]
  bookmarks: string[]
  lastLesson: string
  activity: string[]
  notes: Record<string, string>
}

const key = 'mlverse-learning-v1'
const initial: LearningState = { completed: [], bookmarks: [], lastLesson: 'what-is-machine-learning', activity: [], notes: {} }
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

type LearningContextValue = {
  state: LearningState
  complete: (slug: string) => void
  bookmark: (slug: string) => void
  visit: (slug: string) => void
  recordActivity: () => void
  saveNote: (slug: string, note: string) => void
}

const LearningContext = createContext<LearningContextValue | null>(null)
const today = () => dateKey(new Date())

function readState(): LearningState {
  try {
    const saved = localStorage.getItem(key)
    return saved ? { ...initial, ...JSON.parse(saved) as Partial<LearningState> } : initial
  } catch {
    return initial
  }
}

export function LearningProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(readState)
  useEffect(() => localStorage.setItem(key, JSON.stringify(state)), [state])
  const recordActivity = () => setState((current) => ({ ...current, activity: [...new Set([...current.activity, today()])] }))
  const complete = (slug: string) => setState((current) => ({ ...current, completed: [...new Set([...current.completed, slug])], lastLesson: slug, activity: [...new Set([...current.activity, today()])] }))
  const bookmark = (slug: string) => setState((current) => ({ ...current, bookmarks: current.bookmarks.includes(slug) ? current.bookmarks.filter((item) => item !== slug) : [...current.bookmarks, slug] }))
  const visit = useCallback((slug: string) => setState((current) => {
    const activity = [...new Set([...current.activity, today()])]
    return current.lastLesson === slug && activity.length === current.activity.length ? current : { ...current, lastLesson: slug, activity }
  }), [])
  const saveNote = (slug: string, note: string) => setState((current) => ({ ...current, notes: { ...current.notes, [slug]: note } }))
  return <LearningContext.Provider value={{ state, complete, bookmark, visit, recordActivity, saveNote }}>{children}</LearningContext.Provider>
}

export function useLearning() {
  const context = useContext(LearningContext)
  if (!context) throw new Error('useLearning must be used inside LearningProvider')
  return context
}

export function getStreak(activity: string[]) {
  const days = new Set(activity)
  const date = new Date()
  if (!days.has(today())) date.setDate(date.getDate() - 1)
  let count = 0
  while (days.has(dateKey(date))) {
    count += 1
    date.setDate(date.getDate() - 1)
  }
  return count
}
