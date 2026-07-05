/**
 * run.mjs — Orchestrator for the full admin API test suite.
 *
 * Steps:
 *   1. Preflight: check dev server is reachable
 *   2. Seed: insert test data into Supabase via service role
 *   3. Run: execute all 8 test modules in order
 *   4. Report: write markdown report to reports/
 *   5. Cleanup: delete all test rows, restore singletons
 *
 * Usage:
 *   NODE_ENV=development node scripts/admin_test/run.mjs
 *
 * Skip cleanup (keep seed data for manual inspection):
 *   SKIP_CLEANUP=1 NODE_ENV=development node scripts/admin_test/run.mjs
 *
 * Skip seed (data already exists):
 *   SKIP_SEED=1 NODE_ENV=development node scripts/admin_test/run.mjs
 */

import { seed }    from './seed.mjs'
import { cleanup } from './cleanup.mjs'
import { writeReport } from './lib/report.mjs'
import { BASE_URL, api } from './lib/http.mjs'

import { run as runCategories } from './tests/01-categories.mjs'
import { run as runProducts }   from './tests/02-products.mjs'
import { run as runOrders }     from './tests/03-orders.mjs'
import { run as runCoupons }    from './tests/04-coupons.mjs'
import { run as runReviews }    from './tests/05-reviews.mjs'
import { run as runJournal }    from './tests/06-journal.mjs'
import { run as runSettings }   from './tests/07-settings.mjs'
import { run as runHomepage }   from './tests/08-homepage.mjs'
import { run as runMedia }      from './tests/09-media.mjs'

const BOLD  = '\x1b[1m'
const RESET = '\x1b[0m'
const GREEN = '\x1b[32m'
const RED   = '\x1b[31m'
const YELLOW = '\x1b[33m'

// ─── Preflight ────────────────────────────────────────────────────────────────
async function preflight() {
  console.log(`\n${BOLD}Admin API Test Suite${RESET}`)
  console.log(`Server: ${BASE_URL}`)
  console.log(`Mode:   ${process.env.NODE_ENV ?? 'not set'}\n`)

  if (process.env.NODE_ENV !== 'development') {
    console.error(`${RED}FATAL: NODE_ENV is not "development".${RESET}`)
    console.error(`The admin route auth guard only bypasses in development mode.`)
    console.error(`Run with:  NODE_ENV=development node scripts/admin_test/run.mjs\n`)
    process.exit(1)
  }

  process.stdout.write(`Checking dev server at ${BASE_URL}/api/health ... `)
  try {
    const res = await api('GET', '/api/health')
    if (res.status >= 200 && res.status < 500) {
      console.log(`${GREEN}OK (${res.status})${RESET}`)
    } else {
      throw new Error(`status ${res.status}`)
    }
  } catch (err) {
    console.log(`${RED}FAILED${RESET}`)
    console.error(`\n${RED}Dev server not reachable.${RESET} Start it with:`)
    console.error(`  NODE_ENV=development npm run dev\n`)
    console.error(`Error: ${err.message}\n`)
    process.exit(1)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  await preflight()

  // ── Seed ────────────────────────────────────────────────────────────────────
  let ctx = {}
  if (process.env.SKIP_SEED !== '1') {
    try {
      ctx = await seed()
    } catch (err) {
      console.error(`\n${RED}Seed failed: ${err.message}${RESET}`)
      console.error('Cannot run tests without seed data. Fix seed.mjs or check Supabase credentials.\n')
      process.exit(1)
    }
  } else {
    console.log(`${YELLOW}⚠  SKIP_SEED=1 — skipping seed. Tests will use existing data.${RESET}\n`)
  }

  // ── Run tests ────────────────────────────────────────────────────────────────
  const allResults = []
  const modules = [
    ['Categories', runCategories],
    ['Products',   runProducts],
    ['Orders',     runOrders],
    ['Coupons',    runCoupons],
    ['Reviews',    runReviews],
    ['Journal',    runJournal],
    ['Settings',   runSettings],
    ['Homepage',   runHomepage],
    ['Media',      runMedia],
  ]

  for (const [name, runFn] of modules) {
    try {
      const results = await runFn(ctx)
      allResults.push(...results)
    } catch (err) {
      console.error(`\n${RED}[${name}] Unhandled error: ${err.message}${RESET}`)
      console.error(err.stack)
      // Push a synthetic failure so it shows in the report
      allResults.push({
        resource: name,
        action: 'MODULE ERROR',
        label: err.message,
        passed: false,
        expected: 'no error',
        actual: err.message,
        fixHint: 'Unhandled exception in test module. Check stack trace above.',
      })
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  const passed = allResults.filter(r => r.passed).length
  const failed = allResults.filter(r => !r.passed).length
  const total  = allResults.length

  console.log(`\n${'─'.repeat(52)}`)
  console.log(`${BOLD}Results: ${passed}/${total} passed${RESET}`)
  if (failed > 0) {
    console.log(`${RED}${failed} assertion(s) failed.${RESET}`)
  } else {
    console.log(`${GREEN}All assertions passed.${RESET}`)
  }

  // ── Write report ─────────────────────────────────────────────────────────────
  const reportPath = writeReport(allResults)
  console.log(`\nReport: ${reportPath}`)

  // ── Cleanup ──────────────────────────────────────────────────────────────────
  if (process.env.SKIP_CLEANUP !== '1') {
    await cleanup()
  } else {
    console.log(`${YELLOW}⚠  SKIP_CLEANUP=1 — test data left in Supabase.${RESET}`)
    console.log(`   Remove it later:  node scripts/admin_test/cleanup.mjs\n`)
  }

  // Exit with error code if any failures so CI picks it up
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error(`\n${RED}Fatal: ${err.message}${RESET}`)
  process.exit(1)
})
