'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import RefreshOnFocus from './RefreshOnFocus';
import ClearBadge from './ClearBadge';
import '../app/clients/clients.css';

// מעטפת ה-CRM: תפריט צד כהה בסגנון הרמטיקון. 26.11.2026, שאול: "כל התפריט
// בצד ימין, בהמשך נוסיף עוד דברים כמו דוחות, אבל העבודה תהיה מדף הלקוחות".
const GROUPS: { title: string; items: { href: string; label: string }[] }[] = [
  { title: 'עבודה', items: [
    { href: '/clients', label: 'לקוחות' },
    { href: '/today', label: 'מטלות להיום' },
    { href: '/replies', label: 'תשובות' },
    { href: '/warm', label: 'מכרים' },
    { href: '/connect', label: 'בקשות חברות' },
    { href: '/reach', label: 'פנייה רחבה' },
  ] },
  { title: 'משרות', items: [
    { href: '/jobs', label: 'כל המשרות' },
    { href: '/applications', label: 'הגשות' },
    { href: '/radar', label: 'מתחת לרדאר' },
    { href: '/gold', label: 'חברות זהב' },
  ] },
  { title: 'מערכת', items: [
    { href: '/sources', label: 'מקורות' },
    { href: '/settings', label: 'הגדרות' },
    { href: '/', label: 'דף הבית' },
  ] },
];

export default function CrmShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  // מסך ההתחברות וחזרת ההתחברות בלי תפריט.
  if (path.startsWith('/login') || path.startsWith('/auth')) return <>{children}</>;
  const on = (h: string) => (h === '/' ? path === '/' : path.startsWith(h));
  return (
    <div className="hx">
      <RefreshOnFocus />
      <ClearBadge />
      <aside className="hx-side">
        <div className="hx-brand">חדר <span>המצב</span><small>CRM לחיפוש משרות</small></div>
        <nav>
          {GROUPS.map((g) => (
            <div key={g.title} className="hx-grp">
              <div className="hx-gt">{g.title}</div>
              {g.items.map((i) => (
                <Link key={i.href} href={i.href} className={on(i.href) ? 'on' : ''}>{i.label}</Link>
              ))}
            </div>
          ))}
          <div className="hx-grp"><div className="hx-gt">בקרוב</div><span className="soon">דוחות</span></div>
        </nav>
      </aside>
      <main className="hx-main">{children}</main>
    </div>
  );
}
