'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import RefreshOnFocus from './RefreshOnFocus';
import ClearBadge from './ClearBadge';

const ITEMS: { href: string; label: string; icon: string; wide?: boolean }[] = [
  { href: '/',             label: 'חדר המצב', icon: '◉' },
  { href: '/jobs',         label: 'משרות',    icon: '▤' },
  { href: '/applications', label: 'הגשות',    icon: '↗' },
  { href: '/replies',      label: 'תשובות',   icon: '✉' },
  // 12.11.2026: פניות דרך מכרים. נוסף לניווט העליון בלבד, כי שבעה פריטים
  // בשורה התחתונה בטלפון חותכים את "חדר המצב". בטלפון מגיעים לשם מהבאנר
  // שבראש חדר המצב, שהוא ממילא המסך שמולו שאול יושב.
  { href: '/warm',         label: 'מכרים',    icon: '◈', wide: true },
  { href: '/sources',      label: 'מקורות',   icon: '▦' },
  { href: '/settings',     label: 'הגדרות',   icon: '⚙' },
];

export default function Nav() {
  const path = usePathname();
  if (path.startsWith('/login') || path.startsWith('/auth')) return null;
  const on = (h: string) => (h === '/' ? path === '/' : path.startsWith(h));
  return (
    <>
      <RefreshOnFocus />
      <ClearBadge />
      <header className="top">
        <h1 className="brand">חדר <span>המצב</span></h1>
      </header>
      <nav className="dnav">
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} className={on(i.href) ? 'on' : ''}>{i.label}</Link>
        ))}
      </nav>
      <nav className="bnav">
        {ITEMS.filter((i) => !i.wide).map((i) => (
          <Link key={i.href} href={i.href} className={on(i.href) ? 'on' : ''}>
            <span className="ic" aria-hidden="true">{i.icon}</span>
            {i.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
