'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/',             label: 'חדר המצב', icon: '◉' },
  { href: '/jobs',         label: 'משרות',    icon: '▤' },
  { href: '/applications', label: 'הגשות',    icon: '↗' },
  { href: '/replies',      label: 'תשובות',   icon: '✉' },
  { href: '/sources',      label: 'מקורות',   icon: '▦' },
  { href: '/settings',     label: 'הגדרות',   icon: '⚙' },
];

export default function Nav() {
  const path = usePathname();
  if (path.startsWith('/login') || path.startsWith('/auth')) return null;
  const on = (h: string) => (h === '/' ? path === '/' : path.startsWith(h));
  return (
    <>
      <header className="top">
        <h1 className="brand">חדר <span>המצב</span></h1>
      </header>
      <nav className="dnav">
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} className={on(i.href) ? 'on' : ''}>{i.label}</Link>
        ))}
      </nav>
      <nav className="bnav">
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} className={on(i.href) ? 'on' : ''}>
            <span className="ic" aria-hidden="true">{i.icon}</span>
            {i.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
