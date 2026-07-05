import { NextResponse, NextRequest } from 'next/server'
import { requireAdminAuth } from '@/lib/admin-auth'
import { r2Upload } from '@/lib/r2'

// ─── POST /api/admin/upload ────────────────────────────────────────────────
// Accepts: multipart/form-data with fields:
//   file     — the image File
//   path     — storage path, e.g. "products/1234567890-0-photo.webp"
//
// Returns: { publicUrl: string }

export async function POST(request: NextRequest) {
  if (!await requireAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  const path = formData.get('path')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (typeof path !== 'string' || !path.trim()) {
    return NextResponse.json({ error: 'No path provided' }, { status: 400 })
  }

  // 10 MB guard
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 })
  }

  const allowedTypes = ['image/webp', 'image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/avif']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 })
  }

  if (!process.env.NEXT_PUBLIC_R2_PUBLIC_URL) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_R2_PUBLIC_URL is not set — add it to .env.local or Vercel environment variables' },
      { status: 500 },
    )
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const publicUrl = await r2Upload(path, buffer, file.type)
    return NextResponse.json({ publicUrl })
  } catch (err) {
    console.error('[upload route] unexpected:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
