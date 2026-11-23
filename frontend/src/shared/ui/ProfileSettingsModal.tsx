import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { authService } from '@/app/providers/auth.service';
import { type AuthUser } from '@/shared/api/client';

export function ProfileSettings({ user }: { user: AuthUser }) {
  const { setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>, passwordChange = false) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setNotice('');
    try {
      if (passwordChange) {
        await authService.changePassword({
          currentPassword: String(fields.get('currentPassword')),
          newPassword: String(fields.get('newPassword')),
        });
        form.reset();
        setNotice('Пароль изменён.');
      } else {
        const updated = await authService.updateProfile({
          name: String(fields.get('name')),
          username: String(fields.get('username')),
          email: String(fields.get('email')),
        });
        setUser(updated);
        setNotice('Профиль сохранён.');
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не удалось сохранить изменения.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form key={user.email + user.name + user.username} className="grid gap-3" onSubmit={submit}>
        <label>Имя <input className="input w-full" name="name" defaultValue={user.name} required /></label>
        <label>Логин <input className="input w-full" name="username" autoComplete="username" defaultValue={user.username} required /></label>
        <label>Email <input className="input w-full" name="email" type="email" autoComplete="email" defaultValue={user.email} required /></label>
        <button className="btn btn-primary" disabled={busy}>Сохранить профиль</button>
      </form>
      <form className="grid gap-3" onSubmit={(event) => submit(event, true)}>
        <label>Текущий пароль <input className="input w-full" name="currentPassword" type="password" autoComplete="current-password" required /></label>
        <label>Новый пароль <input className="input w-full" name="newPassword" type="password" autoComplete="new-password" required /></label>
        <button className="btn btn-secondary" disabled={busy}>Изменить пароль</button>
      </form>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void authService.logoutAll()
            .catch((error) => setNotice(error instanceof Error ? error.message : 'Не удалось завершить сеансы.'))
            .finally(() => setBusy(false));
        }}
      >
        Выйти на всех устройствах
      </button>
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}

export function ProfileSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (open && !element?.open) element?.showModal();
    if (!open && element?.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="profile-dialog-title"
      className="panel w-full max-w-lg p-6 text-[var(--text)] backdrop:bg-black/60"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="profile-dialog-title" className="font-display text-2xl">Настройки профиля</h2>
        <button type="button" className="btn" onClick={onClose}>Закрыть</button>
      </div>
      {open && user && <ProfileSettings user={user} />}
    </dialog>
  );
}
