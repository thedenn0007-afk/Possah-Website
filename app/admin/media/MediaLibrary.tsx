'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Image from 'next/image'
import { convertToWebp } from '@/lib/utils'

interface MediaFile {
  name:       string
  url:        string
  size:       number
  created_at: string
  fullPath:   string
}

interface MediaLibraryProps {
  initialFiles: MediaFile[]
  initialFolders: string[]
}

function formatSize(bytes: number) {
  if (bytes < 1024)         return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function MediaLibrary({ initialFiles, initialFolders }: MediaLibraryProps) {
  const [currentPath, setCurrentPath]   = useState('') // '' = root, otherwise 'folder/sub/'
  const [files, setFiles]               = useState<MediaFile[]>(initialFiles)
  const [folders, setFolders]           = useState<string[]>(initialFolders)
  const [loading, setLoading]           = useState(false)
  const [uploading, setUploading]       = useState(false)
  const [uploadError, setUploadError]   = useState<string | null>(null)
  const [copiedUrl, setCopiedUrl]       = useState<string | null>(null)
  const [deleting, setDeleting]         = useState<string | null>(null)
  const [dragOver, setDragOver]         = useState(false)
  const [viewMode, setViewMode]         = useState<'grid' | 'list'>('grid')
  const [search, setSearch]             = useState('')
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [folderError, setFolderError]   = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchFolder = useCallback(async (prefix: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/media/list?prefix=${encodeURIComponent(prefix)}`)
      if (!res.ok) throw new Error(`Failed to load media (${res.status})`)
      const data = await res.json()
      setFiles(data.files ?? [])
      setFolders(data.folders ?? [])
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to load media')
    } finally {
      setLoading(false)
    }
  }, [])

  // Skip refetch on first render — we already have server-fetched root data
  const didMount = useRef(false)
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return }
    fetchFolder(currentPath)
  }, [currentPath, fetchFolder])

  function enterFolder(name: string) {
    setSearch('')
    setCurrentPath((prev) => `${prev}${name}/`)
  }

  function goToBreadcrumb(idx: number) {
    // idx -1 = root; otherwise the crumb ends after segment idx
    const segments = currentPath.split('/').filter(Boolean)
    const next = idx < 0 ? '' : `${segments.slice(0, idx + 1).join('/')}/`
    setSearch('')
    setCurrentPath(next)
  }

  async function createFolder() {
    setFolderError(null)
    const name = newFolderName.trim()
    if (!name) { setFolderError('Folder name required'); return }
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
      await fetchFolder(currentPath)
    } catch (err) {
      setFolderError(err instanceof Error ? err.message : 'Failed to create folder')
    }
  }

  // Upload via service-role API route (not anon client)
  async function uploadFiles(fileList: FileList) {
    setUploading(true)
    setUploadError(null)
    const uploaded: MediaFile[] = []
    const errors: string[] = []

    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith('image/') && file.type !== 'video/mp4') {
        errors.push(`${file.name}: only images and MP4 allowed`)
        continue
      }
      if (file.size > 10 * 1024 * 1024) {
        errors.push(`${file.name}: max 10 MB`)
        continue
      }

      // Convert images to WebP (SVG + GIF pass through)
      const uploadFile = file.type.startsWith('image/')
        ? await convertToWebp(file)
        : file

      // Sanitize: lowercase, replace ALL non-alphanumeric chars
      // (spaces, parens, percent signs, etc.) with hyphens, collapse runs,
      // strip leading/trailing hyphens. Prevents %20 in storage
      // URLs which next/image double-encodes to %2520 (400 Bad Request).
      const timestamp   = Date.now()
      const safeName    = uploadFile.name
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-|-$/g, '')
      const storagePath = `${currentPath}${timestamp}-${safeName}`

      const fd = new FormData()
      fd.append('file', uploadFile)
      fd.append('path', storagePath)

      try {
        const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          errors.push(`${file.name}: ${body.error ?? `Upload failed (${res.status})`}`)
          continue
        }
        const { publicUrl } = await res.json()
        uploaded.push({
          name:       uploadFile.name,
          url:        publicUrl,
          size:       uploadFile.size,
          created_at: new Date().toISOString(),
          fullPath:   storagePath,
        })
      } catch (err) {
        errors.push(`${file.name}: network error`)
        console.error('[MediaLibrary] upload:', err)
      }
    }

    if (errors.length > 0) setUploadError(errors.join(' · '))
    if (uploaded.length > 0) setFiles(prev => [...uploaded, ...prev])
    setUploading(false)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) uploadFiles(e.target.files)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files)
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const el = document.createElement('textarea')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopiedUrl(url)
    setTimeout(() => setCopiedUrl(null), 2000)
  }

  // Delete via service-role API route
  async function deleteFile(file: MediaFile) {
    if (!window.confirm(`Delete "${file.name}"? This cannot be undone.`)) return
    setDeleting(file.fullPath)

    try {
      const res = await fetch('/api/admin/media/delete', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ paths: [file.fullPath] }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        alert(`Delete failed: ${body.error ?? res.status}`)
      } else {
        setFiles(prev => prev.filter(f => f.fullPath !== file.fullPath))
      }
    } catch {
      alert('Delete failed: network error')
    }
    setDeleting(null)
  }

  const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|$)/i.test(url)

  const visibleFiles = search.trim()
    ? files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : files
  const visibleFolders = search.trim()
    ? folders.filter(f => f.toLowerCase().includes(search.toLowerCase()))
    : folders

  const crumbs = currentPath.split('/').filter(Boolean)

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '14px', flexWrap: 'wrap', fontFamily: 'var(--font-body)', fontSize: '12px' }}>
        <button onClick={() => goToBreadcrumb(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: currentPath ? 'var(--color-green)' : 'var(--color-text)', fontWeight: currentPath ? 400 : 600 }}>
          Root
        </button>
        {crumbs.map((seg, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>/</span>
            <button
              onClick={() => goToBreadcrumb(i)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: i === crumbs.length - 1 ? 'var(--color-text)' : 'var(--color-green)', fontWeight: i === crumbs.length - 1 ? 600 : 400 }}
            >
              {seg}
            </button>
          </span>
        ))}
      </div>

      {/* Upload zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border:          `2px dashed ${dragOver ? 'var(--color-gold)' : 'var(--color-border)'}`,
          borderRadius:    '10px',
          padding:         '36px 24px',
          textAlign:       'center',
          cursor:          'pointer',
          backgroundColor: dragOver ? '#FFFBEB' : 'var(--color-surface)',
          marginBottom:    '20px',
          transition:      'all 0.15s',
        }}
      >
        <input ref={fileInputRef} type="file" multiple accept="image/*,video/mp4" onChange={handleFileInput} style={{ display: 'none' }} />
        {uploading ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-muted)' }}>Uploading…</p>
        ) : (
          <>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 10px' }}>
              <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
            </svg>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text)', fontWeight: '500' }}>
              Drag &amp; drop or click to upload {currentPath ? `into "${crumbs[crumbs.length - 1]}"` : ''}
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>Images (JPG, PNG, WebP, SVG) · MP4 video · Max 10 MB each</p>
          </>
        )}
      </div>

      {uploadError && (
        <div style={{ padding: '10px 14px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', marginBottom: '14px', fontFamily: 'var(--font-body)', fontSize: '12px', color: '#DC2626' }}>
          {uploadError}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
          {visibleFiles.length} / {files.length} file{files.length !== 1 ? 's' : ''}
        </span>
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter by name…"
          style={{ flex: 1, minWidth: 160, height: 32, padding: '0 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-input)', fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text)', backgroundColor: 'var(--color-white)' }}
        />
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          {(['grid', 'list'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{ padding: '5px 10px', borderRadius: '5px', border: '1px solid var(--color-border)', backgroundColor: viewMode === mode ? 'var(--color-green)' : 'var(--color-surface)', color: viewMode === mode ? '#fff' : 'var(--color-text-muted)', fontFamily: 'var(--font-body)', fontSize: '11px', cursor: 'pointer', fontWeight: '500', textTransform: 'capitalize' }}
            >
              {mode}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setNewFolderOpen(v => !v); setFolderError(null) }}
          style={{ padding: '5px 12px', borderRadius: '5px', border: '1px solid var(--color-green)', backgroundColor: 'transparent', color: 'var(--color-green)', fontFamily: 'var(--font-body)', fontSize: '11px', cursor: 'pointer', fontWeight: '500', flexShrink: 0 }}
        >
          + New Folder
        </button>
      </div>

      {newFolderOpen && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <input
            type="text"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createFolder() }}
            placeholder="Folder name…"
            autoFocus
            style={{ flex: 1, maxWidth: 240, height: 32, padding: '0 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-input)', fontFamily: 'var(--font-body)', fontSize: '12px', backgroundColor: 'var(--color-white)' }}
          />
          <button onClick={createFolder} style={{ padding: '6px 14px', borderRadius: '5px', border: 'none', backgroundColor: 'var(--color-green)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: '12px', cursor: 'pointer' }}>
            Create
          </button>
          {folderError && <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: '#DC2626' }}>{folderError}</span>}
        </div>
      )}

      {loading && (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', fontSize: '13px' }}>
          Loading…
        </div>
      )}

      {/* Folder tiles */}
      {!loading && visibleFolders.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', marginBottom: '16px' }}>
          {visibleFolders.map(folder => (
            <button
              key={folder}
              onClick={() => enterFolder(folder)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', cursor: 'pointer', textAlign: 'left' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--color-gold)" aria-hidden="true">
                <path d="M2 5a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5z" />
              </svg>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder}</span>
            </button>
          ))}
        </div>
      )}

      {!loading && visibleFiles.length === 0 && visibleFolders.length === 0 && (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', fontSize: '14px' }}>
          {search ? `No files matching "${search}"` : 'No files here yet.'}
        </div>
      )}

      {/* Grid view */}
      {!loading && visibleFiles.length > 0 && viewMode === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
          {visibleFiles.map((file) => (
            <div key={file.fullPath} style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ position: 'relative', width: '100%', paddingBottom: '75%', backgroundColor: 'var(--color-bg)' }}>
                {isImage(file.url) ? (
                  <Image src={file.url} alt={file.name} fill style={{ objectFit: 'cover' }} sizes="200px" />
                ) : (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5">
                      <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                  </div>
                )}
              </div>
              <div style={{ padding: '8px 10px' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '2px' }}>{file.name}</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>{formatSize(file.size)}</p>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => copyUrl(file.url)} style={{ flex: 1, padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: copiedUrl === file.url ? '#DCFCE7' : 'var(--color-bg)', color: copiedUrl === file.url ? '#166534' : 'var(--color-text)', fontFamily: 'var(--font-body)', fontSize: '10px', cursor: 'pointer', transition: 'all 0.1s' }}>
                    {copiedUrl === file.url ? '✓ Copied' : 'Copy URL'}
                  </button>
                  <button onClick={() => deleteFile(file)} disabled={deleting === file.fullPath} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #FCA5A5', backgroundColor: '#FEF2F2', color: '#DC2626', fontFamily: 'var(--font-body)', fontSize: '10px', cursor: deleting === file.fullPath ? 'wait' : 'pointer' }}>
                    {deleting === file.fullPath ? '…' : 'Del'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List view */}
      {!loading && visibleFiles.length > 0 && viewMode === 'list' && (
        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['Preview', 'Name', 'Size', 'Uploaded', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: '600', color: 'var(--color-text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleFiles.map((file, i) => (
                <tr key={file.fullPath} style={{ borderBottom: i < visibleFiles.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'var(--color-border)', position: 'relative' }}>
                      {isImage(file.url) ? (
                        <Image src={file.url} alt={file.name} fill style={{ objectFit: 'cover' }} sizes="40px" />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5">
                            <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text)', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</p>
                  </td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-muted)' }}>{formatSize(file.size)}</span>
                  </td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)' }}>{formatDate(file.created_at)}</span>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={() => copyUrl(file.url)} style={{ padding: '5px 11px', borderRadius: '5px', border: '1px solid var(--color-border)', backgroundColor: copiedUrl === file.url ? '#DCFCE7' : 'var(--color-bg)', color: copiedUrl === file.url ? '#166534' : 'var(--color-text)', fontFamily: 'var(--font-body)', fontSize: '11px', cursor: 'pointer' }}>
                        {copiedUrl === file.url ? '✓ Copied' : 'Copy URL'}
                      </button>
                      <button onClick={() => deleteFile(file)} disabled={deleting === file.fullPath} style={{ padding: '5px 11px', borderRadius: '5px', border: '1px solid #FCA5A5', backgroundColor: '#FEF2F2', color: '#DC2626', fontFamily: 'var(--font-body)', fontSize: '11px', cursor: deleting === file.fullPath ? 'wait' : 'pointer' }}>
                        {deleting === file.fullPath ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
