import { NextResponse, NextRequest } from 'next/server'
import { requireAdminAuth } from '@/lib/admin-auth'
import { r2ListFolder, r2PublicUrl } from '@/lib/r2'

// ─── GET /api/admin/media/list?prefix=folder/ ────────────────────────────────
// Lists one folder level: files directly inside `prefix`, plus the names of
// its immediate subfolders. Omit `prefix` (or pass '') for the bucket root.
// Shape: { files: MediaFile[], folders: string[], prefix: string }
// MediaFile: { name, url, size, created_at, fullPath, folder? }

export async function GET(request: NextRequest) {
  if (!await requireAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const rawPrefix = searchParams.get('prefix') ?? ''
  // Normalize: no leading slash, exactly one trailing slash if non-empty
  const prefix = rawPrefix ? rawPrefix.replace(/^\/+/, '').replace(/\/*$/, '/') : ''

  try {
    const { files, folders } = await r2ListFolder(prefix)

    const mediaFiles = files.map((obj) => {
      const key = obj.Key!
      return {
        name:       key.split('/').pop()!,
        url:        r2PublicUrl(key),
        size:       obj.Size ?? 0,
        created_at: obj.LastModified?.toISOString() ?? new Date().toISOString(),
        fullPath:   key,
        folder:     prefix ? prefix.replace(/\/$/, '') : undefined,
      }
    })
    mediaFiles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return NextResponse.json({ files: mediaFiles, folders, prefix })
  } catch (err) {
    console.error('[media/list] unexpected:', err)
    return NextResponse.json({ error: 'Failed to list media' }, { status: 500 })
  }
}
