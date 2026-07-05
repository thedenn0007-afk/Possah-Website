'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { convertToWebp } from '@/lib/utils'

interface BucketFile {
  name:      string
  url:       string
  size:      number
  fullPath:  string
}

interface BucketPickerProps {
  onSelect:      (url: string) => void
  onClose:       () => void
  defaultFolder?: string
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function BucketPicker({ onSelect, onClose, defaultFolder = 'products' }: BucketPickerProps) {
  const initialPath = defaultFolder ? `${defaultFolder.replace(/^\/+|\/+$/g, '')}/` : ''
  const [currentPath, setCurrentPath] = useState(initialPath)
  const [files, setFiles]           = useState<BucketFile[]>([])
  const [folders, setFolders]       = useState<string[]>([])
  const [loading, setLoading]       = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [search, setSearch]         = useState('')
  const [uploading, setUploading]   = useState(false)
  const [uploadErr, setUploadErr]   = useState<string | null>(null)
  const [selected, setSelected]     = useState<string | null>(null)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const fileInputRef                = useRef<HTMLInputElement>(null)
  const overlayRef                  = useRef<HTMLDivElement>(null)

  // ── Fetch current folder's files + subfolders ───────────────────────────────
  const fetchFiles = useCallback(async (prefix: string) => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch(`/api/admin/media/list?prefix=${encodeURIComponent(prefix)}`)
      if (!res.ok) throw new Error(`Failed to load media (${res.status})`)
      const data = await res.json()
      setFiles(data.files ?? [])
      setFolders(data.folders ?? [])
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load media')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchFiles(currentPath) }, [currentPath, fetchFiles])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function enterFolder(name: string) {
    setSearch('')
    setSelected(null)
    setCurrentPath((prev) => `${prev}${name}/`)
  }

  const crumbs = currentPath.split('/').filter(Boolean)

  function goToBreadcrumb(idx: number) {
    const next = idx < 0 ? '' : `${crumbs.slice(0, idx + 1).join('/')}/`
    setSearch('')
    setSelected(null)
    setCurrentPath(next)
  }

  async function createFolder() {
    const name = newFolderName.trim()
    if (!name) return
    try {
      const res = await fetch('/api/admin/media/folder', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ prefix: currentPath, name }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`)
      setNewFolderName('')
      setNewFolderOpen(false)
      await fetchFiles(currentPath)
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : 'Failed to create folder')
    }
  }

  // ── Upload new file from picker ─────────────────────────────────────────────
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setUploadErr('Images only'); return }
    setUploading(true)
    setUploadErr(null)
    try {
      const webpFile    = await convertToWebp(file)
      // Sanitize filename: lowercase, replace spaces/parens/special chars
      // with hyphens. Prevents storage %20 URLs being double-encoded to
      // %2520 by next/image (causes 400 Bad Request).
      const safeName    = webpFile.name
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-|-$/g, '')
      const storagePath = `${currentPath}${Date.now()}-${safeName}`
      const fd          = new FormData()
      fd.append('file', webpFile)
      fd.append('path', storagePath)
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Upload failed (${res.status})`)
      }
      const { publicUrl } = await res.json()
      const newFile: BucketFile = {
        name:     webpFile.name,
        url:      publicUrl,
        size:     webpFile.size,
        fullPath: storagePath,
      }
      setFiles(prev => [newFile, ...prev])
      setSelected(publicUrl)
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const visibleFiles = search.trim()
    ? files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : files
  const visibleFolders = search.trim()
    ? folders.filter(f => f.toLowerCase().includes(search.toLowerCase()))
    : folders

  const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|$)/i.test(url)

  function handleConfirm() {
    if (selected) { onSelect(selected); onClose() }
  }

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position:        'fixed',
        inset:           0,
        backgroundColor: 'rgba(0,0,0,0.55)',
        zIndex:          1000,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         '20px',
      }}
    >
      <div
        style={{
          width:           '100%',
          maxWidth:        '860px',
          maxHeight:       '90vh',
          backgroundColor: 'var(--color-white)',
          borderRadius:    '12px',
          display:         'flex',
          flexDirection:   'column',
          overflow:        'hidden',
          boxShadow:       '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: '600', color: 'var(--color-text)', margin: 0 }}>Select from Media Library</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontFamily: 'var(--font-body)', fontSize: '11px' }}>
              <button type="button" onClick={() => goToBreadcrumb(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px 3px', color: currentPath ? 'var(--color-green)' : 'var(--color-text-muted)', fontWeight: currentPath ? 400 : 600 }}>
                Root
              </button>
              {crumbs.map((seg, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>/</span>
                  <button type="button" onClick={() => goToBreadcrumb(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px 3px', color: i === crumbs.length - 1 ? 'var(--color-text-muted)' : 'var(--color-green)', fontWeight: i === crumbs.length - 1 ? 600 : 400 }}>
                    {seg}
                  </button>
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}
            className="hover:opacity-60 transition-opacity"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M2 2l14 14M16 2L2 16" />
            </svg>
          </button>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 20px', borderBottom: '1px solid var(--color-border)', flexShrink: 0, flexWrap: 'wrap' }}>
          {/* Search */}
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter by filename…"
            style={{ flex: 1, minWidth: 160, height: 34, padding: '0 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-input)', fontFamily: 'var(--font-body)', fontSize: '12px', backgroundColor: 'var(--color-white)' }}
          />

          {/* New folder */}
          <button
            type="button"
            onClick={() => setNewFolderOpen(v => !v)}
            style={{ height: 34, padding: '0 12px', borderRadius: 'var(--radius-btn)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-white)', color: 'var(--color-text)', fontFamily: 'var(--font-body)', fontSize: '12px', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            + Folder
          </button>

          {/* Upload new */}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              display:         'flex', alignItems: 'center', gap: '6px',
              height:          34, padding: '0 14px', borderRadius: 'var(--radius-btn)',
              border:          '1px solid var(--color-green)',
              backgroundColor: 'var(--color-green)',
              color:           'var(--color-bg)',
              fontFamily:      'var(--font-body)', fontSize: '12px', fontWeight: '500',
              cursor:          uploading ? 'not-allowed' : 'pointer',
              opacity:         uploading ? 0.7 : 1, flexShrink: 0,
            }}
          >
            {uploading ? (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" style={{ animation: 'spin 1s linear infinite' }}>
                  <path d="M6 1v2M6 9v2M1 6h2M9 6h2M2.4 2.4l1.4 1.4M8.2 8.2l1.4 1.4M2.4 9.6l1.4-1.4M8.2 3.8l1.4-1.4" />
                </svg>
                Uploading…
              </>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 8V2M3 5l3-3 3 3M1 10h10" />
                </svg>
                Upload New
              </>
            )}
          </button>

          {/* Count */}
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
            {visibleFiles.length} file{visibleFiles.length !== 1 ? 's' : ''}
          </span>
        </div>

        {newFolderOpen && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px 0' }}>
            <input
              type="text"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createFolder() }}
              placeholder="Folder name…"
              autoFocus
              style={{ flex: 1, maxWidth: 220, height: 30, padding: '0 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-input)', fontFamily: 'var(--font-body)', fontSize: '12px' }}
            />
            <button type="button" onClick={createFolder} style={{ padding: '5px 12px', borderRadius: 'var(--radius-btn)', border: 'none', backgroundColor: 'var(--color-green)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: '12px', cursor: 'pointer' }}>
              Create
            </button>
          </div>
        )}

        {uploadErr && (
          <div style={{ margin: '8px 20px 0', padding: '8px 12px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '6px', fontFamily: 'var(--font-body)', fontSize: '12px', color: '#DC2626', flexShrink: 0 }}>
            {uploadErr}
          </div>
        )}

        {/* Grid */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', fontSize: '14px' }}>
              Loading media…
            </div>
          )}
          {fetchError && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '12px' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-error)' }}>{fetchError}</p>
              <button type="button" onClick={() => fetchFiles(currentPath)} style={{ padding: '6px 14px', borderRadius: 'var(--radius-btn)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', fontFamily: 'var(--font-body)', fontSize: '12px', cursor: 'pointer' }}>
                Retry
              </button>
            </div>
          )}
          {!loading && !fetchError && visibleFolders.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', marginBottom: '14px' }}>
              {visibleFolders.map(folder => (
                <button
                  key={folder}
                  type="button"
                  onClick={() => enterFolder(folder)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', cursor: 'pointer', textAlign: 'left' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-gold)" aria-hidden="true">
                    <path d="M2 5a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5z" />
                  </svg>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder}</span>
                </button>
              ))}
            </div>
          )}
          {!loading && !fetchError && visibleFiles.length === 0 && visibleFolders.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '8px' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-muted)' }}>
                {search ? `No files matching "${search}"` : 'No files in this folder yet. Upload one above.'}
              </p>
            </div>
          )}
          {!loading && visibleFiles.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
              {visibleFiles.map(file => {
                const isSel = selected === file.url
                return (
                  <button
                    key={file.fullPath}
                    type="button"
                    onClick={() => setSelected(isSel ? null : file.url)}
                    style={{
                      padding:         0,
                      border:          isSel ? '2px solid var(--color-green)' : '2px solid transparent',
                      borderRadius:    '8px',
                      overflow:        'hidden',
                      cursor:          'pointer',
                      backgroundColor: 'var(--color-surface)',
                      textAlign:       'left',
                      outline:         'none',
                      transition:      'border-color 0.1s',
                      boxShadow:       isSel ? '0 0 0 2px rgba(31,58,45,0.2)' : 'none',
                    }}
                  >
                    {/* Thumbnail */}
                    <div style={{ position: 'relative', width: '100%', paddingBottom: '80%', backgroundColor: 'var(--color-bg)' }}>
                      {isImage(file.url) ? (
                        <Image src={file.url} alt={file.name} fill style={{ objectFit: 'cover' }} sizes="140px" />
                      ) : (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5">
                            <rect x="1" y="2" width="22" height="20" rx="2" /><circle cx="8" cy="8" r="2" /><path d="M1 14l6-5 4 4 3-2.5 9 7" />
                          </svg>
                        </div>
                      )}
                      {isSel && (
                        <div style={{ position: 'absolute', top: 5, right: 5, width: 20, height: 20, borderRadius: '50%', backgroundColor: 'var(--color-green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round">
                            <path d="M2 5l2 2 4-4" />
                          </svg>
                        </div>
                      )}
                    </div>
                    {/* Label */}
                    <div style={{ padding: '5px 7px' }}>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                        {file.name}
                      </p>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-muted)', margin: '1px 0 0' }}>
                        {formatSize(file.size)}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', padding: '14px 20px', borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 18px', borderRadius: 'var(--radius-btn)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', fontFamily: 'var(--font-body)', fontSize: '13px', cursor: 'pointer', color: 'var(--color-text)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selected}
            style={{
              padding:         '8px 20px',
              borderRadius:    'var(--radius-btn)',
              border:          'none',
              backgroundColor: selected ? 'var(--color-green)' : 'var(--color-border)',
              color:           selected ? 'var(--color-bg)' : 'var(--color-text-muted)',
              fontFamily:      'var(--font-body)', fontSize: '13px', fontWeight: '500',
              cursor:          selected ? 'pointer' : 'not-allowed',
              transition:      'background-color 0.15s',
            }}
          >
            Use Selected Image
          </button>
        </div>
      </div>
    </div>
  )
}
