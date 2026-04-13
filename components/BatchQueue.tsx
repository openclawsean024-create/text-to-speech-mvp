'use client'

import React from 'react'
import { useQueue, BatchTask } from '@/contexts/QueueContext'
import {
  Trash2, Download, Loader, CheckCircle2, XCircle, Clock,
  AlertCircle, PlayCircle, FileAudio, Volume2,
} from 'lucide-react'

function TaskRow({ task }: { task: BatchTask }) {
  const { removeTask } = useQueue()

  const statusIcon = {
    pending:    <Clock size={14} className="text-gray-400" />,
    processing: <Loader size={14} className="text-blue-400 animate-spin" />,
    done:       <CheckCircle2 size={14} className="text-green-400" />,
    failed:     <XCircle size={14} className="text-red-400" />,
  }[task.status]

  const statusLabel = {
    pending:    '等待中',
    processing: '處理中',
    done:       '已完成',
    failed:     '失敗',
  }[task.status]

  const statusColor = {
    pending:    'text-gray-400',
    processing: 'text-blue-400',
    done:       'text-green-400',
    failed:     'text-red-400',
  }[task.status]

  const handleDownload = () => {
    if (!task.audioUrl) return
    const a = document.createElement('a')
    a.href = task.audioUrl
    a.download = `tts-${task.id}-${Date.now()}.${task.format}`
    a.click()
  }

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl transition-all"
      style={{
        background: task.status === 'done' ? 'rgba(16, 185, 129, 0.06)' :
                   task.status === 'failed' ? 'rgba(239, 68, 68, 0.06)' :
                   'var(--surface)',
        border: `1px solid ${task.status === 'done' ? 'rgba(16, 185, 129, 0.2)' :
                        task.status === 'failed' ? 'rgba(239, 68, 68, 0.2)' :
                        'var(--border)'}`,
      }}>
      {/* Status icon */}
      <div className="mt-0.5 flex-shrink-0">{statusIcon}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-bold ${statusColor}`}>{statusLabel}</span>
          {task.isChunked && (
            <span className="text-xs px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(124,58,237,0.15)', color: 'var(--primary-light)', fontSize: '0.65rem' }}>
              {task.totalChunks} 片段
            </span>
          )}
          <span className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ background: 'var(--surface-2)', color: 'var(--text-3)', fontSize: '0.65rem' }}>
            {task.format.toUpperCase()}
          </span>
        </div>

        {/* Text preview */}
        <div className="text-xs mb-1" style={{
          color: 'var(--text-2)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '100%',
        }}>
          {task.text}
        </div>

        {/* Voice + language */}
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>
            {task.voice} · {task.language}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>
            {task.text.length.toLocaleString()} 字
          </span>
        </div>

        {/* Error message */}
        {task.status === 'failed' && task.error && (
          <div className="mt-1.5 flex items-center gap-1 text-xs" style={{ color: 'var(--error)', background: 'rgba(239,68,68,0.08)', padding: '4px 8px', borderRadius: '6px' }}>
            <AlertCircle size={12} className="flex-shrink-0" />
            <span>{task.error}</span>
          </div>
        )}

        {/* Download button for completed tasks */}
        {task.status === 'done' && task.audioUrl && (
          <button
            onClick={handleDownload}
            className="mt-2 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: 'rgba(16,185,129,0.12)',
              color: '#10b981',
              border: '1px solid rgba(16,185,129,0.25)',
            }}
          >
            <Download size={12} /> 下載 MP3
          </button>
        )}
      </div>

      {/* Delete button */}
      <button
        onClick={() => removeTask(task.id)}
        className="flex-shrink-0 p-1.5 rounded-lg transition-all hover:opacity-80"
        style={{ color: 'var(--text-3)', background: 'transparent' }}
        title="移除任務"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

export default function BatchQueue() {
  const { tasks, processing, overallProgress, completedCount, failedCount, startProcessing, clearQueue } = useQueue()

  const pendingCount = tasks.filter(t => t.status === 'pending').length
  const processingCount = tasks.filter(t => t.status === 'processing').length
  const totalCount = tasks.length

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FileAudio size={16} style={{ color: 'var(--primary-light)' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
              批次任務列
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-3)' }}>
            <span className="flex items-center gap-1">
              <span style={{ color: '#10b981' }}>{completedCount}</span> 完成
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <span style={{ color: '#ef4444' }}>{failedCount}</span> 失敗
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <span style={{ color: 'var(--text-2)' }}>{pendingCount}</span> 等待
            </span>
            <span>·</span>
            <span style={{ color: 'var(--text-3)' }}>{totalCount}/{10} 個任務</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {totalCount > 0 && (
            <button
              onClick={clearQueue}
              className="text-xs px-3 py-1.5 rounded-lg transition-all"
              style={{ color: 'var(--text-3)', background: 'transparent', border: '1px solid var(--border)' }}
            >
              清除全部
            </button>
          )}
          {pendingCount > 0 && !processing && (
            <button
              onClick={startProcessing}
              className="flex items-center gap-1.5 text-xs font-bold px-4 py-1.5 rounded-xl transition-all"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(124,58,237,0.3)',
              }}
            >
              <PlayCircle size={14} />
              開始處理 ({pendingCount})
            </button>
          )}
          {processing && (
            <button
              disabled
              className="flex items-center gap-1.5 text-xs font-bold px-4 py-1.5 rounded-xl"
              style={{ background: 'rgba(124,58,237,0.2)', color: 'var(--primary-light)', cursor: 'not-allowed' }}
            >
              <Loader size={14} className="animate-spin" />
              處理中...
            </button>
          )}
        </div>
      </div>

      {/* Overall progress bar */}
      {totalCount > 0 && (
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>整體進度</span>
            <span className="text-xs font-bold" style={{ color: 'var(--primary-light)' }}>{overallProgress}%</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{
                width: `${overallProgress}%`,
                background: failedCount > 0 && completedCount === 0
                  ? 'linear-gradient(90deg, #ef4444, #f97316)'
                  : 'linear-gradient(90deg, #7c3aed, #06b6d4)',
              }}
            />
          </div>
        </div>
      )}

      {/* Task list */}
      {totalCount === 0 ? (
        <div className="text-center py-10 rounded-xl" style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}>
          <div style={{ color: 'var(--text-3)', fontSize: '2rem', marginBottom: '0.5rem' }}><Volume2 size={24} className="inline opacity-30" /></div>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>尚無批次任務</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-3)', opacity: 0.7 }}>在下方新增任務後即可開始批次轉換</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {tasks.map(task => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  )
}
