'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface ReviewProduct {
  id:   string
  name: string
  slug: string
}

interface Review {
  id:            string
  product_id:    string
  product:       ReviewProduct | null
  reviewer_name: string
  reviewer_city: string | null
  rating:        number
  body:          string
  is_approved:   boolean
  created_at:    string
}

interface ReviewManagerProps {
  initialReviews: Review[]
  initialStatus:  string
}

const dangerBtn: React.CSSProperties = {
  padding:         '5px 11px',
  borderRadius:    '5px',
  border:          '1px solid #FCA5A5',
  backgroundColor: '#FEF2F2',
  color:           '#DC2626',
  fontFamily:      'var(--font-body)',
  fontSize:        '11px',
  cursor:          'pointer',
}

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: '1px' }}>
      {[1,2,3,4,5].map(n => (
        <svg key={n} width="12" height="12" viewBox="0 0 24 24"
          fill={n <= rating ? 'var(--color-gold)' : 'none'}
          stroke="var(--color-gold)"
          strokeWidth="1.5"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  )
}

const TAB_OPTIONS = [
  { label: 'Pending',  value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'All',      value: 'all' },
]

export function ReviewManager({ initialReviews, initialStatus }: ReviewManagerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [reviews, setReviews]   = useState<Review[]>(initialReviews)
  const [tab, setTab]           = useState(initialStatus)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function extractError(res: Response, fallback: string): Promise<string> {
    const json = await res.json().catch(() => ({}))
    return (json as { error?: string }).error ?? fallback
  }

  async function fetchReviews(status: string) {
    setLoading(true)
    try {
      const res  = await fetch(`/api/admin/reviews?status=${status}`)
      const data = await res.json()
      if (Array.isArray(data)) setReviews(data)
    } finally {
      setLoading(false)
    }
  }

  function switchTab(t: string) {
    setTab(t)
    setSelected(new Set())
    fetchReviews(t)
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === reviews.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(reviews.map(r => r.id)))
    }
  }

  async function bulkApprove() {
    if (selected.size === 0) return
    setError(null)
    startTransition(async () => {
      const res = await fetch('/api/admin/reviews', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ids: Array.from(selected), is_approved: true }),
      })
      if (res.ok) {
        setReviews(prev => prev.map(r => selected.has(r.id) ? { ...r, is_approved: true } : r))
        setSelected(new Set())
        router.refresh()
      } else {
        setError(await extractError(res, 'Failed to approve selected reviews.'))
      }
    })
  }

  function approve(review: Review) {
    setError(null)
    startTransition(async () => {
      const res = await fetch(`/api/admin/reviews/${review.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ is_approved: true }),
      })
      if (res.ok) {
        setReviews(prev => prev.map(r => r.id === review.id ? { ...r, is_approved: true } : r))
        router.refresh()
      } else {
        setError(await extractError(res, 'Failed to approve review.'))
      }
    })
  }

  function reject(review: Review) {
    setError(null)
    startTransition(async () => {
      const res = await fetch(`/api/admin/reviews/${review.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ is_approved: false }),
      })
      if (res.ok) {
        setReviews(prev => prev.map(r => r.id === review.id ? { ...r, is_approved: false } : r))
        router.refresh()
      } else {
        setError(await extractError(res, 'Failed to unapprove review.'))
      }
    })
  }

  function deleteReview(review: Review) {
    if (!window.confirm('Delete this review permanently?')) return
    setError(null)
    startTransition(async () => {
      const res = await fetch(`/api/admin/reviews/${review.id}`, { method: 'DELETE' })
      if (res.ok) {
        setReviews(prev => prev.filter(r => r.id !== review.id))
        setSelected(prev => { const n = new Set(prev); n.delete(review.id); return n })
        router.refresh()
      } else {
        setError(await extractError(res, 'Failed to delete review.'))
      }
    })
  }

  const pendingCount = reviews.filter(r => !r.is_approved).length

  return (
    <div>
      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="mb-4 p-3 rounded flex items-center gap-2"
          style={{ backgroundColor: '#FEE2E2', border: '1px solid #FECACA' }}
        >
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-error)' }}>
            {error}
          </p>
          <button
            onClick={() => setError(null)}
            style={{ marginLeft: 'auto', color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}
          >
            ×
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '16px', borderBottom: '1px solid var(--color-border)' }}>
        {TAB_OPTIONS.map(t => (
          <button
            key={t.value}
            onClick={() => switchTab(t.value)}
            style={{
              padding:        '9px 16px',
              fontFamily:     'var(--font-body)',
              fontSize:       '13px',
              fontWeight:     tab === t.value ? '600' : '400',
              color:          tab === t.value ? 'var(--color-text)' : 'var(--color-text-muted)',
              borderBottom:   tab === t.value ? '2px solid var(--color-gold)' : '2px solid transparent',
              marginBottom:   '-1px',
              border:         'none',
              cursor:         'pointer',
              backgroundColor:'transparent',
              whiteSpace:     'nowrap',
            }}
          >
            {t.label}
            {t.value === 'pending' && pendingCount > 0 && (
              <span style={{
                marginLeft:      '6px',
                padding:         '1px 6px',
                borderRadius:    '10px',
                backgroundColor: '#FEE2E2',
                color:           '#DC2626',
                fontSize:        '10px',
                fontWeight:      '700',
              }}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div
          style={{
            display:         'flex',
            alignItems:      'center',
            gap:             '12px',
            padding:         '10px 16px',
            backgroundColor: '#EFF6FF',
            border:          '1px solid #BFDBFE',
            borderRadius:    '8px',
            marginBottom:    '12px',
          }}
        >
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: '#1D4ED8' }}>
            {selected.size} selected
          </span>
          <button
            onClick={bulkApprove}
            disabled={isPending}
            style={{
              padding:         '6px 14px',
              borderRadius:    '6px',
              border:          'none',
              backgroundColor: '#16A34A',
              color:           '#fff',
              fontFamily:      'var(--font-body)',
              fontSize:        '12px',
              fontWeight:      '500',
              cursor:          isPending ? 'wait' : 'pointer',
            }}
          >
            ✓ Approve All Selected
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', fontSize: '13px' }}>
          Loading reviews…
        </div>
      )}

      {/* Empty state */}
      {!loading && reviews.length === 0 && (
        <div
          style={{
            padding:         '64px 24px',
            textAlign:       'center',
            backgroundColor: 'var(--color-surface)',
            border:          '1px solid var(--color-border)',
            borderRadius:    '10px',
          }}
        >
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-muted)' }}>
            No {tab !== 'all' ? tab : ''} reviews.
          </p>
        </div>
      )}

      {/* Review cards */}
      {!loading && reviews.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {reviews.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <input
                type="checkbox"
                checked={selected.size === reviews.length}
                onChange={toggleSelectAll}
                style={{ accentColor: 'var(--color-gold)', width: '15px', height: '15px', cursor: 'pointer' }}
              />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Select all
              </span>
            </div>
          )}

          {reviews.map((review) => (
            <div
              key={review.id}
              style={{
                display:         'flex',
                gap:             '14px',
                alignItems:      'flex-start',
                padding:         '16px',
                backgroundColor: 'var(--color-surface)',
                border:          `1px solid ${selected.has(review.id) ? 'var(--color-gold)' : 'var(--color-border)'}`,
                borderRadius:    '10px',
                transition:      'border-color 0.1s',
              }}
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={selected.has(review.id)}
                onChange={() => toggleSelect(review.id)}
                style={{ accentColor: 'var(--color-gold)', width: '15px', height: '15px', marginTop: '2px', cursor: 'pointer', flexShrink: 0 }}
              />

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', color: 'var(--color-text)' }}>
                        {review.reviewer_name}
                      </span>
                      {review.reviewer_city && (
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          {review.reviewer_city}
                        </span>
                      )}
                      <Stars rating={review.rating} />
                    </div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                      on{' '}
                      <a
                        href={`/products/${review.product?.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--color-gold)', textDecoration: 'none' }}
                      >
                        {review.product?.name ?? review.product_id}
                      </a>
                      {' · '}
                      {new Date(review.created_at).toLocaleDateString('en-IN')}
                    </p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text)', lineHeight: '1.5' }}>
                      {review.body}
                    </p>
                  </div>

                  {/* Status badge */}
                  <span
                    style={{
                      padding:         '3px 10px',
                      borderRadius:    '20px',
                      fontFamily:      'var(--font-mono)',
                      fontSize:        '10px',
                      fontWeight:      '600',
                      letterSpacing:   '0.05em',
                      textTransform:   'uppercase',
                      backgroundColor: review.is_approved ? '#DCFCE7' : '#FEF3C7',
                      color:           review.is_approved ? '#166534' : '#92400E',
                      flexShrink:      0,
                    }}
                  >
                    {review.is_approved ? 'Approved' : 'Pending'}
                  </span>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                  {!review.is_approved && (
                    <button
                      onClick={() => approve(review)}
                      disabled={isPending}
                      style={{
                        padding:         '5px 12px',
                        borderRadius:    '5px',
                        border:          '1px solid #86EFAC',
                        backgroundColor: '#F0FDF4',
                        color:           '#166534',
                        fontFamily:      'var(--font-body)',
                        fontSize:        '11px',
                        fontWeight:      '500',
                        cursor:          'pointer',
                      }}
                    >
                      ✓ Approve
                    </button>
                  )}
                  {review.is_approved && (
                    <button
                      onClick={() => reject(review)}
                      disabled={isPending}
                      style={{
                        padding:         '5px 12px',
                        borderRadius:    '5px',
                        border:          '1px solid #FCD34D',
                        backgroundColor: '#FFFBEB',
                        color:           '#92400E',
                        fontFamily:      'var(--font-body)',
                        fontSize:        '11px',
                        fontWeight:      '500',
                        cursor:          'pointer',
                      }}
                    >
                      ↩ Unapprove
                    </button>
                  )}
                  <button onClick={() => deleteReview(review)} disabled={isPending} style={dangerBtn}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
