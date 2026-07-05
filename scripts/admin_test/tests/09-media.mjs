import { api, BASE_URL } from '../lib/http.mjs'
import { env } from '../lib/env.mjs'
import { makeAssertCollection, printHeader } from '../lib/assert.mjs'

// Raw multipart upload helper — api() JSON-stringifies bodies, which can't
// carry a File/Blob, so uploads go straight through fetch().
async function uploadFile(path, bytes, contentType) {
  const fd = new FormData()
  fd.append('file', new Blob([bytes], { type: contentType }), 'test.bin')
  fd.append('path', path)
  const headers = {}
  if (env.ADMIN_TEST_SECRET) headers['x-admin-test-token'] = env.ADMIN_TEST_SECRET
  const res = await fetch(`${BASE_URL}/api/admin/upload`, { method: 'POST', headers, body: fd })
  const data = await res.json().catch(() => null)
  return { status: res.status, data }
}

export async function run() {
  printHeader('9 / 9  MEDIA (folders + AVIF upload)')
  const A = makeAssertCollection('Media')

  const folderName = `test-media-folder-${Date.now()}`
  const uploadedPaths = []

  // ── Root listing has files/folders shape ────────────────────────────────────
  {
    const res = await api('GET', '/api/admin/media/list')
    A.status('LIST root', 'GET /media/list → 200', res, 200)
    A.ok('LIST root', 'response has files array', Array.isArray(res.data?.files),
      'Route must return { files: [], folders: [], prefix }.')
    A.ok('LIST root', 'response has folders array', Array.isArray(res.data?.folders),
      'Route must return dynamically-discovered folders via r2ListFolder (Delimiter).')
  }

  // ── CREATE folder ────────────────────────────────────────────────────────────
  {
    const res = await api('POST', '/api/admin/media/folder', { prefix: '', name: folderName })
    A.status('CREATE folder', 'POST /media/folder → 200', res, 200)
    A.field('CREATE folder', 'returned folder matches sanitized name', res.data, 'folder', folderName)
  }

  // ── Folder now appears in root listing ──────────────────────────────────────
  {
    const res = await api('GET', '/api/admin/media/list')
    A.status('LIST after create', 'GET /media/list → 200', res, 200)
    const found = (res.data?.folders ?? []).includes(folderName)
    A.ok('LIST after create', `"${folderName}" discoverable in root folders`, found,
      'Newly created folder not found in root listing. Check r2ListFolder Delimiter/CommonPrefixes logic.')
  }

  // ── Upload a file into the new folder ───────────────────────────────────────
  {
    const path = `${folderName}/inside-folder.webp`
    const res = await uploadFile(path, Buffer.from('fake-webp-bytes'), 'image/webp')
    A.status('UPLOAD into folder', 'POST /upload (webp, in folder) → 200', res, 200)
    A.ok('UPLOAD into folder', 'response has publicUrl', typeof res.data?.publicUrl === 'string',
      'Upload route must return { publicUrl }.')
    if (res.status === 200) uploadedPaths.push(path)
  }

  // ── Listing that folder shows the uploaded file ─────────────────────────────
  {
    const res = await api('GET', `/api/admin/media/list?prefix=${encodeURIComponent(folderName + '/')}`)
    A.status('LIST folder', 'GET /media/list?prefix=folder/ → 200', res, 200)
    const found = (res.data?.files ?? []).some(f => f.fullPath === `${folderName}/inside-folder.webp`)
    A.ok('LIST folder', 'uploaded file appears scoped to its folder', found,
      'File not found when listing its own folder prefix. Check ?prefix= handling in media/list route.')
  }

  // ── AVIF upload (previously 415'd — regression check for the reported bug) ──
  {
    const path = `${folderName}/avif-test.avif`
    const res = await uploadFile(path, Buffer.from('fake-avif-bytes'), 'image/avif')
    A.status('UPLOAD avif', 'POST /upload (image/avif) → 200', res, 200)
    if (res.status !== 200) {
      A.ok('UPLOAD avif', 'server allowedTypes includes image/avif', false,
        'app/api/admin/upload/route.ts allowedTypes array is missing image/avif — this is the Page Heroes intermittent-error bug.')
    }
    if (res.status === 200) uploadedPaths.push(path)
  }

  // ── Cleanup: remove everything this test created from R2 ────────────────────
  {
    const paths = [...uploadedPaths, `${folderName}/.keep`]
    const res = await api('DELETE', '/api/admin/media/delete', { paths })
    A.status('CLEANUP', 'DELETE /media/delete (test files + folder marker) → 200', res, 200)
  }

  return A.results
}
