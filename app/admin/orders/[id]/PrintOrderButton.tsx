'use client'

// Print-friendly order summary trigger. Relies on Tailwind's `print:hidden`
// utility (applied across the admin shell + this page's non-essential
// sections) to produce a clean, invoice-style printout — no PDF library
// needed for the simple "packing slip / customer record" use case.
export function PrintOrderButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden"
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        gap:             '6px',
        padding:         '8px 14px',
        borderRadius:    '6px',
        border:          '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        fontFamily:      'var(--font-body)',
        fontSize:        '13px',
        fontWeight:      '500',
        color:           'var(--color-text)',
        cursor:          'pointer',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="6 9 6 2 18 2 18 9" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
      </svg>
      Print
    </button>
  )
}
