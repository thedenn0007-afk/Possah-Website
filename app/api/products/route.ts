import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/public'
import type { ProductCardData } from '@/app/(shop)/page'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 24

function getString(val: string | null): string | undefined {
  return val ?? undefined
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const categorySlug = getString(searchParams.get('category'))
    const occasion     = getString(searchParams.get('occasion'))
    const fabric       = getString(searchParams.get('fabric'))
    const size         = getString(searchParams.get('size'))
    const subLine      = getString(searchParams.get('sub_line'))
    const sort         = getString(searchParams.get('sort')) ?? 'newest'

    // FIX (audit U-1): clamp page. parseInt can yield NaN ("abc") or a
    // negative/zero value, which previously produced a negative .range() and a
    // confusing response (total reported but zero products). Always >= 1.
    const pageRaw = parseInt(searchParams.get('page') ?? '1', 10)
    const page    = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1

    // Optional: filter by is_top_selling (used by best-sellers page)
    const topSellingOnly = searchParams.get('top_selling') === 'true'
    const newInOnly      = searchParams.get('new_in') === 'true'

    const supabase = createPublicClient()

    let categoryId: string | null = null
    if (categorySlug) {
      const { data: category } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', categorySlug)
        .single()
      if (!category) {
        return NextResponse.json({ products: [], total: 0 }, { status: 200 })
      }
      categoryId = category.id
    }

    // FIX (audit P-2): occasion + size are properties of child tables
    // (product_tags / product_variants). Resolve them to a set of product ids
    // and apply via .in('id', ...) BEFORE pagination, so the `count` returned
    // reflects the filtered result and pagination math is correct. Previously
    // occasion (and fabric) were filtered in JS AFTER the page was fetched,
    // which silently broke pagination (a page could come back partially empty
    // while `total` reported the unfiltered count).
    const idSets: string[][] = []

    if (size) {
      const { data: sizeRows } = await supabase
        .from('product_variants')
        .select('product_id')
        .eq('size', size)
        .gt('stock_qty', 0)
      idSets.push([...new Set((sizeRows ?? []).map((r) => r.product_id))])
    }

    if (occasion) {
      const { data: tagRows } = await supabase
        .from('product_tags')
        .select('product_id')
        .eq('tag', occasion)
      idSets.push([...new Set((tagRows ?? []).map((r) => r.product_id))])
    }

    // Intersect every child-table filter into one id set (null = no such filter).
    const idFilter: string[] | null =
      idSets.length === 0
        ? null
        : idSets.reduce((acc, set) => acc.filter((id) => set.includes(id)))

    // If a child-table filter was requested but matched nothing, short-circuit.
    if (idFilter !== null && idFilter.length === 0) {
      return NextResponse.json({ products: [], total: 0 }, { status: 200 })
    }

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

    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }

    if (topSellingOnly) {
      query = query.eq('is_top_selling', true)
    }
    if (newInOnly) {
      query = query.eq('is_new_arrival', true)
    }

    if (subLine) {
      query = query.eq('sub_line', subLine)
    }

    // fabric is a column on products — filter in-DB via the parameterized
    // .ilike() builder (NOT string-concatenated into .or(), so no injection).
    if (fabric) {
      query = query.ilike('fabric', `%${fabric}%`)
    }

    if (idFilter !== null) {
      query = query.in('id', idFilter)
    }

    switch (sort) {
      case 'price-asc':   query = query.order('price', { ascending: true });  break
      case 'price-desc':  query = query.order('price', { ascending: false }); break
      case 'bestselling': query = query.eq('is_top_selling', true).order('created_at', { ascending: false }); break
      default:            query = query.order('created_at', { ascending: false })
    }

    const from = (page - 1) * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1
    query = query.range(from, to)

    const { data: products, count } = await query

    const mapped: ProductCardData[] = (products ?? []).map((p) => ({
      id: p.id,
      slug: p.slug,
      category_slug:   ((p.categories as unknown) as { slug: string; gender: string } | null)?.slug   ?? categorySlug ?? 'sarees',
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

    return NextResponse.json({ products: mapped, total: count ?? 0 }, { status: 200 })
  } catch (err) {
    console.error('[/api/products]', err)
    return NextResponse.json({ products: [], total: 0 }, { status: 500 })
  }
}
