import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  type _Object,
} from '@aws-sdk/client-s3'

function getR2Client(): S3Client {
  const accountId = process.env.CF_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials missing (CF_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)')
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

export const R2_BUCKET = process.env.R2_BUCKET_NAME ?? 'possah-media'
export const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? ''

export function r2PublicUrl(path: string): string {
  return `${R2_PUBLIC_URL}/${path}`
}

export async function r2Upload(
  path: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const client = getR2Client()
  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: path,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )
  return r2PublicUrl(path)
}

export async function r2Delete(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const client = getR2Client()
  await client.send(
    new DeleteObjectsCommand({
      Bucket: R2_BUCKET,
      Delete: { Objects: paths.map((Key) => ({ Key })) },
    }),
  )
}

export async function r2List(prefix = '', maxKeys = 500): Promise<_Object[]> {
  const client = getR2Client()
  const res = await client.send(
    new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      Prefix: prefix || undefined,
      MaxKeys: maxKeys,
    }),
  )
  return res.Contents ?? []
}

// Lists the immediate contents of one "folder" level: files directly under
// `prefix`, plus the names of subfolders (S3 CommonPrefixes via Delimiter).
// Placeholder `.keep` objects used to mark empty folders are filtered out of `files`.
export async function r2ListFolder(
  prefix = '',
  maxKeys = 500,
): Promise<{ files: _Object[]; folders: string[] }> {
  const client = getR2Client()
  const res = await client.send(
    new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      Prefix: prefix || undefined,
      Delimiter: '/',
      MaxKeys: maxKeys,
    }),
  )
  const files = (res.Contents ?? []).filter((obj) => !obj.Key?.endsWith('/.keep'))
  const folders = (res.CommonPrefixes ?? [])
    .map((cp) => cp.Prefix ?? '')
    .filter(Boolean)
    .map((full) => full.slice(prefix.length, -1)) // strip parent prefix + trailing '/'
  return { files, folders }
}

export async function r2CreateFolder(prefix: string): Promise<void> {
  const client = getR2Client()
  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: `${prefix}/.keep`,
      Body: Buffer.alloc(0),
      ContentType: 'application/octet-stream',
    }),
  )
}
