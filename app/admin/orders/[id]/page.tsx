import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/admin'
import { PaymentBadge, FulfillmentBadge } from '@/components/admin/FulfillmentBadge'
import { formatPrice } from '@/lib/utils'
import { OrderDetailClient, type HistoryRow } from './OrderDetailClient'

export const dynamic = 'force-dynamic'

type FulfillmentStatus = 'unfulfilled' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
type PaymentStatus     = 'pending' | 'paid' | 'failed' | 'refunded'

interface ShippingAddress {
  line1:   string
  line2?:  string
  city:    string
  state:   string
  pincode: string
  country: string
}

interface LineItem {
  product_id:   string
  name:         string
  image_url:    string | null
  colour:       string | null
  size:         string | null
  qty:          number
  unit_price:   number
  line_total:   number
}

interface OrderDetail {
  id:                  string
  order_number:        string
  customer_name:       string
  customer_email:      string
  customer_phone:      string
  shipping_address:    ShippingAddress
  line_items:          LineItem[]
  subtotal:            number
  shipping_fee:        number
  discount_amount:     number
  coupon_code:         string | null
  tax:                 number
  total:               number
  payment_status:      PaymentStatus
  fulfillment_status:  FulfillmentStatus
  payment_gateway:     string | null
  gateway_order_id:    string | null
  gateway_payment_id:  string | null
  tracking_number:     string | null
  courier:             string | null
  internal_notes:      string | null
  is_gift:             boolean
  gift_message:        string | null
  created_at:          string
}

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return { title: `Order ${params.id.slice(0, 8).toUpperCase()}` }
}

async function getOrder(id: string): Promise<OrderDetail | null> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) return null

    return {
      ...data,
      shipping_address: data.shipping_address as ShippingAddress,
      line_items:       (data.line_items as LineItem[]) ?? [],
    }
  } catch {
    return null
  }
}

async function getHistory(orderId: string): Promise<HistoryRow[]> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('order_status_history')
      .select('id, from_status, to_status, changed_by, note, changed_at')
      .eq('order_id', orderId)
      .order('changed_at', { ascending: false })
    return (data as HistoryRow[]) ?? []
  } catch {
    return []
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day:    '2-digit',
    month:  'long',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

const sectionStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  border:          '1px solid var(--color-border)',
  borderRadius:    '10px',
  padding:         '20px',
}

const sectionHeadStyle: React.CSSProperties = {
  fontFamily:    'var(--font-body)',
  fontSize:      '13px',
  fontWeight:    '600',
  color:         'var(--color-text)',
  marginBottom:  '14px',
  letterSpacing: '0.02em',
}

const metaLabel: React.CSSProperties = {
  fontFamily:    'var(--font-body)',
  fontSize:      '11px',
  fontWeight:    '600',
  color:         'var(--color-text-muted)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  marginBottom:  '2px',
}

const metaValue: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize:   '13px',
  color:      'var(--color-text)',
}

function MetaField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p style={metaLabel}>{label}</p>
      <p style={metaValue}>{value}</p>
    </div>
  )
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const [order, history] = await Promise.all([
    getOrder(params.id),
    getHistory(params.id),
  ])

  if (!order) notFound()

  const addr = order.shipping_address

  return (
    <div className="p-6 md:p-8">

      {/* Back + Header */}
      <div className="mb-6">
        <Link
          href="/admin/orders"
          style={{
            fontFamily:     'var(--font-body)',
            fontSize:       '12px',
            color:          'var(--color-text-muted)',
            textDecoration: 'none',
            display:        'inline-flex',
            alignItems:     'center',
            gap:            '4px',
            marginBottom:   '10px',
          }}
        >
          ← Back to Orders
        </Link>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontFamily: 'var(--font-body)', fontSize: '22px', fontWeight: '600', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              Order #{order.order_number}
              {order.is_gift && (
                <span title="Gift order" style={{ fontSize: '18px' }}>🎁</span>
              )}
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {formatDate(order.created_at)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
            <PaymentBadge status={order.payment_status} />
            <FulfillmentBadge status={order.fulfillment_status} />
          </div>
        </div>
      </div>

      {/* Responsive two-column layout — single col on mobile, sidebar on lg+ */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">

        {/* RIGHT COLUMN — stays first in DOM (customer → address → controls read naturally
            for screen readers/tab order), but visually pushed below Line Items on narrow
            screens via `order-2` so the order contents are the first thing you see, not
            the last, when the two-column `lg:` layout collapses to one column. */}
        <div className="order-2 lg:order-none lg:col-start-2 flex flex-col gap-4">

          {/* Customer */}
          <div style={sectionStyle}>
            <p style={sectionHeadStyle}>Customer</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <MetaField label="Name"  value={order.customer_name} />
              <MetaField label="Email" value={
                <a
                  href={`mailto:${order.customer_email}`}
                  style={{ color: 'var(--color-gold)', textDecoration: 'none', fontFamily: 'var(--font-body)', fontSize: '13px' }}
                >
                  {order.customer_email}
                </a>
              } />
              <MetaField label="Phone" value={
                <a
                  href={`tel:${order.customer_phone}`}
                  style={{ color: 'var(--color-gold)', textDecoration: 'none', fontFamily: 'var(--font-body)', fontSize: '13px' }}
                >
                  {order.customer_phone}
                </a>
              } />
            </div>
          </div>

          {/* Shipping Address */}
          <div style={sectionStyle}>
            <p style={sectionHeadStyle}>Shipping Address</p>
            {addr ? (
              <address
                style={{
                  fontStyle:  'normal',
                  fontFamily: 'var(--font-body)',
                  fontSize:   '13px',
                  color:      'var(--color-text)',
                  lineHeight: '1.7',
                }}
              >
                {addr.line1}<br />
                {addr.line2 && <>{addr.line2}<br /></>}
                {addr.city}, {addr.state} – {addr.pincode}<br />
                {addr.country}
              </address>
            ) : (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                No address on record
              </p>
            )}
          </div>

          {/* Mutable fields: fulfilment, tracking, notes, resend, history */}
          <OrderDetailClient
            orderId={order.id}
            customerEmail={order.customer_email}
            fulfillmentStatus={order.fulfillment_status}
            trackingNumber={order.tracking_number}
            courier={order.courier}
            internalNotes={order.internal_notes}
            history={history}
          />

        </div>

        {/* LEFT COLUMN — placed in col 1 on desktop via explicit col-start; on narrow
            screens `order-1` brings Line Items above the customer/controls stack below. */}
        <div className="order-1 lg:order-none lg:col-start-1 flex flex-col gap-4">

          {/* Line Items */}
          <div style={sectionStyle}>
            <p style={sectionHeadStyle}>Line Items</p>
            {order.line_items.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                No items found
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {order.line_items.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display:       'flex',
                      alignItems:    'flex-start',
                      gap:           '14px',
                      padding:       '14px 0',
                      borderBottom:  i < order.line_items.length - 1 ? '1px solid var(--color-border)' : 'none',
                      flexWrap:      'wrap',
                    }}
                  >
                    {/* Thumbnail */}
                    <div
                      style={{
                        width:        '56px',
                        height:       '70px',
                        borderRadius: '6px',
                        overflow:     'hidden',
                        backgroundColor: 'var(--color-border)',
                        flexShrink:   0,
                        position:     'relative',
                      }}
                    >
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt={item.name ?? ''}
                          fill
                          style={{ objectFit: 'cover' }}
                          sizes="56px"
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '500', color: 'var(--color-text)', marginBottom: '4px' }}>
                        {item.name}
                      </p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {item.colour && (
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                            {item.colour}
                          </span>
                        )}
                        {item.size && (
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                            {item.size}
                          </span>
                        )}
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          Qty: {item.qty}
                        </span>
                      </div>
                    </div>

                    {/* Line total */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: '600', color: 'var(--color-text)' }}>
                        {formatPrice(item.line_total)}
                      </p>
                      {item.qty > 1 && (
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          {formatPrice(item.unit_price)} each
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Order totals */}
            <div
              style={{
                marginTop:     '16px',
                paddingTop:    '16px',
                borderTop:     '1px solid var(--color-border)',
                display:       'flex',
                flexDirection: 'column',
                gap:           '7px',
              }}
            >
              {[
                { label: 'Subtotal',  value: formatPrice(order.subtotal) },
                { label: 'Shipping',  value: order.shipping_fee === 0 ? 'Free' : formatPrice(order.shipping_fee) },
                ...(order.discount_amount > 0
                  ? [{ label: `Discount${order.coupon_code ? ` (${order.coupon_code})` : ''}`, value: `-${formatPrice(order.discount_amount)}` }]
                  : []),
                ...(order.tax > 0 ? [{ label: 'Tax', value: formatPrice(order.tax) }] : []),
              ].map((row) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    {row.label}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-text)' }}>
                    {row.value}
                  </span>
                </div>
              ))}
              <div
                style={{
                  display:        'flex',
                  justifyContent: 'space-between',
                  paddingTop:     '10px',
                  borderTop:      '1px solid var(--color-border)',
                  marginTop:      '3px',
                }}
              >
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600', color: 'var(--color-text)' }}>
                  Total
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: '700', color: 'var(--color-text)' }}>
                  {formatPrice(order.total)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div style={sectionStyle}>
            <p style={sectionHeadStyle}>Payment</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
              <MetaField label="Status" value={<PaymentBadge status={order.payment_status} />} />
              {order.payment_gateway && (
                <MetaField label="Gateway" value={order.payment_gateway} />
              )}
              {order.gateway_order_id && (
                <MetaField
                  label="Gateway Order ID"
                  value={
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                      {order.gateway_order_id}
                    </span>
                  }
                />
              )}
              {order.gateway_payment_id && (
                <MetaField
                  label="Payment ID"
                  value={
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                      {order.gateway_payment_id}
                    </span>
                  }
                />
              )}
            </div>
            <p
              style={{
                marginTop:       '14px',
                padding:         '10px 12px',
                backgroundColor: '#FEF9EC',
                border:          '1px solid #FDE68A',
                borderRadius:    '6px',
                fontFamily:      'var(--font-body)',
                fontSize:        '11px',
                color:           '#92400E',
              }}
            >
              Payment status is controlled by Razorpay webhook only. Never edit manually.
            </p>
          </div>

          {/* Gift Message */}
          {order.is_gift && (
            <div style={sectionStyle}>
              <p style={sectionHeadStyle}>🎁 Gift Message</p>
              {order.gift_message ? (
                <p
                  style={{
                    fontFamily:      'var(--font-body)',
                    fontSize:        '14px',
                    color:           'var(--color-text)',
                    lineHeight:      '1.6',
                    fontStyle:       'italic',
                    padding:         '12px 16px',
                    backgroundColor: 'var(--color-bg)',
                    borderRadius:    '6px',
                    border:          '1px solid var(--color-border)',
                  }}
                >
                  &ldquo;{order.gift_message}&rdquo;
                </p>
              ) : (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  No message provided.
                </p>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
