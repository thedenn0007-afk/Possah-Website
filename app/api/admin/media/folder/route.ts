import { NextResponse, NextRequest } from 'next/server'
import { requireAdminAuth } from '@/lib/admin-auth'
import { r2CreateFolder } from '@/lib/r2'

// ─── POST /api/admin/media/folder ────────────────────────────────────────────
// Body: { prefix?: string, name: string } — prefix is the parent folder
// ('' for root), name is the new folder's own name.
// Returns: { folder: string } — the full prefix of the created folder.

export async function POST(request: NextRequest) {
  if (!await requireAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { prefix?: unknown; name?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const rawParent = typeof body.prefix === 'string' ? body.prefix : ''
  const rawName = typeof body.name === 'string' ? body.name : ''

  const safeName = rawName
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')

  if (!safeName) {
    return NextResponse.json({ error: 'Folder name required' }, { status: 400 })
  }

  const parent = rawParent.replace(/^\/+/, '').replace(/\/*$/, '')
  const folder = parent ? `${parent}/${safeName}` : safeName

  try {
    await r2CreateFolder(folder)
    return NextResponse.json({ folder })
  } catch (err) {
    console.error('[media/folder] unexpected:', err)
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 })
  }
}
