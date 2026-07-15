import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { createPublicClient } from '@/lib/supabase/public'
import { FilterSidebar } from '@/components/shop/FilterSidebar'
import { SortBar } from '@/components/shop/SortBar'
import { YouMightAlsoLike } from '@/components/shop/YouMightAlsoLike'
import { MobileFilterDrawer } from '@/components/shop/MobileFilterDrawer'
import { CategoryListing } from '@/components/shop/CategoryListing'
import type { ProductCardData } from '@/app/(shop)/page'

export const revalidate = 3600

const PAGE_SIZE = 24

export const metadata: Metadata = {
  title: 'Best Sellers',
  description: 'Our most-loved pieces — the ones customers come back for. Shop The Possah\'s best-selling sarees, lehengas, co-ords and more.',
  alternates: { canonical: 'https://thepossah.com/best-sellers' },
}

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>
}

function getString(val: string | string[] | undefined): string | undefined {
  if (Array.isArray(val)) return val[0]
  return val
}

async function getBestSellers(searchParams: Record<string, string | string[] | undefined>) {
  try {
    const supabase = createPublicClient()

    const occasion = getString(searchParams.occasion)
    const fabric   = getString(searchParams.fabric)
    const size     = getString(searchParams.size)
    const subLine  = getString(searchParams.sub_line)
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
      .eq('is_active', true)
      .eq('is_top_selling', true)

    if (subLine) query = query.eq('sub_line', subLine)

    if (size) {
      const { data: sizeRows } = await supabase
        .from('product_variants')
        .select('product_id')
        .eq('size', size)
        .gt('stock_qty', 0)
      const sizeIds = [...new Set((sizeRows ?? []).map((r) => r.product_id))]
      if (sizeIds.length === 0) {
        return { products: [], total: 0, relatedProducts: [] }
      }
      query = query.in('id', sizeIds)
    }

    switch (sort) {
      case 'price-asc':  query = query.order('price', { ascending: true });  break
      case 'price-desc': query = query.order('price', { ascending: false }); break
      default:           query = query.order('created_at', { ascending: false })
    }

    query = query.range(0, PAGE_SIZE - 1)

    const { data: products, count } = await query

    const mapProducts = (raw: typeof products, fallbackSlug = 'sarees'): ProductCardData[] =>
      (raw ?? []).map((p) => ({
        id: p.id,
        slug: p.slug,
        category_slug:   ((p.categories as unknown) as { slug: string; gender: string } | null)?.slug   ?? fallbackSlug,
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

    // Related: non-bestseller products
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
      .eq('is_top_selling', false)
      .order('created_at', { ascending: false })
      .limit(5)

    return { products: mapped, total: count ?? 0, relatedProducts: mapProducts(related) }
  } catch {
    return { products: [], total: 0, relatedProducts: [] }
  }
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
    return (data?.page_heroes as { best_sellers_hero?: string | null } | null)?.best_sellers_hero ?? null
  } catch { return null }
}

export default async function BestSellersPage({ searchParams }: PageProps) {
  const [{ products, total, relatedProducts }, heroImage] = await Promise.all([
    getBestSellers(searchParams),
    getPageHero(),
  ])

  return (
    <>
      {/* Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://thepossah.com' },
              { '@type': 'ListItem', position: 2, name: 'Best Sellers', item: 'https://thepossah.com/best-sellers' },
            ],
          }),
        }}
      />

      {/* Hero image (when configured in admin) */}
      {heroImage && (
        <div className="relative w-full overflow-hidden flex items-end" style={{ minHeight: 'clamp(220px, 32vw, 440px)' }}>
          <Image src={heroImage} alt="Best Sellers" fill priority className="object-cover object-center" sizes="100vw" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(15,25,18,0.6) 0%, transparent 60%)' }} aria-hidden="true" />
          <div className="relative container-site pb-12 z-10">
            <p className="section-label" style={{ color: 'rgba(244,236,223,0.7)', marginBottom: 8 }}>THE POSSAH</p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 6vw, 80px)', fontWeight: '400', color: 'var(--color-white)', lineHeight: 1 }}>
              Best Sellers
            </h1>
          </div>
        </div>
      )}

      {/* Page header */}
      <div
        className="container-site pt-12 pb-8"
        style={{ borderBottom: '1px solid var(--color-border)', display: heroImage ? 'none' : undefined }}
      >
        <p className="section-label mb-3">THE POSSAH</p>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(36px, 6vw, 72px)',
            fontWeight: '400',
            color: 'var(--color-text)',
            letterSpacing: '-0.01em',
            lineHeight: 1,
          }}
        >
          Best Sellers
        </h1>
        <p
          className="mt-3 max-w-md"
          style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: 1.6 }}
        >
          Our most-loved pieces — the ones customers return for, season after season.
        </p>
      </div>

      {/* Breadcrumb */}
      <div className="container-site py-3">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-2" style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
            <li><Link href="/" className="hover:opacity-70">Home</Link></li>
            <li aria-hidden="true">›</li>
            <li aria-current="page" style={{ color: 'var(--color-text)' }}>Best Sellers</li>
          </ol>
        </nav>
      </div>

      {/* Main content */}
      <div className="container-site pb-20">
        <MobileFilterDrawer />

        <div className="flex gap-10 lg:gap-14">
          {/* Sidebar */}
          <div className="hidden md:block sticky top-[104px] self-start">
            <FilterSidebar />
          </div>

          {/* Product area */}
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
              topSellingOnly
            />
          </div>
        </div>
      </div>

      <YouMightAlsoLike products={relatedProducts} heading="You might also like" />
    </>
  )
}
