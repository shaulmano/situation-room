'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { mutualsHref, peopleAtCompanyHref, type WarmContact } from '@/lib/contacts';
import { referralMessage , cvFamilyForTitle } from '@/lib/outreach';
import { isAgency, rankContacts } from '@/lib/pickContact';

// The block that sits under a job row when Shaul already knows someone at that
// company. Collapsed by default: on a day with forty jobs, four of them warm,
// an open block on each would bury the rest of the feed.
//
// Styling is inline on purpose. Everything here is three colours and a border
// straight out of globals.css, and a dozen new class names in a stylesheet
// nobody opens is a worse trade than a few style props.
const line: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 6,
  padding: '6px 0',
  borderTop: '1px solid var(--hair)',
};

const link: React.CSSProperties = {
  fontSize: '.76rem',
  fontWeight: 700,
  textDecoration: 'none',
  color: 'var(--accent)',
  border: '1px solid var(--accent)',
  borderRadius: 6,
  padding: '.22em .6em',
  whiteSpace: 'nowrap',
};

const button: React.CSSProperties = { ...link, background: 'transparent', cursor: 'pointer', width: 'auto' };

export type JobRef = {
  /** מזהה המשרה, כדי לדעת על מה כתבת כשתגיע תגובה. */
  id?: string | null;
  company: string; title: string;
  cvId?: string | null;
  // 13.11.2026: הקישור למודעה. שלושת הראשונים שענו שאלו על איזו
  // משרה מדובר, ושם התפקיד לבדו לא הספיק להם.
  url?: string | null;
  foundFor?: string | null;
  /** המשרה כבר הוגשה. משנה את ההודעה מ"יש משרה" ל"הגשתי למשרה". */
  applied?: boolean;
};

// גרסאות קורות החיים, באותם מזהים שהניקוד משתמש בהם.
//
// 15.11.2026: נוספה Release. היא קיימת במסד ויש לה קובץ, והיא פשוט לא
// הייתה כאן, ולכן משרת Release קיבלה את הגרסה הלא נכונה בלי שום דרך
// לבחור אחרת.
const CVS: [string, string][] = [
  ['qa', 'QA'],
  ['program', 'תוכניות'],
  ['delivery', 'Delivery'],
  ['release', 'Release'],
];

export default function JobContacts(
  { contacts, job, open = false }:
  { contacts: WarmContact[]; job: JobRef; open?: boolean },
) {
  const [rows, setRows] = useState(contacts);
  const [showAll, setShowAll] = useState(false);
  if (rows.length === 0) return null;

  function patch(id: string, fields: Partial<WarmContact>) {
    setRows((prev) => prev.map((p) => (p.id === id ? { ...p, ...fields } : p)));
  }

  // 14.11.2026. שאול מול SQLink עם עשרה אנשי קשר: "אם כן מה אני אמור
  // לעשות פה?" תשעה כרטיסים בלי סדר הם לא תשע הזדמנויות, הם שאלה פתוחה.
  //
  // הסדר עכשיו קבוע: עמית בתחום של המשרה ראשון, אחריו מי שמחזיק את
  // הגיוס, ובסוף מגייסת זוטרה. בחברת השמה מוצג אחד בלבד, כי שם כולם
  // מגייסים של אותה חברה ותשע פניות הן תשעה עותקים של אותה הודעה.
  const agency = isAgency(job.company);
  // **מי שוויתרת עליו יוצא מהחישוב ולא רק מהתצוגה.** 16.11.2026, שאול:
  // "ברגע שאני כותב לאנשי קשר ובוחר להתעלם מהאחרים זה לא סוגר לי את
  // המשימה." השרת כבר סינן אותו (ראה `skipped` ב-`warm/page.tsx`), אבל
  // כאן, בין הלחיצה לרענון הבא, הוא נשאר ברשימה והמשיך להיספר.
  const ranked = rankContacts(rows.filter((c) => !c.skipped_at), job.title, agency);
  // מי שפנית אליו יורד לתחתית ולא נעלם, וגם לא נספר במכסה של השלושה
  // המוצגים: אחרת כרטיס שטיפלת בו היה חוסם את מי שעוד מחכה.
  const openFirst = [...ranked].sort(
    (a, b) => Number(!!a.contacted_at) - Number(!!b.contacted_at));
  const cap = agency ? 1 : 3;
  const openOnes = openFirst.filter((c) => !c.contacted_at);
  const doneOnes = openFirst.filter((c) => c.contacted_at);
  const visible = showAll
    ? openFirst
    : [...openOnes.slice(0, cap), ...doneOnes];
  const hidden = openFirst.length - visible.length;
  // כמה עוד מחכים לפנייה. זה מה שקובע אדום או ירוק, ואת הטקסט בשורה.
  const waiting = openOnes.length;

  return (
    <details
      // 12.11.2026: במסך "דרך מישהו שאתה מכיר" הבלוק הזה הוא כל התוכן,
      // ולכן הוא נפתח לבד. בפיד הרגיל הוא נשאר מקופל.
      //
      // 15.11.2026, שאול ביטל את זה: **"אני רוצה שהשורות יהיו סגורות
      // בדיפולט"**. עם שמונה כרטיסים פתוחים המסך הוא גלילה אחת ארוכה
      // ואי אפשר לסרוק אותו בעין. `open` הוסר משלושת המקומות שהעבירו
      // אותו, והשורה הסגורה נושאת עכשיו את כל מה שצריך כדי להחליט אם
      // לפתוח אותה.
      open={open}
      style={{
        flex: '1 1 100%',
        marginTop: 8,
        // 15.11.2026, שאול: "מה שמחכה לי לביצוע שם יהיה אדום ואחרי ביצוע
        // ירוק". הצבע יושב על הקופסה ולא רק על הטקסט, כי שורה סגורה
        // צריכה להיקרא במבט אחד בלי לפתוח אותה.
        background: waiting ? 'var(--bad-soft)' : 'var(--good-soft)',
        border: '1px solid ' + (waiting ? 'var(--bad)' : 'var(--good)'),
        borderRadius: 6,
        padding: '8px 10px',
      }}
    >
      <summary
        style={{
          cursor: 'pointer', fontSize: '.8rem', fontWeight: 700,
          color: waiting ? 'var(--bad)' : 'var(--good)',
        }}
      >
        {/* והטקסט אומר את אותו דבר כמו הצבע. צבע לבדו אינו מידע: הוא נעלם
            בצילום מסך בשחור לבן, והוא לא נגיש למי שלא מבחין בו. */}
        {waiting === 0
          ? `פנית לכל ${rows.length === 1 ? 'מי שאתה מכיר שם' : rows.length + ' המכרים שם'}`
          : waiting === 1
            ? 'מכר אחד מחכה לפנייה'
            : `${waiting} מכרים מחכים לפנייה`}
        {ranked.length > 1 && !agency && waiting > 0 && ' · הראשון הוא הכי שווה'}
      </summary>

      {agency && (
        <p style={{ margin: '6px 0 0', fontSize: '.74rem', color: 'var(--muted)' }}>
          ‏{job.company} היא חברת השמה, כלומר האנשים שאתה מכיר שם הם המגייסים
          ולא עובדים אצל המעסיק. בקשה "להעביר פנימית" חסרת משמעות כאן, ופנייה
          אחת מספיקה. ההודעה כבר כתובה בהתאם.
        </p>
      )}

      {visible.map((c) => (
        <Contact key={c.id} contact={c} job={job} onPatch={(f) => patch(c.id, f)} />
      ))}

      {/* 14.11.2026. שאול: "אולי אתה יכול להביא אנשי קשר אחרים במקומו
          באותה חברה... איש קשר שעובד שם והוא לא חבר, ואז לבקש חברות".
          קישור לחיפוש של לינקדאין ולא רשימה שנגרדה: הכלל שלו עצמו הוא
          שקשרים מדרגה שנייה לא נגרדים, רק מקשרים לחיפוש. */}
      {peopleAtCompanyHref(job.company, job.title) && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--hair)' }}>
          <a
            style={link}
            href={peopleAtCompanyHref(job.company, job.title) as string}
            target="_blank"
            rel="noreferrer"
          >
            מצא עוד אנשים ב{job.company}
          </a>
          <span style={{ fontSize: '.72rem', color: 'var(--muted)', marginInlineStart: 8 }}>
            דרגה שנייה, לבקשת חברות עם פתק
          </span>
        </div>
      )}

      {hidden > 0 && (
        <button
          type="button"
          style={{ ...button, marginTop: 8 }}
          onClick={() => setShowAll(true)}
        >
          הצג עוד {hidden}
        </button>
      )}
      {showAll && ranked.length > cap && (
        <button
          type="button"
          style={{ ...button, marginTop: 8 }}
          onClick={() => setShowAll(false)}
        >
          הצג רק את {cap === 1 ? 'הראשון' : `${cap} הראשונים`}
        </button>
      )}
    </details>
  );
}

function Contact({
  contact,
  job,
  onPatch,
}: {
  contact: WarmContact;
  job: JobRef;
  onPatch: (fields: Partial<WarmContact>) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(contact.phone ?? '');
  const [draft, setDraft] = useState<string | null>(null);
  // Which CV the message points at. It starts at the family the matcher picked,
  // but that pick is wrong often enough to matter: a Principal Product Manager
  // posting came through as delivery. Getting it wrong here is not a chip on a
  // row, it is the wrong file in a message to someone doing Shaul a favour.
  // ברירת המחדל נגזרת מכותרת המשרה, ולא נופלת ל-QA.
  //
  // 15.11.2026, שאול על Senior Program Manager ב-Dream: "למה אתה מציע
  // לפרסם קורות חיים QA כאשר מה שהגשתי זה פרוגרם?" ההגדרה הקודמת
  // הייתה `job.cvId ?? 'qa'`, כלומר **כל משרה שלא נשא אותה מזהה גרסה
  // קיבלה את גרסת ה-QA**, בלי שום סימן שמשהו לא בסדר. זה אותו דפוס
  // שתוקן היום בתור הפנייה בלינקדאין: נפילה שקטה לברירת מחדל היא
  // קובץ לא נכון ולא שגיאה.
  //
  // הכותרת מכריעה כשהיא אומרת משהו ברור, והמזהה מהניקוד משמש כשהיא
  // לא. הוא עדיין עדיף במקום אחד: הוא יודע להבדיל בין program לבין
  // project-release-manager, והכותרת לא.
  const known = (id?: string | null) => (id && CVS.some(([k]) => k === id) ? id : null);
  const [cv, setCv] = useState<string>(
    known(cvFamilyForTitle(job.title)) ?? known(job.cvId) ?? 'qa'
  );
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  // ויתור. אופטימי, והשורה חוזרת אם הכתיבה נכשלה: שורה שנעלמה ולא נשמרה
  // גרועה משורה שסירבה, כמו בכל שאר הסימונים כאן.
  const [skipped, setSkipped] = useState(false);
  const mutuals = mutualsHref(contact.linkedin_url);

  async function skip() {
    setSkipped(true);
    // 16.11.2026: **הפאטץ' היה ריק, וזה מה ששבר את סגירת המשימה.**
    // השורה נעלמה מהמסך (`if (skipped) return null`) אבל הכרטיס שמעליה
    // המשיך לספור אותה כמחכה לפנייה, ולכן הוא נשאר אדום ואמר
    // "2 מכרים מחכים" אחרי שפנית לשניים וויתרת על השאר.
    const ok = await save({ skipped: true }, { skipped_at: new Date().toISOString() });
    if (!ok) setSkipped(false);
  }

  const askedDays = contact.contacted_at
    ? Math.floor((Date.now() - new Date(contact.contacted_at).getTime()) / 864e5)
    : null;

  async function save(fields: Record<string, unknown>, applied: Partial<WarmContact>) {
    setBusy(true);
    const res = await fetch('/api/contacts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: contact.id, ...fields }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      onPatch(applied);
      // **וגם הצד שרת מחושב מחדש.** בלי זה הספירה בטאב והרשימה שמתחתיה
      // נחשבות בשני רגעים שונים: הטאב אמר "היום 0" בזמן שהכרטיס עדיין
      // הוצג. 16.11.2026.
      router.refresh();
    }
    return !!res?.ok;
  }

  // The message is built once, when the panel opens, and then left alone. It is
  // a draft in a textarea, not generated text on a leash: editing it before
  // copying is the normal case, not an exception.
  function compose(cvId: string): string {
    return referralMessage({
      contactName: contact.full_name,
      company: job.company,
      jobTitle: job.title,
      cvId,
      // 13.11.2026: גם כאן. התפקיד של איש הקשר קובע אם מבקשים ממנו
      // להעביר הלאה או להסתכל, וכותרת בעברית מתורגמת לאנגלית.
      contactTitle: contact.title,
      jobUrl: job.url,
      foundFor: job.foundFor,
      applied: job.applied,
      agency: isAgency(job.company),
    });
  }

  function openDraft() {
    setDraft(compose(cv));
  }

  async function copy() {
    if (draft === null) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  // 14.11.2026. שאול סימן "פניתי" והכרטיס נראה בדיוק אותו דבר: "פניתי
  // וסימנתי וכלום לא קורה... צריך לצבוע אותה בצבע אחר. ולשמור אותה."
  // סימון שלא משנה כלום על המסך הוא סימון שאי אפשר לסמוך עליו, והעלמה
  // של השורה ברענון הבא גרועה עוד יותר: אין שום עדות למה שעשית היום.
  const done = !!contact.contacted_at;

  // ויתרת עליו: השורה יורדת מיד. ברענון הבא היא לא תחזור, כי `skipped_at`
  // מסנן אותו מההתאמה בשרת.
  if (skipped) return null;

  return (
    <div
      style={{
        ...line,
        ...(done ? {
          background: 'color-mix(in srgb, var(--good) 10%, transparent)',
          borderInlineStart: '3px solid var(--good)',
          paddingInlineStart: 8,
          borderRadius: 6,
        } : null),
      }}
    >
      <span style={{ flex: '1 1 140px', minWidth: 0, fontSize: '.82rem', fontWeight: 600 }}>
        {contact.full_name}
        {contact.title && (
          <span style={{ display: 'block', color: 'var(--muted)', fontSize: '.72rem', fontWeight: 400 }}>
            {contact.title}
          </span>
        )}
        {askedDays !== null && (
          <span
            className="chip ok"
            style={{ display: 'inline-block', marginTop: 3, fontSize: '.72rem' }}
          >
            ✓ {askedDays === 0 ? 'פנית היום' : `פנית לפני ${askedDays} ימים`}
          </span>
        )}
      </span>

      <button type="button" style={button} onClick={() => (draft === null ? openDraft() : setDraft(null))}>
        {draft === null ? 'פנייה' : 'סגור'}
      </button>
      {contact.email && <a style={link} href={`mailto:${contact.email}`}>מייל</a>}
      {contact.phone && (
        <a style={link} href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`} dir="ltr">
          {contact.phone}
        </a>
      )}
      {contact.linkedin_url && (
        <a style={link} href={contact.linkedin_url} target="_blank" rel="noreferrer">פרופיל</a>
      )}
      {mutuals && (
        <a style={link} href={mutuals} target="_blank" rel="noreferrer" title="לינקדאין מציג מי מהקשרים שלו מוכר גם לך">
          מי עוד מכיר
        </a>
      )}

      {!contact.phone && !editing && (
        <button type="button" style={button} onClick={() => setEditing(true)}>הוסף טלפון</button>
      )}

      {/* 15.11.2026, שאול: **"תוסיף כפתור מוותר. במקרה של גילה היא לא
          תעזור לי"**. גילה אייזקס היא Office Manager ב-Comm-IT, והמשרה
          היא Software Project Manager. היא תחזור אליו כל יום על כל משרה
          פתוחה שם, והוא יגלול מעליה שוב ושוב.

          **העמודה קיימת מ-13.11**, `contacts.skipped_at`, שנוספה בדיוק
          לבקשה הזאת ובמילים האלה. מה שלא נבנה הוא הכפתור והסינון, ולכן
          שום דבר לא קרה. זאת הפעם השביעית שדפוס כזה חוזר כאן.

          **לא `contacted_at`**: מי שוויתרת עליו לא נשלח אליו כלום, והוא
          לא יכול להיספר בתוך אחוז המענה. זה מה שהמיגרציה עצמה אומרת.
          והוא הפיך: זאת חותמת זמן, ואפשר לנקות אותה. */}
      {!contact.contacted_at && !skipped && (
        <button
          type="button"
          style={{ ...button, color: 'var(--muted)' }}
          title="לא יעזור כאן. השורה תרד מהרשימה ואיש הקשר יישאר"
          onClick={skip}
        >
          מוותר
        </button>
      )}

      {editing && (
        <span style={{ display: 'flex', gap: 6, flex: '1 1 160px' }}>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="052-0000000"
            dir="ltr"
            style={{
              flex: 1,
              minWidth: 0,
              font: 'inherit',
              fontSize: '.8rem',
              padding: '.25em .5em',
              background: 'var(--surface)',
              color: 'var(--ink)',
              border: '1px solid var(--line)',
              borderRadius: 6,
            }}
          />
          <button
            type="button"
            style={button}
            disabled={busy}
            onClick={async () => {
              const ok = await save({ phone }, { phone: phone.trim() || null });
              if (ok) setEditing(false);
            }}
          >
            {busy ? '…' : 'שמור'}
          </button>
        </span>
      )}

      {draft !== null && (
        <div style={{ flex: '1 1 100%', marginTop: 6 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            style={{
              width: '100%',
              font: 'inherit',
              fontSize: '.8rem',
              lineHeight: 1.5,
              padding: '.5em .6em',
              background: 'var(--surface)',
              color: 'var(--ink)',
              border: '1px solid var(--line)',
              borderRadius: 6,
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, alignItems: 'center' }}>
            <span style={{ fontSize: '.72rem', color: 'var(--muted)' }}>קורות חיים:</span>
            {CVS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => { setCv(id); setDraft(compose(id)); }}
                style={{
                  ...button,
                  opacity: cv === id ? 1 : 0.5,
                  borderStyle: cv === id ? 'solid' : 'dashed',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            <button type="button" style={button} onClick={copy}>
              {copied ? 'הועתק' : 'העתק'}
            </button>
            {contact.linkedin_url && (
              <a style={link} href={contact.linkedin_url} target="_blank" rel="noreferrer">
                פתח שיחה בלינקדאין
              </a>
            )}
            <button
              type="button"
              style={button}
              disabled={busy}
              onClick={async () => {
                const ok = await save(
                  { contacted: true, jobId: job.id ?? null },
                  { contacted_at: new Date().toISOString() });
                if (ok) setDraft(null);
              }}
            >
              {busy ? '…' : 'סמן שפניתי'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
