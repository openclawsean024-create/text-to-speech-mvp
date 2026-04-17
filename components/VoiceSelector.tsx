'use client'

import { useState, useCallback } from 'react'
import { useVoiceContext } from '@/contexts/VoiceContext'
import { LANGUAGE_LABELS, GENDER_LABELS, AGE_LABELS, Gender, Age, Language } from '@/lib/voices'
import { Play, Star, StarOff, GitCompare, Check, X, Volume2 } from 'lucide-react'

// Language flag emojis
const LANG_FLAGS: Record<Language, string> = {
  zh: '🇨🇳',
  en: '🇺🇸',
  ja: '🇯🇵',
  ko: '🇰🇷',
  multi: '🌐',
}

const GENDER_ICONS: Record<Gender, string> = {
  male: '♂',
  female: '♀',
}

// Preview audio cache
const previewAudioCache: Record<string, HTMLAudioElement | null> = {}
let currentPreviewAudio: HTMLAudioElement | null = null

function playPreview(voiceId: string, previewText: string) {
  if (currentPreviewAudio) {
    currentPreviewAudio.pause()
    currentPreviewAudio = null
  }

  if (previewAudioCache[voiceId]) {
    const audio = previewAudioCache[voiceId]!
    audio.currentTime = 0
    audio.play().catch(() => {})
    currentPreviewAudio = audio
    return
  }

  // Use Web Speech API for preview (browser-native)
  const utterance = new SpeechSynthesisUtterance(previewText)
  utterance.rate = 1
  utterance.pitch = 1
  utterance.volume = 1

  const voices = window.speechSynthesis.getVoices()
  const voiceObj = voices.find(v => v.lang.startsWith('zh') || v.lang.startsWith('en'))
  if (voiceObj) utterance.voice = voiceObj

  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}

function VoiceCard({
  voice,
  isSelected,
  isFavorite,
  onSelect,
  onToggleFavorite,
  onPreview,
  compareMode,
  isComparing,
  onToggleCompare,
}: {
  voice: { id: string; name: string; gender: Gender; language: Language; age: Age; previewText: string; description?: string }
  isSelected: boolean
  isFavorite: boolean
  onSelect: () => void
  onToggleFavorite: () => void
  onPreview: () => void
  compareMode: boolean
  isComparing: boolean
  onToggleCompare: () => void
}) {
  return (
    <div
      className={`voice-card-v2 ${isSelected ? 'selected' : ''} ${isComparing ? 'comparing' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onSelect()}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div className="voice-card-selected-badge">
          <Check size={10} />
        </div>
      )}

      {/* Compare checkbox */}
      {compareMode && (
        <div
          className={`voice-card-compare-checkbox ${isComparing ? 'checked' : ''}`}
          onClick={e => { e.stopPropagation(); onToggleCompare() }}
          role="checkbox"
          aria-checked={isComparing}
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && onToggleCompare()}
        >
          {isComparing && <Check size={10} />}
        </div>
      )}

      {/* Card body */}
      <div className="voice-card-header">
        <div className="voice-card-lang-badge">
          <span>{LANG_FLAGS[voice.language]}</span>
          <span className="voice-card-lang-text">{LANGUAGE_LABELS[voice.language]}</span>
        </div>
        <button
          className={`voice-card-fav-btn ${isFavorite ? 'active' : ''}`}
          onClick={e => { e.stopPropagation(); onToggleFavorite() }}
          title={isFavorite ? '移除收藏' : '加入收藏'}
        >
          {isFavorite ? <Star size={14} fill="currentColor" /> : <StarOff size={14} />}
        </button>
      </div>

      <div className="voice-card-name">{voice.name}</div>
      {voice.description && (
        <div className="voice-card-desc">{voice.description}</div>
      )}

      <div className="voice-card-meta">
        <span className={`voice-card-gender gender-${voice.gender}`}>
          {GENDER_ICONS[voice.gender]} {GENDER_LABELS[voice.gender]}
        </span>
        <span className="voice-card-age">{AGE_LABELS[voice.age]}</span>
      </div>

      <button
        className="voice-card-preview-btn"
        onClick={e => { e.stopPropagation(); onPreview() }}
      >
        <Play size={11} /> 預覽
      </button>
    </div>
  )
}

function ComparisonPanel({
  voices,
  onSelect,
  onClose,
  onPlayBoth,
}: {
  voices: { id: string; name: string; previewText: string }[]
  onSelect: (v: { id: string; name: string; previewText: string }) => void
  onClose: () => void
  onPlayBoth: () => void
}) {
  return (
    <div className="comparison-panel">
      <div className="comparison-header">
        <div className="comparison-title">
          <GitCompare size={14} />
          語音比較模式
        </div>
        <button className="comparison-close" onClick={onClose}>
          <X size={14} />
        </button>
      </div>

      <div className="comparison-voice-list">
        {voices.map(v => (
          <div key={v.id} className="comparison-voice-item">
            <div className="comparison-voice-info">
              <span className="comparison-voice-name">{v.name}</span>
            </div>
            <div className="comparison-voice-actions">
              <button
                className="comparison-preview-btn"
                onClick={() => playPreview(v.id, v.previewText)}
              >
                <Play size={11} /> 預覽
              </button>
              <button
                className="comparison-select-btn"
                onClick={() => onSelect(v)}
              >
                選擇
              </button>
            </div>
          </div>
        ))}
      </div>

      <button className="comparison-play-both" onClick={onPlayBoth}>
        <Volume2 size={14} /> 比較播放
      </button>
    </div>
  )
}

export default function VoiceSelector() {
  const {
    filteredVoices,
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
  } = useVoiceContext()

  const [playingId, setPlayingId] = useState<string | null>(null)

  const handlePreview = useCallback((voice: { id: string; previewText: string }) => {
    setPlayingId(voice.id)
    playPreview(voice.id, voice.previewText)
    setTimeout(() => setPlayingId(null), 3000)
  }, [])

  const handlePlayBoth = useCallback(() => {
    if (compareVoices.length < 2) return
    const [v1, v2] = compareVoices
    playPreview(v1.id, v1.previewText)
    setTimeout(() => {
      playPreview(v2.id, v2.previewText)
    }, 2500)
  }, [compareVoices])

  const handleSelectFromCompare = useCallback((v: { id: string; name: string; previewText: string }) => {
    const full = filteredVoices.find(fv => fv.id === v.id) || compareVoices.find(cv => cv.id === v.id)
    if (full) {
      setSelectedVoice(full as any)
      clearCompare()
    }
  }, [filteredVoices, compareVoices, setSelectedVoice, clearCompare])

  return (
    <div className="voice-selector-v2">
      {/* Filter bar */}
      <div className="voice-filter-bar">
        <div className="voice-filter-group">
          {/* Gender filter */}
          {(['all', 'male', 'female'] as const).map(g => (
            <button
              key={g}
              className={`voice-filter-btn ${filter.gender === g ? 'active' : ''}`}
              onClick={() => setFilter({ gender: g })}
            >
              {g === 'all' ? '全部性別' : GENDER_LABELS[g]}
            </button>
          ))}
        </div>

        <div className="voice-filter-group">
          {/* Age filter */}
          {(['all', 'adult', 'young', 'teen'] as const).map(a => (
            <button
              key={a}
              className={`voice-filter-btn ${filter.age === a ? 'active' : ''}`}
              onClick={() => setFilter({ age: a })}
            >
              {a === 'all' ? '全部年齡' : AGE_LABELS[a]}
            </button>
          ))}
        </div>

        <div className="voice-filter-group">
          {/* Language filter */}
          {(['all', 'zh', 'en', 'ja', 'ko'] as const).map(l => (
            <button
              key={l}
              className={`voice-filter-btn ${filter.language === l ? 'active' : ''}`}
              onClick={() => setFilter({ language: l as any })}
            >
              {l === 'all' ? '🌐 全部語言' : LANG_FLAGS[l as Language]} {LANGUAGE_LABELS[l as Language] || '全部語言'}
            </button>
          ))}
        </div>

        <div className="voice-filter-group">
          <button
            className={`voice-filter-btn ${filter.showFavorites ? 'active favorites' : ''}`}
            onClick={() => setFilter({ showFavorites: !filter.showFavorites })}
          >
            <Star size={12} fill={filter.showFavorites ? 'currentColor' : 'none'} />{' '}
            收藏 {favorites.length > 0 && `(${favorites.length})`}
          </button>

          <button
            className={`voice-filter-btn compare-toggle ${compareMode ? 'active' : ''}`}
            onClick={() => setCompareMode(!compareMode)}
          >
            <GitCompare size={12} /> {compareMode ? '退出比較' : '語音比較'}
          </button>
        </div>
      </div>

      {/* Selected voice display */}
      {!compareMode && (
        <div className="voice-selected-display">
          <div className="voice-selected-info">
            <span className="voice-selected-label">已選擇：</span>
            <span className="voice-selected-name">{selectedVoice.name}</span>
            <span className="voice-selected-meta">
              {GENDER_LABELS[selectedVoice.gender]} · {AGE_LABELS[selectedVoice.age]} · {LANGUAGE_LABELS[selectedVoice.language]}
            </span>
          </div>
        </div>
      )}

      {/* Comparison panel */}
      {compareMode && compareVoices.length > 0 && (
        <ComparisonPanel
          voices={compareVoices as any}
          onSelect={handleSelectFromCompare as any}
          onClose={clearCompare}
          onPlayBoth={handlePlayBoth}
        />
      )}

      {/* Voice grid */}
      <div className={`voice-grid ${compareMode ? 'compare-mode' : ''} grid grid-cols-1 sm:grid-cols-2`}>
        {filteredVoices.length === 0 ? (
          <div className="voice-grid-empty">
            {filter.showFavorites && favorites.length === 0
              ? '尚無收藏語音'
              : '找不到符合條件的語音'}
          </div>
        ) : (
          filteredVoices.map(voice => (
            <VoiceCard
              key={voice.id}
              voice={voice as any}
              isSelected={selectedVoice.id === voice.id}
              isFavorite={isFavorite(voice.id)}
              onSelect={() => {
                if (!compareMode) {
                  setSelectedVoice(voice as any)
                }
              }}
              onToggleFavorite={() => toggleFavorite(voice.id)}
              onPreview={() => handlePreview(voice as any)}
              compareMode={compareMode}
              isComparing={compareVoices.some(cv => cv.id === voice.id)}
              onToggleCompare={() => toggleCompareVoice(voice as any)}
            />
          ))
        )}
      </div>
    </div>
  )
}
