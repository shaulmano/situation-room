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
  // 12.11.2026: פניות דרך מכרים. היה wide, כלומר ניווט עליון בלבד, והנחתי
  // שבטלפון מגיעים מהבאנר שבראש חדר המצב. ההנחה הייתה שגויה: הבאנר נספר
  // מתוך המשרות של היום, וביום בלי משרות חדשות הוא לא מוצג בכלל. שאול,
  // 22:34: "אני לא רואה שום דבר שמזכיר טאב של מישהו שאני מכיר". בטלפון
  // פשוט לא הייתה דרך להגיע לשם.
  { href: '/warm',         label: 'מכרים',    icon: '◈' },
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
