import { Link } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { ProfileSettings } from '@/shared/ui/ProfileSettingsModal';

export default function AccountPage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <section className="container-x mx-auto max-w-xl space-y-6 pb-16 pt-28">
      <h1 className="font-display text-5xl uppercase">Профиль</h1>
      <Link className="btn btn-secondary" to="/history">История прогнозов</Link>
      <div className="panel p-6">
        <ProfileSettings user={user} />
      </div>
    </section>
  );
}
