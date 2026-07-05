import { api } from '../lib/http.mjs'
import { makeAssertCollection, printHeader } from '../lib/assert.mjs'
import { SEEDS } from '../seed.mjs'

export async function run(ctx) {
  printHeader('1 / 9  CATEGORIES')
  const A = makeAssertCollection('Categories')
  let createdId = null

  // ── LIST ─────────────────────────────────────────────────────────────────────
  {
    const res = await api('GET', '/api/admin/categories')
    A.status('LIST', 'GET /categories → 200', res, 200)
    A.isArray('LIST', 'response is array', res.data)
    if (Array.isArray(res.data)) {
      const found = res.data.find(c => c.slug === SEEDS.category.slug)
      A.ok('LIST', 'seeded test-cat-001 present', !!found,
        `Seed may have failed. Run: node scripts/admin_test/seed.mjs`)
      A.ok('LIST', 'category has parent field', found && 'parent' in found,
        'Route missing parent join. Check GET /api/admin/categories — .select("*, parent:parent_id (id, name)")')
    }
  }

  // ── CREATE ───────────────────────────────────────────────────────────────────
  {
    const body = {
      name: 'Test Cat New',
      slug: 'test-cat-new-' + Date.now(),
      nav_section: 'TEST',
      position: 9998,
    }
    const res = await api('POST', '/api/admin/categories', body)
    A.status('CREATE', 'POST /categories → 201', res, 201)
    A.ok('CREATE', 'response has id', typeof res.data?.id === 'string',
      'Route must return { id: uuid } on 201.')
    if (res.data?.id) createdId = res.data.id
  }

  // ── BULK REORDER ─────────────────────────────────────────────────────────────
  if (ctx.category_id) {
    const body = [
      { id: ctx.category_id, position: 9990 },
      ...(createdId ? [{ id: createdId, position: 9991 }] : []),
    ]
    const res = await api('PATCH', '/api/admin/categories', body)
    A.status('BULK REORDER', 'PATCH /categories (array) → 200', res, 200)
    A.ok('BULK REORDER', 'response ok:true', res.data?.ok === true,
      'Route must return { ok: true }.')
  }

  // ── UPDATE SINGLE ─────────────────────────────────────────────────────────────
  if (createdId) {
    const res = await api('PATCH', `/api/admin/categories/${createdId}`, { name: 'Test Cat Updated' })
    A.status('UPDATE', `PATCH /categories/${createdId.slice(0,8)}… → 200`, res, 200)
    A.ok('UPDATE', 'response ok:true', res.data?.ok === true, 'Route must return { ok: true }.')
  }

  // ── DELETE (clean — no products) ────────────────────────────────────────────
  if (createdId) {
    const res = await api('DELETE', `/api/admin/categories/${createdId}`)
    A.status('DELETE', 'DELETE new category (no products) → 200', res, 200)
    A.ok('DELETE', 'response ok:true', res.data?.ok === true, 'Route must return { ok: true }.')
  }

  // ── DELETE BLOCKED — category has active products ───────────────────────────
  if (ctx.category_id) {
    const res = await api('DELETE', `/api/admin/categories/${ctx.category_id}`)
    A.status('DELETE BLOCKED', 'DELETE category with products → 409', res, 409)
    A.hasError('DELETE BLOCKED', 'response has error message', res)
  }

  // ── VERIFY cleanup — deleted category gone from list ────────────────────────
  if (createdId) {
    const res = await api('GET', '/api/admin/categories')
    if (Array.isArray(res.data)) {
      A.ok('VERIFY', 'deleted category absent from list', !res.data.find(c => c.id === createdId),
        'Deleted category still in list. DELETE may have silently failed.')
    }
  }

  // ── SITE REFLECTION — verify live pages still render after CRUD + revalidation ─
  // The categories API calls revalidatePath('/', 'layout') on every mutation.
  // This step checks that the live pages respond correctly after the cache is cleared.
  {
    const pages = ['/women', '/new-in', '/best-sellers']
    for (const page of pages) {
      const res = await api('GET', page)
      A.ok('SITE REFLECTION', `${page} returns 200 after category change`, res.status === 200,
        `Page ${page} returned ${res.status}. Revalidation or rendering may be broken.`)
    }
  }

  return A.results
}
