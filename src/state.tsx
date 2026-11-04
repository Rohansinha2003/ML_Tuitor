import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { apiRequest, ApiError } from './api'
import { useAuth } from './AuthProvider'
import { lessons } from './content/lessons'

export type QuizAttemptSummary = { _id?: string; lessonSlug: string; score: number; totalQuestions: number; attemptedAt: string }
export type NoteStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'
export type PersistenceStatus = 'loading' | 'guest' | 'syncing' | 'synced' | 'error'

export type LearningState = {
  completed: string[]
  bookmarks: string[]
  lastLesson: string
  activity: string[]
  notes: Record<string, string>
  noteStatuses: Record<string, NoteStatus>
  quizAttempts: QuizAttemptSummary[]
  persistence: 'guest' | 'server'
}

const key = 'deepnova-learning-v1'
const todayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const today = () => todayKey(new Date())
const initial: LearningState = { completed: [], bookmarks: [], lastLesson: 'what-is-machine-learning', activity: [], notes: {}, noteStatuses: {}, quizAttempts: [], persistence: 'guest' }

type ProgressRecord = { lessonSlug: string; isCompleted: boolean; lastAccessedAt: string }
type BookmarkRecord = { lessonSlug: string }
type DashboardResponse = { continueLearning: { slug: string } | null }
const hasGuestProgress = (guest: LearningState) => guest.completed.length > 0 || guest.bookmarks.length > 0 || guest.activity.length > 0 || Object.values(guest.notes).some((note) => note.trim())
type LearningContextValue = {
  state: LearningState
  syncStatus: PersistenceStatus
  error: string | null
  clearError: () => void
  complete: (slug: string) => Promise<void>
  bookmark: (slug: string) => Promise<void>
  visit: (slug: string) => void
  recordActivity: () => void
  loadNote: (slug: string) => Promise<void>
  saveNote: (slug: string, note: string) => void
  recordQuizAttempt: (slug: string, selectedIndex: number) => Promise<void>
}

const LearningContext = createContext<LearningContextValue | null>(null)
function readGuestState(): LearningState {
  try {
    const saved = localStorage.getItem(key) ?? localStorage.getItem('mlverse-learning-v1')
    return saved ? { ...initial, ...JSON.parse(saved) as Partial<LearningState>, persistence: 'guest' } : initial
  } catch {
    return initial
  }
}

function requestError(error: unknown) {
  return error instanceof ApiError ? error.message : 'Could not save your learning data. Please try again.'
}

export function LearningProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const ownerId = auth.status === 'loading' ? 'loading' : auth.user?.id ?? 'guest'
  const [owned, setOwned] = useState<{ ownerId: string; state: LearningState }>({ ownerId: 'guest', state: readGuestState() })
  const [syncStatus, setSyncStatus] = useState<PersistenceStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const noteTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const requestedNotes = useRef(new Set<string>())
  const state = owned.ownerId === ownerId ? owned.state : ownerId === 'guest' ? readGuestState() : initial

  useEffect(() => {
    let active = true
    if (auth.status === 'loading') {
      setSyncStatus('loading')
      return () => { active = false }
    }
    if (!auth.user) {
      const guest = readGuestState()
      setOwned({ ownerId: 'guest', state: guest })
      setSyncStatus('guest')
      setError(null)
      return () => { active = false }
    }

    const userId = auth.user.id
    setOwned({ ownerId: userId, state: { ...initial, persistence: 'server' } })
    setSyncStatus('syncing')
    setError(null)
    const guest = readGuestState()
    const imported = hasGuestProgress(guest)
      ? apiRequest('/progress/import', { method: 'POST', body: JSON.stringify({ completed: guest.completed, bookmarks: guest.bookmarks, notes: guest.notes, activity: guest.activity }) })
        .then(() => localStorage.setItem(key, JSON.stringify(initial)))
        .catch(() => undefined) // Keep the local copy and try again on the next sign-in.
      : Promise.resolve()
    void imported.then(() => Promise.all([
      apiRequest<{ progress: ProgressRecord[]; activity: string[] }>('/progress'),
      apiRequest<{ bookmarks: BookmarkRecord[] }>('/bookmarks'),
      apiRequest<{ attempts: QuizAttemptSummary[] }>('/quizzes/attempts?limit=100'),
      apiRequest<DashboardResponse>('/progress/dashboard'),
    ])).then(([progressResult, bookmarkResult, quizResult, dashboardResult]) => {
      if (!active) return
      const ordered = progressResult.progress.slice().sort((first, second) => new Date(second.lastAccessedAt).getTime() - new Date(first.lastAccessedAt).getTime())
      const nextLesson = ordered.find((item) => !item.isCompleted) ?? ordered[0]
      const lastLesson = dashboardResult.continueLearning?.slug ?? nextLesson?.lessonSlug ?? initial.lastLesson
      setOwned({ ownerId: userId, state: {
        ...initial,
        persistence: 'server',
        completed: progressResult.progress.filter((item) => item.isCompleted).map((item) => item.lessonSlug),
        bookmarks: bookmarkResult.bookmarks.map((item) => item.lessonSlug),
        lastLesson,
        activity: progressResult.activity,
        quizAttempts: quizResult.attempts,
      } })
      setSyncStatus('synced')
    }).catch((reason: unknown) => {
      if (!active) return
      setOwned({ ownerId: userId, state: { ...initial, persistence: 'server' } })
      setSyncStatus('error')
      setError(requestError(reason))
    })
    return () => { active = false }
  }, [auth.status, auth.user])

  useEffect(() => () => {
    for (const timer of noteTimers.current.values()) clearTimeout(timer)
    noteTimers.current.clear()
    requestedNotes.current.clear()
  }, [ownerId])

  const commit = useCallback((update: (current: LearningState) => LearningState) => {
    if (ownerId === 'loading') return
    setOwned((current) => {
      const base = current.ownerId === ownerId ? current.state : ownerId === 'guest' ? readGuestState() : { ...initial, persistence: 'server' as const }
      const next = update(base)
      if (ownerId === 'guest') localStorage.setItem(key, JSON.stringify(next))
      return { ownerId, state: next }
    })
  }, [ownerId])

  const recordActivity = useCallback(() => {
    commit((current) => ({ ...current, activity: [...new Set([...current.activity, today()])] }))
  }, [commit])

  const complete = useCallback(async (slug: string) => {
    if (ownerId === 'loading' || syncStatus === 'syncing') return
    try {
      if (ownerId !== 'guest') await apiRequest(`/progress/${slug}`, { method: 'PUT', body: JSON.stringify({ isCompleted: true, day: today() }) })
      commit((current) => ({ ...current, completed: [...new Set([...current.completed, slug])], lastLesson: slug, activity: [...new Set([...current.activity, today()])] }))
      setError(null)
    } catch (reason) { setError(requestError(reason)) }
  }, [commit, ownerId, syncStatus])

  const bookmark = useCallback(async (slug: string) => {
    if (ownerId === 'loading' || syncStatus === 'syncing') return
    const removing = state.bookmarks.includes(slug)
    try {
      if (ownerId !== 'guest') {
        if (removing) await apiRequest(`/bookmarks/${slug}`, { method: 'DELETE' })
        else await apiRequest('/bookmarks', { method: 'POST', body: JSON.stringify({ lessonSlug: slug }) })
      }
      commit((current) => ({ ...current, bookmarks: removing ? current.bookmarks.filter((item) => item !== slug) : [...current.bookmarks, slug] }))
      setError(null)
    } catch (reason) { setError(requestError(reason)) }
  }, [commit, ownerId, state.bookmarks, syncStatus])

  const visit = useCallback((slug: string) => {
    if (ownerId === 'loading' || (ownerId !== 'guest' && syncStatus !== 'synced')) return
    commit((current) => ({ ...current, lastLesson: slug, activity: [...new Set([...current.activity, today()])] }))
    if (ownerId !== 'guest') void apiRequest(`/progress/${slug}/accessed`, { method: 'POST', body: JSON.stringify({ day: today() }) }).catch((reason: unknown) => setError(requestError(reason)))
  }, [commit, ownerId, syncStatus])

  const loadNote = useCallback(async (slug: string) => {
    if (ownerId === 'guest' || ownerId === 'loading' || syncStatus !== 'synced' || requestedNotes.current.has(slug)) return
    requestedNotes.current.add(slug)
    commit((current) => ({ ...current, noteStatuses: { ...current.noteStatuses, [slug]: 'loading' } }))
    try {
      const result = await apiRequest<{ note: { content: string } | null }>(`/notes/${slug}`)
      // If the learner started typing while this was loading, what they typed wins.
      commit((current) => current.noteStatuses[slug] === 'loading' ? { ...current, notes: { ...current.notes, [slug]: result.note?.content ?? '' }, noteStatuses: { ...current.noteStatuses, [slug]: 'saved' } } : current)
    } catch (reason) {
      commit((current) => ({ ...current, noteStatuses: { ...current.noteStatuses, [slug]: 'error' } }))
      setError(requestError(reason))
    }
  }, [commit, ownerId, syncStatus])

  const saveNote = useCallback((slug: string, note: string) => {
    commit((current) => ({ ...current, notes: { ...current.notes, [slug]: note }, noteStatuses: { ...current.noteStatuses, [slug]: ownerId === 'guest' ? 'saved' : 'saving' } }))
    if (ownerId === 'guest') return
    if (ownerId === 'loading' || syncStatus !== 'synced') {
      commit((current) => ({ ...current, noteStatuses: { ...current.noteStatuses, [slug]: 'error' } }))
      setError(syncStatus === 'syncing' ? 'Your account data is still loading. Try saving again shortly.' : 'Sign in to save this note across devices.')
      return
    }
    const timerKey = `${ownerId}:${slug}`
    const previous = noteTimers.current.get(timerKey)
    if (previous) clearTimeout(previous)
    const timer = setTimeout(() => {
      void apiRequest(`/notes/${slug}`, { method: 'PUT', body: JSON.stringify({ content: note }) }).then(() => {
        commit((current) => ({ ...current, noteStatuses: { ...current.noteStatuses, [slug]: 'saved' } }))
        setError(null)
      }).catch((reason: unknown) => {
        commit((current) => ({ ...current, noteStatuses: { ...current.noteStatuses, [slug]: 'error' } }))
        setError(requestError(reason))
      }).finally(() => noteTimers.current.delete(timerKey))
    }, 500)
    noteTimers.current.set(timerKey, timer)
  }, [commit, ownerId, syncStatus])

  const recordQuizAttempt = useCallback(async (slug: string, selectedIndex: number) => {
    if (ownerId === 'loading' || syncStatus === 'syncing') return
    const lesson = lessons.find((item) => item.slug === slug)
    if (!lesson) return
    try {
      let attempt: QuizAttemptSummary
      if (ownerId === 'guest') {
        attempt = { lessonSlug: slug, score: selectedIndex === lesson.quiz.answer ? 1 : 0, totalQuestions: 1, attemptedAt: new Date().toISOString() }
      } else {
        const result = await apiRequest<{ attempt: QuizAttemptSummary }>('/quizzes/attempts', { method: 'POST', body: JSON.stringify({ lessonSlug: slug, selectedIndex }) })
        attempt = result.attempt
      }
      commit((current) => ({ ...current, quizAttempts: [attempt, ...current.quizAttempts] }))
      setError(null)
    } catch (reason) { setError(requestError(reason)) }
  }, [commit, ownerId, syncStatus])

  const clearError = useCallback(() => setError(null), [])

  return <LearningContext.Provider value={{ state, syncStatus, error, clearError, complete, bookmark, visit, recordActivity, loadNote, saveNote, recordQuizAttempt }}>{children}</LearningContext.Provider>
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
  while (days.has(todayKey(date))) {
    count += 1
    date.setDate(date.getDate() - 1)
  }
  return count
}
