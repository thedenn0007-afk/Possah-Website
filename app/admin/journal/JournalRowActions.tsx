'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface JournalRowActionsProps {
  articleId: string
}

export function JournalRowActions({ articleId }: JournalRowActionsProps) {
  const [confirmDelete, setConfirm] = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [pending, startTransition]  = useTransition()
  const router = useRouter()

  async function handleDelete() {
    setDeleting(true)
    setConfirm(false)
    setError(null)
    try {
      const res = await fetch(`/api/admin/journal/${articleId}`, { method: 'DELETE' })
      if (res.ok) {
        startTransition(() => router.refresh())
      } else {
        const json = await res.json().catch(() => ({}))
        setError((json as { error?: string }).error ?? 'Delete failed')
        setDeleting(false)
      }
    } catch {
      setError('Network error')
      setDeleting(false)
    }
  }

  if (confirmDelete) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
          Delete?
        </span>
        <button
          type="button"
          onClick={handleDelete}
          style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: '600', color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => setConfirm(false)}
          style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          No
        </button>
      </span>
    )
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
      <button
        type="button"
        onClick={() => setConfirm(true)}
        disabled={deleting || pending}
        style={{
          fontFamily: 'var(--font-body)',
          fontSize:   '12px',
          color:      '#DC2626',
          background: 'none',
          border:     'none',
          cursor:     deleting || pending ? 'not-allowed' : 'pointer',
          opacity:    deleting || pending ? 0.5 : 1,
          padding:    0,
        }}
      >
        {deleting ? 'Deleting…' : 'Delete'}
      </button>
      {error && (
        <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: '#DC2626' }}>
          {error}
        </span>
      )}
    </span>
  )
}
