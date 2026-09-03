'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Marking a job applied in one tab left every other tab still showing it. These
// pages are server-rendered, so a tab holds whatever was true when it loaded —
// refetch when it comes back to the front.
export default function RefreshOnFocus() {
  const router = useRouter();

  useEffect(() => {
    let last = Date.now();

    const refresh = () => {
      // Switching between tabs fires this constantly; once every few seconds is
      // enough to catch a change made elsewhere.
      if (Date.now() - last < 3000) return;
      last = Date.now();
      router.refresh();
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [router]);

  return null;
}
