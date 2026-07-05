import { api } from '../lib/http.mjs'
import { makeAssertCollection, printHeader } from '../lib/assert.mjs'

const OCCASION_TILES_8 = Array.from({ length: 8 }, (_, i) => ({
  image_url: `https://placehold.co/400x400?text=Occ${i + 1}`,
  label: `Test Occasion ${i + 1}`,
  link: '/shop',
}))

export async function run(ctx) {
  printHeader('8 / 9  HOMEPAGE CONFIG (singleton)')
  const A = makeAssertCollection('Homepage')

  // ── GET (fetch original so we can restore) ────────────────────────────────────
  let original = null
  {
    const res = await api('GET', '/api/admin/homepage')
    A.status('GET', 'GET /homepage → 200', res, 200)
    A.ok('GET', 'has hero_slides field',     'hero_slides' in (res.data ?? {}),
      'Response missing hero_slides. Check GET handler.')
    A.ok('GET', 'has occasion_tiles field',  'occasion_tiles' in (res.data ?? {}),
      'Response missing occasion_tiles.')
    A.ok('GET', 'has new_arrival_ids field', 'new_arrival_ids' in (res.data ?? {}),
      'Response missing new_arrival_ids.')
    if (res.data) original = res.data
  }

  // ── PATCH: hero_slides ────────────────────────────────────────────────────────
  {
    const res = await api('PATCH', '/api/admin/homepage', {
      hero_slides: [
        {
          image_url:    'https://placehold.co/1440x800?text=Test+Hero',
          headline:     'Test Headline',
          sub_headline: 'Test sub headline',
          cta_label:    'Shop Now',
          cta_link:     '/new-in',
        },
      ],
    })
    A.status('UPDATE hero_slides', 'PATCH /homepage hero_slides → 200', res, 200)
    A.ok('UPDATE hero_slides', 'response ok:true', res.data?.ok === true, 'Must return { ok: true }.')
  }

  // ── VERIFY hero_slides ────────────────────────────────────────────────────────
  {
    const res = await api('GET', '/api/admin/homepage')
    A.ok('UPDATE hero verify', 'hero_slides[0].headline = "Test Headline"',
      res.data?.hero_slides?.[0]?.headline === 'Test Headline',
      `Got "${res.data?.hero_slides?.[0]?.headline}". PATCH not persisting hero_slides.`)
  }

  // ── PATCH: new_arrival_ids ────────────────────────────────────────────────────
  if (ctx.product_a_id) {
    const res = await api('PATCH', '/api/admin/homepage', {
      new_arrival_ids: [ctx.product_a_id],
    })
    A.status('UPDATE new_arrivals', 'PATCH /homepage new_arrival_ids → 200', res, 200)

    const verify = await api('GET', '/api/admin/homepage')
    A.ok('UPDATE new_arrivals verify', 'new_arrival_ids contains product_a_id',
      verify.data?.new_arrival_ids?.includes(ctx.product_a_id),
      `new_arrival_ids: ${JSON.stringify(verify.data?.new_arrival_ids)}. PATCH not persisting array.`)
  }

  // ── PATCH: occasion_tiles (exactly 8) ────────────────────────────────────────
  {
    const res = await api('PATCH', '/api/admin/homepage', { occasion_tiles: OCCASION_TILES_8 })
    A.status('UPDATE occasion_tiles', 'PATCH /homepage occasion_tiles (8 items) → 200', res, 200)

    const verify = await api('GET', '/api/admin/homepage')
    A.ok('UPDATE occasion_tiles verify', 'occasion_tiles has 8 items',
      verify.data?.occasion_tiles?.length === 8,
      `occasion_tiles length: ${verify.data?.occasion_tiles?.length}. Expected 8.`)
    A.ok('UPDATE occasion_tiles verify', 'first tile label matches',
      verify.data?.occasion_tiles?.[0]?.label === 'Test Occasion 1',
      `Label: "${verify.data?.occasion_tiles?.[0]?.label}". Data not persisting.`)
  }

  // ── PATCH: occasion_tiles wrong count → 422 ──────────────────────────────────
  {
    const sixTiles = OCCASION_TILES_8.slice(0, 6)
    const res = await api('PATCH', '/api/admin/homepage', { occasion_tiles: sixTiles })
    A.status('UPDATE bad tiles', 'PATCH /homepage occasion_tiles with 6 items → 422', res, 422)
    A.hasError('UPDATE bad tiles', 'has error field', res)
  }

  // ── PATCH: invalid hero slide (missing required fields) → 422 ────────────────
  {
    const res = await api('PATCH', '/api/admin/homepage', {
      hero_slides: [{ headline: 'No image or cta' }],  // missing image_url, cta_label, cta_link
    })
    A.status('UPDATE bad hero', 'PATCH /homepage hero without required fields → 422', res, 422)
  }

  // ── RESTORE original ─────────────────────────────────────────────────────────
  if (original) {
    const restorePayload = {}
    if (original.hero_slides       !== undefined) restorePayload.hero_slides       = original.hero_slides
    if (original.collection_banner !== undefined) restorePayload.collection_banner = original.collection_banner
    if (original.new_arrival_ids   !== undefined) restorePayload.new_arrival_ids   = original.new_arrival_ids
    if (original.occasion_tiles    !== undefined) restorePayload.occasion_tiles    = original.occasion_tiles

    if (Object.keys(restorePayload).length) {
      const res = await api('PATCH', '/api/admin/homepage', restorePayload)
      A.ok('RESTORE', 'homepage config restored to original', res.status === 200,
        `Restore PATCH returned ${res.status}. Manual restore may be needed.`)
    }
  }

  return A.results
}
