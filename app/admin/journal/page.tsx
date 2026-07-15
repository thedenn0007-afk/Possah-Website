import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { JournalRowActions } from './JournalRowActions'

export const metadata: Metadata = { title: 'Journal' }
export const dynamic = 'force-dynamic'

interface Article {
  id:           string
  title:        string
  slug:         string
  category:     string
  author:       string
  is_featured:  boolean
  published_at: string | null
  created_at:   string
}

async function getArticles(): Promise<Article[]> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('journal_articles')
      .select('id, title, slug, category, author, is_featured, published_at, created_at')
      .order('created_at', { ascending: false })

    if (error) { console.error('[Admin Journal]', error); return [] }
    return (data ?? []) as Article[]
  } catch {
    return []
  }
}

function isPublished(article: Article) {
  if (!article.published_at) return false
  return new Date(article.published_at) <= new Date()
}

export default async function AdminJournalPage() {
  const articles = await getArticles()

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 style={{ fontFamily: 'var(--font-body)', fontSize: '22px', fontWeight: '600', color: 'var(--color-text)' }}>
            Journal
          </h1>
          <p className="mt-0.5" style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-muted)' }}>
            {articles.length} article{articles.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/admin/journal/new"
          style={{
            display:         'inline-flex',
            alignItems:      'center',
            gap:             '6px',
            padding:         '9px 18px',
            borderRadius:    '6px',
            border:          'none',
            backgroundColor: 'var(--color-green)',
            color:           '#fff',
            fontFamily:      'var(--font-body)',
            fontSize:        '13px',
            fontWeight:      '500',
            textDecoration:  'none',
          }}
        >
          + New Article
        </Link>
      </div>

      {articles.length === 0 ? (
        <div
          style={{
            padding:         '64px 24px',
            textAlign:       'center',
            backgroundColor: 'var(--color-surface)',
            border:          '1px solid var(--color-border)',
            borderRadius:    '10px',
          }}
        >
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
            No articles yet.
          </p>
          <Link
            href="/admin/journal/new"
            style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-gold)', textDecoration: 'underline' }}
          >
            Write your first article
          </Link>
        </div>
      ) : (
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border:          '1px solid var(--color-border)',
            borderRadius:    '10px',
            overflow:        'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Title', 'Category', 'Author', 'Status', 'Published', ''].map(h => (
                    <th key={h} style={{
                      padding:       '10px 16px',
                      textAlign:     'left',
                      fontFamily:    'var(--font-body)',
                      fontSize:      '11px',
                      fontWeight:    '600',
                      color:         'var(--color-text-muted)',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      whiteSpace:    'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {articles.map((article, i) => {
                  const published = isPublished(article)
                  return (
                    <tr key={article.id} style={{ borderBottom: i < articles.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '500', color: 'var(--color-text)' }}>
                            {article.title}
                          </span>
                          {article.is_featured && (
                            <span style={{
                              padding:         '2px 7px',
                              borderRadius:    '10px',
                              backgroundColor: '#FEF3C7',
                              color:           '#92400E',
                              fontFamily:      'var(--font-mono)',
                              fontSize:        '9px',
                              fontWeight:      '700',
                              letterSpacing:   '0.04em',
                              textTransform:   'uppercase',
                            }}>Featured</span>
                          )}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          /journal/{article.slug}
                        </div>
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          {article.category}
                        </span>
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text)' }}>
                          {article.author}
                        </span>
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{
                          padding:         '3px 10px',
                          borderRadius:    '20px',
                          fontFamily:      'var(--font-mono)',
                          fontSize:        '10px',
                          fontWeight:      '600',
                          letterSpacing:   '0.04em',
                          textTransform:   'uppercase',
                          backgroundColor: published ? '#DCFCE7' : '#F3F4F6',
                          color:           published ? '#166534' : '#6B7280',
                        }}>
                          {published ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          {article.published_at
                            ? new Date(article.published_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'
                          }
                        </span>
                      </td>
                      <td style={{ padding: '13px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <Link
                            href={`/admin/journal/${article.id}/edit`}
                            style={{ fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '500', color: 'var(--color-gold)', textDecoration: 'none' }}
                          >
                            Edit
                          </Link>
                          <a
                            href={`/journal/${article.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)', textDecoration: 'none' }}
                          >
                            View ↗
                          </a>
                          <JournalRowActions articleId={article.id} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
