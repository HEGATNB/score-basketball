import { useState } from 'react';
import type { LiveNewsItem } from '@/shared/api/live';

interface Props {
  item: LiveNewsItem;
  relTime: string;
  tall?: boolean;
  onOpen: () => void;
}

/**
 * Bento card for a news item — uses a real `<img>` element so we can swap
 * to a gradient fallback on 404 (some ESPN photo URLs don't have publicly
 * accessible variants).
 */
export const NewsBentoCard = ({ item, relTime, tall, onOpen }: Props) => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`news-bento-card ${tall ? 'tall' : ''} group`}
    >
      {item.thumb && !imgFailed ? (
        <img
          src={item.thumb}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="img"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div
          className="img"
          style={{
            background:
              'linear-gradient(135deg, rgba(255,90,31,0.22), rgba(91,184,255,0.10) 50%, rgba(20,20,28,0.9))',
          }}
        />
      )}
      <div className="scrim" />
      <div className="body">
        <div className="news-meta">
          <span className="news-cat compact">{item.category || 'NBA'}</span>
          {relTime && <span className="news-time">· {relTime}</span>}
        </div>
        <h4>{item.title}</h4>
      </div>
    </button>
  );
};

interface FeatureProps {
  item: LiveNewsItem;
  relTime: string;
  onOpen: () => void;
}

export const NewsBentoFeature = ({ item, relTime, onOpen }: FeatureProps) => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="news-bento-feature group"
    >
      {item.thumb && !imgFailed ? (
        <img
          src={item.thumb}
          alt=""
          loading="eager"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="img"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div
          className="img"
          style={{
            background:
              'linear-gradient(135deg, rgba(255,90,31,0.45), rgba(91,184,255,0.12) 50%, rgba(20,20,28,0.95))',
          }}
        />
      )}
      <div className="scrim" />
      <div className="body">
        <div className="news-meta">
          <span className="news-cat">
            <span className="dot" />
            {item.category || 'TOP STORY'}
          </span>
          {relTime && <span className="news-time">· {relTime}</span>}
        </div>
        <h3>{item.title}</h3>
        {item.description && <p className="deck">{item.description}</p>}
        <span className="news-read mt-4 inline-flex">
          Читать материал
          <span className="arrow">→</span>
        </span>
      </div>
    </button>
  );
};
