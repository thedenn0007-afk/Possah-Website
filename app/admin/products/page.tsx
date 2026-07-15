import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { SubLineEnum } from '@/lib/validations/admin-products'
import { ProductsTable, type ProductRow } from './ProductsTable'

export const metadata: Metadata = { title: 'Products' }
export const dynamic = 'force-dynamic'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CategoryRow {
  id: string
  name: string
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getCategories(): Promise<CategoryRow[]> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase.from('categories').select('id, name').order('name')
    return (data ?? []) as CategoryRow[]
  } catch {
    return []
  }
}

const SORT_OPTIONS = [
  { value: 'newest',     label: 'Newest first' },
  { value: 'name_asc',   label: 'Name A–Z' },
  { value: 'price_asc',  label: 'Price low–high' },
  { value: 'price_desc', label: 'Price high–low' },
]

async function getProducts(search: string, page: number, category: string, sort: string, subLine: string): Promise<{
  products: ProductRow[]
  total: number
}> {
  const perPage = 20
  const offset  = (page - 1) * perPage

  try {
    const supabase = createAdminClient()

    let query = supabase
      .from('products')
      .select(`
        id, name, slug, price, compare_price, is_active, is_new_arrival, created_at, category_id,
        categories:category_id ( name, slug ),
        product_images ( url, position ),
        product_variants ( stock_qty )
      `, { count: 'exact' })
      .range(offset, offset + perPage - 1)

    if (search)   query = query.ilike('name', `%${search}%`)
    if (category) query = query.eq('category_id', category)
    if (subLine)  query = query.eq('sub_line', subLine)

    switch (sort) {
      case 'name_asc':   query = query.order('name', { ascending: true }); break
      case 'price_asc':  query = query.order('price', { ascending: true }); break
      case 'price_desc': query = query.order('price', { ascending: false }); break
      default:           query = query.order('created_at', { ascending: false })
    }

    const { data, count, error } = await query
    if (error) {
      console.error('[Admin Products list]', error)
      return { products: [], total: 0 }
    }

    const products: ProductRow[] = (data ?? []).map((p) => {
      const cat = Array.isArray(p.categories) ? p.categories[0] : p.categories
      const imgs = (p.product_images as { url: string; position: number }[] | null) ?? []
      imgs.sort((a, b) => a.position - b.position)
      const variants = (p.product_variants as { stock_qty: number }[] | null) ?? []
      const totalStock = variants.reduce((sum, v) => sum + (v.stock_qty ?? 0), 0)
      return {
        id:            p.id,
        name:          p.name,
        slug:          p.slug,
        price:         p.price,
        compare_price: p.compare_price,
        stock_qty:     totalStock,
        is_active:     p.is_active,
        is_new_arrival: p.is_new_arrival,
        created_at:    p.created_at,
        category_id:   p.category_id ?? null,
        category_name: (cat as { name?: string; slug?: string } | null)?.name ?? null,
        category_slug: (cat as { name?: string; slug?: string } | null)?.slug ?? null,
        thumbnail:     imgs[0]?.url ?? null,
      }
    })

    return { products, total: count ?? 0 }
  } catch (err) {
    console.error('[Admin Products list] unexpected:', err)
    return { products: [], total: 0 }
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: { search?: string; page?: string; category?: string; sort?: string; sub_line?: string }
}) {
  const search   = searchParams.search ?? ''
  const page     = Math.max(1, parseInt(searchParams.page ?? '1', 10))
  const category = searchParams.category ?? ''
  const sort     = searchParams.sort ?? 'newest'
  const subLine  = searchParams.sub_line ?? ''

  const [{ products, total }, categories] = await Promise.all([
    getProducts(search, page, category, sort, subLine),
    getCategories(),
  ])
  const totalPages = Math.ceil(total / 20)

  return (
    <div className="p-6 md:p-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '22px',
              fontWeight: '600',
              color: 'var(--color-text)',
            }}
          >
            Products
          </h1>
          <p
            className="mt-0.5"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              color: 'var(--color-text-muted)',
            }}
          >
            {total} {total === 1 ? 'product' : 'products'} total
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 hover:opacity-90 transition-opacity"
          style={{
            backgroundColor: 'var(--color-green)',
            color: 'var(--color-bg)',
            borderRadius: 'var(--radius-btn)',
            fontFamily: 'var(--font-body)',
            fontSize: '12px',
            fontWeight: '500',
            letterSpacing: '0.06em',
            textDecoration: 'none',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M6 1v10M1 6h10" />
          </svg>
          Add Product
        </Link>
      </div>

      {/* Search + filter bar */}
      <form method="GET" className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[160px] max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="var(--color-text-muted)"
            strokeWidth="1.4"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="6.5" cy="6.5" r="4.5" />
            <path d="M11 11l3.5 3.5" />
          </svg>
          <input
            type="search"
            name="search"
            defaultValue={search}
            placeholder="Search products…"
            className="w-full pl-9 pr-3 h-10"
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-input)',
              backgroundColor: 'var(--color-white)',
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              color: 'var(--color-text)',
            }}
          />
        </div>

        {/* Category filter */}
        <select
          name="category"
          defaultValue={category}
          className="h-10 px-3"
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-input)',
            backgroundColor: 'var(--color-white)',
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: 'var(--color-text)',
            minWidth: 150,
          }}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          name="sort"
          defaultValue={sort}
          className="h-10 px-3"
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-input)',
            backgroundColor: 'var(--color-white)',
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: 'var(--color-text)',
            minWidth: 150,
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Sub-line filter */}
        <select
          name="sub_line"
          defaultValue={subLine}
          className="h-10 px-3"
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-input)',
            backgroundColor: 'var(--color-white)',
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: 'var(--color-text)',
            minWidth: 150,
          }}
        >
          <option value="">All collections</option>
          {SubLineEnum.options.map((sl) => (
            <option key={sl} value={sl}>{sl}</option>
          ))}
        </select>

        <button
          type="submit"
          className="px-4 h-10 hover:opacity-90 transition-opacity"
          style={{
            backgroundColor: 'var(--color-green)',
            color: 'var(--color-bg)',
            borderRadius: 'var(--radius-btn)',
            fontFamily: 'var(--font-body)',
            fontSize: '12px',
            fontWeight: '500',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Apply
        </button>
        {(search || category || sort !== 'newest' || subLine) && (
          <Link
            href="/admin/products"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              color: 'var(--color-text-muted)',
              textDecoration: 'none',
            }}
            className="hover:underline"
          >
            Clear filters
          </Link>
        )}
      </form>

      {/* Table */}
      {products.length === 0 ? (
        <EmptyState search={search} category={category} />
      ) : (
        <>
          <ProductsTable products={products} />

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination current={page} total={totalPages} search={search} category={category} sort={sort} subLine={subLine} />
          )}
        </>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState({ search, category }: { search: string; category: string }) {
  const filtered = search || category
  return (
    <div
      className="flex flex-col items-center justify-center py-20 rounded"
      style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-white)' }}
    >
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--color-border)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 5S9 12 20 12 32 5 32 5L38 8.5 33 14v22H7V14L2 8.5z" />
      </svg>
      <p className="mt-4" style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-muted)' }}>
        {filtered ? 'No products match the current filters.' : 'No products yet.'}
      </p>
      {filtered ? (
        <Link
          href="/admin/products"
          className="mt-4 hover:underline"
          style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)', textDecoration: 'none' }}
        >
          Clear filters
        </Link>
      ) : (
        <Link
          href="/admin/products/new"
          className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 hover:opacity-90 transition-opacity"
          style={{
            backgroundColor: 'var(--color-green)',
            color: 'var(--color-bg)',
            borderRadius: 'var(--radius-btn)',
            fontFamily: 'var(--font-body)',
            fontSize: '12px',
            fontWeight: '500',
            textDecoration: 'none',
          }}
        >
          Add your first product
        </Link>
      )}
    </div>
  )
}

function Pagination({ current, total, search, category, sort, subLine }: { current: number; total: number; search: string; category: string; sort: string; subLine: string }) {
  const qs = [
    search   ? `search=${encodeURIComponent(search)}`   : '',
    category ? `category=${encodeURIComponent(category)}` : '',
    sort && sort !== 'newest' ? `sort=${encodeURIComponent(sort)}` : '',
    subLine  ? `sub_line=${encodeURIComponent(subLine)}` : '',
  ].filter(Boolean).join('&')
  const base = `/admin/products?${qs ? qs + '&' : ''}`
  return (
    <div className="flex items-center justify-between mt-5 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
        Page {current} of {total}
      </span>
      <div className="flex items-center gap-2">
        {current > 1 && (
          <Link
            href={`${base}page=${current - 1}`}
            className="px-4 py-2 hover:opacity-80"
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-btn)',
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              color: 'var(--color-text)',
              textDecoration: 'none',
            }}
          >
            ← Previous
          </Link>
        )}
        {current < total && (
          <Link
            href={`${base}page=${current + 1}`}
            className="px-4 py-2 hover:opacity-80"
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-btn)',
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              color: 'var(--color-text)',
              textDecoration: 'none',
            }}
          >
            Next →
          </Link>
        )}
      </div>
    </div>
  )
}
