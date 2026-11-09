import Link from 'next/link';
import { serverClient } from '@/lib/server';
import AppStep from '@/components/AppStep';

export const dynamic = 'force-dynamic';

const LABEL: Record<string, [string, string]> = {
  sent: ['נשלח', 'mute'],
  acknowledged: ['נצפה', 'warn'],
  replied: ['נענה', 'ok'],
  conversation: ['שיחה', 'ok'],
  interview: ['ראיון', 'ok'],
  rejected: ['נדחה', 'crit'],
  silent: ['שקט', 'mute'],
};

const MONTHS = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];

export default async function Applications({
  searchParams,
}: {
  searchParams: { status?: string; range?: string; month?: string; q?: string };
}) {
  const status = searchParams.status ?? '';
  const range = searchParams.range ?? '';
  // המפתח הוא YYYY-M עם חודש מאפס, בדיוק כמו ב-buckets, כדי שעמודה בגרף
  // והחתך שהיא פותחת ייגזרו מאותו ערך ולא משני חישובים שיכולים להיפרד.
  const month = searchParams.month ?? '';
  const q = searchParams.q ?? '';

  const { data } = await serverClient()
    .from('applications')
    .select('id, company, role, recipient, cv_id, channel, sent_at, status, next_at, next_kind, note')
    .order('sent_at', { ascending: false });

  const all = (data ?? []) as any[];

  // The dashboard tiles link here with the cut they counted, so arriving from a
  // tile lands on those rows rather than on all 161.
  const CONVERSATION = ['conversation', 'interview', 'offer'];
  const weekAgo = Date.now() - 7 * 864e5;
  const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const needle = q.trim().toLowerCase();
  const rows = all.filter((a) => {
    if (needle && !`${a.company ?? ''} ${a.role ?? ''} ${a.recipient ?? ''}`
      .toLowerCase().includes(needle)) return false;
    if (month && monthKey(new Date(a.sent_at)) !== month) return false;
    if (status === 'conversation') return CONVERSATION.includes(a.status);
    if (status && a.status !== status) return false;
    if (range === 'week') return new Date(a.sent_at).getTime() >= weekAgo;
    return true;
  });
  const filtered = Boolean(status || range || month || needle);
  const FILTER_LABEL: Record<string, string> = {
    conversation: 'שיחות שהתקיימו',
    silent: 'ללא מענה',
    acknowledged: 'נצפו על ידי מגייס',
    replied: 'נענו',
  };
  const MONTHS_FULL = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי',
                      'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const monthName = month
    ? `${MONTHS_FULL[Number(month.split('-')[1])]} ${month.split('-')[0]}`
    : '';
  const filterName = [
    status ? FILTER_LABEL[status] ?? status : '',
    monthName,
    needle ? `"${q}"` : '',
    !status && !monthName && !needle && range === 'week' ? 'הגשות השבוע' : '',
  ].filter(Boolean).join(' · ');
  // `all`, not `rows`: an empty filter result is not an empty database, and
  // saying the sync never ran would be a lie in that case.
  if (all.length === 0) {
    return (
      <>
        <h2>הגשות</h2>
        <div className="empty"><b>אין הגשות</b>הסנכרון מג&apos;ימייל עוד לא רץ.</div>
      </>
    );
  }

  // Every month between the first application and now, so a gap reads as a gap
  // rather than quietly closing up between two bars.
  const first = new Date(all[all.length - 1].sent_at);
  const buckets: { key: string; label: string; total: number; seen: number }[] = [];
  const index = new Map<string, number>();
  const cur = new Date(first.getFullYear(), first.getMonth(), 1);
  const end = new Date();
  while (cur <= end) {
    const key = `${cur.getFullYear()}-${cur.getMonth()}`;
    index.set(key, buckets.length);
    buckets.push({
      key,
      label: MONTHS[cur.getMonth()] + (cur.getMonth() === 0 ? ` ${String(cur.getFullYear()).slice(2)}` : ''),
      total: 0,
      seen: 0,
    });
    cur.setMonth(cur.getMonth() + 1);
  }
  for (const a of all) {
    const d = new Date(a.sent_at);
    const i = index.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (i === undefined) continue;
    buckets[i].total += 1;
    if (['acknowledged', 'replied', 'conversation', 'interview'].includes(a.status)) buckets[i].seen += 1;
  }
  const peak = Math.max(...buckets.map((b) => b.total), 1);

  const ENGAGED = ['acknowledged', 'replied', 'conversation', 'interview'];
  const seenTotal = rows.filter((a) => ENGAGED.includes(a.status)).length;

  // Same cut three ways. The share column is the point: volume without a
  // response rate beside it is the number that produced 145 applications and
  // no conversation.
  function breakdown(key: (a: any) => string) {
    const m = new Map<string, { total: number; seen: number }>();
    for (const a of rows) {
      const k = key(a) || '—';
      const cur = m.get(k) ?? { total: 0, seen: 0 };
      cur.total += 1;
      if (ENGAGED.includes(a.status)) cur.seen += 1;
      m.set(k, cur);
    }
    return [...m.entries()].sort((x, y) => y[1].total - x[1].total);
  }

  const CV_LABEL: Record<string, string> = {
    qa: 'QA', program: 'ניהול פרויקטים', delivery: 'גרסאות ו‑Delivery',
  };
  const CH_LABEL: Record<string, string> = {
    linkedin: 'לינקדאין', form: 'טופס באתר', email: 'מייל ישיר',
  };
  const byCv = breakdown((a) => CV_LABEL[a.cv_id] ?? a.cv_id);
  const byChannel = breakdown((a) => CH_LABEL[a.channel] ?? a.channel);
  const byStatus = breakdown((a) => (LABEL[a.status] ?? [a.status])[0]);

  return (
    <>
      <div className="screen-head">
        <h2>הגשות</h2>
        {filtered && <Link className="more" href="/applications">הצג הכל ←</Link>}
      </div>

      {filtered && (
        <p className="screen-note">
          מסונן: <b>{filterName}</b> · {rows.length} מתוך {all.length}
        </p>
      )}

      {rows.length === 0 && filtered && (
        <div className="empty">
          <b>אין הגשות בחתך הזה</b>
          <Link href="/applications">הצג את כל ההגשות</Link>
        </div>
      )}

      <div className="kpis">
        <div className="kpi"><div className="kpi-l">סה״כ</div><div className="kpi-v">{rows.length}</div></div>
        <div className="kpi"><div className="kpi-l">נצפו על ידי מגייס</div><div className="kpi-v">{seenTotal}</div></div>
        <div className="kpi">
          <div className="kpi-l">שיעור צפייה</div>
          <div className="kpi-v">{Math.round((seenTotal / rows.length) * 100)}%</div>
        </div>
      </div>

      <h2>לפי חודש</h2>
      <div className="chart">
        {/* כל עמודה פותחת את החודש שלה. 9.11.2026: הגרף הראה 238 בספטמבר
            ולא הייתה שום דרך לראות מי הן. מספר שאי אפשר לפתוח הוא מספר
            שצריך להאמין לו. */}
        {buckets.map((b) => (
          <Link
            className={'col' + (month === b.key ? ' on' : '')}
            key={b.key}
            href={b.total ? `/applications?month=${b.key}` : '/applications'}
            aria-label={`${b.label}, ${b.total} הגשות`}
          >
            <span className="col-n">{b.total || ''}</span>
            <span className="col-track">
              <span className="col-bar" style={{ height: `${(b.total / peak) * 100}%` }}>
                <span className="col-seen" style={{ height: b.total ? `${(b.seen / b.total) * 100}%` : '0%' }} />
              </span>
            </span>
            <span className="col-l">{b.label}</span>
          </Link>
        ))}
      </div>
      <p className="screen-note">
        הכהה בתוך כל עמודה הוא החלק שמגייס פתח. הקשה על חודש מציגה אותו.
      </p>

      <h2>פילוח</h2>
      <div className="splits">
        {[['לפי תפקיד', byCv], ['לפי ערוץ', byChannel], ['לפי סטטוס', byStatus]].map(
          ([title, data]) => (
            <div className="split" key={title as string}>
              <div className="split-h">{title as string}</div>
              {(data as [string, { total: number; seen: number }][]).map(([k, v]) => (
                <div className="split-row" key={k}>
                  <span className="split-l">{k}</span>
                  <span className="split-t">
                    <span className="split-b" style={{ width: `${(v.total / rows.length) * 100}%` }} />
                  </span>
                  <span className="split-n">{v.total}</span>
                  <span className="split-p">{v.total ? Math.round((v.seen / v.total) * 100) : 0}%</span>
                </div>
              ))}
            </div>
          )
        )}
      </div>
      <p className="screen-note">העמודה האחרונה היא שיעור הצפייה — כמה מהן מגייס פתח.</p>

      <h2>{filtered ? 'ההגשות בחתך הזה' : 'אחרונות'}</h2>

      {/* 9.11.2026: שאול אמר שהיו לו שיחות וראיון והוא לא מצליח לסמן. הסיבה
          לא הייתה הכפתורים אלא המציאה: המסך הציג 25 שורות מתוך 513, והשיחה
          הייתה על הגשה מספטמבר. טופס רגיל, בלי JavaScript, כדי שיעבוד גם
          לפני שה-hydration מסתיים בטלפון. */}
      <form method="get" style={{ display: 'flex', gap: 6, margin: '10px 0' }}>
        <input
          type="search" name="q" defaultValue={q} placeholder="חפש חברה או תפקיד"
          style={{ flex: 1, minWidth: 0, padding: '.55em .7em', font: 'inherit',
                   fontSize: '.85rem', border: '1px solid var(--line)',
                   borderRadius: 6, background: 'var(--surface)', color: 'inherit' }}
        />
        {month && <input type="hidden" name="month" value={month} />}
        {status && <input type="hidden" name="status" value={status} />}
        <button type="submit" style={{ width: 'auto', flex: 'none', padding: '.55em 1.1em',
                                       fontSize: '.85rem' }}>חפש</button>
      </form>

      <div className="rows">
        {rows.slice(0, filtered ? 300 : 25).map((a) => {
          const [txt, cls] = LABEL[a.status] ?? [a.status, 'mute'];
          const days = Math.floor((Date.now() - new Date(a.sent_at).getTime()) / 864e5);
          return (
            <div className="row" key={a.id}>
              <span className="grow">
                {a.company ?? a.recipient}
                <span className="sub">
                  {[a.role, new Date(a.sent_at).toLocaleDateString('he-IL'), a.cv_id]
                    .filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="chip mute">{days === 0 ? 'היום' : `${days} ימים`}</span>
              <span className={'chip ' + cls}>{txt}</span>
              {/* שיחה או ראיון נקבעים בטלפון ולא משאירים עקבה בג'ימייל, ולכן
                  זאת הדרך היחידה שהם נכנסים למערכת. */}
              <AppStep id={a.id} status={a.status} nextAt={a.next_at} nextKind={a.next_kind} />
              {a.note && <span className="sub" style={{ width: '100%' }}>{a.note}</span>}
            </div>
          );
        })}
      </div>
      {rows.length > (filtered ? 300 : 25) && (
        <p className="screen-note">
          מוצגות {filtered ? 300 : 25} מתוך {rows.length}. הקש על חודש בגרף, או חפש חברה.
        </p>
      )}
    </>
  );
}
