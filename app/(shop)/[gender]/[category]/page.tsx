import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { createPublicClient } from '@/lib/supabase/public'

import { FilterSidebar } from '@/components/shop/FilterSidebar'
import { ProductGrid } from '@/components/shop/ProductGrid'
import { CategoryListing } from '@/components/shop/CategoryListing'
import { SortBar } from '@/components/shop/SortBar'
import { YouMightAlsoLike } from '@/components/shop/YouMightAlsoLike'
import { MobileFilterDrawer } from '@/components/shop/MobileFilterDrawer'
import type { ProductCardData } from '@/app/(shop)/page'

export const revalidate = 3600

const VALID_GENDERS = ['women', 'men', 'kids', 'unisex']

const PAGE_SIZE = 24

interface PageProps {
  params: { gender: string; category: string }
  searchParams: Record<string, string | string[] | undefined>
}

function getString(val: string | string[] | undefined): string | undefined {
  if (Array.isArray(val)) return val[0]
  return val
}

export async function generateStaticParams() {
  const supabase = createPublicClient()
  const { data } = await supabase.from('categories').select('slug, gender')
  return (data ?? []).map((c) => ({ gender: c.gender ?? 'women', category: c.slug }))
}

async function getCategoryAndProducts(
  genderParam: string,
  slug: string,
  searchParams: Record<string, string | string[] | undefined>
) {
  try {
    const category = await getCategoryBySlug(slug)

    if (!category) return { category: null, products: [], total: 0, relatedProducts: [] }

    // Redirect guard: if this category's gender doesn't match the URL gender, 404
    if (category.gender !== genderParam) return { category: null, products: [], total: 0, relatedProducts: [] }

    const supabase = createPublicClient()
    let query = supabase
      .from('products')
      .select(`
        id, slug, name, fabric, price, compare_price,
        is_new_arrival, is_top_selling, sub_line,
        categories (slug, gender),
        product_images (url, alt, position),
        product_tags (tag)
      `, { count: 'exact' })
      .eq('category_id', category.id)
      .eq('is_active', true)

    const occasion = getString(searchParams.occasion)
    const fabric   = getString(searchParams.fabric)
    const size     = getString(searchParams.size)
    const subLine  = getString(searchParams.sub_line)
    const page     = parseInt(getString(searchParams.page) ?? '1', 10)
    const sort     = getString(searchParams.sort) ?? 'newest'

    if (subLine) query = query.eq('sub_line', subLine)

    if (size) {
      const { data: sizeRows } = await supabase
        .from('product_variants')
        .select('product_id')
        .eq('size', size)
        .gt('stock_qty', 0)
      const sizeIds = [...new Set((sizeRows ?? []).map((r) => r.product_id))]
      if (sizeIds.length === 0) return { category, products: [], total: 0, relatedProducts: [] }
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
      .neq('category_id', category.id)
      .order('created_at', { ascending: false })
      .limit(5)

    const mapProducts = (raw: typeof products, fallbackCategorySlug?: string): ProductCardData[] =>
      (raw ?? []).map((p) => ({
        id: p.id,
        slug: p.slug,
        category_slug:   ((p.categories as unknown) as { slug: string; gender: string } | null)?.slug   ?? fallbackCategorySlug ?? 'sarees',
        category_gender: ((p.categories as unknown) as { slug: string; gender: string } | null)?.gender ?? genderParam,
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

    let mapped = mapProducts(products, category.slug)
    if (occasion) mapped = mapped.filter((p) => p.tags.includes(occasion))
    if (fabric)   mapped = mapped.filter((p) => p.fabric?.toLowerCase().includes(fabric.toLowerCase()))

    return { category, products: mapped, total: count ?? 0, relatedProducts: mapProducts(related) }
  } catch {
    return { category: null, products: [], total: 0, relatedProducts: [] }
  }
}

// cache() deduplicates the DB call between generateMetadata and CategoryPage within the same render
const getCategoryBySlug = cache(async (slug: string) => {
  try {
    const supabase = createPublicClient()
    const { data } = await supabase.from('categories').select('*').eq('slug', slug).single()
    return data
  } catch {
    return null
  }
})

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const category = await getCategoryBySlug(params.category)
  if (!category) return { title: 'Shop', robots: { index: false } }
  return {
    title: `${category.name}`,
    description: `Shop ${category.name} at The Possah — handcrafted luxury Indian fashion. Sarees, lehengas, co-ords and more.`,
    alternates: { canonical: `https://thepossah.com/${params.gender}/${category.slug}` },
    openGraph: {
      title: category.name,
      description: `Shop ${category.name} at The Possah — handcrafted luxury Indian fashion.`,
      ...(category.image_url && { images: [{ url: category.image_url, width: 1200, height: 630, alt: category.name }] }),
    },
  }
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  if (!VALID_GENDERS.includes(params.gender)) notFound()

  const { category, products, total, relatedProducts } =
    await getCategoryAndProducts(params.gender, params.category, searchParams)

  if (!category) notFound()

  const genderLabel = params.gender.charAt(0).toUpperCase() + params.gender.slice(1)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home',       item: 'https://thepossah.com' },
              { '@type': 'ListItem', position: 2, name: genderLabel,  item: `https://thepossah.com/${params.gender}` },
              { '@type': 'ListItem', position: 3, name: category.name, item: `https://thepossah.com/${params.gender}/${category.slug}` },
            ],
          }),
        }}
      />

      {/* Hero banner */}
      <div
        className="relative w-full overflow-hidden flex items-end"
        style={{ minHeight: 'clamp(200px, 30vw, 380px)' }}
        aria-label={`${category.name} category`}
      >
        <Image
          src={category.hero_image_url || 'https://cdn.thepossah.com/ui/placeholder.svg'}
          alt={category.name}
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(15,25,18,0.6) 0%, rgba(15,25,18,0.1) 60%, transparent 100%)' }}
          aria-hidden="true"
        />
        <div className="relative container-site pb-10 z-10">
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
            {category.name.toUpperCase()}
          </h1>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="container-site py-3">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-2" style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
            <li><Link href="/" className="hover:opacity-70">Home</Link></li>
            <li aria-hidden="true">›</li>
            <li><Link href={`/${params.gender}`} className="hover:opacity-70">{genderLabel}</Link></li>
            <li aria-hidden="true">›</li>
            <li aria-current="page" style={{ color: 'var(--color-text)' }}>{category.name}</li>
          </ol>
        </nav>
      </div>

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
              categorySlug={params.category}
            />
          </div>
        </div>
      </div>

      <YouMightAlsoLike products={relatedProducts} heading="You might also like" />
    </>
  )
}
