'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'

export type TaskStatus = 'pending' | 'processing' | 'done' | 'failed'
export type AudioFormat = 'mp3' | 'wav'

export interface BatchTask {
  id: string
  text: string
  language: string
  voice: string
  format: AudioFormat
  speed?: number
  status: TaskStatus
  progress?: { current: number; total: number }
  audioUrl?: string
  contentType?: string
  error?: string
  isChunked?: boolean
  totalChunks?: number
  createdAt: number
}

interface QueueContextValue {
  tasks: BatchTask[]
  processing: boolean
  addTask: (task: Omit<BatchTask, 'status' | 'createdAt'>) => boolean
  removeTask: (id: string) => void
  updateTaskStatus: (id: string, status: TaskStatus, extra?: Partial<BatchTask>) => void
  clearQueue: () => void
  startProcessing: () => Promise<void>
  overallProgress: number
  completedCount: number
  failedCount: number
}

const QueueContext = createContext<QueueContextValue | null>(null)

const STORAGE_KEY = 'tts_batch_queue'
const MAX_TASKS = 10

function loadFromStorage(): BatchTask[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const tasks: BatchTask[] = JSON.parse(raw)
    // Reset any 'processing' tasks to 'pending' on reload (they were interrupted)
    return tasks.map(t => ({ ...t, status: t.status === 'processing' ? 'pending' as TaskStatus : t.status }))
  } catch {
    return []
  }
}

function saveToStorage(tasks: BatchTask[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  } catch { /* ignore */ }
}

export function QueueProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<BatchTask[]>([])
  const [processing, setProcessing] = useState(false)
  const notificationPermissionRequested = useRef(false)

  // Load from localStorage on mount
  useEffect(() => {
    setTasks(loadFromStorage())
  }, [])

  // Save to localStorage on change
  useEffect(() => {
    saveToStorage(tasks)
  }, [tasks])

  // Request notification permission on mount
  useEffect(() => {
    if (notificationPermissionRequested.current) return
    notificationPermissionRequested.current = true
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const showNotification = useCallback((title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const n = new Notification(title, { body, icon: '/favicon.ico' })
      n.onclick = () => { window.focus(); n.close() }
      setTimeout(() => n.close(), 5000)
    }
  }, [])

  const addTask = useCallback((task: Omit<BatchTask, 'status' | 'createdAt'>): boolean => {
    if (tasks.length >= MAX_TASKS) return false
    if (tasks.find(t => t.id === task.id)) return false

    const newTask: BatchTask = {
      ...task,
      status: 'pending',
      createdAt: Date.now(),
    }
    setTasks(prev => [...prev, newTask])
    return true
  }, [tasks])

  const removeTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
  }, [])

  const updateTaskStatus = useCallback((id: string, status: TaskStatus, extra?: Partial<BatchTask>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status, ...extra } : t))
  }, [])

  const clearQueue = useCallback(() => {
    setTasks([])
  }, [])

  const startProcessing = useCallback(async () => {
    if (processing) return
    const pending = tasks.filter(t => t.status === 'pending')
    if (pending.length === 0) return

    setProcessing(true)

    // Mark all pending as processing
    setTasks(prev => prev.map(t => t.status === 'pending' ? { ...t, status: 'processing' as TaskStatus } : t))

    const taskPayloads = pending.map(t => ({
      id: t.id,
      text: t.text,
      language: t.language,
      voice: t.voice,
      format: t.format,
      speed: t.speed ?? 1.0,
    }))

    try {
      const res = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: taskPayloads }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        // Mark all as failed
        for (const t of pending) {
          updateTaskStatus(t.id, 'failed', { error: err.error || `HTTP ${res.status}` })
        }
        setProcessing(false)
        return
      }

      const data = await res.json()
      const resultsMap: Record<string, typeof data.results[0]> = {}
      for (const r of data.results) {
        resultsMap[r.id] = r
      }

      for (const t of pending) {
        const result = resultsMap[t.id]
        if (!result) {
          updateTaskStatus(t.id, 'failed', { error: 'No result returned' })
          showNotification('❌ 轉換失敗', `任務「${t.text.slice(0, 20)}...」處理失敗`)
          continue
        }
        if (result.success && result.audioUrl) {
          updateTaskStatus(t.id, 'done', {
            audioUrl: result.audioUrl,
            contentType: result.contentType,
            isChunked: result.isChunked,
            totalChunks: result.totalChunks,
          })
          showNotification('✅ 轉換完成', `任務「${t.text.slice(0, 20)}...」已完成`)
        } else {
          updateTaskStatus(t.id, 'failed', { error: result.error || 'Unknown error' })
          showNotification('❌ 轉換失敗', `任務「${t.text.slice(0, 20)}...」：${result.error}`)
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network error'
      for (const t of pending) {
        updateTaskStatus(t.id, 'failed', { error: message })
      }
    }

    setProcessing(false)
  }, [processing, tasks, updateTaskStatus, showNotification])

  const completedCount = tasks.filter(t => t.status === 'done').length
  const failedCount = tasks.filter(t => t.status === 'failed').length
  const total = tasks.length
  const overallProgress = total > 0
    ? Math.round(((completedCount + failedCount) / total) * 100)
    : 0

  return (
    <QueueContext.Provider value={{
      tasks,
      processing,
      addTask,
      removeTask,
      updateTaskStatus,
      clearQueue,
      startProcessing,
      overallProgress,
      completedCount,
      failedCount,
    }}>
      {children}
    </QueueContext.Provider>
  )
}

export function useQueue() {
  const ctx = useContext(QueueContext)
  if (!ctx) throw new Error('useQueue must be used within QueueProvider')
  return ctx
}
