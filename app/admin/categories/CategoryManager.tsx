'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { slugify } from '@/lib/utils'

interface Category {
  id: string
  name: string
  slug: string
  parent_id: string | null
  parent_name: string | null
  nav_section: string | null
  gender: string | null
  hero_image_url: string | null
  position: number
  product_count: number
}

interface CategoryManagerProps {
  initialCategories: Category[]
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CategoryManager({ initialCategories }: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [showModal, setShowModal]   = useState(false)
  const [editTarget, setEditTarget] = useState<Category | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [pending, startTransition]    = useTransition()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const router = useRouter()

  // ── Drag state ──────────────────────────────────────────────────────────────
  const dragIdx  = useRef<number | null>(null)
  const overIdx  = useRef<number | null>(null)

  function handleDragStart(idx: number) {
    dragIdx.current = idx
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    overIdx.current = idx
  }

  async function handleDrop() {
    if (dragIdx.current === null || overIdx.current === null) return
    if (dragIdx.current === overIdx.current) return

    const reordered = [...categories]
    const [moved]   = reordered.splice(dragIdx.current, 1)
    reordered.splice(overIdx.current, 0, moved)

    const updated = reordered.map((cat, i) => ({ ...cat, position: i }))
    setCategories(updated)
    dragIdx.current  = null
    overIdx.current  = null

    // Persist to API
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated.map(({ id, position }) => ({ id, position }))),
      })
      if (!res.ok) {
        setError('Failed to save new order. Refresh to try again.')
      } else {
        startTransition(() => router.refresh())
      }
    } catch {
      setError('Network error saving order.')
    }
  }

  function openAdd() {
    setEditTarget(null)
    setShowModal(true)
  }

  function openEdit(cat: Category) {
    setEditTarget(cat)
    setShowModal(true)
  }

  async function handleDelete(cat: Category) {
    setError(null)
    setConfirmDeleteId(null)
    try {
      const res = await fetch(`/api/admin/categories/${cat.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Delete failed.')
        return
      }
      setCategories((prev) => prev.filter((c) => c.id !== cat.id))
      startTransition(() => router.refresh())
    } catch {
      setError('Network error.')
    }
  }

  function handleModalClose() {
    setShowModal(false)
    setEditTarget(null)
  }

  function handleModalSave(updated: Category) {
    setCategories((prev) => {
      const exists = prev.find((c) => c.id === updated.id)
      if (exists) {
        return prev.map((c) => c.id === updated.id ? updated : c)
      }
      return [...prev, { ...updated, position: prev.length }]
    })
    setShowModal(false)
    setEditTarget(null)
    startTransition(() => router.refresh())
  }

  return (
    <>
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
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>×</button>
        </div>
      )}

      {/* Add button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-5 py-2.5 hover:opacity-90 transition-opacity"
          style={{
            backgroundColor: 'var(--color-green)',
            color: 'var(--color-bg)',
            borderRadius: 'var(--radius-btn)',
            fontFamily: 'var(--font-body)',
            fontSize: '12px',
            fontWeight: '500',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M6 1v10M1 6h10" />
          </svg>
          Add Category
        </button>
      </div>

      {/* Category table */}
      {categories.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 rounded"
          style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-white)' }}
        >
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-muted)' }}>
            No categories yet.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded" style={{ border: '1px solid var(--color-border)' }}>
          <table className="w-full min-w-[600px]" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-white)', borderBottom: '1px solid var(--color-border)' }}>
                {['', '', 'Name', 'Slug', 'Parent', 'Nav Section', 'Gender', 'Products', 'Actions'].map((h, i) => (
                  <th
                    key={i}
                    className="text-left px-4 py-3"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: 'var(--color-text-muted)',
                      fontWeight: '500',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((cat, idx) => (
                <tr
                  key={cat.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={handleDrop}
                  style={{
                    backgroundColor: idx % 2 === 0 ? 'var(--color-white)' : 'rgba(244,236,223,0.35)',
                    borderBottom: '1px solid var(--color-border)',
                    cursor: 'grab',
                  }}
                >
                  {/* Drag handle */}
                  <td className="px-4 py-3 w-10">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
                      <path d="M2 4h10M2 7h10M2 10h10" />
                    </svg>
                  </td>

                  {/* Hero image thumbnail */}
                  <td className="px-4 py-3 w-14">
                    <div
                      className="relative overflow-hidden rounded-sm flex-shrink-0"
                      style={{ width: 40, height: 40, backgroundColor: 'var(--color-border)' }}
                    >
                      {cat.hero_image_url ? (
                        <Image
                          src={cat.hero_image_url}
                          alt={cat.name}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.2" aria-hidden="true">
                            <rect x="1" y="2" width="14" height="12" rx="1" />
                            <circle cx="5.5" cy="6" r="1.2" />
                            <path d="M1 10l4-3 3 2.5 2-1.5 5 4" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '500', color: 'var(--color-text)' }}>
                      {cat.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-muted)' }}>
                      {cat.slug}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      {cat.parent_name ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      {cat.nav_section ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-muted)' }}>
                      {cat.gender}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text)' }}>
                      {cat.product_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => openEdit(cat)}
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: '12px',
                          color: 'var(--color-green)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: '500',
                          padding: 0,
                        }}
                        className="hover:underline"
                      >
                        Edit
                      </button>
                      {cat.product_count === 0 && (
                        confirmDeleteId === cat.id ? (
                          <span className="flex items-center gap-2">
                            <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                              Delete?
                            </span>
                            <button
                              onClick={() => handleDelete(cat)}
                              style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: '600', color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
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
                          <button
                            onClick={() => setConfirmDeleteId(cat.id)}
                            style={{
                              fontFamily: 'var(--font-body)',
                              fontSize: '12px',
                              color: 'var(--color-error)',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                            }}
                            className="hover:underline"
                          >
                            Delete
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <CategoryModal
          category={editTarget}
          allCategories={categories}
          onSave={handleModalSave}
          onClose={handleModalClose}
        />
      )}
    </>
  )
}

// ─── Category Modal ───────────────────────────────────────────────────────────

interface CategoryModalProps {
  category:      Category | null
  allCategories: Category[]
  onSave:        (cat: Category) => void
  onClose:       () => void
}

const NAV_SECTIONS = [
  'Women > Ethnic',
  'Women > Western',
  'Bridal',
  'Festive',
  'New In',
  'Accessories',
]

const GENDERS = ['women', 'men', 'kids', 'unisex'] as const

function CategoryModal({ category, allCategories, onSave, onClose }: CategoryModalProps) {
  const isEdit = Boolean(category)

  const [name,         setName]         = useState(category?.name         ?? '')
  const [slug,         setSlug]         = useState(category?.slug         ?? '')
  const [parentId,     setParentId]     = useState(category?.parent_id    ?? '')
  const [navSection,   setNavSection]   = useState(category?.nav_section  ?? '')
  const [gender,       setGender]       = useState(category?.gender       ?? 'women')
  const [heroImageUrl, setHeroImageUrl] = useState(category?.hero_image_url ?? '')
  const [slugManual,   setSlugManual]   = useState(isEdit)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  function handleNameChange(v: string) {
    setName(v)
    if (!slugManual) setSlug(slugify(v))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) {
      setError('Name and slug are required.')
      return
    }
    setSaving(true)
    setError(null)

    try {
      const payload = {
        name,
        slug,
        parent_id:      parentId || null,
        nav_section:    navSection || null,
        gender,
        hero_image_url: heroImageUrl || null,
      }

      let res: Response
      if (isEdit && category) {
        res = await fetch(`/api/admin/categories/${category.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/admin/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Save failed.')
        return
      }

      onSave({
        id:             isEdit ? category!.id : data.id,
        name,
        slug,
        parent_id:      parentId || null,
        parent_name:    allCategories.find((c) => c.id === parentId)?.name ?? null,
        nav_section:    navSection || null,
        gender,
        hero_image_url: heroImageUrl || null,
        position:       category?.position ?? 0,
        product_count:  category?.product_count ?? 0,
      })
    } catch {
      setError('Network error.')
    } finally {
      setSaving(false)
    }
  }

  // Close on backdrop click
  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-md rounded shadow-lg overflow-hidden"
        style={{ backgroundColor: 'var(--color-white)' }}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit Category' : 'Add Category'}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <h2 style={{ fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: '600', color: 'var(--color-text)' }}>
            {isEdit ? 'Edit Category' : 'Add Category'}
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 20 }}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 p-5">
            {error && (
              <p role="alert" style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-error)' }}>
                {error}
              </p>
            )}

            <ModalField label="Display Name" required>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Sarees"
                style={modalInputStyle}
                autoFocus
                required
              />
            </ModalField>

            <ModalField label="Slug" required>
              <input
                type="text"
                value={slug}
                onChange={(e) => { setSlugManual(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')) }}
                placeholder="sarees"
                style={modalInputStyle}
                required
              />
            </ModalField>

            <ModalField label="Parent Category">
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                style={modalInputStyle}
              >
                <option value="">— None (top-level) —</option>
                {allCategories
                  .filter((c) => !category || c.id !== category.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))
                }
              </select>
            </ModalField>

            <ModalField label="Nav Section">
              <select value={navSection} onChange={(e) => setNavSection(e.target.value)} style={modalInputStyle}>
                <option value="">— None —</option>
                {NAV_SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </ModalField>

            <ModalField label="Gender" required>
              <select value={gender} onChange={(e) => setGender(e.target.value)} style={modalInputStyle}>
                {GENDERS.map((g) => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
              </select>
            </ModalField>

            <ModalField label="Hero Banner Image URL">
              <input
                type="url"
                value={heroImageUrl}
                onChange={(e) => setHeroImageUrl(e.target.value)}
                placeholder="https://cdn.thepossah.com/images/…"
                style={modalInputStyle}
              />
            </ModalField>
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-end gap-3 px-5 py-4"
            style={{ borderTop: '1px solid var(--color-border)' }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                color: 'var(--color-text-muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 hover:opacity-90 transition-opacity"
              style={{
                backgroundColor: 'var(--color-green)',
                color: 'var(--color-bg)',
                border: 'none',
                borderRadius: 'var(--radius-btn)',
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                fontWeight: '500',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const modalInputStyle: React.CSSProperties = {
  width: '100%',
  height: 40,
  padding: '0 10px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-input)',
  backgroundColor: 'var(--color-white)',
  fontFamily: 'var(--font-body)',
  fontSize: '14px',
  color: 'var(--color-text)',
  outline: 'none',
  boxSizing: 'border-box',
}

function ModalField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '9px',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'var(--color-text-muted)',
      }}>
        {label}{required && ' *'}
      </span>
      {children}
    </label>
  )
}
