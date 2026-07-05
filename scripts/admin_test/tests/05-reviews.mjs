import { api } from '../lib/http.mjs'
import { makeAssertCollection, printHeader } from '../lib/assert.mjs'

export async function run(ctx) {
  printHeader('5 / 9  REVIEWS')
  const A = makeAssertCollection('Reviews')

  if (!ctx.review_ids?.length) {
    console.log('  ⚠  No review IDs in context. Seed may have failed. Skipping.\n')
    return A.results
  }

  const [r1, r2, r3] = ctx.review_ids // r1,r2=pending  r3=approved

  // ── LIST all ─────────────────────────────────────────────────────────────────
  {
    const res = await api('GET', '/api/admin/reviews?status=all')
    A.status('LIST all', 'GET /reviews?status=all → 200', res, 200)
    A.isArray('LIST all', 'response is array', res.data)
    if (Array.isArray(res.data)) {
      const found = res.data.find(r => r.id === r1)
      A.ok('LIST all', 'seeded review #1 present', !!found, 'Seed reviews missing. Re-run seed.mjs.')
      A.ok('LIST all', 'reviews include product relation', found && typeof found.product === 'object',
        'Route must join product: .select("*, product:product_id(id,name,slug)").')
    }
  }

  // ── LIST pending ─────────────────────────────────────────────────────────────
  {
    const res = await api('GET', '/api/admin/reviews?status=pending')
    A.status('LIST pending', 'GET /reviews?status=pending → 200', res, 200)
    if (Array.isArray(res.data)) {
      const allPending = res.data.every(r => r.is_approved === false)
      A.ok('LIST pending', 'all results is_approved=false', allPending,
        'Pending filter not working. Check .eq("is_approved", false).')
      A.ok('LIST pending', 'count ≥ 2 pending reviews', res.data.length >= 2,
        'Expected 2 pending reviews from seed. Seed may have set is_approved incorrectly.')
    }
  }

  // ── LIST approved ────────────────────────────────────────────────────────────
  {
    const res = await api('GET', '/api/admin/reviews?status=approved')
    A.status('LIST approved', 'GET /reviews?status=approved → 200', res, 200)
    if (Array.isArray(res.data)) {
      const allApproved = res.data.every(r => r.is_approved === true)
      A.ok('LIST approved', 'all results is_approved=true', allApproved,
        'Approved filter not working. Check .eq("is_approved", true).')
    }
  }

  // ── APPROVE SINGLE ───────────────────────────────────────────────────────────
  {
    const res = await api('PATCH', `/api/admin/reviews/${r1}`, { is_approved: true })
    A.status('APPROVE single', `PATCH /reviews/${r1.slice(0,8)}… is_approved=true → 200`, res, 200)
    A.ok('APPROVE single', 'response ok:true', res.data?.ok === true, 'Must return { ok: true }.')

    // Verify
    const listRes = await api('GET', '/api/admin/reviews?status=approved')
    if (Array.isArray(listRes.data)) {
      A.ok('APPROVE verify', 'review now in approved list', !!listRes.data.find(r => r.id === r1),
        'Review not appearing in approved list. Check PATCH handler update.')
    }
  }

  // ── REJECT SINGLE ────────────────────────────────────────────────────────────
  {
    const res = await api('PATCH', `/api/admin/reviews/${r1}`, { is_approved: false })
    A.status('REJECT single', `PATCH /reviews/${r1.slice(0,8)}… is_approved=false → 200`, res, 200)

    const listRes = await api('GET', '/api/admin/reviews?status=pending')
    if (Array.isArray(listRes.data)) {
      A.ok('REJECT verify', 'review back in pending list', !!listRes.data.find(r => r.id === r1),
        'Review not back in pending list after reject.')
    }
  }

  // ── APPROVE SINGLE: missing is_approved → 422 ────────────────────────────────
  {
    const res = await api('PATCH', `/api/admin/reviews/${r1}`, {})
    A.status('PATCH bad body', 'PATCH /reviews/[id] with empty body → 422', res, 422)
    A.hasError('PATCH bad body', 'has error field', res)
  }

  // ── BULK APPROVE ─────────────────────────────────────────────────────────────
  {
    const res = await api('PATCH', '/api/admin/reviews', { ids: [r1, r2], is_approved: true })
    A.status('BULK APPROVE', 'PATCH /reviews bulk approve → 200', res, 200)
    A.ok('BULK APPROVE', 'response ok:true', res.data?.ok === true, 'Must return { ok: true }.')

    const listRes = await api('GET', '/api/admin/reviews?status=approved')
    if (Array.isArray(listRes.data)) {
      const r1found = listRes.data.find(r => r.id === r1)
      const r2found = listRes.data.find(r => r.id === r2)
      A.ok('BULK APPROVE verify', 'review r1 approved', !!r1found, 'r1 not in approved list after bulk approve.')
      A.ok('BULK APPROVE verify', 'review r2 approved', !!r2found, 'r2 not in approved list after bulk approve.')
    }
  }

  // ── BULK APPROVE: bad payload → 422 ──────────────────────────────────────────
  {
    const res = await api('PATCH', '/api/admin/reviews', { ids: 'not-an-array', is_approved: true })
    A.status('BULK bad payload', 'PATCH /reviews bulk with invalid ids → 422', res, 422)
  }

  // ── DELETE ───────────────────────────────────────────────────────────────────
  {
    const res = await api('DELETE', `/api/admin/reviews/${r3}`)
    A.status('DELETE', `DELETE /reviews/${r3.slice(0,8)}… → 200`, res, 200)
    A.ok('DELETE', 'response ok:true', res.data?.ok === true, 'Must return { ok: true }.')

    // Verify gone
    const listRes = await api('GET', '/api/admin/reviews?status=all')
    if (Array.isArray(listRes.data)) {
      A.ok('DELETE verify', 'deleted review absent from list', !listRes.data.find(r => r.id === r3),
        'Review still in list after DELETE. Hard delete may have failed.')
    }
  }

  return A.results
}
