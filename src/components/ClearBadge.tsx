'use client';
import { useEffect } from 'react';

// Opening the app is what "seen" means here, so the badge clears on arrival
// rather than needing anything pressed. Both paths are tried: the page can
// clear it directly when it has focus, and the service worker can do it when
// the notification was tapped from a cold start.
export default function ClearBadge() {
  useEffect(() => {
    const clear = () => {
      const nav = navigator as Navigator & { clearAppBadge?: () => Promise<void> };
      nav.clearAppBadge?.().catch(() => {});
      navigator.serviceWorker?.controller?.postMessage({ type: 'clear-badge' });
    };

    // Refetch sw.js rather than trusting the HTTP cache: a stale worker is
    // indistinguishable from a feature that does not work.
    navigator.serviceWorker
      ?.register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => reg.update())
      .catch(() => {});

    clear();
    const onVisible = () => { if (document.visibilityState === 'visible') clear(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  return null;
}
