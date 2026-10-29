import { lazy, Suspense, useEffect } from 'react';
import { Shell } from './Shell';
import { ToastHost } from '../ui/Toast';
const BrainDump = lazy(() => import('../features/capture/BrainDump').then((m) => ({ default: m.BrainDump })));
import { Shortcuts } from './Shortcuts';
import { seedOnboarding } from '../data/onboarding';
import { undo } from '../features/tasks/actions';
import { useSettings } from './settings';
import { useSyncLifecycle } from '../features/sync/useSync';

export function App() {
  const theme = useSettings((s) => s.theme);
  useSyncLifecycle();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    void navigator.storage?.persist?.();
    void seedOnboarding();
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.matches('input, textarea, [contenteditable]');
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey && !typing) {
        e.preventDefault();
        void undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <Shell />
      <ToastHost />
      <Shortcuts />
      <Suspense fallback={null}>
        <BrainDump />
      </Suspense>
    </>
  );
}
