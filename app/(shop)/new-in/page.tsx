import type { Metadata } from 'next'
import Link from 'next/link'
import { createPublicClient } from '@/lib/supabase/public'
import { FilterSidebar } from '@/components/shop/FilterSidebar'
import { ProductGrid } from '@/components/shop/ProductGrid'
import { CategoryListing } from '@/components/shop/CategoryListing'
import { SortBar } from '@/components/shop/SortBar'
import { YouMightAlsoLike } from '@/components/shop/YouMightAlsoLike'
import { MobileFilterDrawer } from '@/components/shop/MobileFilterDrawer'
import type { ProductCardData } from '@/app/(shop)/page'

const PAGE_SIZE = 24

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>
}

function getString(val: string | string[] | undefined): string | undefined {
  if (Array.isArray(val)) return val[0]
  return val
}

async function getNewArrivals(searchParams: Record<string, string | string[] | undefined>) {
  try {
    const supabase = createPublicClient()

    const occasion = getString(searchParams.occasion)
    const fabric   = getString(searchParams.fabric)
    const size     = getString(searchParams.size)
    const subLine  = getString(searchParams.sub_line)
    const page     = parseInt(getString(searchParams.page) ?? '1', 10)
    const sort     = getString(searchParams.sort) ?? 'newest'

    let query = supabase
      .from('products')
      .select(`
        id, slug, name, fabric, price, compare_price,
        is_new_arrival, is_top_selling, sub_line,
        categories (slug, gender),
        product_images (url, alt, position),
        product_tags (tag)
      `, { count: 'exact' })
      .eq('is_new_arrival', true)
      .eq('is_active', true)

    if (subLine) query = query.eq('sub_line', subLine)

    if (size) {
      const { data: sizeRows } = await supabase
        .from('product_variants')
        .select('product_id')
        .eq('size', size)
        .gt('stock_qty', 0)
      const sizeIds = [...new Set((sizeRows ?? []).map((r) => r.product_id))]
      if (sizeIds.length === 0) return { products: [], total: 0, relatedProducts: [] }
      query = query.in('id', sizeIds)
    }

    switch (sort) {
      case 'price-asc':   query = query.order('price', { ascending: true });  break
      case 'price-desc':  query = query.order('price', { ascending: false }); break
      case 'bestselling': query = query.eq('is_top_selling', true).order('created_at', { ascending: false }); break
      default:            query = query.order('created_at', { ascending: false })
    }

    const from = (page - 1) * PAGE_SIZE
    query = query.range(from, from + PAGE_SIZE - 1)

    const { data: products, count } = await query

    const { data: related } = await supabase
      .from('products')
      .select(`
        id, slug, name, fabric, price, compare_price,
        is_new_arrival, is_top_selling, sub_line,
        categories (slug, gender),
        product_images (url, alt, position),
        product_tags (tag)
      `)
      .eq('is_active', true)
      .eq('is_new_arrival', false)
      .order('created_at', { ascending: false })
      .limit(5)

    const mapProducts = (raw: typeof products): ProductCardData[] =>
      (raw ?? []).map((p) => ({
        id: p.id,
        slug: p.slug,
        category_slug:   ((p.categories as unknown) as { slug: string; gender: string } | null)?.slug   ?? 'sarees',
        category_gender: ((p.categories as unknown) as { slug: string; gender: string } | null)?.gender ?? 'women',
        name: p.name,
        fabric: p.fabric,
        price: p.price,
        compare_price: p.compare_price ?? null,
        is_new_arrival: p.is_new_arrival,
        is_top_selling: p.is_top_selling,
        images: ((p.product_images as { url: string; alt: string | null; position: number }[]) ?? [])
          .sort((a, b) => a.position - b.position)
          .map((img) => ({ url: img.url, alt: img.alt })),
        tags: ((p.product_tags as { tag: string }[]) ?? []).map((t) => t.tag),
        sub_line: p.sub_line ?? null,
      }))

    let mapped = mapProducts(products)
    if (occasion) mapped = mapped.filter((p) => p.tags.includes(occasion))
    if (fabric)   mapped = mapped.filter((p) => p.fabric?.toLowerCase().includes(fabric.toLowerCase()))

    return { products: mapped, total: count ?? 0, relatedProducts: mapProducts(related) }
  } catch {
    return { products: [], total: 0, relatedProducts: [] }
  }
}

export const metadata: Metadata = {
  title: 'New In',
  description: 'The latest arrivals from The Possah Atelier — handcrafted sarees, lehengas, co-ords and more.',
  alternates: { canonical: 'https://thepossah.com/new-in' },
}

const HOMEPAGE_SINGLETON = '00000000-0000-0000-0000-000000000001'

async function getPageHero(): Promise<string | null> {
  try {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('homepage_config')
      .select('page_heroes')
      .eq('id', HOMEPAGE_SINGLETON)
      .maybeSingle()
    return (data?.page_heroes as { new_in_hero?: string | null } | null)?.new_in_hero ?? null
  } catch { return null }
}

export default async function NewInPage({ searchParams }: PageProps) {
  const [{ products, total, relatedProducts }, heroImage] = await Promise.all([
    getNewArrivals(searchParams),
    getPageHero(),
  ])

  const page    = parseInt(getString(searchParams.page) ?? '1', 10)
  const hasMore = page * PAGE_SIZE < total

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home',   item: 'https://thepossah.com' },
              { '@type': 'ListItem', position: 2, name: 'New In', item: 'https://thepossah.com/new-in' },
            ],
          }),
        }}
      />

      {/* Hero */}
      <div
        className="relative w-full flex items-end overflow-hidden"
        style={{
          minHeight: 'clamp(180px, 28vw, 360px)',
          background: heroImage ? undefined : 'linear-gradient(135deg, var(--color-green) 0%, #0d2619 100%)',
        }}
        aria-label="New In"
      >
        {/* Background image (when configured) or decorative grain */}
        {heroImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImage} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover object-center" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(15,25,18,0.65) 0%, transparent 60%)' }} aria-hidden="true" />
          </>
        ) : (
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")', backgroundSize: '200px' }}
            aria-hidden="true"
          />
        )}
        <div className="relative container-site pb-10 z-10">
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.25em',
              color: 'rgba(255,255,255,0.55)',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}
          >
            The Possah Atelier
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(36px, 6vw, 80px)',
              fontWeight: '400',
              color: 'var(--color-white)',
              lineHeight: 1,
              letterSpacing: '0.04em',
            }}
          >
            NEW IN
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'clamp(13px, 1.4vw, 15px)',
              color: 'rgba(255,255,255,0.65)',
              marginTop: '12px',
              fontStyle: 'italic',
            }}
          >
            Fresh from the atelier — pieces that just arrived.
          </p>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="container-site py-3">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-2" style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
            <li><Link href="/" className="hover:opacity-70">Home</Link></li>
            <li aria-hidden="true">›</li>
            <li aria-current="page" style={{ color: 'var(--color-text)' }}>New In</li>
          </ol>
        </nav>
      </div>

      {/* Main */}
      <div className="container-site pb-20">
        <MobileFilterDrawer />
        <div className="flex gap-10 lg:gap-14">
          <div className="hidden md:block sticky top-[104px] self-start">
            <FilterSidebar />
          </div>
          <div className="flex-1 min-w-0">
            <SortBar resultCount={total} showFilterButton />
            <CategoryListing
              key={[
                getString(searchParams.occasion),
                getString(searchParams.fabric),
                getString(searchParams.size),
                getString(searchParams.sub_line),
                getString(searchParams.sort) ?? 'newest',
              ].join('|')}
              initialProducts={products}
              total={total}
              categorySlug=""
              topSellingOnly={false}
              newInOnly
            />
          </div>
        </div>
      </div>

      <YouMightAlsoLike products={relatedProducts} heading="You might also like" />
    </>
  )
}
