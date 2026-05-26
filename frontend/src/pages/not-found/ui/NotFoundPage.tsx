import { Link } from 'react-router-dom';
import { ArrowLeft, Home, Search } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <section className="flex min-h-screen items-center justify-center">
      <div className="container-x text-center">
        <div
          className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-md"
          style={{
            background: 'linear-gradient(135deg, var(--accent), var(--gold))',
            color: '#0a0a0c',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <span className="font-display text-4xl">404</span>
        </div>

        <span className="tag tag-hot">МАРШРУТ ОТСУТСТВУЕТ</span>

        <h1
          className="display-h mt-7"
          style={{ fontSize: 'clamp(72px, 10vw, 160px)' }}
        >
          ВНЕ <em>ПЛОЩАДКИ</em>
        </h1>
        <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-[var(--text-2)]">
          Страница за чертой. Возвращайся на главную или выбери другую секцию.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link to="/" className="btn btn-primary">
            <Home className="h-4 w-4" />
            На главную
          </Link>
          <Link to="/teams" className="btn">
            <Search className="h-4 w-4" />
            Команды
          </Link>
          <button onClick={() => window.history.back()} className="btn btn-ghost">
            <ArrowLeft className="h-4 w-4" />
            Назад
          </button>
        </div>
      </div>
    </section>
  );
}
