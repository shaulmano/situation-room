'use client';
import { titleTokens, type DupCandidate } from '@/lib/dedupe';

/**
 * בדיקת כפילות בעין, על השורה עצמה.
 *
 * 17.11.2026, שאול: **"אני אבדוק בעין ואז אחליט במקום כפולה וודאית כן
 * או לא."** הוא ביקש כפתור שפותח בדיקה, מציג את הרשומות שנראות אותה
 * משרה, ושהן לחיצות ונפתחות במודעה המקורית.
 *
 * **הפאנל לא מכריע והוא לא כותב כלום.** הוא מציג ראיות: מה שונה בכותרת,
 * מאיזה לוח, איפה, ומתי. ההכרעה היא שלו, והיא מתבצעת בכפתור שכבר קיים
 * על השורה: ה-✕ סוגר את המיותרת.
 *
 * **ולמה לא להציג תיאורים זה מול זה.** נמדד באותו בוקר: מתוך 522 השורות
 * שיושבות בקבוצות כפילות, 39 נושאות תיאור שמור, שבעה אחוזים. פאנל
 * שמבטיח השוואת תיאורים ומציג ריק ברוב המקרים גרוע מפאנל שלא מבטיח.
 */

function Diff({ mine, theirs }: { mine: string; theirs: string }) {
  // המילים שיש להם ואין לי הן מה שמסביר למה זאת אולי משרה אחרת.
  const my = titleTokens(mine);
  const words = (theirs ?? '').split(/(\s+)/);
  return (
    <>
      {words.map((w, i) => {
        const bare = w.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
        const isNew = bare.length > 1 && !my.has(bare);
        return isNew ? <b key={i} className="dup-new">{w}</b> : <span key={i}>{w}</span>;
      })}
    </>
  );
}

function when(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '' : d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
}

export default function DuplicateCheck(
  { title, candidates }: { title: string; candidates: DupCandidate[] },
) {
  if (!candidates.length) return null;

  return (
    <details className="dup">
      <summary>
        ◀ בדוק כפילות ({candidates.length})
      </summary>
      <p className="dup-hint">
        באותה חברה, כותרת קרובה ולא זהה. <b>מה ששונה מודגש.</b> לחיצה פותחת
        את המודעה עצמה בלשונית חדשה. אם נחתת ברשימת המשרות של החברה במקום
        במודעה, המודעה כבר נסגרה.
      </p>
      {candidates.map((c) => (
        <div className="dup-row" key={c.id}>
          {c.url ? (
            <a href={c.url} target="_blank" rel="noreferrer" className="dup-title">
              <Diff mine={title} theirs={c.title} />
            </a>
          ) : (
            <span className="dup-title"><Diff mine={title} theirs={c.title} /></span>
          )}
          <div className="dup-meta">
            {[
              c.source,
              c.location || null,
              c.posted ? 'פורסמה ' + when(c.posted) : null,
              c.firstSeen ? 'נכנסה ' + when(c.firstSeen) : null,
              c.foundFor ? 'נמצאה בחיפוש ' + c.foundFor : null,
            ].filter(Boolean).join(' · ')}
          </div>
        </div>
      ))}
      <p className="dup-hint">
        אותה משרה? סגור את המיותרת ב-✕ שעל השורה שלה.
      </p>
    </details>
  );
}
