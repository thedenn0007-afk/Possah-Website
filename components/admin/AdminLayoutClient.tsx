'use client'

import { useState } from 'react'
import { AdminSidebar } from './AdminSidebar'

interface AdminLayoutClientProps {
  children: React.ReactNode
  isDev: boolean
}

/**
 * Client shell for the admin layout — owns the mobile sidebar open/close state.
 * The layout.tsx (server component) passes isDev so we never have client-side
 * env var reads for security-relevant values.
 */
export function AdminLayoutClient({ children, isDev }: AdminLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex overflow-hidden print:block print:overflow-visible" style={{ height: '100dvh', minHeight: '100vh' }}>
      {/* Sidebar */}
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:block print:overflow-visible print:h-auto">

        {/* Dev banner */}
        {isDev && (
          <div
            role="alert"
            aria-live="polite"
            className="flex items-center gap-2 px-4 py-2 flex-shrink-0 print:hidden"
            style={{
              backgroundColor: '#FEF08A',
              borderBottom: '1px solid #EAB308',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#854D0E" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M8 3L15 13H1L8 3z" />
              <path d="M8 7v3M8 11.5v.5" />
            </svg>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#854D0E',
                fontWeight: '500',
              }}
            >
              DEV MODE — Google sign-in still required. This banner disappears in production.
            </span>
          </div>
        )}

        {/* Mobile top bar */}
        <header
          className="md:hidden flex items-center gap-3 px-4 h-14 flex-shrink-0 print:hidden"
          style={{
            backgroundColor: 'var(--color-green)',
            borderBottom: '1px solid rgba(244,236,223,0.12)',
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center justify-center w-9 h-9 flex-shrink-0"
            style={{
              color: 'var(--color-bg)',
              WebkitTapHighlightColor: 'transparent',
              WebkitAppearance: 'none',
              appearance: 'none',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
            }}
            aria-label="Open admin navigation"
            aria-expanded={sidebarOpen}
            aria-controls="admin-sidebar"
          >
            <svg width="20" height="16" viewBox="0 0 20 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M0 1h20M0 8h20M0 15h20" />
            </svg>
          </button>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              fontWeight: '500',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-bg)',
            }}
          >
            Admin
          </span>
        </header>

        {/* Page content */}
        <main
          className="flex-1 overflow-y-auto overscroll-contain print:overflow-visible"
          style={{
            backgroundColor: 'var(--color-bg)',
            overscrollBehavior: 'contain' as any,
          }}
          id="admin-main-content"
        >
          {children}
        </main>

      </div>
    </div>
  )
}
