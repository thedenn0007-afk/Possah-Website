import { api } from '../lib/http.mjs'
import { makeAssertCollection, printHeader } from '../lib/assert.mjs'
import { SEEDS } from '../seed.mjs'

export async function run(ctx) {
  printHeader('2 / 9  PRODUCTS')
  const A = makeAssertCollection('Products')
  let createdId = null

  // ── LIST ─────────────────────────────────────────────────────────────────────
  {
    const res = await api('GET', '/api/admin/products')
    A.status('LIST', 'GET /products → 200', res, 200)
    A.ok('LIST', 'response has products array', Array.isArray(res.data?.products),
      'Route must return { products: [], total, page, per_page }.')
    A.ok('LIST', 'response has total', typeof res.data?.total === 'number',
      'Missing "total" field in response.')
  }

  // ── LIST: search filter ───────────────────────────────────────────────────────
  {
    const res = await api('GET', '/api/admin/products?search=Alpha')
    A.status('LIST search', 'GET /products?search=Alpha → 200', res, 200)
    if (Array.isArray(res.data?.products)) {
      const found = res.data.products.find(p => p.slug === SEEDS.productA.slug)
      A.ok('LIST search', 'test-product-alpha found in search results', !!found,
        'ilike search on name may not be case-insensitive. Check query filter.')
    }
  }

  // ── LIST: active=false filter ─────────────────────────────────────────────────
  {
    const res = await api('GET', '/api/admin/products?active=false')
    A.status('LIST active=false', 'GET /products?active=false → 200', res, 200)
    if (Array.isArray(res.data?.products)) {
      const found = res.data.products.find(p => p.slug === SEEDS.productB.slug)
      A.ok('LIST active=false', 'inactive test-product-beta in results', !!found,
        'Seed may have set is_active=true for productB, or active filter not working.')
      const allInactive = res.data.products.every(p => p.is_active === false)
      A.ok('LIST active=false', 'all returned products are inactive', allInactive,
        'active=false filter not correctly applied. Check query: .eq("is_active", false).')
    }
  }

  // ── LIST: pagination ─────────────────────────────────────────────────────────
  {
    const res = await api('GET', '/api/admin/products?page=1&per_page=2')
    A.status('LIST paginate', 'GET /products?page=1&per_page=2 → 200', res, 200)
    A.ok('LIST paginate', 'returned ≤ 2 products', (res.data?.products?.length ?? 0) <= 2,
      'Pagination per_page limit not applied. Check .range(offset, offset + perPage - 1).')
  }

  // ── CREATE ───────────────────────────────────────────────────────────────────
  {
    const body = {
      name: 'Test Product Gamma',
      slug: 'test-product-gamma-' + Date.now(),
      price: 3500,
      is_new_arrival: false,
      is_top_selling: false,
      is_featured: false,
      is_festive: false,
      is_bridal: false,
      is_active: true,
      tags: ['Evening'],
      variants: [
        { colour_name: 'Green', colour_hex: '#27AE60', size: 'S', stock_qty: 3 },
        { colour_name: 'Green', colour_hex: '#27AE60', size: 'M', stock_qty: 3 },
      ],
      images: [
        { url: 'https://placehold.co/600x800?text=Gamma', alt: 'Gamma', position: 0 },
      ],
    }
    const res = await api('POST', '/api/admin/products', body)
    A.status('CREATE', 'POST /products → 201', res, 201)
    A.ok('CREATE', 'response has id', typeof res.data?.id === 'string',
      'Route must return { id, slug } on 201.')
    A.ok('CREATE', 'response has slug', typeof res.data?.slug === 'string',
      'Route must return { id, slug } on 201.')
    if (res.data?.id) createdId = res.data.id
  }

  // ── CREATE: dupe slug → 422 ───────────────────────────────────────────────────
  {
    const res = await api('POST', '/api/admin/products', {
      name: 'Dupe', slug: SEEDS.productA.slug,
      price: 100, is_new_arrival: false, is_top_selling: false, is_featured: false, is_active: true,
      tags: [], variants: [], images: [],
    })
    A.status('CREATE dupe slug', 'POST /products with existing slug → 422', res, 422)
    A.hasError('CREATE dupe slug', 'has error message', res)
  }

  // ── GET SINGLE ───────────────────────────────────────────────────────────────
  if (ctx.product_a_id) {
    const res = await api('GET', `/api/admin/products/${ctx.product_a_id}`)
    A.status('GET', `GET /products/${ctx.product_a_id.slice(0,8)}… → 200`, res, 200)
    A.field('GET', 'slug matches', res.data, 'slug', SEEDS.productA.slug)
    A.field('GET', 'name matches', res.data, 'name', SEEDS.productA.name)
    A.ok('GET', 'has product_images array',  Array.isArray(res.data?.product_images),
      'Route must join product_images. Check .select("*, product_images(…)").')
    A.ok('GET', 'has product_variants array', Array.isArray(res.data?.product_variants),
      'Route must join product_variants. Check .select("*, product_variants(…)").')
    A.ok('GET', 'has product_tags array',     Array.isArray(res.data?.product_tags),
      'Route must join product_tags. Check .select("*, product_tags(…)").')
    A.ok('GET', 'has is_festive field', typeof res.data?.is_festive === 'boolean',
      'is_festive column missing — run migration 024.')
    A.ok('GET', 'has is_bridal field',  typeof res.data?.is_bridal  === 'boolean',
      'is_bridal column missing — run migration 024.')
    A.ok('GET', 'productA is_festive = true', res.data?.is_festive === true,
      'Seed sets is_festive:true for productA. Check seed.mjs.')
  }

  // ── GET SINGLE: not found ──────────────────────────────────────────────────────
  {
    const res = await api('GET', '/api/admin/products/00000000-0000-0000-0000-000000000099')
    A.status('GET 404', 'GET /products/non-existent-id → 404', res, 404)
  }

  // ── UPDATE (scalar fields) ────────────────────────────────────────────────────
  if (ctx.product_a_id) {
    const res = await api('PATCH', `/api/admin/products/${ctx.product_a_id}`, {
      name: 'Test Product Alpha (Updated)',
      is_featured: true,
      is_festive: false,
      is_bridal: true,
    })
    A.status('UPDATE', `PATCH /products/${ctx.product_a_id.slice(0,8)}… → 200`, res, 200)
    A.ok('UPDATE', 'response ok:true', res.data?.ok === true, 'Route must return { ok: true }.')

    // Verify change persisted
    const verify = await api('GET', `/api/admin/products/${ctx.product_a_id}`)
    A.field('UPDATE verify', 'name updated in DB', verify.data, 'name', 'Test Product Alpha (Updated)')
    A.field('UPDATE verify', 'is_featured updated', verify.data, 'is_featured', true)
  }

  // ── UPDATE (replace variants array) ─────────────────────────────────────────
  if (ctx.product_a_id) {
    const res = await api('PATCH', `/api/admin/products/${ctx.product_a_id}`, {
      variants: [
        { colour_name: 'Blue', colour_hex: '#2980B9', size: 'XL', stock_qty: 7 },
      ],
    })
    A.status('UPDATE variants', 'PATCH /products variants replace → 200', res, 200)

    const verify = await api('GET', `/api/admin/products/${ctx.product_a_id}`)
    const variants = verify.data?.product_variants ?? []
    A.ok('UPDATE variants', 'variants replaced (count = 1)', variants.length === 1,
      `Expected 1 variant after replace, got ${variants.length}. Check delete+reinsert logic.`)
    A.ok('UPDATE variants', 'new variant colour = Blue', variants[0]?.colour_name === 'Blue',
      'Variant replace did not persist. Check PATCH handler variant section.')
  }

  // ── IMAGE REORDER (drag-and-drop persistence contract) ────────────────────────
  // The admin UI lets the user drag images into any order; on save, ProductForm
  // re-derives `position` from array index and PATCHes the whole array. This
  // verifies that backend contract end-to-end (not the drag UI itself).
  if (ctx.product_a_id) {
    const threeImages = [
      { url: 'https://placehold.co/600x800?text=One',   alt: 'One',   position: 0 },
      { url: 'https://placehold.co/600x800?text=Two',   alt: 'Two',   position: 1 },
      { url: 'https://placehold.co/600x800?text=Three', alt: 'Three', position: 2 },
    ]
    const setupRes = await api('PATCH', `/api/admin/products/${ctx.product_a_id}`, { images: threeImages })
    A.status('IMAGE REORDER setup', 'PATCH images (3, in order) → 200', setupRes, 200)

    // Simulate a drag: move "Three" (was last) to first position.
    const reordered = [threeImages[2], threeImages[0], threeImages[1]]
      .map((img, i) => ({ url: img.url, alt: img.alt, position: i }))
    const res = await api('PATCH', `/api/admin/products/${ctx.product_a_id}`, { images: reordered })
    A.status('IMAGE REORDER', 'PATCH images (reordered) → 200', res, 200)

    const verify = await api('GET', `/api/admin/products/${ctx.product_a_id}`)
    const images = (verify.data?.product_images ?? []).slice().sort((a, b) => a.position - b.position)
    A.ok('IMAGE REORDER verify', 'image count still 3', images.length === 3,
      `Expected 3 images after reorder, got ${images.length}.`)
    A.ok('IMAGE REORDER verify', 'dragged image ("Three") is now position 0 / primary', images[0]?.alt === 'Three',
      'Reordered array was not persisted with position = array index. Check PATCH handler images replace logic.')
    A.ok('IMAGE REORDER verify', 'order fully matches drag result (Three, One, Two)',
      images.map(i => i.alt).join(',') === 'Three,One,Two',
      `Got order: ${images.map(i => i.alt).join(',')}. Position column must be re-derived from array index on every save.`)
  }

  // ── SOFT DELETE ───────────────────────────────────────────────────────────────
  if (createdId) {
    const res = await api('DELETE', `/api/admin/products/${createdId}`)
    A.status('DELETE', `DELETE /products/${createdId.slice(0,8)}… → 200`, res, 200)

    // Product still exists but is_active=false
    const verify = await api('GET', `/api/admin/products/${createdId}`)
    A.status('DELETE verify', 'product still GET-able after soft delete', verify, 200)
    A.field('DELETE verify', 'is_active=false after soft delete', verify.data, 'is_active', false)
  }

  return A.results
}
