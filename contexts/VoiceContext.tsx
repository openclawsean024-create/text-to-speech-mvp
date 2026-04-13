'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { Voice, VOICES, filterVoices, Gender, Age, Language } from '@/lib/voices'

interface VoiceFilter {
  gender: Gender | 'all'
  age: Age | 'all'
  language: Language | 'all'
  showFavorites: boolean
}

interface VoiceContextValue {
  voices: Voice[]
  selectedVoice: Voice
  setSelectedVoice: (v: Voice) => void
  favorites: string[]
  toggleFavorite: (id: string) => void
  isFavorite: (id: string) => boolean
  compareMode: boolean
  setCompareMode: (on: boolean) => void
  compareVoices: Voice[]
  toggleCompareVoice: (v: Voice) => void
  clearCompare: () => void
  filter: VoiceFilter
  setFilter: (f: Partial<VoiceFilter>) => void
  filteredVoices: Voice[]
}

const VoiceContext = createContext<VoiceContextValue | null>(null)

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const [selectedVoice, setSelectedVoiceState] = useState<Voice>(VOICES[0])
  const [favorites, setFavorites] = useState<string[]>([])
  const [compareMode, setCompareModeState] = useState(false)
  const [compareVoices, setCompareVoices] = useState<Voice[]>([])
  const [filter, setFilterState] = useState<VoiceFilter>({
    gender: 'all',
    age: 'all',
    language: 'all',
    showFavorites: false,
  })

  // Load favorites from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tts-favorites')
      if (saved) setFavorites(JSON.parse(saved))
    } catch (_) {}
  }, [])

  // Load selected voice from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tts-selected-voice')
      if (saved) {
        const v = JSON.parse(saved)
        if (v?.id) setSelectedVoiceState(v)
      }
    } catch (_) {}
  }, [])

  const setSelectedVoice = useCallback((v: Voice) => {
    setSelectedVoiceState(v)
    try {
      localStorage.setItem('tts-selected-voice', JSON.stringify(v))
    } catch (_) {}
  }, [])

  const toggleFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
      try {
        localStorage.setItem('tts-favorites', JSON.stringify(next))
      } catch (_) {}
      return next
    })
  }, [])

  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites])

  const setCompareMode = useCallback((on: boolean) => {
    setCompareModeState(on)
    if (!on) setCompareVoices([])
  }, [])

  const toggleCompareVoice = useCallback((v: Voice) => {
    setCompareVoices(prev => {
      if (prev.some(vp => vp.id === v.id)) {
        return prev.filter(vp => vp.id !== v.id)
      }
      if (prev.length >= 2) return prev
      return [...prev, v]
    })
  }, [])

  const clearCompare = useCallback(() => {
    setCompareVoices([])
    setCompareModeState(false)
  }, [])

  const setFilter = useCallback((f: Partial<VoiceFilter>) => {
    setFilterState(prev => ({ ...prev, ...f }))
  }, [])

  const filteredVoices = filterVoices(VOICES, filter, favorites)

  return (
    <VoiceContext.Provider
      value={{
        voices: VOICES,
        selectedVoice,
        setSelectedVoice,
        favorites,
        toggleFavorite,
        isFavorite,
        compareMode,
        setCompareMode,
        compareVoices,
        toggleCompareVoice,
        clearCompare,
        filter,
        setFilter,
        filteredVoices,
      }}
    >
      {children}
    </VoiceContext.Provider>
  )
}

export function useVoiceContext(): VoiceContextValue {
  const ctx = useContext(VoiceContext)
  if (!ctx) throw new Error('useVoiceContext must be used within VoiceProvider')
  return ctx
}
