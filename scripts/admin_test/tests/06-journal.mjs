import { api } from '../lib/http.mjs'
import { makeAssertCollection, printHeader } from '../lib/assert.mjs'
import { SEEDS } from '../seed.mjs'

export async function run(ctx) {
  printHeader('6 / 9  JOURNAL')
  const A = makeAssertCollection('Journal')
  let createdId = null

  // ── LIST ─────────────────────────────────────────────────────────────────────
  {
    const res = await api('GET', '/api/admin/journal')
    A.status('LIST', 'GET /journal → 200', res, 200)
    A.isArray('LIST', 'response is array', res.data)
    if (Array.isArray(res.data)) {
      const foundA = res.data.find(a => a.slug === SEEDS.articleA.slug)
      const foundB = res.data.find(a => a.slug === SEEDS.articleB.slug)
      A.ok('LIST', 'test-article-alpha present (published)', !!foundA,
        'articleA seed missing. Re-run seed.mjs.')
      A.ok('LIST', 'test-article-beta present (draft)',     !!foundB,
        'articleB seed missing. Re-run seed.mjs.')
      A.ok('LIST', 'published_at is set on articleA',  !!foundA?.published_at,
        'articleA should have published_at set.')
      A.ok('LIST', 'published_at is null on articleB (draft)', foundB?.published_at === null,
        'articleB should have published_at=null (draft).')
    }
  }

  // ── CREATE ───────────────────────────────────────────────────────────────────
  {
    const body = {
      title: 'Test Article Gamma',
      slug: `test-article-gamma-${Date.now()}`,
      category: 'Style',
      author: 'Test Author',
      body: '<p>Test body content</p>',
      is_featured: false,
      published_at: null,
    }
    const res = await api('POST', '/api/admin/journal', body)
    A.status('CREATE', 'POST /journal → 201', res, 201)
    A.ok('CREATE', 'response has id', typeof res.data?.id === 'string',
      'Route must return { id: uuid } on 201.')
    if (res.data?.id) createdId = res.data.id
  }

  // ── CREATE: dupe slug → 409 ───────────────────────────────────────────────────
  {
    const res = await api('POST', '/api/admin/journal', {
      title: 'Dupe', slug: SEEDS.articleA.slug,
      category: 'Style', author: 'Author',
    })
    A.status('CREATE dupe', 'POST /journal with existing slug → 409', res, 409)
    A.hasError('CREATE dupe', 'has error message', res)
  }

  // ── CREATE: invalid category → 422 ───────────────────────────────────────────
  {
    const res = await api('POST', '/api/admin/journal', {
      title: 'Bad Cat', slug: `test-bad-cat-${Date.now()}`,
      category: 'InvalidCategory', author: 'Author',
    })
    A.status('CREATE bad category', 'POST /journal with invalid category → 422', res, 422)
  }

  // ── GET SINGLE ───────────────────────────────────────────────────────────────
  if (ctx.article_a_id) {
    const res = await api('GET', `/api/admin/journal/${ctx.article_a_id}`)
    A.status('GET', `GET /journal/${ctx.article_a_id.slice(0,8)}… → 200`, res, 200)
    A.field('GET', 'slug matches',     res.data, 'slug',     SEEDS.articleA.slug)
    A.field('GET', 'category matches', res.data, 'category', SEEDS.articleA.category)
    A.field('GET', 'author matches',   res.data, 'author',   SEEDS.articleA.author)
  }

  // ── GET SINGLE: not found → 404 ───────────────────────────────────────────────
  {
    const res = await api('GET', '/api/admin/journal/00000000-0000-0000-0000-000000000099')
    A.status('GET 404', 'GET /journal/non-existent → 404', res, 404)
    A.hasError('GET 404', 'has error field', res)
  }

  // ── UPDATE: publish article ───────────────────────────────────────────────────
  if (createdId) {
    const publishedAt = new Date().toISOString()
    const res = await api('PATCH', `/api/admin/journal/${createdId}`, {
      title: 'Test Article Gamma (Published)',
      published_at: publishedAt,
      is_featured: true,
    })
    A.status('UPDATE publish', `PATCH /journal/${createdId.slice(0,8)}… → 200`, res, 200)
    A.ok('UPDATE publish', 'response ok:true', res.data?.ok === true, 'Must return { ok: true }.')

    const verify = await api('GET', `/api/admin/journal/${createdId}`)
    A.ok('UPDATE verify', 'title updated',      verify.data?.title === 'Test Article Gamma (Published)',
      `Title is "${verify.data?.title}". PATCH update may not have saved.`)
    A.ok('UPDATE verify', 'is_featured=true',   verify.data?.is_featured === true,
      'is_featured not updated. Check PATCH handler.')
    A.ok('UPDATE verify', 'published_at set',   !!verify.data?.published_at,
      'published_at not persisted. Check PATCH handler.')
  }

  // ── UPDATE: set back to draft ─────────────────────────────────────────────────
  if (createdId) {
    const res = await api('PATCH', `/api/admin/journal/${createdId}`, { published_at: null })
    A.status('UPDATE draft', 'PATCH published_at=null (draft) → 200', res, 200)

    const verify = await api('GET', `/api/admin/journal/${createdId}`)
    A.ok('UPDATE draft verify', 'published_at is null', verify.data?.published_at === null,
      'Setting published_at=null did not persist. Check nullable handling in PATCH.')
  }

  // ── DELETE ───────────────────────────────────────────────────────────────────
  if (createdId) {
    const res = await api('DELETE', `/api/admin/journal/${createdId}`)
    A.status('DELETE', `DELETE /journal/${createdId.slice(0,8)}… → 200`, res, 200)
    A.ok('DELETE', 'response ok:true', res.data?.ok === true, 'Must return { ok: true }.')

    const verify = await api('GET', `/api/admin/journal/${createdId}`)
    A.status('DELETE verify', 'GET after delete → 404', verify, 404)
  }

  return A.results
}
