'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type CouponType = 'percent' | 'flat' | 'free_shipping'

interface Coupon {
  id:              string
  code:            string
  type:            CouponType
  value:           number
  min_order_value: number
  usage_limit:     number | null
  usage_count:     number
  expiry_date:     string | null
  is_active:       boolean
  created_at:      string
}

interface CouponManagerProps {
  initialCoupons: Coupon[]
}

/* ── Styles ─────────────────────────────────────────────────────── */
const inputStyle: React.CSSProperties = {
  width:           '100%',
  padding:         '8px 11px',
  border:          '1px solid var(--color-border)',
  borderRadius:    '6px',
  fontSize:        '13px',
  fontFamily:      'var(--font-body)',
  color:           'var(--color-text)',
  backgroundColor: 'var(--color-bg)',
  outline:         'none',
  boxSizing:       'border-box',
}
const labelStyle: React.CSSProperties = {
  display:       'block',
  fontFamily:    'var(--font-body)',
  fontSize:      '11px',
  fontWeight:    '600',
  color:         'var(--color-text-muted)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  marginBottom:  '5px',
}
const primaryBtn: React.CSSProperties = {
  padding:         '9px 18px',
  borderRadius:    '6px',
  border:          'none',
  backgroundColor: 'var(--color-green)',
  color:           '#fff',
  fontFamily:      'var(--font-body)',
  fontSize:        '13px',
  fontWeight:      '500',
  cursor:          'pointer',
}
const ghostBtn: React.CSSProperties = {
  padding:         '7px 14px',
  borderRadius:    '6px',
  border:          '1px solid var(--color-border)',
  backgroundColor: 'var(--color-surface)',
  color:           'var(--color-text)',
  fontFamily:      'var(--font-body)',
  fontSize:        '12px',
  cursor:          'pointer',
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

const EMPTY_FORM = {
  code:            '',
  type:            'percent' as CouponType,
  value:           10,
  min_order_value: 0,
  usage_limit:     '',
  expiry_date:     '',
  is_active:       true,
}

function typeLabel(type: CouponType, value: number) {
  if (type === 'percent')      return `${value}% off`
  if (type === 'flat')         return `₹${value} off`
  return 'Free shipping'
}

function isExpired(expiry: string | null) {
  if (!expiry) return false
  return new Date(expiry) < new Date()
}

export function CouponManager({ initialCoupons }: CouponManagerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [coupons, setCoupons]   = useState<Coupon[]>(initialCoupons)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  function setField<K extends keyof typeof EMPTY_FORM>(key: K, val: (typeof EMPTY_FORM)[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function createCoupon(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    const body = {
      code:            form.code.trim().toUpperCase(),
      type:            form.type,
      value:           Number(form.value),
      min_order_value: Number(form.min_order_value),
      usage_limit:     form.usage_limit ? Number(form.usage_limit) : null,
      expiry_date:     form.expiry_date ? new Date(form.expiry_date).toISOString() : null,
      is_active:       form.is_active,
    }

    startTransition(async () => {
      const res = await fetch('/api/admin/coupons', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFormError((json as { error?: string }).error ?? 'Failed to create')
        return
      }
      setShowForm(false)
      setForm(EMPTY_FORM)
      router.refresh()
      // Optimistic: refetch
      const listRes  = await fetch('/api/admin/coupons')
      const listData = await listRes.json()
      if (Array.isArray(listData)) setCoupons(listData)
    })
  }

  function toggleActive(coupon: Coupon) {
    setTogglingId(coupon.id)
    startTransition(async () => {
      const res = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ is_active: !coupon.is_active }),
      })
      if (res.ok) {
        setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, is_active: !c.is_active } : c))
        router.refresh()
      }
      setTogglingId(null)
    })
  }

  function deleteCoupon(coupon: Coupon) {
    setConfirmDeleteId(null)
    startTransition(async () => {
      const res = await fetch(`/api/admin/coupons/${coupon.id}`, { method: 'DELETE' })
      if (res.ok) {
        setCoupons(prev => prev.filter(c => c.id !== coupon.id))
        router.refresh()
      }
    })
  }

  return (
    <div>
      {/* Add Button */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => { setShowForm(v => !v); setFormError(null) }}
          style={primaryBtn}
        >
          {showForm ? '✕ Cancel' : '+ Add Coupon'}
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <form onSubmit={createCoupon}>
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border:          '1px solid var(--color-border)',
              borderRadius:    '10px',
              padding:         '20px',
              marginBottom:    '16px',
            }}
          >
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', color: 'var(--color-text)', marginBottom: '16px' }}>
              New Coupon
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              {/* Code */}
              <div>
                <label style={labelStyle}>Code</label>
                <input
                  required
                  placeholder="SAVE10"
                  value={form.code}
                  onChange={e => setField('code', e.target.value.toUpperCase())}
                  style={{ ...inputStyle, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}
                />
              </div>

              {/* Type */}
              <div>
                <label style={labelStyle}>Type</label>
                <select
                  value={form.type}
                  onChange={e => setField('type', e.target.value as CouponType)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="percent">% off</option>
                  <option value="flat">₹ flat off</option>
                  <option value="free_shipping">Free shipping</option>
                </select>
              </div>

              {/* Value */}
              <div>
                <label style={labelStyle}>Value {form.type === 'percent' ? '(%)' : form.type === 'flat' ? '(₹)' : '(ignored)'}</label>
                <input
                  type="number"
                  min={0}
                  max={form.type === 'percent' ? 100 : undefined}
                  value={form.value}
                  onChange={e => setField('value', Number(e.target.value))}
                  disabled={form.type === 'free_shipping'}
                  style={{ ...inputStyle, opacity: form.type === 'free_shipping' ? 0.5 : 1 }}
                />
              </div>

              {/* Min order */}
              <div>
                <label style={labelStyle}>Min Order (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={form.min_order_value}
                  onChange={e => setField('min_order_value', Number(e.target.value))}
                  style={inputStyle}
                />
              </div>

              {/* Usage limit */}
              <div>
                <label style={labelStyle}>Usage Limit (blank = unlimited)</label>
                <input
                  type="number"
                  min={1}
                  placeholder="e.g. 100"
                  value={form.usage_limit}
                  onChange={e => setField('usage_limit', e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Expiry */}
              <div>
                <label style={labelStyle}>Expiry Date (optional)</label>
                <input
                  type="date"
                  value={form.expiry_date}
                  onChange={e => setField('expiry_date', e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Active toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '14px' }}>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => setField('is_active', e.target.checked)}
                style={{ accentColor: 'var(--color-green)', width: '15px', height: '15px' }}
              />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text)' }}>
                Active immediately
              </span>
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button type="submit" disabled={isPending} style={{ ...primaryBtn, opacity: isPending ? 0.7 : 1 }}>
                {isPending ? 'Creating…' : 'Create Coupon'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={ghostBtn}>Cancel</button>
              {formError && <span style={{ fontSize: '12px', color: '#DC2626', fontFamily: 'var(--font-body)' }}>{formError}</span>}
            </div>
          </div>
        </form>
      )}

      {/* Table */}
      {coupons.length === 0 ? (
        <div
          style={{
            padding:         '56px 24px',
            textAlign:       'center',
            backgroundColor: 'var(--color-surface)',
            border:          '1px solid var(--color-border)',
            borderRadius:    '10px',
          }}
        >
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-muted)' }}>
            No coupons yet. Create your first one.
          </p>
        </div>
      ) : (
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border:          '1px solid var(--color-border)',
            borderRadius:    '10px',
            overflow:        'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Code', 'Discount', 'Min Order', 'Usage', 'Expiry', 'Status', ''].map(h => (
                    <th key={h} style={{
                      padding:       '10px 16px',
                      textAlign:     'left',
                      fontFamily:    'var(--font-body)',
                      fontSize:      '11px',
                      fontWeight:    '600',
                      color:         'var(--color-text-muted)',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      whiteSpace:    'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coupons.map((c, i) => {
                  const expired = isExpired(c.expiry_date)
                  return (
                    <tr key={c.id} style={{ borderBottom: i < coupons.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: '700', color: 'var(--color-text)', letterSpacing: '0.05em' }}>
                          {c.code}
                        </span>
                      </td>
                      <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text)' }}>
                          {typeLabel(c.type, c.value)}
                        </span>
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          {c.min_order_value > 0 ? `₹${c.min_order_value}` : '—'}
                        </span>
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: c.usage_limit && c.usage_count >= c.usage_limit ? '#DC2626' : 'var(--color-text)' }}>
                          {c.usage_count}{c.usage_limit ? ` / ${c.usage_limit}` : ''}
                        </span>
                      </td>
                      <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: expired ? '#DC2626' : 'var(--color-text-muted)' }}>
                          {c.expiry_date
                            ? `${new Date(c.expiry_date).toLocaleDateString('en-IN')}${expired ? ' (expired)' : ''}`
                            : 'No expiry'
                          }
                        </span>
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        {/* Toggle active */}
                        <button
                          onClick={() => toggleActive(c)}
                          disabled={isPending && togglingId === c.id}
                          style={{
                            display:         'inline-flex',
                            alignItems:      'center',
                            gap:             '6px',
                            padding:         '4px 10px',
                            borderRadius:    '20px',
                            border:          'none',
                            cursor:          'pointer',
                            fontFamily:      'var(--font-mono)',
                            fontSize:        '10px',
                            fontWeight:      '600',
                            letterSpacing:   '0.05em',
                            textTransform:   'uppercase',
                            backgroundColor: c.is_active ? '#DCFCE7' : '#F3F4F6',
                            color:           c.is_active ? '#166534' : '#6B7280',
                            opacity:         isPending && togglingId === c.id ? 0.6 : 1,
                          }}
                        >
                          <span style={{
                            width: '6px', height: '6px', borderRadius: '50%',
                            backgroundColor: c.is_active ? '#16A34A' : '#9CA3AF',
                            display: 'inline-block',
                          }} />
                          {c.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                        {confirmDeleteId === c.id ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                              Delete?
                            </span>
                            <button
                              onClick={() => deleteCoupon(c)}
                              disabled={isPending}
                              style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: '600', color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(c.id)} disabled={isPending} style={dangerBtn}>
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
