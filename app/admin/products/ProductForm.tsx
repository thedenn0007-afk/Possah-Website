'use client'

import { useState, useCallback, useRef, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { slugify } from '@/lib/utils'
import { BucketPicker } from './BucketPicker'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Category {
  id: string
  name: string
  slug: string
}

interface Variant {
  id?: string
  colour_name: string
  colour_hex: string
  size: string
  stock_qty: number
}

interface ProductImage {
  id?: string
  url: string
  alt: string
  position: number
}

type OccasionTag =
  | 'Everyday' | 'Brunch' | 'Workwear' | 'Evening'
  | 'Cocktail' | 'Sangeet' | 'Mehendi' | 'Haldi' | 'Wedding'

const ALL_OCCASIONS: OccasionTag[] = [
  'Everyday', 'Brunch', 'Workwear', 'Evening',
  'Cocktail', 'Sangeet', 'Mehendi', 'Haldi', 'Wedding',
]

const ALL_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'Free Size', 'Made-to-Measure']

const SUB_LINES = ['THE DRAPE', 'THE EDIT', 'THE ATELIER', 'THE VAULT'] as const

export interface ProductFormData {
  id?: string
  name: string
  slug: string
  description: string
  sub_line: string
  category_id: string
  price: number
  compare_price: number | null
  fabric: string
  craft_description: string
  care_instructions: string
  drape_guide: string
  craft_story_title: string
  craft_story_body: string
  craft_story_image: string
  audio_url: string
  meta_title: string
  meta_description: string
  is_new_arrival: boolean
  is_top_selling: boolean
  is_featured: boolean
  is_festive: boolean
  is_bridal:  boolean
  is_active: boolean
  tags: OccasionTag[]
  variants: Variant[]
  images: ProductImage[]
}

interface ProductFormProps {
  initialData?: Partial<ProductFormData>
  categories: Category[]
  mode: 'new' | 'edit'
}

// ─── Form component ───────────────────────────────────────────────────────────

export function ProductForm({ initialData, categories, mode }: ProductFormProps) {
  const router = useRouter()

  // Form state
  const [form, setForm] = useState<ProductFormData>({
    name:              initialData?.name              ?? '',
    slug:              initialData?.slug              ?? '',
    description:       initialData?.description       ?? '',
    sub_line:          initialData?.sub_line          ?? '',
    category_id:       initialData?.category_id       ?? '',
    price:             initialData?.price             ?? 0,
    compare_price:     initialData?.compare_price     ?? null,
    fabric:            initialData?.fabric            ?? '',
    craft_description: initialData?.craft_description ?? '',
    care_instructions: initialData?.care_instructions ?? '',
    drape_guide:       initialData?.drape_guide       ?? '',
    craft_story_title: initialData?.craft_story_title ?? '',
    craft_story_body:  initialData?.craft_story_body  ?? '',
    craft_story_image: initialData?.craft_story_image ?? '',
    audio_url:         initialData?.audio_url         ?? '',
    meta_title:        initialData?.meta_title        ?? '',
    meta_description:  initialData?.meta_description  ?? '',
    is_new_arrival:    initialData?.is_new_arrival    ?? false,
    is_top_selling:    initialData?.is_top_selling    ?? false,
    is_featured:       initialData?.is_featured       ?? false,
    is_festive:        initialData?.is_festive        ?? false,
    is_bridal:         initialData?.is_bridal         ?? false,
    is_active:         initialData?.is_active         ?? true,
    tags:              (initialData?.tags as OccasionTag[]) ?? [],
    variants:          initialData?.variants          ?? [{ colour_name: '', colour_hex: '#C99A99', size: 'S', stock_qty: 0 }],
    images:            initialData?.images            ?? [],
  })

  const [errors, setErrors]       = useState<Record<string, string>>({})
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [slugManual, setSlugManual] = useState(mode === 'edit')
  const [savedSlug, setSavedSlug] = useState<string | null>(null)
  const [savedCategorySlug, setSavedCategorySlug] = useState<string | null>(null)

  // Auto-slug from name
  const handleNameChange = useCallback((value: string) => {
    setForm((prev) => ({
      ...prev,
      name: value,
      ...(!slugManual ? { slug: slugify(value) } : {}),
    }))
  }, [slugManual])

  const set = useCallback(<K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }, [])

  // ── Variant management ──────────────────────────────────────────────────────

  function addVariant() {
    setForm((prev) => ({
      ...prev,
      variants: [...prev.variants, { colour_name: '', colour_hex: '#C99A99', size: 'S', stock_qty: 0 }],
    }))
  }

  function removeVariant(idx: number) {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== idx),
    }))
  }

  function updateVariant(idx: number, field: keyof Variant, value: string | number) {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((v, i) => i === idx ? { ...v, [field]: value } : v),
    }))
  }

  // ── Image management ────────────────────────────────────────────────────────

  function addImage() {
    setForm((prev) => ({
      ...prev,
      images: [
        ...prev.images,
        { url: '', alt: '', position: prev.images.length },
      ],
    }))
  }

  function removeImage(idx: number) {
    setForm((prev) => ({
      ...prev,
      images: prev.images
        .filter((_, i) => i !== idx)
        .map((img, i) => ({ ...img, position: i })),
    }))
  }

  function updateImage(idx: number, field: keyof ProductImage, value: string | number) {
    setForm((prev) => ({
      ...prev,
      images: prev.images.map((img, i) => i === idx ? { ...img, [field]: value } : img),
    }))
  }

  // ── Image drag-and-drop reorder ─────────────────────────────────────────────
  const dragImgIdx = useRef<number | null>(null)
  const overImgIdx = useRef<number | null>(null)

  function handleImageDragStart(idx: number) {
    dragImgIdx.current = idx
  }

  function handleImageDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    overImgIdx.current = idx
  }

  function handleImageDrop() {
    if (dragImgIdx.current === null || overImgIdx.current === null) return
    if (dragImgIdx.current === overImgIdx.current) return

    setForm((prev) => {
      const reordered = [...prev.images]
      const [moved] = reordered.splice(dragImgIdx.current!, 1)
      reordered.splice(overImgIdx.current!, 0, moved)
      return { ...prev, images: reordered.map((img, i) => ({ ...img, position: i })) }
    })
    dragImgIdx.current = null
    overImgIdx.current = null
  }

  function handleImageDragEnd() {
    dragImgIdx.current = null
    overImgIdx.current = null
  }

  // ── Tag toggle ──────────────────────────────────────────────────────────────

  function toggleTag(tag: OccasionTag) {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }))
  }

  // ── Client-side validation ──────────────────────────────────────────────────

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!form.name.trim())  errs.name  = 'Name is required'
    if (!form.slug.trim())  errs.slug  = 'Slug is required'
    if (!/^[a-z0-9-]+$/.test(form.slug)) errs.slug = 'Slug: lowercase letters, numbers, hyphens only'
    if (form.price <= 0)    errs.price = 'Price must be greater than 0'
    if (form.variants.length === 0) errs.variants = 'At least one variant required'
    for (const v of form.variants) {
      if (!v.colour_name.trim()) { errs.variants = 'All variants must have a colour name'; break }
      if (!v.size.trim())        { errs.variants = 'All variants must have a size'; break }
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit(e: FormEvent, publish: boolean) {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    setSaveError(null)

    const payload = {
      ...form,
      // Empty strings must be null — Zod enum/UUID/url validators reject ""
      sub_line:          form.sub_line          || null,
      category_id:       form.category_id       || null,
      craft_story_image: form.craft_story_image || null,
      // Drop image rows that have no URL yet (user added row but didn't upload)
      images: form.images.filter((img) => img.url.trim() !== '').map((img, i) => ({ ...img, position: i })),
      is_active:    publish ? true : form.is_active,
      compare_price: form.compare_price && form.compare_price > 0 ? form.compare_price : null,
      audio_url: (form.is_new_arrival || form.is_top_selling) && form.audio_url ? form.audio_url : null,
    }

    try {
      const url    = mode === 'edit' && initialData?.id
        ? `/api/admin/products/${initialData.id}`
        : '/api/admin/products'
      const method = mode === 'edit' ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.issues) {
          const serverErrors: Record<string, string> = {}
          for (const [field, msgs] of Object.entries(data.issues)) {
            serverErrors[field] = (msgs as string[])[0] ?? 'Invalid value'
          }
          setErrors(serverErrors)
        } else {
          setSaveError(data.error ?? 'Save failed. Please try again.')
        }
        return
      }

      // Success — show banner then redirect
      const catSlug = form.category_id
        ? categories.find((c) => c.id === form.category_id)?.slug ?? null
        : null
      setSavedSlug(form.slug)
      setSavedCategorySlug(catSlug)
      setTimeout(() => {
        router.push('/admin/products')
        router.refresh()
      }, 2000)
    } catch (err) {
      console.error('[ProductForm] submit:', err)
      setSaveError('Network error. Please check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const showAudio = form.is_new_arrival || form.is_top_selling

  return (
    <form onSubmit={(e) => handleSubmit(e, false)} noValidate>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      <div className="max-w-[900px] mx-auto p-6 md:p-8 flex flex-col gap-8">

        {/* ── Save success banner ── */}
        {savedSlug && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 p-4 rounded"
            style={{ backgroundColor: '#DCFCE7', border: '1px solid #86EFAC' }}
          >
            <div className="flex items-center gap-3">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#166534" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                <circle cx="8" cy="8" r="7" />
                <path d="M5 8l2 2 4-4" />
              </svg>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: '#166534' }}>
                {mode === 'edit' ? 'Changes saved.' : 'Product created.'} Redirecting…
              </p>
            </div>
            {savedCategorySlug && (
              <Link
                href={`/women/${savedCategorySlug}/${savedSlug}`}
                target="_blank"
                style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: '#166534', fontWeight: '500', textDecoration: 'underline' }}
              >
                View on site
              </Link>
            )}
          </div>
        )}

        {/* ── Save error banner ── */}
        {saveError && (
          <div
            role="alert"
            className="flex items-center gap-3 p-4 rounded"
            style={{
              backgroundColor: '#FEE2E2',
              border: '1px solid #FECACA',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--color-error)" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
              <circle cx="8" cy="8" r="7" />
              <path d="M8 5v3M8 10v.5" />
            </svg>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-error)' }}>
              {saveError}
            </p>
          </div>
        )}

        {/* ── TOP ACTION BAR (iOS: visible without scrolling) ── */}
        <div
          className="flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            disabled={saving}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              color: 'var(--color-text-muted)',
              background: 'none',
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              padding: 0,
              opacity: saving ? 0.5 : 1,
            }}
          >
            ← Cancel
          </button>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 hover:opacity-90 transition-opacity"
              style={{
                border: '1px solid var(--color-green)',
                borderRadius: 'var(--radius-btn)',
                backgroundColor: 'transparent',
                color: 'var(--color-green)',
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                fontWeight: '500',
                letterSpacing: '0.06em',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Save as Draft'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={(e) => handleSubmit(e, true)}
              className="px-5 py-2.5 hover:opacity-90 transition-opacity"
              style={{
                backgroundColor: 'var(--color-green)',
                color: 'var(--color-bg)',
                border: 'none',
                borderRadius: 'var(--radius-btn)',
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                fontWeight: '500',
                letterSpacing: '0.06em',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Publish'}
            </button>
          </div>
        </div>

        {/* ── BASIC INFO ── */}
        <FormSection title="Basic Info">
          <div className="grid md:grid-cols-2 gap-5">
            <FormField label="Product Name" error={errors.name} required>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. The Noor Saree"
                style={inputStyle}
                required
              />
            </FormField>
            <FormField label="Slug" error={errors.slug} required hint="URL-safe identifier">
              <input
                type="text"
                value={form.slug}
                onChange={(e) => {
                  setSlugManual(true)
                  set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
                }}
                placeholder="the-noor-saree"
                style={inputStyle}
                required
              />
            </FormField>
          </div>

          <div className="grid md:grid-cols-2 gap-5 mt-5">
            <FormField label="Sub-line">
              <select value={form.sub_line} onChange={(e) => set('sub_line', e.target.value)} style={inputStyle}>
                <option value="">— Select sub-line —</option>
                {SUB_LINES.map((sl) => <option key={sl} value={sl}>{sl}</option>)}
              </select>
            </FormField>
            <FormField label="Category">
              <select value={form.category_id} onChange={(e) => set('category_id', e.target.value)} style={inputStyle}>
                <option value="">— Select category —</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="Description" className="mt-5">
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              placeholder="Short product description shown on the product page…"
              style={{ ...inputStyle, height: 'auto', resize: 'vertical' }}
            />
          </FormField>
        </FormSection>

        {/* ── PRICING ── */}
        <FormSection title="Pricing">
          <div className="grid md:grid-cols-2 gap-5">
            <FormField label="Price (₹)" error={errors.price} required>
              <div className="relative">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-muted)' }}
                >
                  ₹
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.price || ''}
                  onChange={(e) => set('price', parseFloat(e.target.value) || 0)}
                  placeholder="18999"
                  style={{ ...inputStyle, paddingLeft: 28 }}
                  required
                />
              </div>
            </FormField>
            <FormField label="Compare-at Price (₹)" hint="Shows as strikethrough if set">
              <div className="relative">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-muted)' }}
                >
                  ₹
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.compare_price ?? ''}
                  onChange={(e) => set('compare_price', e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="24999"
                  style={{ ...inputStyle, paddingLeft: 28 }}
                />
              </div>
            </FormField>
          </div>
        </FormSection>

        {/* ── BADGES / TOGGLES ── */}
        <FormSection title="Badges & Visibility">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Toggle
              label="New Arrival"
              hint="Shows NEW badge. Enables audio section."
              checked={form.is_new_arrival}
              onChange={(v) => set('is_new_arrival', v)}
            />
            <Toggle
              label="Top Selling"
              hint="Enables audio section."
              checked={form.is_top_selling}
              onChange={(v) => set('is_top_selling', v)}
            />
            <Toggle
              label="Featured"
              hint="Shown in curated sections."
              checked={form.is_featured}
              onChange={(v) => set('is_featured', v)}
            />
            <Toggle
              label="Festive"
              hint="Show in Festive editorial grid."
              checked={form.is_festive}
              onChange={(v) => set('is_festive', v)}
            />
            <Toggle
              label="Bridal"
              hint="Show in Bridal editorial grid."
              checked={form.is_bridal}
              onChange={(v) => set('is_bridal', v)}
            />
            <Toggle
              label="Active / Visible"
              hint="Hidden from shop when off."
              checked={form.is_active}
              onChange={(v) => set('is_active', v)}
            />
          </div>
        </FormSection>

        {/* ── PRODUCT TAGS ── */}
        <FormSection title="Works For (Occasion Tags)">
          <div className="flex flex-wrap gap-2">
            {ALL_OCCASIONS.map((tag) => {
              const selected = form.tags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="px-3 py-1.5 transition-all duration-150"
                  style={{
                    borderRadius: 'var(--radius-btn)',
                    border: `1px solid ${selected ? 'var(--color-green)' : 'var(--color-border)'}`,
                    backgroundColor: selected ? 'var(--color-green)' : 'transparent',
                    color: selected ? 'var(--color-bg)' : 'var(--color-text)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  {tag}
                </button>
              )
            })}
          </div>
        </FormSection>

        {/* ── VARIANTS ── */}
        <FormSection title="Colour & Size Variants" error={errors.variants}>
          <div className="flex flex-col gap-3">
            {form.variants.map((v, idx) => (
              <VariantRow
                key={idx}
                variant={v}
                index={idx}
                allSizes={ALL_SIZES}
                onChange={updateVariant}
                onRemove={() => removeVariant(idx)}
                canRemove={form.variants.length > 1}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={addVariant}
            className="mt-3 flex items-center gap-2 hover:opacity-80 transition-opacity"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              fontWeight: '500',
              color: 'var(--color-green)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 1v10M1 6h10" />
            </svg>
            Add Colour / Size
          </button>
        </FormSection>

        {/* ── IMAGES ── */}
        <FormSection title="Product Images" hint="Drag the handle to reorder. First image is the primary." error={errors.images}>
          <div className="flex flex-col gap-3">
            {form.images.map((img, idx) => (
              <ImageRow
                key={idx}
                image={img}
                index={idx}
                onChange={updateImage}
                onRemove={() => removeImage(idx)}
                onDragStart={() => handleImageDragStart(idx)}
                onDragOver={(e) => handleImageDragOver(e, idx)}
                onDrop={handleImageDrop}
                onDragEnd={handleImageDragEnd}
              />
            ))}
            {form.images.length === 0 && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                No images added yet. Add at least 4 images (front, back, detail, lifestyle).
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={addImage}
            className="mt-3 flex items-center gap-2 hover:opacity-80 transition-opacity"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              fontWeight: '500',
              color: 'var(--color-green)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 1v10M1 6h10" />
            </svg>
            Add Image
          </button>
        </FormSection>

        {/* ── AUDIO (conditional) ── */}
        {showAudio && (
          <FormSection title="The Possah Note (Audio)" hint="MP3 URL. Plays on PDP for New Arrivals and Top Selling.">
            <FormField label="Audio File URL">
              <input
                type="url"
                value={form.audio_url}
                onChange={(e) => set('audio_url', e.target.value)}
                placeholder="https://cdn.thepossah.com/audio/noor-saree.mp3"
                style={inputStyle}
              />
            </FormField>
          </FormSection>
        )}

        {/* ── PRODUCT DETAILS ── */}
        <FormSection title="Product Details">
          <div className="grid md:grid-cols-2 gap-5">
            <FormField label="Fabric">
              <input
                type="text"
                value={form.fabric}
                onChange={(e) => set('fabric', e.target.value)}
                placeholder="e.g. Dusty Rose Chikankari Silk"
                style={inputStyle}
              />
            </FormField>
            <FormField label="Craft Description">
              <input
                type="text"
                value={form.craft_description}
                onChange={(e) => set('craft_description', e.target.value)}
                placeholder="e.g. Hand-embroidered in Bengaluru"
                style={inputStyle}
              />
            </FormField>
          </div>
          <div className="grid md:grid-cols-2 gap-5 mt-5">
            <FormField label="Care Instructions">
              <input
                type="text"
                value={form.care_instructions}
                onChange={(e) => set('care_instructions', e.target.value)}
                placeholder="e.g. Dry clean only. Store in dust bag."
                style={inputStyle}
              />
            </FormField>
            <FormField label="Drape Guide">
              <input
                type="text"
                value={form.drape_guide}
                onChange={(e) => set('drape_guide', e.target.value)}
                placeholder="e.g. Nivi style drape recommended."
                style={inputStyle}
              />
            </FormField>
          </div>
        </FormSection>

        {/* ── CRAFT STORY ── */}
        <FormSection title="The Craft Behind">
          <FormField label="Story Title">
            <input
              type="text"
              value={form.craft_story_title}
              onChange={(e) => set('craft_story_title', e.target.value)}
              placeholder="e.g. The Craft Behind The Noor Saree"
              style={inputStyle}
            />
          </FormField>
          <FormField label="Story Body" className="mt-5">
            <textarea
              value={form.craft_story_body}
              onChange={(e) => set('craft_story_body', e.target.value)}
              rows={5}
              placeholder="Over 72 hours of hand-embroidery by skilled artisans in Bengaluru…"
              style={{ ...inputStyle, height: 'auto', resize: 'vertical' }}
            />
          </FormField>
          <FormField label="Story Image URL" className="mt-5">
            <input
              type="url"
              value={form.craft_story_image}
              onChange={(e) => set('craft_story_image', e.target.value)}
              placeholder="https://cdn.thepossah.com/images/craft/noor-artisan.jpg"
              style={inputStyle}
            />
          </FormField>
        </FormSection>

        {/* ── SEO ── */}
        <FormSection title="SEO">
          <FormField label="Meta Title" hint="Max 70 characters">
            <input
              type="text"
              value={form.meta_title}
              onChange={(e) => set('meta_title', e.target.value)}
              placeholder={`${form.name || 'Product Name'} — The Possah`}
              maxLength={70}
              style={inputStyle}
            />
            <CharCount current={form.meta_title.length} max={70} />
          </FormField>
          <FormField label="Meta Description" hint="Max 160 characters" className="mt-5">
            <textarea
              value={form.meta_description}
              onChange={(e) => set('meta_description', e.target.value)}
              rows={2}
              maxLength={160}
              placeholder="Shop the Noor Saree — handcrafted chikankari silk from The Possah atelier."
              style={{ ...inputStyle, height: 'auto', resize: 'vertical' }}
            />
            <CharCount current={form.meta_description.length} max={160} />
          </FormField>
        </FormSection>

        {/* ── ACTION BUTTONS ── */}
        <div
          className="flex items-center justify-between pt-6"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            disabled={saving}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              color: 'var(--color-text-muted)',
              background: 'none',
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              padding: 0,
              opacity: saving ? 0.5 : 1,
            }}
          >
            ← Cancel
          </button>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 hover:opacity-90 transition-opacity"
              style={{
                border: '1px solid var(--color-green)',
                borderRadius: 'var(--radius-btn)',
                backgroundColor: 'transparent',
                color: 'var(--color-green)',
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                fontWeight: '500',
                letterSpacing: '0.06em',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Save as Draft'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={(e) => handleSubmit(e, true)}
              className="px-6 py-3 hover:opacity-90 transition-opacity"
              style={{
                backgroundColor: 'var(--color-green)',
                color: 'var(--color-bg)',
                border: 'none',
                borderRadius: 'var(--radius-btn)',
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                fontWeight: '500',
                letterSpacing: '0.06em',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Publish'}
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 44,
  padding: '0 12px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-input)',
  backgroundColor: 'var(--color-white)',
  fontFamily: 'var(--font-body)',
  fontSize: '14px',
  color: 'var(--color-text)',
  outline: 'none',
  boxSizing: 'border-box',
}

interface FormSectionProps {
  title: string
  hint?: string
  error?: string
  children: React.ReactNode
}

function FormSection({ title, hint, error, children }: FormSectionProps) {
  return (
    <section>
      <div className="mb-4">
        <h2
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            fontWeight: '600',
            color: 'var(--color-text)',
            letterSpacing: '0.01em',
          }}
        >
          {title}
        </h2>
        {hint && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 2 }}>
            {hint}
          </p>
        )}
        {error && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-error)', marginTop: 4 }}>
            {error}
          </p>
        )}
      </div>
      <div
        className="p-5 rounded"
        style={{
          backgroundColor: 'var(--color-white)',
          border: '1px solid var(--color-border)',
        }}
      >
        {children}
      </div>
    </section>
  )
}

interface FormFieldProps {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

function FormField({ label, hint, error, required, children, className = '' }: FormFieldProps) {
  return (
    <div className={className}>
      <label className="flex flex-col gap-1.5">
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: error ? 'var(--color-error)' : 'var(--color-text-muted)',
          }}
        >
          {label}{required && ' *'}
        </span>
        {children}
      </label>
      {hint && !error && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 4 }}>
          {hint}
        </p>
      )}
      {error && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-error)', marginTop: 4 }}>
          {error}
        </p>
      )}
    </div>
  )
}

interface ToggleProps {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}

function Toggle({ label, hint, checked, onChange }: ToggleProps) {
  return (
    <label className="flex flex-col gap-2 cursor-pointer">
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
        }}
      >
        {label}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          style={{
            width: 36,
            height: 20,
            borderRadius: 10,
            backgroundColor: checked ? 'var(--color-green)' : 'var(--color-border)',
            border: 'none',
            cursor: 'pointer',
            position: 'relative',
            flexShrink: 0,
            transition: 'background-color 0.2s',
            padding: 0,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 3,
              left: checked ? 18 : 3,
              width: 14,
              height: 14,
              borderRadius: '50%',
              backgroundColor: 'white',
              transition: 'left 0.2s',
              boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
            }}
          />
        </button>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '11px',
            color: checked ? 'var(--color-text)' : 'var(--color-text-muted)',
          }}
        >
          {checked ? 'On' : 'Off'}
        </span>
      </div>
      {hint && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
          {hint}
        </p>
      )}
    </label>
  )
}

interface VariantRowProps {
  variant: Variant
  index: number
  allSizes: string[]
  onChange: (idx: number, field: keyof Variant, value: string | number) => void
  onRemove: () => void
  canRemove: boolean
}

function VariantRow({ variant, index, allSizes, onChange, onRemove, canRemove }: VariantRowProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 p-3 rounded"
      style={{ backgroundColor: 'rgba(244,236,223,0.5)', border: '1px solid var(--color-border)' }}
    >
      {/* Colour swatch */}
      <input
        type="color"
        value={variant.colour_hex}
        onChange={(e) => onChange(index, 'colour_hex', e.target.value)}
        title="Pick colour"
        style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--radius-input)',
          border: '1px solid var(--color-border)',
          cursor: 'pointer',
          padding: 2,
          backgroundColor: 'var(--color-white)',
          flexShrink: 0,
        }}
      />

      {/* Colour name */}
      <input
        type="text"
        value={variant.colour_name}
        onChange={(e) => onChange(index, 'colour_name', e.target.value)}
        placeholder="Colour name"
        style={{ ...inputStyle, width: 140, flexShrink: 0 }}
      />

      {/* Size */}
      <select
        value={variant.size}
        onChange={(e) => onChange(index, 'size', e.target.value)}
        style={{ ...inputStyle, width: 140, flexShrink: 0 }}
      >
        {allSizes.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      {/* Stock qty */}
      <input
        type="number"
        min={0}
        step={1}
        value={variant.stock_qty}
        onChange={(e) => onChange(index, 'stock_qty', parseInt(e.target.value) || 0)}
        placeholder="Qty"
        title="Stock quantity"
        style={{ ...inputStyle, width: 80, flexShrink: 0 }}
      />
      {variant.stock_qty === 0 && (
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#DC2626',
          backgroundColor: '#FEF2F2',
          border: '1px solid #FCA5A5',
          borderRadius: '4px',
          padding: '2px 6px',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}>
          Out of Stock
        </span>
      )}

      {/* Remove */}
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          title="Remove variant"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-muted)',
            padding: 4,
          }}
          className="hover:opacity-60 transition-opacity ml-auto"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
            <path d="M3 8h10" />
          </svg>
        </button>
      )}
    </div>
  )
}

interface ImageRowProps {
  image: ProductImage
  index: number
  onChange: (idx: number, field: keyof ProductImage, value: string | number) => void
  onRemove: () => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  onDragEnd: () => void
}

function ImageRow({ image, index, onChange, onRemove, onDragStart, onDragOver, onDrop, onDragEnd }: ImageRowProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [uploadErr, setUploadErr]   = useState<string | null>(null)
  const [dragging, setDragging]     = useState(false)

  // Called when BucketPicker confirms a selection
  function handlePickerSelect(url: string) {
    onChange(index, 'url', url)
    if (!image.alt) {
      // Derive alt from filename portion of URL
      const filename = url.split('/').pop()?.split('?')[0] ?? ''
      onChange(index, 'alt', filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '))
    }
  }

  return (
    <>
      {pickerOpen && (
        <BucketPicker
          onSelect={handlePickerSelect}
          onClose={() => setPickerOpen(false)}
          defaultFolder="products"
        />
      )}
      <div
        className="flex flex-col gap-2 p-3 rounded"
        style={{
          backgroundColor: 'rgba(244,236,223,0.5)',
          border: '1px solid var(--color-border)',
          opacity: dragging ? 0.4 : 1,
          transition: 'opacity 0.1s',
        }}
        onDragOver={onDragOver}
        onDrop={() => { setDragging(false); onDrop() }}
      >
        <div className="flex items-center gap-3">
          {/* Drag handle */}
          <span
            draggable
            onDragStart={() => { setDragging(true); onDragStart() }}
            onDragEnd={() => { setDragging(false); onDragEnd() }}
            title="Drag to reorder"
            style={{ flexShrink: 0, cursor: 'grab', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}
          >
            <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
              <circle cx="2.5" cy="2.5" r="1.4" /><circle cx="7.5" cy="2.5" r="1.4" />
              <circle cx="2.5" cy="8" r="1.4" /><circle cx="7.5" cy="8" r="1.4" />
              <circle cx="2.5" cy="13.5" r="1.4" /><circle cx="7.5" cy="13.5" r="1.4" />
            </svg>
          </span>

          {/* Position number */}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-muted)', flexShrink: 0, width: 20, textAlign: 'center' }}>
            {index + 1}
          </span>

          {/* Thumbnail preview */}
          <div style={{ width: 44, height: 54, flexShrink: 0, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {image.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.2" aria-hidden="true">
                <rect x="1" y="2" width="14" height="12" rx="1" /><circle cx="5.5" cy="6" r="1.2" /><path d="M1 10l4-3 3 2.5 2-1.5 5 4" />
              </svg>
            )}
          </div>

          {/* Open bucket picker (shows existing images + upload new) */}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={uploading}
            className="hover:opacity-80 transition-opacity flex items-center gap-1.5 px-3"
            style={{ height: 36, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-input)', backgroundColor: 'var(--color-white)', fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-green)', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 8V2M3 5l3-3 3 3M1 10h10" />
            </svg>
            Choose / Upload
          </button>

          {/* URL input — also editable manually / paste */}
          <input type="url" value={image.url} onChange={(e) => onChange(index, 'url', e.target.value)} placeholder="Or paste URL…" style={{ ...inputStyle, flex: 1, minWidth: 0 }} />

          {/* Alt text */}
          <input type="text" value={image.alt} onChange={(e) => onChange(index, 'alt', e.target.value)} placeholder="Alt text" style={{ ...inputStyle, width: 130, flexShrink: 0 }} />

          {/* Remove */}
          <button type="button" onClick={onRemove} title="Remove image" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)', padding: 4, flexShrink: 0 }} className="hover:opacity-60 transition-opacity">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
              <path d="M3 4h10M6 4V2h4v2M5 4l1 10h4l1-10" />
            </svg>
          </button>
        </div>

        {uploadErr && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-error)', paddingLeft: 28 }}>
            {uploadErr}
          </p>
        )}
      </div>
    </>
  )
}


function CharCount({ current, max }: { current: number; max: number }) {
  const over = current > max
  return (
    <p
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '9px',
        color: over ? 'var(--color-error)' : 'var(--color-text-muted)',
        marginTop: 4,
        textAlign: 'right',
      }}
    >
      {current}/{max}
    </p>
  
)
}
