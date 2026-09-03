'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/',             label: 'חדר המצב', icon: '◉' },
  { href: '/jobs',         label: 'משרות',    icon: '▤' },
  { href: '/applications', label: 'הגשות',    icon: '↗' },
  { href: '/replies',      label: 'תשובות',   icon: '✉' },
  { href: '/sources',      label: 'מקורות',   icon: '⚙' },
];

export default function Nav() {
  const path = usePathname();
  const on = (h: string) => (h === '/' ? path === '/' : path.startsWith(h));
  return (
    <>
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
