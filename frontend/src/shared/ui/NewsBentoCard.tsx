import { useState } from 'react';
import type { LiveNewsItem } from '@/shared/api/live';

interface Props {
  item: LiveNewsItem;
  relTime?: string;
  tall?: boolean;
  onOpen: () => void;
}

function newsMeta(item: LiveNewsItem, relTime?: string) {
  const published = item.published && new Date(item.published);
  return {
    tags: item.teams?.length ? item.teams.join(' · ') : 'NBA',
    time: relTime || (published && Number.isFinite(published.getTime())
      ? published.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
      : ''),
  };
}

export const NewsBentoCard = ({ item, relTime, tall, onOpen }: Props) => {
  const [imgFailed, setImgFailed] = useState(false);
  const meta = newsMeta(item, relTime);

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
              'linear-gradient(135deg, rgba(210,106,52,0.22), rgba(91,184,255,0.10) 50%, rgba(20,20,28,0.9))',
          }}
        />
      )}
      <div className="scrim" />
      <div className="body">
        <div className="news-meta">
          <span className="news-cat compact">{meta.tags}</span>
          {meta.time && <span className="news-time">· {meta.time}</span>}
        </div>
        <h4>{item.title}</h4>
      </div>
    </button>
  );
};

interface FeatureProps {
  item: LiveNewsItem;
  relTime?: string;
  onOpen: () => void;
}

export const NewsBentoFeature = ({ item, relTime, onOpen }: FeatureProps) => {
  const [imgFailed, setImgFailed] = useState(false);
  const meta = newsMeta(item, relTime);

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
              'linear-gradient(135deg, rgba(210,106,52,0.45), rgba(91,184,255,0.12) 50%, rgba(20,20,28,0.95))',
          }}
        />
      )}
      <div className="scrim" />
      <div className="body">
        <div className="news-meta">
          <span className="news-cat">
            <span className="dot" />
            {meta.tags}
          </span>
          {meta.time && <span className="news-time">· {meta.time}</span>}
        </div>
        <h3>{item.title}</h3>
        {item.description && <p className="deck">{item.description}</p>}
        <div className="news-feature-foot">
          <span className="news-read inline-flex">
            Читать материал
            <span className="arrow">→</span>
          </span>
        </div>
      </div>
    </button>
  );
};
