'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import RefreshOnFocus from './RefreshOnFocus';
import ClearBadge from './ClearBadge';
import '../app/clients/clients.css';

// מעטפת ה-CRM: תפריט צד כהה בסגנון הרמטיקון. 26.11.2026, שאול: "כל התפריט
// בצד ימין, בהמשך נוסיף עוד דברים כמו דוחות, אבל העבודה תהיה מדף הלקוחות".
const GROUPS: { title: string; items: { href: string; label: string; tip: string }[] }[] = [
  { title: 'עבודה', items: [
    { href: '/clients', label: 'לקוחות', tip: 'כל המגייסות, ה-HR ומנהלי הפיתוח, והמשרות בחברות שלהם. משם עובדים' },
    { href: '/today', label: 'מטלות להיום', tip: 'מה מחכה לך היום, לפי הסדר' },
    { href: '/replies', label: 'תשובות', tip: 'מי ענה לך ומה כתב, עם תשובה מוצעת' },
    { href: '/warm', label: 'מכרים', tip: 'מכרים בחברות שיש בהן משרה, ופנייה אליהם' },
    { href: '/connect', label: 'בקשות חברות', tip: 'חברות עם משרה פתוחה שאין בהן איש קשר: בקשת חברות לפי משרה' },
    { href: '/reach', label: 'פנייה רחבה', tip: 'פנייה יומית למגייסים שעוד לא פנית אליהם' },
  ] },
  { title: 'משרות', items: [
    { href: '/jobs', label: 'כל המשרות', tip: 'ארכיון כל המשרות שנסרקו, עם סינון לפי מקור' },
    { href: '/applications', label: 'הגשות', tip: 'כל המשרות שהגשת אליהן והסטטוס שלהן' },
    { href: '/radar', label: 'מתחת לרדאר', tip: 'משרות שנמצאו בחיפוש בוליאני בגוגל' },
    { href: '/gold', label: 'חברות זהב', tip: 'חברות יעד, אנשי גיוס ומשרות מאומתות' },
  ] },
  { title: 'מערכת', items: [
    { href: '/sources', label: 'מקורות', tip: 'מצב הסריקה של כל לוח משרות' },
    { href: '/settings', label: 'הגדרות', tip: 'התראות, סיסמה והתנתקות' },
    { href: '/', label: 'דף הבית', tip: 'סיכום היום ומשרות חדשות' },
  ] },
];

export default function CrmShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  // כל כפתור, קישור ותג בלי tooltip מקבל את הטקסט שלו, כדי שכשהטקסט מוקטן בשורה אחת אפשר לקרוא אותו במעבר עכבר.
  useEffect(() => {
    const fill = () => document.querySelectorAll<HTMLElement>('.hx-main button:not([title]), .hx-main a:not([title]), .hx-main summary:not([title]), .hx-main .hx-pill:not([title]), .hx-main .hx-tag:not([title])').forEach((el) => {
      const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
      if (t) el.title = t.slice(0, 120);
    });
    fill();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const mo = new MutationObserver(() => { if (timer) clearTimeout(timer); timer = setTimeout(fill, 150); });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); if (timer) clearTimeout(timer); };
  }, [path]);
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
                <Link key={i.href} href={i.href} title={i.tip} className={on(i.href) ? 'on' : ''}>{i.label}</Link>
              ))}
            </div>
          ))}
          <div className="hx-grp"><div className="hx-gt">בקרוב</div><span className="soon" title="יתווסף בהמשך">דוחות</span></div>
        </nav>
      </aside>
      <main className="hx-main">{children}</main>
    </div>
  );
}
