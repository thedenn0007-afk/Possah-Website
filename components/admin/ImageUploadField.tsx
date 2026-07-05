'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { BucketPicker } from '@/app/admin/products/BucketPicker'

interface Props {
  label: string
  value: string
  onChange: (url: string) => void
  pathPrefix?: string
}

export function ImageUploadField({ label, value, onChange, pathPrefix = 'uploads/homepage' }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setError('Max 10 MB'); return }
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
    if (!allowed.includes(file.type)) { setError('JPG, PNG, WebP, AVIF only'); return }

    setError(null)
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/\.[^.]+$/, '')
      const path = `${pathPrefix}/${Date.now()}-${safe}.${ext}`

      const fd = new FormData()
      fd.append('file', file)
      fd.append('path', path)

      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
      const data = await res.json() as { publicUrl?: string; error?: string }
      if (!res.ok || !data.publicUrl) throw new Error(data.error ?? 'Upload failed')
      onChange(data.publicUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const lbl: React.CSSProperties = {
    display: 'block', fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: '600',
    color: 'var(--color-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '5px',
  }
  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 11px', border: '1px solid var(--color-border)', borderRadius: '6px',
    fontSize: '13px', fontFamily: 'var(--font-body)', color: 'var(--color-text)',
    backgroundColor: 'var(--color-bg)', boxSizing: 'border-box',
  }

  return (
    <div>
      <label style={lbl}>{label}</label>

      {/* Current image preview */}
      {value && (
        <div style={{ marginBottom: 8, position: 'relative', width: '100%', height: 80, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
          <Image src={value} alt="preview" fill style={{ objectFit: 'cover' }} sizes="300px" unoptimized />
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        {/* Primary: open media library */}
        <button
          type="button"
          onClick={() => { setError(null); setPickerOpen(true) }}
          style={{
            padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)', fontFamily: 'var(--font-body)', fontSize: '12px',
            color: 'var(--color-text)', cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          Select from Media
        </button>

        {/* Secondary: upload new file directly */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            padding: '6px 12px', borderRadius: '6px', border: '1px dashed var(--color-border)',
            backgroundColor: 'transparent', fontFamily: 'var(--font-body)', fontSize: '12px',
            color: uploading ? 'var(--color-text-muted)' : 'var(--color-text)',
            cursor: uploading ? 'wait' : 'pointer', whiteSpace: 'nowrap',
          }}
        >
          {uploading ? 'Uploading…' : '↑ Upload new'}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
        />
      </div>

      {/* URL fallback input */}
      <input
        type="text"
        value={value}
        placeholder="https://… or paste URL directly"
        onChange={(e) => { setError(null); onChange(e.target.value) }}
        style={inp}
      />

      {error && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: '#DC2626', marginTop: 4 }}>{error}</p>
      )}

      {/* Media library modal */}
      {pickerOpen && (
        <BucketPicker
          onSelect={(url) => { onChange(url); setPickerOpen(false) }}
          onClose={() => setPickerOpen(false)}
          defaultFolder={pathPrefix}
        />
      )}
    </div>
  )
}
