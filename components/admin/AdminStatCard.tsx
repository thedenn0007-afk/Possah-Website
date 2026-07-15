interface AdminStatCardProps {
  label: string
  value: string | number
  subLabel?: string
  accent?: 'default' | 'warning' | 'success' | 'error'
  icon: React.ReactNode
}

const accentStyles: Record<NonNullable<AdminStatCardProps['accent']>, string> = {
  default: 'var(--color-green)',
  warning:  '#D97706',
  success:  '#16A34A',
  error:    'var(--color-error)',
}

// Warning cards get a light background wash on top of the border-color accent —
// a 3px top border alone reads as too subtle for "this needs action now."
const WARNING_BG = '#FFFBEB'

export function AdminStatCard({
  label,
  value,
  subLabel,
  accent = 'default',
  icon,
}: AdminStatCardProps) {
  const borderColor = accentStyles[accent]

  return (
    <div
      className="flex flex-col gap-3 p-5 rounded"
      style={{
        backgroundColor: accent === 'warning' ? WARNING_BG : 'var(--color-white)',
        border: '1px solid var(--color-border)',
        borderTop: `3px solid ${borderColor}`,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      <div className="flex items-center justify-between">
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
          }}
        >
          {label}
        </span>
        <span style={{ color: borderColor, opacity: 0.7 }}>{icon}</span>
      </div>

      <div>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '26px',
            fontWeight: '600',
            color: 'var(--color-text)',
            lineHeight: 1.1,
          }}
        >
          {value}
        </p>
        {subLabel && (
          <p
            className="mt-1"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              color: 'var(--color-text-muted)',
            }}
          >
            {subLabel}
          </p>
        )}
      </div>
    </div>
  )
}
