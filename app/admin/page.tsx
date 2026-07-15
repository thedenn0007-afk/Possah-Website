import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminStatCard } from '@/components/admin/AdminStatCard'
import { FulfillmentBadge, PaymentBadge } from '@/components/admin/FulfillmentBadge'
import { formatPrice } from '@/lib/utils'

export const metadata: Metadata = { title: 'Dashboard' }

// Revalidate every 60s — admin dashboard stats don't need real-time
export const revalidate = 60

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardStats {
  ordersToday: number          // PAID orders today only — excludes abandoned attempts
  revenueToday: number         // PAID revenue today only
  pendingOrders: number        // Unfulfilled or processing orders (admin action queue)
  totalProducts: number
  lowStockItems: number
  abandonedLast7d: number      // Pending/failed orders in last 7 days — checkout intent that did not pay
  abandonedValueLast7d: number // Stored total of those attempts
  activeCoupons: number        // Active coupon codes available right now
}

interface RecentOrder {
  id: string
  order_number: string
  customer_name: string
  customer_email: string
  total: number
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded'
  fulfillment_status: 'unfulfilled' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  created_at: string
  item_count: number
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getDashboardData(): Promise<{
  stats: DashboardStats
  recentOrders: RecentOrder[]
}> {
  const fallback = {
    stats: {
      ordersToday: 0,
      revenueToday: 0,
      pendingOrders: 0,
      totalProducts: 0,
      lowStockItems: 0,
      abandonedLast7d: 0,
      abandonedValueLast7d: 0,
      activeCoupons: 0,
    },
    recentOrders: [],
  }

  try {
    const supabase = createAdminClient()

    // Today's date range (IST-aware via UTC comparison is fine for a dashboard)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayISO = todayStart.toISOString()

    // 7-day window for the abandoned-checkout metric
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Parallel queries
    const [
      todayOrdersRes,
      pendingRes,
      productsRes,
      lowStockRes,
      recentOrdersRes,
      abandonedRes,
      activeCouponsRes,
    ] = await Promise.all([
      // Orders + revenue today — PAID ONLY. Unpaid attempts (pending/failed)
      // never roll into revenue; that's tracked in `abandonedLast7d` instead.
      supabase
        .from('orders')
        .select('total')
        .eq('payment_status', 'paid')
        .gte('created_at', todayISO),

      // Unfulfilled + processing orders (pending admin action — paid only,
      // because pending-payment orders are abandoned checkouts, not admin work).
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('payment_status', 'paid')
        .in('fulfillment_status', ['unfulfilled', 'processing']),

      // Total active products
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true),

      // Low stock products (1–3 units)
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .gt('stock_qty', 0)
        .lte('stock_qty', 3)
        .eq('is_active', true),

      // Last 15 orders (all statuses — admin sees everything in the recent list)
      supabase
        .from('orders')
        .select('id, order_number, customer_name, customer_email, total, payment_status, fulfillment_status, created_at, line_items')
        .order('created_at', { ascending: false })
        .limit(15),

      // Abandoned checkouts in the last 7 days — pending/failed payment, not
      // explicitly cancelled. Surfaces the "people tried to pay but didn't"
      // signal that used to be drowned in the revenue number.
      supabase
        .from('orders')
        .select('total')
        .in('payment_status', ['pending', 'failed'])
        .neq('fulfillment_status', 'cancelled')
        .gte('created_at', sevenDaysAgo),

      // Active coupon codes right now
      supabase
        .from('coupons')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true),
    ])

    const todayOrders = todayOrdersRes.data ?? []
    const ordersToday   = todayOrders.length
    const revenueToday  = todayOrders.reduce((sum, o) => sum + (o.total ?? 0), 0)
    const pendingOrders = pendingRes.count ?? 0
    const totalProducts = productsRes.count ?? 0
    const lowStockItems = lowStockRes.count ?? 0
    const abandonedOrders = abandonedRes.data ?? []
    const abandonedLast7d = abandonedOrders.length
    const abandonedValueLast7d = abandonedOrders.reduce((sum, o) => sum + (o.total ?? 0), 0)
    const activeCoupons = activeCouponsRes.count ?? 0

    const recentOrders: RecentOrder[] = (recentOrdersRes.data ?? []).map((o) => {
      // line_items is a JSON array — count items
      let itemCount = 1
      try {
        const items = Array.isArray(o.line_items) ? o.line_items : JSON.parse(String(o.line_items))
        itemCount = items.length
      } catch {
        itemCount = 1
      }
      return {
        id:                 o.id,
        order_number:       o.order_number,
        customer_name:      o.customer_name,
        customer_email:     o.customer_email,
        total:              o.total,
        payment_status:     o.payment_status as RecentOrder['payment_status'],
        fulfillment_status: o.fulfillment_status as RecentOrder['fulfillment_status'],
        created_at:         o.created_at,
        item_count:         itemCount,
      }
    })

    return {
      stats: {
        ordersToday,
        revenueToday,
        pendingOrders,
        totalProducts,
        lowStockItems,
        abandonedLast7d,
        abandonedValueLast7d,
        activeCoupons,
      },
      recentOrders,
    }
  } catch (err) {
    // In dev with missing Supabase keys, degrade gracefully
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Admin Dashboard] Supabase unavailable — showing zero stats:', err)
    }
    return fallback
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminDashboardPage() {
  const { stats, recentOrders } = await getDashboardData()

  return (
    <div className="p-6 md:p-8 max-w-[1280px] mx-auto">

      {/* Header */}
      <div className="mb-8">
        <h1
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '22px',
            fontWeight: '600',
            color: 'var(--color-text)',
            letterSpacing: '-0.01em',
          }}
        >
          Dashboard
        </h1>
        <p
          className="mt-1"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: 'var(--color-text-muted)',
          }}
        >
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-10">
        <AdminStatCard
          label="Orders Today"
          value={stats.ordersToday}
          subLabel="Paid only"
          accent="default"
          icon={<IconPackage />}
        />
        <AdminStatCard
          label="Revenue Today"
          value={formatPrice(stats.revenueToday)}
          subLabel="Paid only"
          accent="success"
          icon={<IconRupee />}
        />
        <AdminStatCard
          label="Pending Orders"
          value={stats.pendingOrders}
          subLabel="Unfulfilled + Processing"
          accent={stats.pendingOrders > 5 ? 'warning' : 'default'}
          icon={<IconClock />}
        />
        <AdminStatCard
          label="Abandoned (7d)"
          value={stats.abandonedLast7d}
          subLabel={`${formatPrice(stats.abandonedValueLast7d)} not converted`}
          accent={stats.abandonedLast7d > 0 ? 'warning' : 'default'}
          icon={<IconCart />}
        />
        <AdminStatCard
          label="Total Products"
          value={stats.totalProducts}
          subLabel="Active listings"
          accent="default"
          icon={<IconShirt />}
        />
        <AdminStatCard
          label="Low Stock"
          value={stats.lowStockItems}
          subLabel="1–3 units remaining"
          accent={stats.lowStockItems > 0 ? 'warning' : 'default'}
          icon={<IconAlert />}
        />
        <AdminStatCard
          label="Active Coupons"
          value={stats.activeCoupons}
          subLabel="Live discount codes"
          accent="default"
          icon={<IconTag />}
        />
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap items-center gap-3 mb-10">
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
          }}
        >
          Quick Actions
        </span>
        <QuickLink href="/admin/products/new" label="+ Add Product" />
        <QuickLink href="/admin/categories" label="+ Add Category" />
        <QuickLink href="/admin/homepage" label="Configure Homepage" />
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 hover:opacity-80 transition-opacity"
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-btn)',
            fontFamily: 'var(--font-body)',
            fontSize: '12px',
            fontWeight: '500',
            color: 'var(--color-text-muted)',
            textDecoration: 'none',
          }}
        >
          View Site
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M2 8L8 2M5 2h3v3" />
          </svg>
        </a>
      </div>

      {/* Recent orders */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '15px',
              fontWeight: '600',
              color: 'var(--color-text)',
            }}
          >
            Recent Orders
          </h2>
          <Link
            href="/admin/orders"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              color: 'var(--color-green)',
              textDecoration: 'none',
              fontWeight: '500',
            }}
            className="hover:underline"
          >
            View all →
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto rounded" style={{ border: '1px solid var(--color-border)' }}>
            <table className="w-full min-w-[640px]" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-white)', borderBottom: '1px solid var(--color-border)' }}>
                  {['Order #', 'Customer', 'Items', 'Total', 'Payment', 'Fulfillment', 'Date', ''].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '9px',
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                        color: 'var(--color-text-muted)',
                        fontWeight: '500',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order, idx) => (
                  <tr
                    key={order.id}
                    style={{
                      backgroundColor: idx % 2 === 0 ? 'var(--color-white)' : 'rgba(244,236,223,0.35)',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          color: 'var(--color-text)',
                          fontWeight: '500',
                        }}
                      >
                        {order.order_number}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text)', fontWeight: '500' }}>
                        {order.customer_name}
                      </p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {order.customer_email}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text)' }}>
                        {order.item_count} {order.item_count === 1 ? 'piece' : 'pieces'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '500', color: 'var(--color-text)' }}>
                        {formatPrice(order.total)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <PaymentBadge status={order.payment_status} />
                    </td>
                    <td className="px-4 py-3">
                      <FulfillmentBadge status={order.fulfillment_status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        {new Date(order.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: '12px',
                          color: 'var(--color-green)',
                          textDecoration: 'none',
                          fontWeight: '500',
                        }}
                        className="hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center px-4 py-2 hover:opacity-90 transition-opacity"
      style={{
        backgroundColor: 'var(--color-green)',
        color: 'var(--color-bg)',
        borderRadius: 'var(--radius-btn)',
        fontFamily: 'var(--font-body)',
        fontSize: '12px',
        fontWeight: '500',
        letterSpacing: '0.04em',
        textDecoration: 'none',
      }}
    >
      {label}
    </Link>
  )
}

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 rounded"
      style={{
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-white)',
      }}
    >
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--color-border)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="8" width="32" height="26" rx="2" />
        <path d="M4 16h32M14 8v8M26 8v8" />
      </svg>
      <p className="mt-4" style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-muted)' }}>
        No orders yet.
      </p>
    </div>
  )
}

// ─── Inline icons for stat cards ─────────────────────────────────────────────

function IconPackage() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 5.5L9 2l6.5 3.5v8L9 17l-6.5-3.5V5.5z" />
      <path d="M9 2v15M5.5 4L9 6l3.5-2" />
    </svg>
  )
}

function IconRupee() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
      <path d="M5 4h8M5 8h8M5 8c0 3.5 3 6 4 7" />
      <path d="M5 8h4a3 3 0 000-4" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
      <circle cx="9" cy="9" r="7" />
      <path d="M9 5v4l2.5 2.5" />
    </svg>
  )
}

function IconShirt() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6.5 2S7 4.5 9 4.5 11.5 2 11.5 2L16 5l-2.5 2.5v9h-9v-9L2 5z" />
    </svg>
  )
}

function IconAlert() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
      <path d="M9 3L17 15H1L9 3z" />
      <path d="M9 8v4M9 13.5v.5" />
    </svg>
  )
}

function IconCart() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 3h2l1.5 9.5a1.5 1.5 0 0 0 1.5 1.3h6a1.5 1.5 0 0 0 1.5-1.2L16 6H5" />
      <circle cx="7" cy="16" r="0.9" />
      <circle cx="13" cy="16" r="0.9" />
    </svg>
  )
}

function IconTag() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.5 2H3a1 1 0 0 0-1 1v6.5a1 1 0 0 0 .3.7l7 7a1 1 0 0 0 1.4 0l6-6a1 1 0 0 0 0-1.4l-7-7A1 1 0 0 0 9.5 2z" />
      <circle cx="5.5" cy="5.5" r="1" />
    </svg>
  )
}
