import { NextResponse, NextRequest } from 'next/server'
import { requireAdminAuth } from '@/lib/admin-auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { ProductCreateSchema, type ProductCreateInput } from '@/lib/validations/admin-products'

// ─── GET /api/admin/products ─ list all products ──────────────────────────────

export async function GET(request: NextRequest) {
  if (!await requireAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const search    = searchParams.get('search') ?? ''
    const page      = parseInt(searchParams.get('page') ?? '1', 10)
    const perPage   = parseInt(searchParams.get('per_page') ?? '20', 10)
    const isActive  = searchParams.get('active')

    const supabase = createAdminClient()
    const offset = (page - 1) * perPage

    let query = supabase
      .from('products')
      .select(`
        id,
        slug,
        name,
        sub_line,
        price,
        compare_price,
        stock_qty,
        is_active,
        is_new_arrival,
        is_featured,
        created_at,
        categories:category_id (
          id,
          name
        ),
        product_images (
          url,
          alt,
          position
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    if (isActive === 'true') query = query.eq('is_active', true)
    if (isActive === 'false') query = query.eq('is_active', false)

    const { data, count, error } = await query

    if (error) {
      console.error('[Admin Products GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      products: data ?? [],
      total:    count ?? 0,
      page,
      per_page: perPage,
    })
  } catch (err) {
    console.error('[Admin Products GET] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST /api/admin/products ─ create product ───────────────────────────────

export async function POST(request: NextRequest) {
  if (!await requireAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = ProductCreateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
        { status: 422 }
      )
    }

    const data = parsed.data
    const supabase = createAdminClient()

    // Check slug uniqueness
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('slug', data.slug)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Validation failed', issues: { slug: ['Slug already exists — choose a unique slug.'] } },
        { status: 422 }
      )
    }

    // Insert product
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        slug:               data.slug,
        name:               data.name,
        description:        data.description ?? null,
        sub_line:           data.sub_line ?? null,
        category_id:        data.category_id ?? null,
        price:              data.price,
        compare_price:      data.compare_price ?? null,
        fabric:             data.fabric ?? null,
        craft_description:  data.craft_description ?? null,
        care_instructions:  data.care_instructions ?? null,
        drape_guide:        data.drape_guide ?? null,
        craft_story_title:  data.craft_story_title ?? null,
        craft_story_body:   data.craft_story_body ?? null,
        craft_story_image:  data.craft_story_image ?? null,
        audio_url:          data.audio_url ?? null,
        meta_title:         data.meta_title ?? null,
        meta_description:   data.meta_description ?? null,
        is_new_arrival:     data.is_new_arrival,
        is_top_selling:     data.is_top_selling,
        is_featured:        data.is_featured,
        is_festive:         data.is_festive,
        is_bridal:          data.is_bridal,
        is_active:          data.is_active,
        stock_qty:          data.variants.reduce((sum, v) => sum + v.stock_qty, 0),
      })
      .select('id')
      .single()

    if (productError || !product) {
      console.error('[Admin Products POST] product insert:', productError)
      return NextResponse.json({ error: productError?.message ?? 'Insert failed' }, { status: 500 })
    }

    const productId = product.id

    // Insert tags
    if (data.tags.length > 0) {
      const { error: tagError } = await supabase
        .from('product_tags')
        .insert(data.tags.map((tag) => ({ product_id: productId, tag })))

      if (tagError) {
        console.error('[Admin Products POST] tag insert:', tagError)
        // Non-fatal — product is created, tags can be re-added on edit
      }
    }

    // Insert variants
    if (data.variants.length > 0) {
      const { error: variantError } = await supabase
        .from('product_variants')
        .insert(data.variants.map((v) => ({
          product_id:  productId,
          colour_name: v.colour_name,
          colour_hex:  v.colour_hex,
          size:        v.size,
          stock_qty:   v.stock_qty,
        })))

      if (variantError) {
        console.error('[Admin Products POST] variant insert:', variantError)
      }
    }

    // Insert images
    if (data.images.length > 0) {
      const { error: imgError } = await supabase
        .from('product_images')
        .insert(data.images.map((img, idx) => ({
          product_id: productId,
          url:        img.url,
          alt:        img.alt ?? null,
          position:   img.position ?? idx,
        })))

      if (imgError) {
        console.error('[Admin Products POST] image insert:', imgError)
      }
    }

    // Bust ISR so new product appears on shop immediately
    revalidatePath('/', 'layout')
    revalidatePath('/festive')
    revalidatePath('/bridal')
    if (data.category_id) {
      // Fetch category slug for targeted revalidation
      const { data: cat } = await supabase
        .from('categories')
        .select('slug, gender')
        .eq('id', data.category_id)
        .single()
      if (cat?.slug) {
        const g = cat.gender ?? 'women'
        revalidatePath(`/${g}/${cat.slug}`)
        revalidatePath(`/${g}/${cat.slug}/${data.slug}`)
      }
    }

    return NextResponse.json({ id: productId, slug: data.slug }, { status: 201 })
  } catch (err) {
    console.error('[Admin Products POST] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── PATCH /api/admin/products ─ bulk activate/deactivate ────────────────────
// Mirrors the bulk-approve pattern in /api/admin/reviews (PATCH): a flat
// {ids, is_active} body applied to every matching row in one update. Reuses
// the existing soft-delete semantics — never a hard delete, same as the
// single-product DELETE handler below.

const BulkUpdateSchema = z.object({
  ids:       z.array(z.string().uuid()).min(1),
  is_active: z.boolean(),
})

export async function PATCH(request: NextRequest) {
  if (!await requireAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body   = await request.json()
    const parsed = BulkUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
        { status: 422 }
      )
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('products')
      .update({ is_active: parsed.data.is_active })
      .in('id', parsed.data.ids)

    if (error) {
      console.error('[Admin Products PATCH bulk]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Bust ISR so activated/deactivated products reflect on the shop immediately
    revalidatePath('/', 'layout')

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Admin Products PATCH bulk] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
