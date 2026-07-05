import { api } from '../lib/http.mjs'
import { makeAssertCollection, printHeader } from '../lib/assert.mjs'
import { SEEDS } from '../seed.mjs'

export async function run(ctx) {
  printHeader('4 / 9  COUPONS')
  const A = makeAssertCollection('Coupons')
  let createdId = null
  const uniqueCode = `TESTNEW${Date.now().toString().slice(-5)}`

  // ── LIST ─────────────────────────────────────────────────────────────────────
  {
    const res = await api('GET', '/api/admin/coupons')
    A.status('LIST', 'GET /coupons → 200', res, 200)
    A.isArray('LIST', 'response is array', res.data)
    if (Array.isArray(res.data)) {
      const foundA = res.data.find(c => c.code === SEEDS.couponA.code)
      const foundB = res.data.find(c => c.code === SEEDS.couponB.code)
      A.ok('LIST', `${SEEDS.couponA.code} present`, !!foundA, 'Seed couponA missing. Re-run seed.mjs.')
      A.ok('LIST', `${SEEDS.couponB.code} present`, !!foundB, 'Seed couponB missing. Re-run seed.mjs.')
    }
  }

  // ── CREATE ───────────────────────────────────────────────────────────────────
  {
    const body = {
      code: uniqueCode,
      type: 'percent',
      value: 15,
      min_order_value: 500,
      usage_limit: 50,
      expiry_date: '2030-12-31T23:59:59+05:30',
      is_active: true,
    }
    const res = await api('POST', '/api/admin/coupons', body)
    A.status('CREATE', 'POST /coupons → 201', res, 201)
    A.ok('CREATE', 'response has id', typeof res.data?.id === 'string',
      'Route must return { id: uuid } on 201.')
    if (res.data?.id) createdId = res.data.id
  }

  // ── CREATE: dupe code → 409 ───────────────────────────────────────────────────
  {
    const res = await api('POST', '/api/admin/coupons', {
      code: SEEDS.couponA.code,
      type: 'percent', value: 5, min_order_value: 0, is_active: true,
    })
    A.status('CREATE dupe', 'POST /coupons with existing code → 409', res, 409)
    A.hasError('CREATE dupe', 'has error field', res)
  }

  // ── CREATE: invalid type → 422 ────────────────────────────────────────────────
  {
    const res = await api('POST', '/api/admin/coupons', {
      code: 'TESTBADTYPE', type: 'invalid_type', value: 10, min_order_value: 0, is_active: true,
    })
    A.status('CREATE bad type', 'POST /coupons with invalid type → 422', res, 422)
  }

  // ── UPDATE ───────────────────────────────────────────────────────────────────
  if (createdId) {
    const res = await api('PATCH', `/api/admin/coupons/${createdId}`, {
      value: 20,
      is_active: false,
    })
    A.status('UPDATE', `PATCH /coupons/${createdId.slice(0,8)}… → 200`, res, 200)
    A.ok('UPDATE', 'response ok:true', res.data?.ok === true, 'Route must return { ok: true }.')
  }

  // ── UPDATE: verify change reflected in list ───────────────────────────────────
  if (createdId) {
    const res = await api('GET', '/api/admin/coupons')
    if (Array.isArray(res.data)) {
      const updated = res.data.find(c => c.id === createdId)
      A.ok('UPDATE verify', 'value updated to 20', updated?.value === 20 || Number(updated?.value) === 20,
        `Value is ${updated?.value}. PATCH may not have persisted. Check PATCH handler.`)
      A.ok('UPDATE verify', 'is_active updated to false', updated?.is_active === false,
        `is_active is ${updated?.is_active}. PATCH update not persisted.`)
    }
  }

  // ── DELETE ───────────────────────────────────────────────────────────────────
  if (createdId) {
    const res = await api('DELETE', `/api/admin/coupons/${createdId}`)
    A.status('DELETE', `DELETE /coupons/${createdId.slice(0,8)}… → 200`, res, 200)
    A.ok('DELETE', 'response ok:true', res.data?.ok === true, 'Route must return { ok: true }.')
  }

  // ── VERIFY: deleted coupon absent from list ───────────────────────────────────
  if (createdId) {
    const res = await api('GET', '/api/admin/coupons')
    if (Array.isArray(res.data)) {
      A.ok('DELETE verify', 'deleted coupon absent from list', !res.data.find(c => c.id === createdId),
        'Coupon still in list after DELETE. Hard delete may have failed.')
    }
  }

  return A.results
}
