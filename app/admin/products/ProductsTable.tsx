'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { formatPrice } from '@/lib/utils'
import { ProductListActions } from './ProductListActions'

export interface ProductRow {
  id: string
  name: string
  slug: string
  price: number
  compare_price: number | null
  stock_qty: number
  is_active: boolean
  is_new_arrival: boolean
  created_at: string
  category_name: string | null
  category_slug: string | null
  category_id: string | null
  thumbnail: string | null
}

interface ProductsTableProps {
  products: ProductRow[]
}

const bulkBtnBase: React.CSSProperties = {
  padding:      '6px 14px',
  borderRadius: '6px',
  border:       'none',
  fontFamily:   'var(--font-body)',
  fontSize:     '12px',
  fontWeight:   '500',
  cursor:       'pointer',
}

export function ProductsTable({ products: initialProducts }: ProductsTableProps) {
  const router = useRouter()
  const [products, setProducts] = useState(initialProducts)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError]       = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Resync local copy whenever the server sends fresh data — new search/
  // filter/page navigation, or our own router.refresh() after a bulk action.
  useEffect(() => {
    setProducts(initialProducts)
    setSelected(new Set())
  }, [initialProducts])

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected((prev) =>
      prev.size === products.length ? new Set() : new Set(products.map((p) => p.id))
    )
  }

  function bulkUpdate(isActive: boolean) {
    if (selected.size === 0) return
    setError(null)
    startTransition(async () => {
      const res = await fetch('/api/admin/products', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ids: Array.from(selected), is_active: isActive }),
      })
      if (res.ok) {
        setProducts((prev) => prev.map((p) => (selected.has(p.id) ? { ...p, is_active: isActive } : p)))
        setSelected(new Set())
        router.refresh()
      } else {
        const json = await res.json().catch(() => ({}))
        setError((json as { error?: string }).error ?? 'Bulk update failed.')
      }
    })
  }

  const allSelected = products.length > 0 && selected.size === products.length

  return (
    <>
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div
          className="flex items-center gap-3 mb-4 flex-wrap"
          style={{
            padding:         '10px 16px',
            backgroundColor: '#EFF6FF',
            border:          '1px solid #BFDBFE',
            borderRadius:    '8px',
          }}
        >
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: '#1D4ED8' }}>
            {selected.size} selected
          </span>
          <button
            type="button"
            onClick={() => bulkUpdate(false)}
            disabled={isPending}
            style={{ ...bulkBtnBase, backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5', opacity: isPending ? 0.6 : 1 }}
          >
            Deactivate Selected
          </button>
          <button
            type="button"
            onClick={() => bulkUpdate(true)}
            disabled={isPending}
            style={{ ...bulkBtnBase, backgroundColor: '#16A34A', color: '#fff', opacity: isPending ? 0.6 : 1 }}
          >
            Activate Selected
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            disabled={isPending}
            style={{ ...bulkBtnBase, backgroundColor: 'transparent', color: '#1D4ED8' }}
          >
            Clear
          </button>
          {error && (
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: '#DC2626' }}>
              {error}
            </span>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full min-w-[700px]" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-white)', borderBottom: '1px solid var(--color-border)' }}>
              <th className="px-4 py-3" style={{ width: 36 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  aria-label="Select all products on this page"
                  style={{ accentColor: 'var(--color-green)', width: 15, height: 15, cursor: 'pointer' }}
                />
              </th>
              {['', 'Product', 'Category', 'Price', 'Stock', 'Status', 'Actions'].map((h, i) => (
                <th
                  key={i}
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
            {products.map((product, idx) => (
              <tr
                key={product.id}
                style={{
                  backgroundColor: idx % 2 === 0 ? 'var(--color-white)' : 'rgba(244,236,223,0.35)',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                {/* Select checkbox */}
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(product.id)}
                    onChange={() => toggleSelect(product.id)}
                    aria-label={`Select ${product.name}`}
                    style={{ accentColor: 'var(--color-green)', width: 15, height: 15, cursor: 'pointer' }}
                  />
                </td>

                {/* Thumbnail */}
                <td className="px-4 py-3 w-14">
                  <div
                    className="relative overflow-hidden rounded-sm flex-shrink-0"
                    style={{ width: 40, height: 50 }}
                  >
                    {product.thumbnail ? (
                      <Image
                        src={product.thumbnail}
                        alt={product.name}
                        fill
                        className="object-cover object-top"
                        sizes="40px"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ backgroundColor: 'var(--color-border)' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.2" aria-hidden="true">
                          <rect x="1" y="2" width="14" height="12" rx="1" />
                          <circle cx="5.5" cy="6" r="1.2" />
                          <path d="M1 10l4-3 3 2.5 2-1.5 5 4" />
                        </svg>
                      </div>
                    )}
                  </div>
                </td>

                {/* Name + slug */}
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/products/${product.id}/edit`}
                    className="hover:underline block"
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '13px',
                      fontWeight: '500',
                      color: 'var(--color-text)',
                      textDecoration: 'none',
                    }}
                  >
                    {product.name}
                    {product.is_new_arrival && (
                      <span
                        className="ml-2 px-1.5 py-0.5 rounded-sm"
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '8px',
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          backgroundColor: 'var(--color-orange)',
                          color: 'var(--color-white)',
                        }}
                      >
                        New
                      </span>
                    )}
                  </Link>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {product.slug}
                  </p>
                </td>

                {/* Category */}
                <td className="px-4 py-3">
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    {product.category_name ?? '—'}
                  </span>
                </td>

                {/* Price */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '500', color: 'var(--color-text)' }}>
                    {formatPrice(product.price)}
                  </span>
                  {product.compare_price && product.compare_price > product.price && (
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)', textDecoration: 'line-through', marginLeft: 6 }}>
                      {formatPrice(product.compare_price)}
                    </span>
                  )}
                </td>

                {/* Stock */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: product.stock_qty === 0
                        ? 'var(--color-error)'
                        : product.stock_qty <= 3
                        ? '#D97706'
                        : 'var(--color-text)',
                      fontWeight: product.stock_qty <= 3 ? '600' : '400',
                    }}
                  >
                    {product.stock_qty === 0 ? 'Out of stock' : `${product.stock_qty} units`}
                  </span>
                </td>

                {/* Status + toggle — keyed on is_active so a bulk action
                    (which changes is_active without remounting by id alone)
                    forces this to re-initialize with the fresh value. */}
                <td className="px-4 py-3">
                  <ProductListActions
                    key={`${product.id}:${product.is_active}`}
                    productId={product.id}
                    isActive={product.is_active}
                  />
                </td>

                {/* Actions */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/admin/products/${product.id}/edit`}
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '12px',
                        color: 'var(--color-green)',
                        textDecoration: 'none',
                        fontWeight: '500',
                      }}
                      className="hover:underline"
                    >
                      Edit
                    </Link>
                    {product.category_slug && (
                      <Link
                        href={`/women/${product.category_slug}/${product.slug}`}
                        target="_blank"
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: '12px',
                          color: 'var(--color-text-muted)',
                          textDecoration: 'none',
                        }}
                        className="hover:underline"
                      >
                        View ↗
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
