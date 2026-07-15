'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { useWishlistStore } from '@/lib/store/wishlistStore'
import { formatPrice } from '@/lib/utils'
import type { ProductCardData } from '@/app/(shop)/page'

interface ProductCardProps {
  product: ProductCardData
  priority?: boolean
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const [hovered, setHovered] = useState(false)
  const router = useRouter()
  const { toggleItem, isInWishlist } = useWishlistStore()

  const primaryImage = product.images[0]
  const hoverImage = product.images[1] ?? product.images[0]
  const inWishlist = isInWishlist(product.id)
  const productHref = `/${product.category_gender ?? 'women'}/${product.category_slug ?? 'women'}/${product.slug}`

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    router.push(productHref)
  }

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggleItem({
      productId: product.id,
      variantId: null,
      name: product.name,
      image: primaryImage?.url ?? 'https://cdn.thepossah.com/ui/placeholder.svg',
      price: product.price,
      slug: productHref,
    })
  }

  return (
    <article
      className="group relative flex flex-col"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Image container */}
      <Link href={productHref} className="block relative overflow-hidden aspect-product">
        {/* Primary image */}
        <Image
          src={primaryImage?.url || 'https://cdn.thepossah.com/ui/placeholder.svg'}
          alt={primaryImage?.alt ?? product.name}
          fill
          priority={priority}
          quality={80}
          className="object-cover object-top transition-opacity duration-400"
          style={{ opacity: hovered && hoverImage !== primaryImage ? 0 : 1 }}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />

        {/* Hover image */}
        {hoverImage && hoverImage !== primaryImage && hoverImage.url && (
          <Image
            src={hoverImage.url}
            alt={hoverImage.alt ?? product.name}
            fill
            priority={priority}
            quality={80}
            className="object-cover object-top transition-opacity duration-400"
            style={{ opacity: hovered ? 1 : 0 }}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        )}

        {/* Badges — top left */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
          {product.is_new_arrival && <Badge variant="new" />}
          {product.compare_price && product.compare_price > product.price && (
            <Badge variant="sale" />
          )}
        </div>

        {/* Wishlist — top right */}
        <button
          onClick={handleWishlist}
          className="absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center transition-all duration-200 rounded-full"
          style={{
            backgroundColor: 'rgba(244,236,223,0.85)',
            opacity: hovered || inWishlist ? 1 : 0,
          }}
          aria-label={inWishlist ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          aria-pressed={inWishlist}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 20 20"
            fill={inWishlist ? 'var(--color-orange)' : 'none'}
            stroke={inWishlist ? 'var(--color-orange)' : 'var(--color-green)'}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 17.5S2 12.5 2 6.5a4 4 0 018-1.3A4 4 0 0118 6.5c0 6-8 11-8 11z" />
          </svg>
        </button>

        {/* Quick Add — bottom overlay, appears on hover */}
        <div
          className="absolute bottom-0 left-0 right-0 transition-all duration-250"
          style={{ opacity: hovered ? 1 : 0, transform: hovered ? 'translateY(0)' : 'translateY(6px)' }}
        >
          <button
            onClick={handleQuickAdd}
            className="w-full py-3 flex items-center justify-center gap-2 transition-opacity duration-150 hover:opacity-90"
            style={{
              backgroundColor: 'var(--color-green)',
              color: 'var(--color-bg)',
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              fontWeight: '500',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
            aria-label={`View ${product.name}`}
          >
            Select Size
          </button>
        </div>
      </Link>

      {/* Product info */}
      <div className="pt-3 flex flex-col gap-1">
        {/* Occasion tags */}
        {product.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {product.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-muted)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Sub-line / collection label */}
        {product.sub_line && (
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--color-gold)',
            }}
          >
            {product.sub_line}
          </p>
        )}

        {/* Name */}
        <Link href={productHref}>
          <h3
            className="hover:opacity-70 transition-opacity duration-200 line-clamp-2"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              fontWeight: '500',
              color: 'var(--color-text)',
              lineHeight: 1.35,
            }}
          >
            {product.name}
          </h3>
        </Link>

        {/* Fabric */}
        {product.fabric && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              color: 'var(--color-text-muted)',
            }}
          >
            {product.fabric}
          </p>
        )}

        {/* Price */}
        <div className="flex items-center gap-2 mt-0.5">
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              fontWeight: '500',
              color: 'var(--color-text)',
            }}
          >
            {formatPrice(product.price)}
          </span>
          {product.compare_price && product.compare_price > product.price && (
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                color: 'var(--color-text-muted)',
                textDecoration: 'line-through',
              }}
            >
              {formatPrice(product.compare_price)}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
