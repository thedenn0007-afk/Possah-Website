import type { Metadata } from 'next'
import { createPublicClient } from '@/lib/supabase/public'
import { HeroSlider } from '@/components/homepage/HeroSlider'
import { CategorySplit } from '@/components/homepage/CategorySplit'
import { CategoryCircles } from '@/components/homepage/CategoryCircles'
import { NewArrivals } from '@/components/homepage/NewArrivals'
import { CollectionBanner } from '@/components/homepage/CollectionBanner'
import { OccasionGrid } from '@/components/homepage/OccasionGrid'
import { MtmCta } from '@/components/homepage/MtmCta'
import { parseJson } from '@/lib/utils'
import { Reveal } from '@/components/ui/Reveal'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'The Possah — she wants what she wants.',
  description:
    'Luxury Indian fashion. Handcrafted sarees, lehengas, co-ord sets. Made to fit you. Not for trends — for you.',
}

// Fallback data in case DB isn't seeded yet
const PH = 'https://cdn.thepossah.com/ui/placeholder.svg'

const FALLBACK_HERO_SLIDES = [
  {
    id: 'slide-1',
    image: PH,
    headline: 'she wants what she wants.',
    subheadline: 'Couture, off-duty. Spring \'26',
    ctaLabel: 'Shop the Collection',
    ctaLink: '/women',
  },
]

const FALLBACK_COLLECTION_BANNER = {
  image: PH,
  headline: 'Chapter 04: Veil',
  subtitle: 'The Spring Collection',
  ctaLabel: 'Shop the Collection',
  ctaLink: '/festive',
}

const FALLBACK_OCCASION_TILES = [
  { id: 'everyday', label: 'EVERYDAY', image: PH, link: '/women/sarees?occasion=Everyday' },
  { id: 'brunch',   label: 'BRUNCH',   image: PH, link: '/women/sarees?occasion=Brunch'   },
  { id: 'workwear', label: 'WORKWEAR', image: PH, link: '/women/co-ords?occasion=Workwear' },
  { id: 'evening',  label: 'EVENING',  image: PH, link: '/women/lehengas?occasion=Evening' },
  { id: 'sangeet',  label: 'SANGEET',  image: PH, link: '/women/lehengas?occasion=Sangeet' },
  { id: 'mehendi',  label: 'MEHENDI',  image: PH, link: '/women/sarees?occasion=Mehendi'  },
  { id: 'haldi',    label: 'HALDI',    image: PH, link: '/women/kurta-sets?occasion=Haldi' },
  { id: 'wedding',  label: 'WEDDING',  image: PH, link: '/women/lehengas?occasion=Wedding' },
]

export interface HeroSlide {
  id: string
  image: string
  headline: string
  subheadline: string
  ctaLabel: string
  ctaLink: string
}

export interface CollectionBannerData {
  image: string
  headline: string
  subtitle: string
  ctaLabel: string
  ctaLink: string
}

export interface OccasionTile {
  id: string
  label: string
  image: string
  link: string
}

export interface ProductCardData {
  id: string
  slug: string
  category_slug: string
  category_gender: string
  name: string
  fabric: string | null
  price: number
  compare_price: number | null
  is_new_arrival: boolean
  is_top_selling: boolean
  images: { url: string; alt: string | null }[]
  tags: string[]
  sub_line?: string | null
}

const PRODUCT_SELECT = `
  id, slug, name, fabric, price, compare_price,
  is_new_arrival, is_top_selling, sub_line,
  categories (slug, gender),
  product_images (url, alt, position),
  product_tags (tag)
`

async function getHomepageData() {
  try {
    const supabase = createPublicClient()

    const { data: config } = await supabase
      .from('homepage_config')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    // Use curated list if admin has selected specific products; otherwise fall back to is_new_arrival flag
    const curatedIds = parseJson<string[]>(config?.new_arrival_ids, [])

    let products = null
    if (curatedIds.length > 0) {
      const { data } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('is_active', true)
        .in('id', curatedIds)
        .limit(12)
      // Re-order to match admin-selected order (DB .in() doesn't guarantee order)
      const map = new Map((data ?? []).map((p) => [p.id, p]))
      products = curatedIds.map((id) => map.get(id)).filter((p): p is NonNullable<typeof p> => p != null)
    } else {
      const { data } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('is_active', true)
        .eq('is_new_arrival', true)
        .order('created_at', { ascending: false })
        .limit(12)
      products = data
    }

    return { config, products }
  } catch {
    // DB not connected — return nulls, page uses fallback data
    return { config: null, products: null }
  }
}

export default async function HomePage() {
  const { config, products } = await getHomepageData()

  // Admin saves snake_case fields (image_url, cta_link, sub_headline, cta_label).
  // Homepage components expect camelCase (image, ctaLink, subheadline, ctaLabel).
  // Map here so both shapes work regardless of when config was saved.
  const heroSlides = (() => {
    if (!config) return FALLBACK_HERO_SLIDES
    const raw = parseJson<Record<string, unknown>[]>(config.hero_slides, [])
    if (!raw.length) return FALLBACK_HERO_SLIDES
    return raw.map((s, i): HeroSlide => ({
      id:          String(s.id ?? s.image_url ?? i),
      image:       String(s.image ?? s.image_url ?? ''),
      headline:    String(s.headline ?? ''),
      subheadline: String(s.subheadline ?? s.sub_headline ?? ''),
      ctaLabel:    String(s.ctaLabel ?? s.cta_label ?? ''),
      ctaLink:     String(s.ctaLink ?? s.cta_link ?? ''),
    }))
  })()

  const collectionBanner = (() => {
    if (!config) return FALLBACK_COLLECTION_BANNER
    const raw = parseJson<Record<string, unknown>>(config.collection_banner, {})
    const image   = String(raw.image   ?? raw.image_url  ?? '')
    const ctaLink = String(raw.ctaLink ?? raw.cta_link   ?? '')
    const headline = String(raw.headline ?? '')
    if (!image || !ctaLink || !headline) return FALLBACK_COLLECTION_BANNER
    return {
      image,
      headline,
      subtitle: String(raw.subtitle ?? raw.sub_headline ?? ''),
      ctaLabel: String(raw.ctaLabel  ?? raw.cta_label   ?? 'Shop Now'),
      ctaLink,
    } satisfies CollectionBannerData
  })()

  const occasionTiles = (() => {
    if (!config) return FALLBACK_OCCASION_TILES
    const raw = parseJson<Record<string, unknown>[]>(config.occasion_tiles, [])
    if (!raw.length) return FALLBACK_OCCASION_TILES
    return raw.map((t, i): OccasionTile => ({
      id:    String(t.id    ?? t.label ?? i),
      label: String(t.label ?? ''),
      image: String(t.image ?? t.image_url ?? ''),
      link:  String(t.link  ?? '/women'),
    }))
  })()

  const categorySplitImages = (() => {
    const raw = parseJson<Record<string, unknown>>(config?.category_split, {})
    return {
      ethnicImage:  raw.ethnic_image  ? String(raw.ethnic_image)  : undefined,
      westernImage: raw.western_image ? String(raw.western_image) : undefined,
    }
  })()

  const categoryCirclesImages = (() => {
    const raw = parseJson<Record<string, unknown>>(config?.category_circles, {})
    return {
      sarees:     raw.sarees     ? String(raw.sarees)     : null,
      lehengas:   raw.lehengas   ? String(raw.lehengas)   : null,
      co_ords:    raw.co_ords    ? String(raw.co_ords)    : null,
      dresses:    raw.dresses    ? String(raw.dresses)    : null,
      kurta_sets: raw.kurta_sets ? String(raw.kurta_sets) : null,
      tops:       raw.tops       ? String(raw.tops)       : null,
    }
  })()

  const mtmCtaImage = (() => {
    const raw = parseJson<Record<string, unknown>>(config?.mtm_cta, {})
    return raw.image_url ? String(raw.image_url) : undefined
  })()

  const newArrivalProducts: ProductCardData[] = (products ?? []).map((p) => ({
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
    images: ((p.product_images as { url: string; alt: string | null; position: number }[] | null) ?? [])
      .sort((a, b) => a.position - b.position)
      .map((img) => ({ url: img.url, alt: img.alt })),
    tags: ((p.product_tags as { tag: string }[] | null) ?? []).map((t) => t.tag),
    sub_line: p.sub_line ?? null,
  }))

  return (
    <>
      {/* Structured data — Organization schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ClothingStore',
            name: 'ThePossah',
            description: 'Haute couture fashion house in Bengaluru, Karnataka.',
            url: 'https://thepossah.com',
            telephone: '+919151512323',
            address: {
              '@type': 'PostalAddress',
              streetAddress: 'Shop No. 1, Ground Floor, No. 30, 1st Main Rd, behind Maharaja Furniture Store, Munireddy Layout',
              addressLocality: 'Horamavu, Bengaluru',
              addressRegion: 'Karnataka',
              postalCode: '560113',
              addressCountry: 'IN',
            },
            sameAs: [
              'https://www.instagram.com/thepossahhautecouture/',
              'https://www.pinterest.com/thepossah/',
              'https://www.youtube.com/@thepossah',
            ],
          }),
        }}
      />

      {/* Structured data — WebSite + SearchAction */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'The Possah',
            url: 'https://thepossah.com',
            potentialAction: {
              '@type': 'SearchAction',
              target: 'https://thepossah.com/search?q={search_term_string}',
              'query-input': 'required name=search_term_string',
            },
          }),
        }}
      />

      <HeroSlider slides={heroSlides} />
      <Reveal><CategorySplit ethnicImage={categorySplitImages.ethnicImage} westernImage={categorySplitImages.westernImage} /></Reveal>
      <Reveal delay={0.05}><CategoryCircles images={categoryCirclesImages} /></Reveal>
      <Reveal><NewArrivals products={newArrivalProducts} /></Reveal>
      <Reveal><CollectionBanner data={collectionBanner} /></Reveal>
      <Reveal delay={0.05}><OccasionGrid tiles={occasionTiles} /></Reveal>
      <Reveal><MtmCta imageUrl={mtmCtaImage} /></Reveal>
    </>
  )
}
