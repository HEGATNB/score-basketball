import { useEffect } from 'react';
import { X, ExternalLink, Calendar } from 'lucide-react';
import type { LiveNewsItem } from '@/shared/api/live';

interface NewsModalProps {
  article: LiveNewsItem | null;
  onClose: () => void;
}

function formatPublished(iso: string | null): string {
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

export const NewsModal = ({ article, onClose }: NewsModalProps) => {
  useEffect(() => {
    if (!article) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    // Lock body scroll while open
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [article, onClose]);

  if (!article) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center px-4 py-10 sm:py-16"
      style={{ background: 'rgba(6,7,10,0.78)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="card relative w-full max-w-3xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'rgba(20,20,28,0.96)' }}
      >
        {/* Hero image */}
        {article.thumb ? (
          <div
            className="relative h-[280px] sm:h-[360px]"
            style={{
              backgroundImage: `url(${article.thumb})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, transparent 30%, rgba(20,20,28,0.55) 65%, rgba(20,20,28,0.95))',
              }}
            />
            <button
              onClick={onClose}
              aria-label="Закрыть"
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-pill border border-[var(--line)] bg-[var(--surface)] text-[var(--text-2)] backdrop-blur transition hover:text-[var(--text)]"
            >
              <X className="h-4 w-4" />
            </button>
            {/* Floating meta on top of image */}
            <div className="absolute bottom-5 left-6 right-6 flex flex-wrap items-center gap-2">
              {article.category && (
                <span className="tag tag-hot">{article.category}</span>
              )}
              {article.published && (
                <span className="tag">
                  <Calendar className="h-3 w-3" />
                  {formatPublished(article.published)}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between border-b border-[var(--line)] px-6 py-4">
            <div className="flex items-center gap-2">
              {article.category && (
                <span className="tag tag-hot">{article.category}</span>
              )}
              {article.published && (
                <span className="tag">
                  <Calendar className="h-3 w-3" />
                  {formatPublished(article.published)}
                </span>
              )}
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

        {/* Body */}
        <div className="max-h-[55vh] overflow-y-auto px-6 py-7 sm:px-10 sm:py-9">
          <h2
            className="display-h"
            style={{ fontSize: 'clamp(28px, 4.2vw, 44px)', lineHeight: 1.05 }}
          >
            {article.title}
          </h2>

          {article.description && (
            <p className="mt-5 text-[15px] leading-relaxed text-[var(--text-2)]">
              {article.description}
            </p>
          )}

          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-5">
            <span
              className="font-mono text-[10px] uppercase text-[var(--text-3)]"
              style={{ letterSpacing: '0.22em' }}
            >
              Источник · ESPN NBA News
            </span>
            {article.url && (
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost"
              >
                Полная статья
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewsModal;
