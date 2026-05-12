interface MarqueeItem {
  text: string;
  highlight?: boolean;
}

interface MarqueeProps {
  items?: MarqueeItem[];
}

const DEFAULT_ITEMS: MarqueeItem[] = [
  { text: 'СЕЗОН 2025/26' },
  { text: 'ИИ-точность 78%', highlight: true },
  { text: 'Сегодня 4 матча' },
  { text: 'Игра вечера: BOS vs LAL', highlight: true },
  { text: 'Стрик чемпиона: 14' },
  { text: 'Прайм-тайм 20:00', highlight: true },
  { text: 'Шторм 5W подряд' },
  { text: 'Porziņģis под вопросом', highlight: true },
];

export const Marquee = ({ items = DEFAULT_ITEMS }: MarqueeProps) => {
  const all = [...items, ...items];
  return (
    <div className="marquee">
      <div className="marquee-track">
        {all.map((item, i) => (
          <span key={i} className="marquee-item">
            <span className="star">✦</span>
            {item.highlight ? <em>{item.text}</em> : item.text}
          </span>
        ))}
      </div>
    </div>
  );
};

export default Marquee;
