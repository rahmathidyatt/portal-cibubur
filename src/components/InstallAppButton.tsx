import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Tombol "Pasang aplikasi": muncul bila browser menawarkan pemasangan PWA. */
export const InstallAppButton: React.FC<{ className?: string; onDone?: () => void }> = ({ className, onDone }) => {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setPromptEvent(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!promptEvent) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        await promptEvent.prompt();
        await promptEvent.userChoice.catch(() => undefined);
        setPromptEvent(null);
        onDone?.();
      }}
      className={
        className ??
        'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 rounded-lg ring-1 ring-slate-200 hover:bg-slate-100 cursor-pointer'
      }
    >
      <Download className="w-3.5 h-3.5" />
      Pasang aplikasi
    </button>
  );
};
