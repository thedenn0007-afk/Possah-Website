'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// ─── Nav items ───────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { label: 'Dashboard',  href: '/admin',            icon: IconGrid    },
  { label: 'Products',   href: '/admin/products',   icon: IconShirt   },
  { label: 'Orders',     href: '/admin/orders',     icon: IconPackage },
  { label: 'Categories', href: '/admin/categories', icon: IconFolder  },
  { label: 'Homepage',   href: '/admin/homepage',   icon: IconHome    },
  { label: 'Journal',    href: '/admin/journal',    icon: IconFile    },
  { label: 'Coupons',    href: '/admin/coupons',    icon: IconTag     },
  { label: 'Reviews',    href: '/admin/reviews',    icon: IconStar    },
  { label: 'Media',      href: '/admin/media',      icon: IconImage   },
  { label: 'Settings',   href: '/admin/settings',   icon: IconSliders },
] as const

interface AdminSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname()

  function isActive(href: string): boolean {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* ── Mobile overlay backdrop ── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar panel ── */}
      <aside
        className={[
          'fixed md:sticky md:top-0 left-0 z-50 md:z-auto',
          'flex flex-col overflow-hidden md:overflow-auto',
          'w-60 flex-shrink-0',
          'transition-transform duration-250 ease-in-out md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'print:hidden',
        ].join(' ')}
        style={{
          backgroundColor: 'var(--color-green)',
          height: '100dvh',
          minHeight: '100vh',
          top: 0,
          overscrollBehavior: 'contain' as any,
        }}
        aria-label="Admin navigation"
      >
        {/* Logo area */}
        <div
          className="flex items-center gap-3 px-6 h-16 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(244,236,223,0.12)' }}
        >
          {/* Monochrome symbol (SVG inline — no img tag) */}
          <svg
            width="28"
            height="28"
            viewBox="0 0 40 48"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M20 2C20 2 6 10 6 24C6 35.046 12.954 42 20 42C27.046 42 34 35.046 34 24C34 10 20 2 20 2Z"
              stroke="rgba(244,236,223,0.9)"
              strokeWidth="1.5"
              fill="none"
            />
            <path
              d="M14 22C14 22 14 18 17 16C17 16 20 14 20 18V26C20 26 20 30 17 32C17 32 14 30 14 26V22Z"
              stroke="rgba(244,236,223,0.7)"
              strokeWidth="1.2"
              fill="none"
            />
            <path
              d="M26 22C26 22 26 18 23 16C23 16 20 14 20 18V26C20 26 20 30 23 32C23 32 26 30 26 26V22Z"
              stroke="rgba(244,236,223,0.7)"
              strokeWidth="1.2"
              fill="none"
            />
          </svg>
          <div>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                fontWeight: '600',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--color-bg)',
                lineHeight: 1.2,
              }}
            >
              The Possah
            </p>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'rgba(244,236,223,0.5)',
                lineHeight: 1.2,
              }}
            >
              Admin
            </p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-4" aria-label="Admin sections">
          <ul className="flex flex-col gap-0.5 px-3">
            {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
              const active = isActive(href)
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onClose}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-sm transition-all duration-150 group relative"
                    style={{
                      color: active ? 'var(--color-bg)' : 'rgba(244,236,223,0.65)',
                      backgroundColor: active ? 'rgba(244,236,223,0.1)' : 'transparent',
                      borderLeft: active
                        ? '3px solid var(--color-gold)'
                        : '3px solid transparent',
                      fontFamily: 'var(--font-body)',
                      fontSize: '13px',
                      fontWeight: active ? '500' : '400',
                      letterSpacing: '0.02em',
                      textDecoration: 'none',
                      WebkitTapHighlightColor: 'transparent',
                      cursor: 'pointer',
                    }}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon
                      size={16}
                      style={{
                        color: active ? 'var(--color-bg)' : 'rgba(244,236,223,0.55)',
                        flexShrink: 0,
                        transition: 'color 0.15s',
                      }}
                    />
                    {label}

                    {/* Hover highlight */}
                    {!active && (
                      <span
                        className="absolute inset-0 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                        style={{ backgroundColor: 'rgba(244,236,223,0.06)' }}
                        aria-hidden="true"
                      />
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Footer: View Site */}
        <div
          className="px-6 py-5 flex-shrink-0"
          style={{ borderTop: '1px solid rgba(244,236,223,0.12)' }}
        >
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity duration-150"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'rgba(244,236,223,0.55)',
              textDecoration: 'none',
            }}
          >
            View Site
            <svg
              width="9"
              height="9"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M2 8L8 2M5 2h3v3" />
            </svg>
          </a>
        </div>
      </aside>
    </>
  )
}

// ─── Icon components (hairline SVG, 1pt stroke, 24px grid) ────────────────────

interface IconProps {
  size?: number
  style?: React.CSSProperties
  className?: string
}

function IconGrid({ size = 16, style, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" style={style} className={className} aria-hidden="true">
      <rect x="1" y="1" width="5.5" height="5.5" rx="0.5" />
      <rect x="9.5" y="1" width="5.5" height="5.5" rx="0.5" />
      <rect x="1" y="9.5" width="5.5" height="5.5" rx="0.5" />
      <rect x="9.5" y="9.5" width="5.5" height="5.5" rx="0.5" />
    </svg>
  )
}

function IconShirt({ size = 16, style, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={style} className={className} aria-hidden="true">
      <path d="M5.5 2C5.5 2 6 4 8 4C10 4 10.5 2 10.5 2L14 4.5L12 6.5V14H4V6.5L2 4.5L5.5 2Z" />
    </svg>
  )
}

function IconPackage({ size = 16, style, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={style} className={className} aria-hidden="true">
      <path d="M2 5l6-3 6 3v8l-6 3-6-3V5z" />
      <path d="M8 2v14M5 3.5l6 3" />
    </svg>
  )
}

function IconFolder({ size = 16, style, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={style} className={className} aria-hidden="true">
      <path d="M1 3.5A1.5 1.5 0 012.5 2H6l1.5 2H13.5A1.5 1.5 0 0115 5.5V12a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12V3.5z" />
    </svg>
  )
}

function IconHome({ size = 16, style, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={style} className={className} aria-hidden="true">
      <path d="M2 7L8 2l6 5" />
      <path d="M3 6.5V13a.5.5 0 00.5.5H6V9.5h4V13.5h2.5a.5.5 0 00.5-.5V6.5" />
    </svg>
  )
}

function IconFile({ size = 16, style, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={style} className={className} aria-hidden="true">
      <path d="M9 1H3.5A1.5 1.5 0 002 2.5v11A1.5 1.5 0 003.5 15h9A1.5 1.5 0 0014 13.5V6L9 1z" />
      <path d="M9 1v5h5M5 9h6M5 11.5h4" />
    </svg>
  )
}

function IconTag({ size = 16, style, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={style} className={className} aria-hidden="true">
      <path d="M8.5 1.5H2.5A1 1 0 001.5 2.5v6l6.5 6.5 6.5-6.5-6-6z" />
      <circle cx="4.5" cy="4.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconStar({ size = 16, style, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={style} className={className} aria-hidden="true">
      <path d="M8 1l2 4.5H15l-4 3 1.5 5L8 11.5 3.5 13.5 5 8.5 1 5.5h5z" />
    </svg>
  )
}

function IconImage({ size = 16, style, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={style} className={className} aria-hidden="true">
      <rect x="1" y="2" width="14" height="12" rx="1" />
      <circle cx="5.5" cy="6" r="1.2" />
      <path d="M1 10l4-3 3 2.5 2-1.5 5 4" />
    </svg>
  )
}

function IconSliders({ size = 16, style, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" style={style} className={className} aria-hidden="true">
      <path d="M2 4h12M2 8h12M2 12h12" />
      <circle cx="5" cy="4" r="1.5" fill="var(--color-green)" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="11" cy="8" r="1.5" fill="var(--color-green)" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="7" cy="12" r="1.5" fill="var(--color-green)" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}
