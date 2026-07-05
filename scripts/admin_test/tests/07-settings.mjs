import { api } from '../lib/http.mjs'
import { makeAssertCollection, printHeader } from '../lib/assert.mjs'

export async function run(_ctx) {
  printHeader('7 / 9  SETTINGS (singleton)')
  const A = makeAssertCollection('Settings')

  // ── GET (fetch original so we can restore) ────────────────────────────────────
  let original = null
  {
    const res = await api('GET', '/api/admin/settings')
    A.status('GET', 'GET /settings → 200', res, 200)
    A.ok('GET', 'has announcement_text field',       'announcement_text' in (res.data ?? {}),
      'Response missing announcement_text. Check GET handler and store_settings table.')
    A.ok('GET', 'has free_shipping_threshold field', 'free_shipping_threshold' in (res.data ?? {}),
      'Response missing free_shipping_threshold.')
    A.ok('GET', 'has seo_title field',               'seo_title' in (res.data ?? {}),
      'Response missing seo_title.')
    if (res.data) original = res.data
  }

  // ── PATCH: update fields ──────────────────────────────────────────────────────
  {
    const res = await api('PATCH', '/api/admin/settings', {
      announcement_text: 'TEST ANNOUNCEMENT — DO NOT SHIP',
      store_email: 'test@possah.test',
      free_shipping_threshold: 9999,
    })
    A.status('UPDATE', 'PATCH /settings → 200', res, 200)
    A.ok('UPDATE', 'response ok:true', res.data?.ok === true, 'Must return { ok: true }.')
  }

  // ── VERIFY: changes persisted ─────────────────────────────────────────────────
  {
    const res = await api('GET', '/api/admin/settings')
    A.field('UPDATE verify', 'announcement_text updated',       res.data, 'announcement_text',       'TEST ANNOUNCEMENT — DO NOT SHIP')
    A.field('UPDATE verify', 'store_email updated',             res.data, 'store_email',             'test@possah.test')
    A.ok('UPDATE verify',    'free_shipping_threshold updated',
      Number(res.data?.free_shipping_threshold) === 9999,
      `Got ${res.data?.free_shipping_threshold}. PATCH may not have saved numeric field correctly.`)
  }

  // ── PATCH: invalid email → 422 ────────────────────────────────────────────────
  {
    const res = await api('PATCH', '/api/admin/settings', { store_email: 'not-a-valid-email' })
    A.status('UPDATE bad email', 'PATCH /settings with invalid email → 422', res, 422)
    A.hasError('UPDATE bad email', 'has error field', res)
  }

  // ── PATCH: overly long seo_title → 422 ───────────────────────────────────────
  {
    const res = await api('PATCH', '/api/admin/settings', { seo_title: 'X'.repeat(80) })
    A.status('UPDATE long seo_title', 'PATCH /settings seo_title > 70 chars → 422', res, 422)
  }

  // ── RESTORE original settings ─────────────────────────────────────────────────
  if (original) {
    const restorePayload = {
      announcement_text:       original.announcement_text       ?? '',
      store_email:             original.store_email             ?? '',
      whatsapp_number:         original.whatsapp_number         ?? '',
      free_shipping_threshold: original.free_shipping_threshold ?? 5000,
      express_delivery_fee:    original.express_delivery_fee    ?? 499,
      seo_title:               original.seo_title               ?? 'The Possah — Luxury Indian Fashion',
      seo_description:         original.seo_description         ?? '',
      seo_og_image:            original.seo_og_image            ?? null,
    }
    const res = await api('PATCH', '/api/admin/settings', restorePayload)
    A.ok('RESTORE', 'settings restored to original values', res.status === 200,
      `Restore PATCH returned ${res.status}. Manual restore needed.`)
  }

  return A.results
}
