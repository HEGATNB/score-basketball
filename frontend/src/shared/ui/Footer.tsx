import { Mail, Check } from 'lucide-react';
import { useState } from 'react';

const TelegramIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.14-.26.26-.54.26l.188-2.74 4.99-4.51c.217-.194-.047-.302-.335-.108l-6.17 3.89-2.66-.83c-.578-.18-.59-.578.124-.858l10.4-4.01c.48-.18.9.11.75.85z"/>
  </svg>
);

const VKIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="24" cy="24" r="24" fill="currentColor" />
    <path
      d="M25.54 34.58c-10.94 0-17.18-7.5-17.44-19.98h5.48c.18 9.16 4.22 13.04 7.42 13.84V14.6h5.16v7.9c3.16-.34 6.48-3.94 7.6-7.9h5.16c-.86 4.88-4.46 8.48-7.02 9.96 2.56 1.2 6.66 4.34 8.22 10.02h-5.68c-1.22-3.8-4.26-6.74-8.28-7.14v7.14z"
      fill="#0b0807"
    />
  </svg>
);

interface FooterProps {
  copyrightText?: string;
  contactEmail?: string;
  socialLinks?: {
    telegram?: string;
    vk?: string;
  };
  className?: string;
}

export function Footer({
  copyrightText = '© 2026 CourtVision Pro. All rights reserved.',
  contactEmail = 'hello@courtvision.pro',
  socialLinks = {
    telegram: 'https://t.me/courtvision',
    vk: 'https://vk.com/courtvision',
  },
  className = '',
}: FooterProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(contactEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy email:', error);
    }
  };

  return (
    <footer className={`border-t border-[var(--border-soft)] bg-[rgba(10,8,6,0.78)] backdrop-blur-2xl ${className}`}>
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-[var(--text-soft)]">
            {copyrightText}
          </p>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[var(--text-muted)]">
              Подписывайтесь на нас
            </span>
            <a
              href={socialLinks.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-[var(--text-muted)] transition hover:text-[#26A5E4]"
              aria-label="Telegram"
            >
              <TelegramIcon className="h-6 w-6" />
            </a>
            <a
              href={socialLinks.vk}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-[var(--text-muted)] transition hover:text-[#0077FF]"
              aria-label="VK"
            >
              <VKIcon className="h-6 w-6" />
            </a>

            <div className="mx-1 h-6 w-px bg-[var(--border-soft)]" />
            <button
              onClick={handleCopyEmail}
              className="relative flex items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[rgba(255,246,229,0.03)] px-3 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[rgba(232,161,67,0.22)] hover:bg-[rgba(232,161,67,0.08)] hover:text-[var(--accent-soft)]"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span className="text-emerald-400">Скопировано!</span>
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  <span className="hidden sm:inline">{contactEmail}</span>
                  <span className="sm:hidden">Email</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;