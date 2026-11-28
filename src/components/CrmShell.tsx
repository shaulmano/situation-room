'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import RefreshOnFocus from './RefreshOnFocus';
import ClearBadge from './ClearBadge';
import '../app/clients/clients.css';

// מעטפת ה-CRM: תפריט צד כהה בסגנון הרמטיקון. 26.11.2026, שאול: "כל התפריט
// בצד ימין, בהמשך נוסיף עוד דברים כמו דוחות, אבל העבודה תהיה מדף הלקוחות".
const GROUPS: { title: string; items: { href: string; label: string; tip: string }[] }[] = [
  { title: 'עבודה', items: [
    { href: '/', label: 'דף הבית', tip: 'סיכום היום ומשרות חדשות' },
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
  ] },
];

export default function CrmShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  // כל כפתור, קישור ותג בלי tooltip מקבל את הטקסט שלו, כדי שכשהטקסט מוקטן בשורה אחת אפשר לקרוא אותו במעבר עכבר.
  useEffect(() => {
    const fill = () => document.querySelectorAll<HTMLElement>('.hx-main button:not([title]), .hx-main a:not([title]), .hx-main summary:not([title]), .hx-main .hx-pill:not([title]), .hx-main .hx-tag:not([title])').forEach((el) => {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (t) el.title = t.slice(0, 120);
    });
    // כל הכפתורים של בלוק בשורה אחת (שאול, 26.11.2026). ה-CSS לא יודע כמה טקסט יש, ולכן
    // שורה שירדה לשתי שורות מקבלת גופן קטן יותר עד שהיא נכנסת. בלוק רחב באמצע השורה
    // (בחירת מכר, הערה) מפריד בין קטעים, וכל קטע נמדד לבד. מינימום 9px; אם גם אז לא נכנס,
    // הכפתורים מתכווצים והטקסט נחתך עם tooltip, אבל לא יורד שורה.
    const ROW = '.cn-flow,.cn-acts,.gold-acts,.reach-acts,.filters,.hx-acts,.hx-chips,.cn-line,.hx-gos,.hx-leg';
    const fit = () => document.querySelectorAll<HTMLElement>(ROW).forEach((row) => {
      if (!row.offsetWidth) return;
      const segs: HTMLElement[][] = [[]];
      // עטיפות display:contents (span סביב כפתור) הן שקופות: מסתכלים על מה שבתוכן.
      const flat = (el: HTMLElement): HTMLElement[] => (Array.from(el.children) as HTMLElement[])
        .flatMap((k) => (getComputedStyle(k).display === 'contents' ? flat(k) : [k]));
      for (const k of flat(row)) {
        if (/^(BUTTON|A|SUMMARY)$/.test(k.tagName)) segs[segs.length - 1].push(k);
        else if (segs[segs.length - 1].length) segs.push([]);
      }
      for (const kids of segs) {
        if (kids.length < 2) continue;
        const wrapped = () => { const t = kids.map((k) => k.offsetTop); return Math.max(...t) - Math.min(...t) > 8; };
        if (!wrapped()) continue;
        let size = parseFloat(getComputedStyle(kids[0]).fontSize) || 12;
        while (wrapped() && size > 9) { size -= 0.5; kids.forEach((k) => k.style.setProperty('font-size', size + 'px', 'important')); }
        if (wrapped()) {
          row.style.setProperty('flex-wrap', 'nowrap', 'important');
          kids.forEach((k) => { k.style.setProperty('min-width', '0', 'important'); k.style.setProperty('overflow', 'hidden'); k.style.setProperty('text-overflow', 'ellipsis'); });
        }
      }
    });
    const run = () => { fill(); fit(); };
    run();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const mo = new MutationObserver(() => { if (timer) clearTimeout(timer); timer = setTimeout(run, 150); });
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', run);
    // פרט מקופל שנפתח לא משנה את ה-DOM, ושורה שבתוכו נמדדת רק כשהיא נראית.
    document.addEventListener('toggle', run, true);
    return () => { mo.disconnect(); window.removeEventListener('resize', run); document.removeEventListener('toggle', run, true); if (timer) clearTimeout(timer); };
  }, [path]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    let dead = false;
    const load = () => {
      if (path.startsWith('/login') || path.startsWith('/auth')) return;
      fetch('/api/nav-counts', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((d) => {
        if (dead || !d) return;
        setCounts({ '/clients': d.clients ?? 0, urgent: d.urgent ?? 0 });
      }).catch(() => {});
    };
    load();
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { dead = true; document.removeEventListener('visibilitychange', onVis); };
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
                <Link key={i.href} href={i.href} title={i.tip} className={(on(i.href) ? 'on' : '') + (counts[i.href] > 0 ? (i.href === '/clients' && counts.urgent > 0 ? ' wait red' : ' wait') : '')}>{i.label}{counts[i.href] > 0 && <b className={'hx-cnt' + (i.href === '/clients' && counts.urgent > 0 ? ' red' : '')} title={counts.urgent > 0 ? `לקוחות שמחכים לפעולה שלך, ${counts.urgent} מהם ענו לך` : 'לקוחות שמחכים לפעולה שלך'}>{counts[i.href]}</b>}</Link>
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
