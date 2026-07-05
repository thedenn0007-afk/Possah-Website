import { api } from '../lib/http.mjs'
import { makeAssertCollection, printHeader } from '../lib/assert.mjs'
import { BASE_URL } from '../lib/http.mjs'
import { env } from '../lib/env.mjs'
import { SEEDS } from '../seed.mjs'

export async function run(ctx) {
  printHeader('3 / 9  ORDERS')
  const A = makeAssertCollection('Orders')

  // ── LIST (basic) ─────────────────────────────────────────────────────────────
  {
    const res = await api('GET', '/api/admin/orders')
    A.status('LIST', 'GET /orders → 200', res, 200)
    A.ok('LIST', 'has data array',      Array.isArray(res.data?.data),
      'Route must return { data: [], total, page, per_page, page_count }.')
    A.ok('LIST', 'has total',           typeof res.data?.total      === 'number', 'Missing "total".')
    A.ok('LIST', 'has page_count',      typeof res.data?.page_count === 'number', 'Missing "page_count".')
  }

  // ── LIST: status filter ───────────────────────────────────────────────────────
  {
    const res = await api('GET', '/api/admin/orders?status=unfulfilled')
    A.status('LIST status', 'GET /orders?status=unfulfilled → 200', res, 200)
    if (Array.isArray(res.data?.data)) {
      const allMatch = res.data.data.every(o => o.fulfillment_status === 'unfulfilled')
      A.ok('LIST status', 'all results fulfillment_status=unfulfilled', allMatch,
        'Status filter not applied. Check query: .eq("fulfillment_status", status).')
      const found = res.data.data.find(o => o.order_number === SEEDS.orderA.order_number)
      A.ok('LIST status', 'TEST-001 (unfulfilled) in results', !!found,
        'Seed orderA not found. Re-run seed.mjs.')
    }
  }

  // ── LIST: payment filter ──────────────────────────────────────────────────────
  {
    const res = await api('GET', '/api/admin/orders?payment=paid')
    A.status('LIST payment', 'GET /orders?payment=paid → 200', res, 200)
    if (Array.isArray(res.data?.data)) {
      const allPaid = res.data.data.every(o => o.payment_status === 'paid')
      A.ok('LIST payment', 'all results payment_status=paid', allPaid,
        'Payment filter not applied. Check query: .eq("payment_status", paymentStatus).')
    }
  }

  // ── LIST: search ──────────────────────────────────────────────────────────────
  {
    const res = await api('GET', `/api/admin/orders?q=${SEEDS.orderA.order_number}`)
    A.status('LIST search', `GET /orders?q=TEST-001 → 200`, res, 200)
    if (Array.isArray(res.data?.data)) {
      const found = res.data.data.find(o => o.order_number === SEEDS.orderA.order_number)
      A.ok('LIST search', 'TEST-001 found via q search', !!found,
        'Search not working. Check .or("order_number.ilike.%...%,...")')
    }
  }

  // ── LIST: date range ─────────────────────────────────────────────────────────
  {
    const res = await api('GET', '/api/admin/orders?from=2020-01-01&to=2030-12-31')
    A.status('LIST date', 'GET /orders?from=..&to=.. → 200', res, 200)
    A.ok('LIST date', 'date range returns results', (res.data?.data?.length ?? 0) >= 2,
      'Date filter may be too narrow or seed orders missing.')
  }

  // ── LIST: pagination ─────────────────────────────────────────────────────────
  {
    const res = await api('GET', '/api/admin/orders?page=1&per_page=1')
    A.status('LIST paginate', 'GET /orders?per_page=1 → 200', res, 200)
    A.ok('LIST paginate', 'returns ≤ 1 order', (res.data?.data?.length ?? 0) <= 1,
      'per_page limit not enforced. Check .range(offset, offset + perPage - 1).')
  }

  // ── CSV EXPORT ────────────────────────────────────────────────────────────────
  {
    const url  = `${BASE_URL}/api/admin/orders?format=csv`
    const adminToken = env.ADMIN_TEST_SECRET
    const res2 = await fetch(url, {
      headers: adminToken ? { 'X-Admin-Test-Token': adminToken } : {},
    })
    const ct   = res2.headers.get('content-type') ?? ''
    const cd   = res2.headers.get('content-disposition') ?? ''
    const body = await res2.text()
    const lines = body.split('\n').filter(l => l.trim())

    A.ok('CSV EXPORT', 'content-type is text/csv', ct.includes('text/csv'),
      `Expected text/csv, got "${ct}". Check Response headers in CSV branch.`)
    A.ok('CSV EXPORT', 'content-disposition has filename', cd.includes('possah-orders'),
      `Disposition: "${cd}". Check filename in Response headers.`)
    A.ok('CSV EXPORT', 'CSV header row present', body.startsWith('Order #') || body.includes('Order #'),
      'First CSV line must be the header row.')
    A.ok('CSV EXPORT', 'CSV has ≥ 2 lines (header + data)', lines.length >= 2,
      `Got ${lines.length} line(s). Check that seed orders are being returned.`)
  }

  // ── GET SINGLE ───────────────────────────────────────────────────────────────
  if (ctx.order_a_id) {
    const res = await api('GET', `/api/admin/orders/${ctx.order_a_id}`)
    A.status('GET', `GET /orders/${ctx.order_a_id.slice(0,8)}… → 200`, res, 200)
    A.field('GET', 'order_number matches', res.data, 'order_number', SEEDS.orderA.order_number)
    A.field('GET', 'customer_email matches', res.data, 'customer_email', SEEDS.orderA.customer_email)
  }

  // ── GET SINGLE: not found ─────────────────────────────────────────────────────
  {
    const res = await api('GET', '/api/admin/orders/00000000-0000-0000-0000-000000000099')
    A.status('GET 404', 'GET /orders/non-existent → 404', res, 404)
    A.hasError('GET 404', 'has error field', res)
  }

  // ── UPDATE: fulfillment status ────────────────────────────────────────────────
  if (ctx.order_a_id) {
    const res = await api('PATCH', `/api/admin/orders/${ctx.order_a_id}`, {
      fulfillment_status: 'processing',
    })
    A.status('UPDATE fulfillment', 'PATCH fulfillment_status → 200', res, 200)

    const verify = await api('GET', `/api/admin/orders/${ctx.order_a_id}`)
    A.field('UPDATE fulfillment verify', 'fulfillment_status updated', verify.data, 'fulfillment_status', 'processing')
  }

  // ── UPDATE: tracking + courier ────────────────────────────────────────────────
  if (ctx.order_a_id) {
    const res = await api('PATCH', `/api/admin/orders/${ctx.order_a_id}`, {
      tracking_number: 'TRACK123456789',
      courier: 'Blue Dart',
      internal_notes: 'Test note — do not ship',
    })
    A.status('UPDATE tracking', 'PATCH tracking_number + courier → 200', res, 200)

    const verify = await api('GET', `/api/admin/orders/${ctx.order_a_id}`)
    A.field('UPDATE tracking verify', 'tracking_number saved', verify.data, 'tracking_number', 'TRACK123456789')
    A.field('UPDATE tracking verify', 'courier saved',         verify.data, 'courier',          'Blue Dart')
    A.field('UPDATE tracking verify', 'internal_notes saved',  verify.data, 'internal_notes',   'Test note — do not ship')
  }

  // ── UPDATE: invalid fulfillment status → 422 ─────────────────────────────────
  if (ctx.order_a_id) {
    const res = await api('PATCH', `/api/admin/orders/${ctx.order_a_id}`, {
      fulfillment_status: 'INVALID_STATUS',
    })
    A.status('UPDATE bad status', 'PATCH invalid fulfillment_status → 422', res, 422)
    A.hasError('UPDATE bad status', 'has error field', res)
  }

  return A.results
}
