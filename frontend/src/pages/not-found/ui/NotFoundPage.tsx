import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="text-center py-12">
      <h1 className="text-9xl font-black text-white mb-4">404</h1>
      <p className="text-2xl text-slate-400 mb-8">Страница не найдена</p>
      <Link
        to="/"
        className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors inline-block"
      >
        На главную
      </Link>
    </div>
  );
}