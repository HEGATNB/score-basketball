import { useEffect, useState } from 'react';
import { X, ExternalLink, Calendar, User2, Tag, ChevronRight } from 'lucide-react';
import { liveApi, type LiveArticle, type LiveNewsItem } from '@/shared/api/live';

interface NewsModalProps {
  article: LiveNewsItem | null;
  onClose: () => void;
  onOpen?: (item: LiveNewsItem) => void;
}

function formatPublished(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function approxReadingTime(paragraphs: string[]): number {
  const words = paragraphs.join(' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export const NewsModal = ({ article, onClose, onOpen }: NewsModalProps) => {
  const [full, setFull] = useState<LiveArticle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lazy-fetch the full article body when modal opens
  useEffect(() => {
    if (!article?.id) {
      setFull(null);
      return;
    }
    setLoading(true);
    setError(null);
    setFull(null);
    let cancelled = false;
    liveApi
      .article(article.id)
      .then((data) => {
        if (cancelled) return;
        setFull(data);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Не удалось подгрузить полную статью.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [article?.id]);

  // Escape to close, body scroll lock
  useEffect(() => {
    if (!article) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [article, onClose]);

  if (!article) return null;

  const heroImage = full?.images?.[0]?.url || article.thumb || null;
  const heroCaption = full?.images?.[0]?.caption;
  const heroCredit = full?.images?.[0]?.credit;
  const paragraphs = full?.paragraphs?.length ? full.paragraphs : article.description ? [article.description] : [];
  const readTime = approxReadingTime(paragraphs);
  const galleryImages = (full?.images || []).slice(1, 5);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center px-3 py-6 sm:py-10"
      style={{ background: 'rgba(6,7,10,0.82)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <article
        className="news-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero */}
        {heroImage && (
          <div
            className="news-modal-hero"
            style={{ backgroundImage: `url(${heroImage})` }}
          >
            <div className="news-modal-hero-scrim" />
            <button
              onClick={onClose}
              aria-label="Закрыть"
              className="news-modal-close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="news-modal-hero-body">
              <div className="news-modal-tags">
                {(full?.category || article.category) && (
                  <span className="news-cat">
                    <span className="dot" />
                    {full?.category || article.category}
                  </span>
                )}
                {full?.section && (
                  <span className="news-cat compact">{full.section}</span>
                )}
                <span
                  className="font-mono text-[10px] uppercase text-[var(--text-2)]"
                  style={{ letterSpacing: '0.22em' }}
                >
                  ~{readTime} мин чтения
                </span>
              </div>
              <h1 className="news-modal-title">{article.title}</h1>
              {(full?.description || article.description) && (
                <p className="news-modal-deck">
                  {full?.description || article.description}
                </p>
              )}
            </div>
          </div>
        )}

        {!heroImage && (
          <div className="flex items-center justify-between border-b border-[var(--line)] px-7 py-5">
            <div className="flex flex-wrap items-center gap-2">
              {(full?.category || article.category) && (
                <span className="news-cat">
                  <span className="dot" />
                  {full?.category || article.category}
                </span>
              )}
              <span
                className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.22em' }}
              >
                ~{readTime} мин чтения
              </span>
            </div>
            <button
              onClick={onClose}
              aria-label="Закрыть"
              className="rounded-pill p-2 text-[var(--text-3)] hover:text-[var(--text)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Hero caption */}
        {heroImage && (heroCaption || heroCredit) && (
          <div className="news-modal-caption">
            {heroCaption && <span>{heroCaption}</span>}
            {heroCredit && <span className="credit">© {heroCredit}</span>}
          </div>
        )}

        {/* Meta strip */}
        <div className="news-modal-meta">
          {(full?.byline || article.byline) && (
            <span className="meta-item">
              <User2 className="h-3 w-3" />
              {full?.byline || article.byline}
            </span>
          )}
          {(full?.published || article.published) && (
            <span className="meta-item">
              <Calendar className="h-3 w-3" />
              {formatPublished(full?.published || article.published)}
            </span>
          )}
          {full?.lastModified && full.lastModified !== full.published && (
            <span className="meta-item meta-muted">
              Обновлено: {formatPublished(full.lastModified)}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="news-modal-body">
          {loading && (
            <div className="space-y-3 py-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-3 animate-pulse rounded bg-[var(--surface-2)]"
                  style={{ width: `${75 + (i % 3) * 8}%` }}
                />
              ))}
            </div>
          )}

          {!loading && error && paragraphs.length === 0 && (
            <p className="text-sm text-[var(--text-3)]">{error}</p>
          )}

          {!loading &&
            paragraphs.map((p, i) => (
              <p
                key={i}
                className="news-modal-p"
                style={i === 0 ? { fontSize: '17px' } : undefined}
              >
                {i === 0 && p.length > 60 ? (
                  <>
                    <span className="news-modal-dropcap">{p[0]}</span>
                    {p.slice(1)}
                  </>
                ) : (
                  p
                )}
              </p>
            ))}

          {/* Gallery */}
          {galleryImages.length > 0 && (
            <div className="news-modal-gallery">
              {galleryImages.map((img, i) => (
                <figure key={i} className="news-modal-figure">
                  <img src={img.url} alt={img.caption || ''} loading="lazy" />
                  {(img.caption || img.credit) && (
                    <figcaption>
                      {img.caption}
                      {img.credit && <span className="credit"> · © {img.credit}</span>}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          )}

          {/* Keywords */}
          {full?.keywords && full.keywords.length > 0 && (
            <div className="news-modal-kw">
              <Tag className="h-3 w-3" style={{ color: 'var(--accent)' }} />
              {full.keywords.slice(0, 8).map((kw) => (
                <span key={kw} className="news-modal-kw-tag">
                  {kw}
                </span>
              ))}
            </div>
          )}

          {/* Related */}
          {full?.related && full.related.length > 0 && (
            <div className="news-modal-related">
              <div
                className="mb-3 font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.22em' }}
              >
                Связанное
              </div>
              <div className="space-y-2">
                {full.related.map((r) => (
                  <button
                    type="button"
                    key={r.id || r.title}
                    onClick={() => {
                      if (onOpen) {
                        onOpen({
                          id: r.id,
                          title: r.title,
                          thumb: r.thumb || null,
                          description: null,
                          category: null,
                          published: null,
                          url: r.url || null,
                        });
                      } else if (r.url) {
                        window.open(r.url, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    className="news-modal-related-row group"
                  >
                    {r.thumb && (
                      <span
                        className="news-modal-related-thumb"
                        style={{ backgroundImage: `url(${r.thumb})` }}
                      />
                    )}
                    <span className="news-modal-related-title">{r.title}</span>
                    <ChevronRight className="h-4 w-4 text-[var(--text-3)] transition group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="news-modal-footer">
          <span
            className="font-mono text-[10px] uppercase text-[var(--text-3)]"
            style={{ letterSpacing: '0.22em' }}
          >
            Источник · ESPN NBA NEWS
          </span>
          {(full?.url || article.url) && (
            <a
              href={full?.url || article.url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
            >
              Открыть на ESPN
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </article>
    </div>
  );
};

export default NewsModal;
