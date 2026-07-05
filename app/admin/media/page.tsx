import type { Metadata } from 'next'
import { r2ListFolder, r2PublicUrl } from '@/lib/r2'
import { MediaLibrary } from './MediaLibrary'

export const metadata: Metadata = { title: 'Media' }
export const dynamic = 'force-dynamic'

const BUCKET = 'possah-media'

interface MediaFile {
  name:       string
  url:        string
  size:       number
  created_at: string
  fullPath:   string
  folder?:    string
}

async function getRootListing(): Promise<{ files: MediaFile[]; folders: string[] }> {
  try {
    const { files, folders } = await r2ListFolder('')
    const mediaFiles = files.map((obj) => {
      const key = obj.Key!
      return {
        name:       key.split('/').pop()!,
        url:        r2PublicUrl(key),
        size:       obj.Size ?? 0,
        created_at: obj.LastModified?.toISOString() ?? new Date().toISOString(),
        fullPath:   key,
      }
    })
    mediaFiles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return { files: mediaFiles, folders }
  } catch (err) {
    console.error('[Admin Media] unexpected:', err)
    return { files: [], folders: [] }
  }
}

export default async function AdminMediaPage() {
  const { files, folders } = await getRootListing()

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 style={{ fontFamily: 'var(--font-body)', fontSize: '22px', fontWeight: '600', color: 'var(--color-text)' }}>
          Media Library
        </h1>
        <p className="mt-0.5" style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-muted)' }}>
          {files.length} file{files.length !== 1 ? 's' : ''} at root in{' '}
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', backgroundColor: 'var(--color-border)', padding: '1px 5px', borderRadius: '3px' }}>
            {BUCKET}
          </code>
          . Browse into folders below, or create a new one. Drag & drop or click to upload. Copy URL to use in products, hero slides, etc.
        </p>
      </div>

      <MediaLibrary initialFiles={files} initialFolders={folders} />
    </div>
  )
}
