'use client';
import { createContext, useContext, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { STAGES, SILENT_LIMIT, CLOSED_NOTE, type Client, type ClientJob, type FeedItem } from '@/lib/clients';
import { jobAge } from '@/lib/age';
import { referralMessage, connectNote, cvFileFor, inviteMessage } from '@/lib/outreach';
import { isAgency } from '@/lib/pickContact';

/** רענון אחרי שמירה: אחד לכל המסך, עם חיווי גלובלי כל עוד השרת טוען מחדש. */
/** כתיבות שעדיין בדרך לשרת. ביטול מחכה להן, אחרת הוא יכול להגיע לפני הסימון ולהיות מבוטל על ידו. */
function enteredLabel(seen: string | null): { text: string; fresh: boolean } | null {
  if (!seen) return null;
  const t = new Date(seen);
  if (Number.isNaN(t.getTime())) return null;
  const tz = 'Asia/Jerusalem';
  const day = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: tz });
  const hm = t.toLocaleTimeString('he-IL', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  if (day(t) === day(new Date())) return { text: `נכנסה היום ${hm}`, fresh: true };
  const [, m, d] = day(t).split('-');
  return { text: `נכנסה ${Number(d)}.${Number(m)} ${hm}`, fresh: false };
}

const inflight = new Set<Promise<unknown>>();
const track = <T,>(p: Promise<T>): Promise<T> => { inflight.add(p); p.finally(() => inflight.delete(p)).catch(() => {}); return p; };
const Refresh = createContext<(appliedJobId?: string) => void>(() => {});
/** מסמן הגשה מיד בשני התצוגות, לפני שהשרת ענה. false מחזיר אם השמירה נכשלה. */
const Local = createContext<(jobId: string, on: boolean, kind?: 'applied' | 'dismissed', label?: string) => void>(() => {});

type Group = 'recruiter' | 'dev' | 'other';
const GL: Record<Group, string> = { recruiter: 'מגייסות ו-HR', dev: 'מנהלי פיתוח', other: 'אחרים' };
const SL = { none: 'לא חבר', requested: 'נשלחה בקשה', friend: 'חבר' } as const;

/** סימון אחד לשלב אחד. ההגשה והשיחה והראיון והסגירה נרשמים דרך הנתיבים הקיימים. */
function StepButtons({ j, friends }: { j: import('@/lib/clients').ClientJob; friends: Client[] }) {
  const [busy, setBusy] = useState(false);
  const refresh = useContext(Refresh);
  const local = useContext(Local);
  const [pick, setPick] = useState(false);
  const [who, setWho] = useState('');
  const [closing, setClosing] = useState(false);
  async function post(url: string, body: object): Promise<boolean> {
    setBusy(true);
    const r = await track(fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null));
    setBusy(false);
    if (!r || !r.ok) { alert('לא נשמר. נסה שוב.'); return false; }
    return true;
  }
  /** הוגשה דרך מכר: ההגשה נרשמת כפנימית, ומי שנבחר מסומן שפנית אליו על המשרה הזאת. */
  async function viaFriend(f: Client | null) {
    local(j.id, true, 'applied', j.title);
    if (!(await post('/api/jobs/applied', { id: j.id, internal: true }))) { local(j.id, false); return; }
    if (f && f.kind === 'contact') {
      setBusy(true);
      const r = await fetch('/api/contacts', { method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: f.id.slice(2), contacted: true, jobId: j.id }) }).catch(() => null);
      setBusy(false);
      if (!r || !r.ok) { alert('ההגשה נרשמה, אבל הסימון על איש הקשר לא נשמר.'); }
    }
    setPick(false); refresh();
  }
  const step = async (body: object) => { if (await post('/api/applications/step', body)) { setClosing(false); refresh(); } };
  if (!j.applied) return (<>
    <button className="hx-b" disabled={busy} title="סמן שהגשת מועמדות למשרה הזאת ישירות באתר" onClick={async () => { local(j.id, true, 'applied', j.title); if (await post('/api/jobs/applied', { id: j.id })) refresh(); else local(j.id, false); }}>הוגשה ישירות</button>
    <button className={'hx-b' + (pick ? ' on' : '')} disabled={busy} title="סמן שהגשת דרך מכר או איש HR בחברה, ובחר מי" onClick={() => setPick(!pick)}>הוגשה דרך מכר או HR</button>
    <button className="hx-b" disabled={busy} title="לא רלוונטית או שאתה לא רוצה להגיש. המשרה יורדת מכל הרשימות, ואפשר לבטל מיד בכפתור שמופיע למטה"
      onClick={async () => { local(j.id, true, 'dismissed', j.title); if (await post('/api/jobs/dismiss', { id: j.id })) refresh(); else local(j.id, false); }}>לא מגיש</button>
    {pick && (
      <div className="hx-pick row1">
        <small>דרך מי הוגשה? הבחירה מסמנת שפנית אליו על המשרה הזאת.</small>
        <select className="hx-sel" value={who} onChange={(e) => setWho(e.target.value)} title="בחר את איש הקשר שדרכו הוגשה המשרה">
          <option value="">בחר מי…</option>
          {friends.map((f) => <option key={f.id} value={f.id}>{f.name}{f.title ? ' · ' + f.title : ''}</option>)}
          <option value="__none">בלי לציין מי</option>
        </select>
        <button className="hx-b main" disabled={busy || !who} title="רושם הגשה פנימית ומסמן שפנית אליו על המשרה הזאת"
          onClick={() => viaFriend(who === '__none' ? null : friends.find((f) => f.id === who) ?? null)}>אישור</button>
        {friends.length === 0 && <small className="mut">אין אצלך איש קשר בחברה הזאת. אפשר לסמן בלי שם.</small>}
      </div>
    )}
  </>);
  if (!j.appId) return null;
  if (j.closed) return <span className="hx-tag gray">{j.closeReason ?? 'נסגרה'}</span>;
  return (<>
    {j.stage < 5 && <button className="hx-b" disabled={busy} title="נקבעה שיחה עם החברה על המשרה הזאת" onClick={() => step({ id: j.appId, status: 'conversation', kind: 'call' })}>נקבעה שיחה</button>}
    {j.stage < 6 && <button className="hx-b" disabled={busy} title="נקבע ראיון על המשרה הזאת" onClick={() => step({ id: j.appId, status: 'interview', kind: 'interview' })}>נקבע ראיון</button>}
    <button className={'hx-b' + (closing ? ' on' : '')} disabled={busy} title="סגור את המשרה: נדחית, המשרה נסגרה או קיבלת הצעה" onClick={() => setClosing(!closing)}>סגירת המשרה</button>
    {closing && (
      <div className="hx-pick row1">
        <small>למה נסגרה?</small>
        <button className="hx-b" disabled={busy} title="החברה דחתה אותך" onClick={() => step({ id: j.appId, status: 'rejected', note: '' })}>נדחה</button>
        <button className="hx-b" disabled={busy} title="המשרה עצמה נסגרה, בלי קשר אליך" onClick={() => step({ id: j.appId, status: 'rejected', note: CLOSED_NOTE })}>המשרה נסגרה</button>
        <button className="hx-b" disabled={busy} title="קיבלת הצעה למשרה" onClick={() => step({ id: j.appId, status: 'offer', kind: 'offer' })}>קיבלתי הצעה</button>
      </div>
    )}
  </>);
}

/** מה שהוא כתב לך, ומה עושים איתו: מעתיקים תשובה מוכנה, או מסמנים שטופל. */
function ReplyBox({ c }: { c: Client }) {
  const [busy, setBusy] = useState(false);
  const refresh = useContext(Refresh);
  const [copied, setCopied] = useState(false);
  async function done() {
    setBusy(true);
    const r = await fetch('/api/contacts', { method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: c.id.slice(2), replyDone: true }) }).catch(() => null);
    setBusy(false);
    if (!r || !r.ok) { alert('לא נשמר. נסה שוב.'); return; }
    refresh();
  }
  async function copy() {
    try { await navigator.clipboard.writeText(c.replyDraft ?? ''); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {}
  }
  return (
    <div className="hx-reply"><small>מה שכתב לך</small>{c.replyText}
      {c.replyDraft && <div className="hx-draft"><small>תשובה מוצעת</small>{c.replyDraft}</div>}
      <div className="hx-acts">
        {c.replyDraft && <button className="hx-b" title="מעתיק את התשובה המוצעת ללוח, אפשר להדביק בלינקדאין" onClick={copy}>{copied ? 'הועתקה' : 'העתק תשובה'}</button>}
        {c.profile && <a className="hx-b" title="פותח את הפרופיל בלינקדאין בלשונית חדשה" href={c.profile} target="_blank" rel="noreferrer">פתח בלינקדאין</a>}
        <button className="hx-b main" disabled={busy} title="מסמן שטיפלת בתגובה. תגובה חדשה מאותו אדם תחזיר אותה לרשימה" onClick={done}>טיפלתי</button>
      </div>
    </div>
  );
}

/** מחזיר לרשימה מי שסומן "לא לפנות". אותו שדה שכותב גם "מוותר" בפנייה הרחבה. */
function Unskip({ c }: { c: Client }) {
  const [busy, setBusy] = useState(false);
  const refresh = useContext(Refresh);
  async function undo() {
    setBusy(true);
    const r = await fetch('/api/contacts', { method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: c.id.slice(2), skipped: false }) }).catch(() => null);
    setBusy(false);
    if (!r || !r.ok) { alert('לא נשמר. נסה שוב.'); return; }
    refresh();
  }
  return <><span>סומן: לא לפנות</span> <button className="hx-nbtn" disabled={busy} title="מבטל את הסימון 'לא לפנות' וההצעה לפנות חוזרת" onClick={undo}>החזר לרשימה</button></>;
}

const STAGE_HELP = [
  'יש משרה מתאימה ופתוחה בחברה, ועוד לא פנית',
  'פנית לאיש הקשר על המשרה, ומחכים לתשובה',
  'האיש ענה לך',
  'הוגשה מועמדות למשרה',
  'נקבעה שיחה',
  'נקבע ראיון',
  'המשרה נסגרה: נדחית, המשרה הוסרה או שהתקבלה הצעה',
];
function Bar({ stage }: { stage: number }) {
  const all = STAGES.map((s, i) => `${i + 1}. ${s}${i + 1 === stage ? ' (כאן)' : i < stage ? ' ✓' : ''}: ${STAGE_HELP[i]}`).join('\n');
  return (
    <div className="hx-bar" title={(stage ? `שלב נוכחי: ${STAGES[stage - 1]}\n\n` : 'אין משרה בחברה כרגע\n\n') + all}>
      {STAGES.map((s, i) => <i key={s} title={`${i + 1}. ${s}${i + 1 === stage ? ' (השלב הנוכחי)' : i < stage ? ' ✓' : ''}\n${STAGE_HELP[i]}`} className={i < stage ? (stage === 7 ? 'off' : stage >= 4 ? 'ok' : 'on') : ''} />)}
    </div>
  );
}

/** מחכה לפעולה שלו: יש צעד הבא שאינו המתנה למישהו אחר. */
/** יש משרה פתוחה: לא הוגשה ולא נסגרה. משרה שהוגשה או נסגרה נשארת ברשימת המשרות של הלקוח, אבל אינה "פתוחה". */
const hasOpen = (c: Client) => c.jobs.some((j) => !j.applied && !j.closed);
const isWaiting = (c: Client) => !!c.next && !c.next.startsWith('מחכה');

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' }) : '—');

function Editor({ c }: { c: Client }) {
  const refresh = useContext(Refresh);
  const editable = c.kind === 'contact';
  const [f, setF] = useState({ fullName: c.name, title: c.title ?? '', company: c.company ?? '',
    email: c.email ?? '', phone: c.phone ?? '', note: c.note ?? '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const dirty = f.fullName !== c.name || f.title !== (c.title ?? '') || f.company !== (c.company ?? '')
    || f.email !== (c.email ?? '') || f.phone !== (c.phone ?? '') || f.note !== (c.note ?? '');
  async function save() {
    setBusy(true); setMsg('');
    const r = await fetch('/api/contacts', { method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: c.id.slice(2), ...f }) });
    setBusy(false);
    if (!r.ok) { const j = await r.json().catch(() => ({})); setMsg(j.error ?? 'השמירה נכשלה'); return; }
    setMsg('נשמר'); refresh();
  }
  const fld = (k: keyof typeof f, label: string, ltr = false) => (
    <label className="hx-f"><small>{label}</small>
      <input value={f[k]} dir={ltr ? 'ltr' : undefined} disabled={!editable}
        onChange={(e) => { setF({ ...f, [k]: e.target.value }); setMsg(''); }} /></label>
  );
  return (
    <div className="hx-edit">
      <div className="hx-fgrid">
        {fld('fullName', 'שם')}{fld('title', 'תפקיד')}{fld('company', 'חברה')}
        {fld('phone', 'טלפון', true)}{fld('email', 'אימייל', true)}
        <label className="hx-f wide"><small>הערות</small>
          <textarea value={f.note} disabled={!editable} rows={2}
            onChange={(e) => { setF({ ...f, note: e.target.value }); setMsg(''); }} /></label>
      </div>
      <div className="hx-facts">
        <span>חיבור: <b>{fmt(c.connectedOn)}</b></span>
        <span>אישר חברות: <b>{fmt(c.acceptedAt)}</b></span>
        <span>פניתי: <b>{fmt(c.contactedAt)}</b></span>
        <span>ענה: <b>{fmt(c.repliedAt)}</b></span>
      </div>
      <div className="hx-acts">
        {editable && <button className="hx-b main" disabled={!dirty || busy} title="שומר את הפרטים של הלקוח" onClick={save}>{busy ? 'שומר…' : 'שמור'}</button>}
        {c.profile && <a className="hx-b" title="פותח את הפרופיל בלינקדאין בלשונית חדשה" href={c.profile} target="_blank" rel="noreferrer">פרופיל בלינקדאין</a>}
        {msg && <span className="hx-msg">{msg}</span>}
        {!editable && <span className="mut">נמצא בחיפוש מגייסים. עריכה אחרי שיאשר חברות.</span>}
      </div>
    </div>
  );
}

/** הפעולה של "הצעד הבא": ההודעה מוכנה, ורק אחרי "שלחתי" השלב מתקדם. */
function ActionPanel({ c, onDone, forJob }: { c: Client; onDone: () => void; forJob?: ClientJob }) {
  const refresh = useContext(Refresh);
  const job = forJob ?? c.jobs.find((j) => !j.applied) ?? c.jobs[0];
  const request = c.status === 'none';
  const initial = request
    ? connectNote(null, c.company)
    : !job
    ? inviteMessage({ contactName: c.name, title: c.title })
    : job
    ? referralMessage({ contactName: c.name, company: c.company ?? '', jobTitle: job.title, contactTitle: c.title,
        jobUrl: job.url, applied: job.applied, agency: isAgency(c.company), attached: true })
    : '';
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const file = cvFileFor(null, job?.title ?? null);

  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {}
  }
  async function mark(kind: 'sent' | 'skip') {
    setBusy(true);
    let res: Response | null = null;
    if (c.kind === 'gold') {
      res = await fetch('/api/gold', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recruiterId: c.id.slice(2), [kind === 'sent' ? 'asked' : 'skipped']: true }) }).catch(() => null);
    } else {
      res = await fetch('/api/contacts', { method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(kind === 'sent'
          ? { id: c.id.slice(2), contacted: true, jobId: job?.id }
          : { id: c.id.slice(2), skipped: true }) }).catch(() => null);
    }
    setBusy(false);
    if (!res || !res.ok) { alert('לא נשמר. נסה שוב.'); return; }
    onDone(); refresh();
  }
  return (
    <div className="hx-act">
      <div className="hx-actt">
        <b>{request ? 'בקשת חברות עם הערה' : job ? 'הודעה עם קורות חיים' : 'הודעת היכרות, בלי משרה'}</b>
        {job && <span>על המשרה: {job.title}</span>}
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={request ? 4 : 9} dir="ltr" />
      {request && <small className="mut">{text.length} תווים מתוך 200 (מגבלת לינקדאין)</small>}
      {!request && file && <small className="mut">לצרף את הקובץ: <b>{file}</b></small>}
      <div className="hx-acts">
        <button className="hx-b" title="מעתיק את הנוסח ללוח. אחרי ההדבקה בלינקדאין צרף את הקובץ" onClick={copy}>{copied ? 'הועתק' : 'העתק'}</button>
        {c.profile && <a className="hx-b" title="פותח את הפרופיל בלינקדאין בלשונית חדשה" href={c.profile} target="_blank" rel="noreferrer">פתח בלינקדאין</a>}
        <button className="hx-b main" disabled={busy} title={request ? 'סמן שבקשת החברות נשלחה' : 'סמן שההודעה נשלחה. השלב מתקדם והשורה עוברת להמתנה'} onClick={() => mark('sent')}>{request ? 'ביקשתי' : 'שלחתי'}</button>
        <button className="hx-b" disabled={busy} title="החלטת לא לפנות לאיש הזה. אפשר להחזיר מהשורה" onClick={() => mark('skip')}>לא לפנות</button>
      </div>
      <small className="mut">אחרי "{request ? 'ביקשתי' : 'שלחתי'}" השלב מתקדם והשורה עוברת ל"מחכה לתשובה". הנוסח הוא טיוטה: ערוך לפני העתקה.</small>
    </div>
  );
}

/**
 * "לפי משרה": כל המשרות הפתוחות מהחדשה לישנה (תאריך פרסום), ומתחת לכל אחת הלקוחות בחברה.
 * אין כאן מצב משלו. כל כפתור כותב לאותה משרה ולאותו לקוח כמו במסך "לפי לקוח",
 * והרענון טוען את שניהם מחדש מאותם נתונים.
 */
function JobsFeed({ feed, clients, q, filterNote, shown, setShown, friendsOf }: {
  feed: FeedItem[]; clients: Client[]; q: string; filterNote: string; shown: number; setShown: (n: number) => void; friendsOf: (c: Client) => Client[];
}) {
  const [act, setAct] = useState<string | null>(null);
  const byId = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const s = q.trim().toLowerCase();
  const rows = feed.filter((f) => !s || `${f.job.title} ${f.company} ${f.clientIds.map((id) => byId.get(id)?.name ?? '').join(' ')}`.toLowerCase().includes(s));
  const ds = rows.map((f) => f.job.posted ?? f.job.seenAt ?? '').filter(Boolean).sort();
  return (
    <div className="hx-card hx-table">
      <div className="hx-cnt">מציג <b>{Math.min(shown, rows.length)}</b> מתוך <b>{rows.length}</b> משרות פתוחות</div>
      <div className="hx-note">
        מסודר מהחדש לישן לפי תאריך הפרסום, ובתוך אותו יום לפי מועד הכניסה למערכת. משרות פתוחות ולא מוגשות מ-30 הימים האחרונים.
        {ds.length ? ` מהחדשה (${jobAge(ds[ds.length - 1].slice(0, 10), null)?.label}) עד הישנה (${jobAge(ds[0].slice(0, 10), null)?.label}).` : ''}
        {' '}{rows.filter((f) => f.job.priorApplied !== null).length} מסומנות "כבר הגשת לאותה משרה" (אותה חברה ואותה כותרת, מלוח אחר). אין כאן מצב משלו: כל פעולה נרשמת על אותה משרה ועל אותו לקוח כמו במסך "לפי לקוח", והמסך ההוא מתעדכן איתה.
        {filterNote || s ? ` סינון פעיל:${filterNote}${s ? ` חיפוש "${q.trim()}".` : ''}` : ' אין סינון פעיל.'}
      </div>
      {rows.slice(0, shown).map((f) => {
        const j = f.job;
        const age = jobAge(j.posted, j.seenAt);
        const entered = enteredLabel(j.seenAt);
        const cs = f.clientIds.map((id) => byId.get(id)).filter(Boolean) as Client[];
        return (
          <div key={j.dk} className={"hx-rowwrap" + (j.priorApplied !== null ? " hx-prior" : "")}>
            <div className="hx-job">
              <div className="hx-jt"><b>{j.title}</b><span>{f.company}{age ? ` · ${age.label}` : ''}{j.location ? ` · ${j.location}` : ''}</span>
                {entered && <em className={'hx-tag' + (entered.fresh ? '' : ' gray')} title="מתי הסריקה הכניסה את המשרה לחדר המצב. זה לא תאריך הפרסום.">{entered.text}</em>}
                {j.priorApplied !== null && <em className="hx-tag" title="הגשת כבר לחברה הזאת באותה כותרת בדיוק. כנראה אותה מודעה מלוח אחר. הסימון לקריאה בלבד.">כבר הגשת לאותה משרה{j.priorApplied ? ` ב-${new Date(j.priorApplied).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}` : ''}</em>}
              </div>
              <div className="hx-acts">
                {j.url && <a className="hx-b" title="פותח את המודעה בלשונית חדשה" href={j.url} target="_blank" rel="noreferrer">פתח משרה</a>}
                <StepButtons j={j} friends={cs[0] ? friendsOf(cs[0]) : []} />
              </div>
            </div>
            {cs.length === 0 && <div className="hx-jc mut">אין בחברה הזאת אף לקוח (מגייס, HR או מנהל פיתוח). המשרה מופיעה גם ב"חברות בלי איש קשר".</div>}
            {cs.map((c) => (
              <div key={c.id} className="hx-jc">
                <b>{c.name || '(ללא שם)'}</b>
                <span className="mut">{c.title ?? ''}</span>
                <span className={'hx-pill ' + c.status}>{SL[c.status]}</span>
                {c.next && /^(לשלוח|פנה ישירות)/.test(c.next)
                  ? <button className="hx-nbtn" title="פותח נוסח מוכן על המשרה הזאת, ושלחתי או לא לפנות" onClick={() => setAct(act === c.id + j.dk ? null : c.id + j.dk)}>{c.next}</button>
                  : <span className="mut">{c.next ?? '—'}</span>}
                {act === c.id + j.dk && <ActionPanel c={c} forJob={j} onDone={() => setAct(null)} />}
              </div>
            ))}
          </div>
        );
      })}
      {rows.length === 0 && <div className="hx-empty">אין משרות שמתאימות לחיפוש.</div>}
      {rows.length > shown && <button className="hx-more" title="טוען עוד 60 משרות" onClick={() => setShown(shown + 60)}>הצג עוד</button>}
    </div>
  );
}

export default function ClientsTable(props: { clients: Client[]; feed: FeedItem[]; initial?: { waiting?: boolean; replied?: boolean; group?: Group } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // 27.11.2026, שאול: "מעבר בין טאב לטאב בסימון משאיר את אותם פרטים". הרענון מהשרת לוקח כחמש שניות,
  // ובינתיים הטאב השני הראה את המצב הישן. הסימון נכתב מיד על אותם אובייקטים ששני התצוגות חולקות.
  const [ver, setVer] = useState(0);
  const undo = useRef(new Map<string, () => void>());
  const [last, setLast] = useState<{ jobId: string; kind: 'applied' | 'dismissed'; label: string } | null>(null);
  const lastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const local = (jobId: string, on: boolean, kind: 'applied' | 'dismissed' = 'applied', label = '') => {
    if (on) {
      const back: (() => void)[] = [];
      const mark = (j: import('@/lib/clients').ClientJob, c?: Client) => {
        const pa = j.applied, pj = j.stage, pc = c?.stage, pcl = j.closed, pr = j.closeReason;
        if (kind === 'applied') { j.applied = true; if (j.stage < 4) j.stage = 4; if (c && c.stage < 4) c.stage = 4; }
        else { j.closed = true; j.closeReason = 'לא מגיש'; }
        back.push(() => { j.applied = pa; j.stage = pj; j.closed = pcl; j.closeReason = pr; if (c && pc !== undefined) c.stage = pc; });
      };
      for (const c of props.clients) for (const j of c.jobs) if (j.id === jobId) mark(j, c);
      for (const f of props.feed) if (f.job.id === jobId) mark(f.job);
      undo.current.set(jobId, () => back.forEach((b) => b()));
      setLast({ jobId, kind, label });
      if (lastTimer.current) clearTimeout(lastTimer.current);
      lastTimer.current = setTimeout(() => setLast(null), 15000);
    } else { undo.current.get(jobId)?.(); undo.current.delete(jobId); setLast(null); }
    setVer((v) => v + 1);
  };
  async function undoLast() {
    if (!last) return;
    const cur = last;
    local(cur.jobId, false);
    await Promise.allSettled([...inflight]);
    const r = await fetch(cur.kind === 'applied' ? '/api/applications/undo' : '/api/jobs/dismiss', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cur.kind === 'applied' ? { id: cur.jobId } : { id: cur.jobId, undo: true }),
    }).catch(() => null);
    if (!r || !r.ok) { alert('הביטול לא נשמר. נסה שוב.'); start(() => router.refresh()); return; }
    start(() => router.refresh());
  }
  const refresh = () => { start(() => router.refresh()); };
  const clients = useMemo(() => props.clients.slice(), [props.clients, ver]);
  const feed = useMemo(() => props.feed.filter((f) => !f.job.applied && !f.job.closed), [props.feed, ver]);
  return (
    <Refresh.Provider value={refresh}><Local.Provider value={local}>
      {pending && <div className="hx-toast">נשמר. מרענן את הרשימה…</div>}
      {last && !pending && (
        <div className="hx-toast hx-undo">
          {last.kind === 'applied' ? 'סומנה כהוגשה' : 'סומנה כלא רלוונטית'}{last.label ? `: ${last.label}` : ''}.{' '}
          <button className="hx-b" title="מחזיר את המשרה בדיוק כמו שהייתה" onClick={undoLast}>בטל</button>
        </div>
      )}
      <Inner {...props} clients={clients} feed={feed} />
    </Local.Provider></Refresh.Provider>
  );
}

function Inner({ clients, feed, initial }: { clients: Client[]; feed: FeedItem[]; initial?: { waiting?: boolean; replied?: boolean; group?: Group } }) {
  const [group, setGroup] = useState<Group | 'all'>(initial?.group ?? 'all');
  const [status, setStatus] = useState<'all' | keyof typeof SL>('all');
  const [withJob, setWithJob] = useState(false);
  const [onlyReplied, setOnlyReplied] = useState(!!initial?.replied);
  const [onlyWaiting, setOnlyWaiting] = useState(!!initial?.waiting);
  const [onlyApplied, setOnlyApplied] = useState(false);
  const [q, setQ] = useState('');
  // 27.11.2026, שאול: "פילטר ופילטר משני, הכל צריך להתעדכן". בתצוגת משרות הבוררים מסננים את המשרות לפי הלקוחות בחברה שלהן.
  const [jobGroup, setJobGroup] = useState<'all' | Group | 'none'>('all');
  const [view, setView] = useState<{ id: string; tab: 'jobs' | 'edit' } | null>(null);
  const toggle = (id: string, tab: 'jobs' | 'edit') => setView(view?.id === id && view.tab === tab ? null : { id, tab });
  const [act, setAct] = useState<string | null>(null);
  const [shown, setShown] = useState(40);
  const [newOnly, setNewOnly] = useState(false);
  const [mode, setModeRaw] = useState<'clients' | 'jobs'>('clients');
  // הרענון אחרי שמירה טוען את המסך מחדש, והתצוגה חזרה ל"לפי לקוח" באמצע עבודה. זוכרים בלשונית.
  useEffect(() => { try { if (sessionStorage.getItem('crm-mode') === 'jobs') setModeRaw('jobs'); } catch {} }, []);
  const setMode = (m: 'clients' | 'jobs') => { setModeRaw(m); try { sessionStorage.setItem('crm-mode', m); } catch {} };

  /** מי שמכירים בחברה של הלקוח: מגייסים ו-HR קודם, כי דרכם מגישים. */
  const friendsOf = (c: Client) => (!c.companyKey ? [] : clients.filter((x) => x.kind === 'contact' && x.companyKey === c.companyKey)
    .sort((a, b) => ['recruiter', 'dev', 'other'].indexOf(a.group) - ['recruiter', 'dev', 'other'].indexOf(b.group) || a.name.localeCompare(b.name)));

  const inGroup = useMemo(() => clients.filter((c) => group === 'all' || c.group === group), [clients, group]);
  // תנאי אחד לרשימה ולכל מספר על כל צ'יפ: המספר הוא מה שיוצג אם לוחצים עליו, עם כל שאר הסינונים הפעילים.
  const passes = (c: Client, o: { status?: 'all' | keyof typeof SL; withJob?: boolean; onlyReplied?: boolean } = {}) => {
    const st = o.status ?? status, wj = o.withJob ?? withJob, rp = o.onlyReplied ?? onlyReplied, s = q.trim().toLowerCase();
    return (st === 'all' || c.status === st)
      && (!wj || hasOpen(c))
      && (!rp || !!c.repliedAt)
      && (!onlyWaiting || isWaiting(c))
      && (!onlyApplied || (c.stage >= 4 && c.stage < 7))
      && (!s || `${c.name} ${c.company ?? ''} ${c.title ?? ''} ${c.jobs.map((j) => j.title).join(' ')}`.toLowerCase().includes(s));
  };
  const rows = useMemo(() => {
    return inGroup
      .filter((c) => passes(c))
      // מי שענה נשאר גבוה גם אחרי שטופל: ראשון מי שמחכה לך, אחריו הענייה האחרונה.
      .sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.activityAt.localeCompare(a.activityAt) || a.name.localeCompare(b.name));
  }, [inGroup, status, withJob, onlyReplied, onlyWaiting, onlyApplied, q]);

  // אריח מציג בדיוק את המספר שעליו: לחיצה מנקה כל סינון אחר ומדליקה רק אותו. לחיצה נוספת מבטלת.
  const tile = (k: 'job' | 'wait' | 'applied') => {
    const cur = k === 'job' ? withJob : k === 'wait' ? onlyWaiting : onlyApplied;
    setStatus('all'); setOnlyReplied(false); setQ(''); setGroup('all');
    setWithJob(!cur && k === 'job'); setOnlyWaiting(!cur && k === 'wait'); setOnlyApplied(!cur && k === 'applied'); go(); setShown(40);
  };
  // 27.11.2026: בטלפון הרשימה יושבת מתחת למסך. לחיצה על אריח או סינון שלא מגלגלת אליה נראית כמו כפתור שלא עושה כלום.
  const listRef = useRef<HTMLDivElement>(null);
  const [jumpN, setJumpN] = useState(0);
  const go = () => setJumpN((n) => n + 1);
  useEffect(() => {
    if (jumpN === 0) return;
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [jumpN]);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const jfit = (f: FeedItem, g: 'all' | Group | 'none', st: 'all' | keyof typeof SL) => {
    const cs = f.clientIds.map((id) => clientById.get(id)).filter(Boolean) as Client[];
    if (g === 'none') return cs.length === 0;
    return cs.some((c) => (g === 'all' || c.group === g) && (st === 'all' || c.status === st));
  };
  const isNew = (f: FeedItem) => !!f.job.seenAt && Date.now() - Date.parse(f.job.seenAt) < 864e5;
  const newCount = feed.filter(isNew).length;
  const jfeed = useMemo(() => feed.filter((f) => (!newOnly || isNew(f)) && ((jobGroup === 'all' && status === 'all') ? true : jfit(f, jobGroup, status))), [feed, jobGroup, status, clientById, newOnly]);
  const base = newOnly ? feed.filter(isNew) : feed;
  const jgCount = (g: 'all' | Group | 'none') => base.filter((f) => g === 'all' && status === 'all' ? true : jfit(f, g, status)).length;
  const jsCount = (st: 'all' | keyof typeof SL) => base.filter((f) => jobGroup === 'all' && st === 'all' ? true : jfit(f, jobGroup, st)).length;
  const cnt = (k: 'none' | 'requested' | 'friend') => inGroup.filter((c) => passes(c, { status: k })).length;
  const groupCount = (g: Group | 'all') => clients.filter((c) => (g === 'all' || c.group === g) && passes(c)).length;
  const total = cnt('none') + cnt('requested') + cnt('friend') || 1;
  const waiting = clients.filter(isWaiting).length;

  return (
    <>
      {/* 27.11.2026, שאול: "המידע ממש לא מאורגן". בתצוגת "לפי משרה" אין אריחי לקוחות, סרגל חברון ובוררי סוג: רק משרות. */}
      {mode === 'clients' && (<>
      <div className="hx-kpis">
        <button className={'hx-kpi hx-kpib'} style={{ gridColumn: '1 / -1' }} title="משרות שנכנסו לחדר המצב ב-24 השעות האחרונות, מהחדשה לישנה. פותח את תצוגת לפי משרה" onClick={() => { go(); setNewOnly(true); setMode('jobs'); setShown(40); }}><small>משרות חדשות מהסריקה (24 שעות)</small><b>{newCount}</b></button>
        <button className={'hx-kpi hx-kpib' + (!withJob && !onlyWaiting && !onlyApplied && !onlyReplied && status === 'all' && !q && group === 'all' ? ' on' : '')} title="מנקה את כל הסינונים ומציג את כל הלקוחות" onClick={() => { setGroup('all'); setWithJob(false); setOnlyWaiting(false); setOnlyApplied(false); setOnlyReplied(false); setStatus('all'); setQ(''); go(); setShown(40); }}><small>כל הלקוחות</small><b>{clients.length}</b></button>
        <button className={'hx-kpi hx-kpib' + (withJob ? ' on' : '')} title="הצג רק לקוחות שיש משרה פתוחה בחברה שלהם. לחיצה נוספת מבטלת" onClick={() => tile('job')}><small>עם משרה פתוחה</small><b>{clients.filter(hasOpen).length}</b></button>
        <button className={'hx-kpi warn hx-kpib' + (onlyWaiting ? ' on' : '')} title="הצג רק מי שמחכה לפעולה שלך. לחיצה נוספת מבטלת" onClick={() => tile('wait')}><small>מחכים לפעולה שלך</small><b>{waiting}</b></button>
        <button className={'hx-kpi hx-kpib' + (onlyApplied ? ' on' : '')} title="הצג רק לקוחות שהוגשה דרכם משרה ועוד לא נסגרה. לחיצה נוספת מבטלת" onClick={() => tile('applied')}><small>הוגשה דרכם משרה</small><b>{clients.filter((c) => c.stage >= 4 && c.stage < 7).length}</b></button>
      </div>

      <div className="hx-card">
        <div className="hx-stack">
          {(['none', 'requested', 'friend'] as const).map((k) => (
            <i key={k} role="button" tabIndex={0} title={`הצג רק: ${SL[k]} (${cnt(k)}). לחיצה נוספת מבטלת`} style={{ flex: cnt(k) || 0.001, background: ({ none: '#B9CBDD', requested: '#A8690A', friend: '#12365E' })[k], cursor: 'pointer' }}
              onClick={() => { setStatus(status === k ? 'all' : k); go(); setShown(40); }} onKeyDown={(e) => { if (e.key === 'Enter') { setStatus(status === k ? 'all' : k); go(); setShown(40); } }} />
          ))}
        </div>
        <div className="hx-leg">
          <button className={'hx-legb' + (status === 'none' ? ' on' : '')} title="הצג רק: לא חבר. לחיצה נוספת מבטלת" onClick={() => { setStatus(status === 'none' ? 'all' : 'none'); go(); setShown(40); }}><u style={{ background: '#B9CBDD' }} />לא חבר {cnt('none')}</button>
          <button className={'hx-legb' + (status === 'requested' ? ' on' : '')} title="הצג רק: נשלחה בקשה. לחיצה נוספת מבטלת" onClick={() => { setStatus(status === 'requested' ? 'all' : 'requested'); go(); setShown(40); }}><u style={{ background: '#A8690A' }} />נשלחה בקשה {cnt('requested')}</button>
          <button className={'hx-legb' + (status === 'friend' ? ' on' : '')} title="הצג רק: חבר. לחיצה נוספת מבטלת" onClick={() => { setStatus(status === 'friend' ? 'all' : 'friend'); go(); setShown(40); }}><u style={{ background: '#12365E' }} />חבר {cnt('friend')}</button>
          <span className="mut">{Math.round((cnt('friend') / total) * 100)}% חברים</span>
        </div>
      </div>
      </>)}

      <div className="hx-card hx-filters">
        <input className="hx-search" placeholder="חיפוש לפי שם, חברה, תפקיד או משרה…" value={q}
          onChange={(e) => { setQ(e.target.value); setShown(40); }} />
        <div className="hx-chips"><span className="lab">תצוגה</span>
          <button className={mode === 'clients' ? 'on' : ''} title="רשימת הלקוחות, ומשרות כל אחד מהם" onClick={() => { go(); setNewOnly(false); setMode('clients'); setShown(40); }}>לפי לקוח {clients.length}</button>
          <button className={mode === 'jobs' && !newOnly ? 'on' : ''} title="כל המשרות הפתוחות מהחדשה לישנה, ובכל אחת הלקוחות בחברה שלה" onClick={() => { go(); setNewOnly(false); setMode('jobs'); setShown(40); }}>לפי משרה {feed.length}</button>
          <button className={mode === 'jobs' && newOnly ? 'on' : ''} title="רק משרות שנכנסו לחדר המצב ב-24 השעות האחרונות, מהחדשה לישנה" onClick={() => { go(); setNewOnly(true); setMode('jobs'); setShown(40); }}>חדשות {newCount}</button>
        </div>
        {mode === 'clients' && (<>
        <div className="hx-chips"><span className="lab">סוג</span>
          {(['all', 'recruiter', 'dev', 'other'] as const).map((g) => (
            <button key={g} className={group === g ? 'on' : ''} title={g === 'all' ? 'כל סוגי הלקוחות' : `הצג לקוחות מסוג: ${GL[g]}`} onClick={() => { setGroup(g); go(); setShown(40); }}>
              {g === 'all' ? 'הכול' : GL[g]} {groupCount(g)}
            </button>
          ))}
        </div>
        <div className="hx-chips"><span className="lab">חברות</span>
          {(['all', 'none', 'requested', 'friend'] as const).map((s) => (
            <button key={s} className={status === s ? 'on' : ''} title={s === 'all' ? 'כל סטטוסי החברות' : `הצג רק: ${SL[s]}`} onClick={() => { setStatus(s); go(); setShown(40); }}>
              {s === 'all' ? 'הכול' : SL[s]} {s === 'all' ? inGroup.filter((c) => passes(c, { status: 'all' })).length : cnt(s)}
            </button>
          ))}
        </div>
        <div className="hx-chips"><span className="lab">סינון נוסף</span>
          <button className={onlyReplied ? 'on' : ''} title="הצג רק מי שענה לך" onClick={() => { setOnlyReplied(!onlyReplied); go(); setShown(40); }}>ענו לי {inGroup.filter((c) => passes(c, { onlyReplied: true })).length}</button>
          <button className={withJob ? 'on' : ''} title="הצג רק לקוחות שיש משרה פתוחה בחברה שלהם" onClick={() => { setWithJob(!withJob); go(); setShown(40); }}>רק עם משרה {inGroup.filter((c) => passes(c, { withJob: true })).length}</button>
        </div>
        </>)}
        {mode === 'jobs' && (<>
          <div className="hx-chips"><span className="lab">סוג</span>
            {(['all', 'recruiter', 'dev', 'other', 'none'] as const).map((g) => (
              <button key={g} className={jobGroup === g ? 'on' : ''} title={g === 'all' ? 'כל המשרות הפתוחות' : g === 'none' ? 'משרות בחברות שאין בהן אף לקוח' : `משרות בחברות שיש בהן לקוח מסוג: ${GL[g]}`}
                onClick={() => { setJobGroup(g); go(); setShown(40); }}>{g === 'all' ? 'הכול' : g === 'none' ? 'בלי לקוח' : GL[g]} {jgCount(g)}</button>
            ))}
          </div>
          <div className="hx-chips"><span className="lab">חברות</span>
            {(['all', 'none', 'requested', 'friend'] as const).map((st) => (
              <button key={st} className={status === st ? 'on' : ''} title={st === 'all' ? 'כל סטטוסי החברות' : `משרות שיש בחברה שלהן לקוח במצב: ${SL[st]}`}
                onClick={() => { setStatus(st); go(); setShown(40); }}>{st === 'all' ? 'הכול' : SL[st]} {jsCount(st)}</button>
            ))}
          </div>
        </>)}
      </div>

      <div ref={listRef} style={{ scrollMarginTop: 8 }} />
      {mode === 'jobs' && (
        <button className="hx-b hx-back" title="חוזר לרשימת הלקוחות ומנקה את הסינונים" onClick={() => { setNewOnly(false); setJobGroup('all'); setStatus('all'); setQ(''); go(); setMode('clients'); setShown(40); window.scrollTo({ top: 0 }); }}>← חזרה לכל הלקוחות</button>
      )}
      {mode === 'jobs' ? <JobsFeed feed={jfeed} clients={clients} q={q} filterNote={(newOnly ? ' נכנסו ב-24 השעות האחרונות.' : '') + (jobGroup === 'all' ? '' : jobGroup === 'none' ? ' סוג: חברות בלי לקוח.' : ` סוג: ${GL[jobGroup]}.`) + (status === 'all' ? '' : ` חברות: ${SL[status]}.`)} shown={shown} setShown={setShown} friendsOf={friendsOf} /> : (
      <div className="hx-card hx-table">
        <div className="hx-cnt">מציג <b>{Math.min(shown, rows.length)}</b> מתוך <b>{rows.length}</b>
          {rows.length < inGroup.length && <span className="mut"> · {inGroup.length - rows.length} מוסתרים בגלל הסינון, מתוך {inGroup.length} בסוג הזה</span>}</div>
        <div className="hx-note">{(() => {
          const ds = rows.map((c) => c.activityAt).filter(Boolean).sort();
          const fmt = (d: string) => new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' });
          const days = (d: string) => { const n = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 864e5)); return n > 365 ? `${(n / 365).toFixed(1)} שנים` : `${n} ימים`; };
          const range = ds.length ? `הפעילות האחרונה: מ-${fmt(ds[ds.length - 1])} (לפני ${days(ds[ds.length - 1])}) עד ${fmt(ds[0])} (לפני ${days(ds[0])}). ` : '';
          const f = [onlyWaiting && 'רק מי שמחכה לפעולה שלך', onlyApplied && 'רק מי שהוגשה דרכו משרה פתוחה', withJob && 'רק עם משרה פתוחה בחברה', onlyReplied && 'רק מי שענה', status !== 'all' && `חברות: ${SL[status]}`, q.trim() && `חיפוש: ${q.trim()}`].filter(Boolean).join(' · ');
          return `מסודר מהחדש לישן: קודם מי שמחכה לך, אחריו לפי הפעילות האחרונה (משרה חדשה, תגובה, אישור חברות או פנייה). ${range}משרות: רק מ-30 הימים האחרונים, פתוחות ולא נדחו. ${f ? 'סינון פעיל: ' + f : 'אין סינון פעיל.'}`;
        })()}</div>
        <div className="hx-head">
          <span>לקוח וחברה</span><span>חברות</span><span>משרות</span><span>שלב</span><span>הצעד הבא</span><span />
        </div>
        {rows.slice(0, shown).map((c) => (
          <div key={c.id} data-act={c.activityAt} data-urgent={c.urgent ? 1 : 0} className={'hx-rowwrap' + (c.urgent ? ' urgent' : '')}>
            <div className="hx-row">
              <div className="hx-who">
                <b>{c.name || '(ללא שם)'}</b>
                <span>{[c.company, c.title].filter(Boolean).join(' · ')}</span>
                {c.kind === 'prior' && <em className="hx-tag gray" title="קיבל בקשה או הודעה בגל מאי ולא אישר. לא מציעים פנייה נוספת">נשלחה במאי, לא אושרה</em>}
                {c.silentCount >= SILENT_LIMIT && <em className="hx-tag" title="הגשות לחברה הזאת שלא נענו. מעל 3 מומלץ לפנות ישירות">{c.silentCount} הגשות בלי מענה</em>}
              </div>
              <div><span className={'hx-pill ' + c.status} title={c.status === 'friend' ? 'חבר בלינקדאין' : c.status === 'requested' ? 'נשלחה בקשת חברות וממתינים לאישור' : 'עוד לא חבר ולא נשלחה בקשה'}>{SL[c.status]}</span></div>
              <div className="hx-jobs">
                {c.jobs.length
                  ? <button className="hx-jlink" title="פתח את המשרות של הלקוח" onClick={() => toggle(c.id, 'jobs')}><b>{c.jobs.length}</b> <span>{c.jobs[0].title}</span></button>
                  : <span className="mut">אין משרה</span>}
              </div>
              <div className="hx-stage">
                <Bar stage={c.stage} />
                <small>{c.stage ? STAGES[c.stage - 1] : 'ממתין למשרה'}</small>
              </div>
              <div className={'hx-next' + (c.urgent || c.next?.startsWith('פנה ישירות') ? ' red' : '')}>
                {c.next && /^(לשלוח|פנה ישירות)/.test(c.next) && (c.jobs.length > 0 || c.kind === 'contact')
                  ? <button className="hx-nbtn" title={c.next?.startsWith('פנה ישירות') ? `הוגשו ${SILENT_LIMIT} הגשות ויותר בלי מענה. פנה ישירות למגייס במקום להגיש עוד` : 'פותח נוסח מוכן ושם הקובץ לצירוף, ושלחתי או לא לפנות'} onClick={() => setAct(act === c.id ? null : c.id)}>{c.next}</button>
                  : c.urgent ? <button className="hx-nbtn" title="פותח את מה שהוא כתב לך ותשובה מוצעת" onClick={() => toggle(c.id, 'jobs')}>{c.next}</button>
                  : c.skipped && c.kind === 'contact' ? <Unskip c={c} />
                  : (c.next ?? '—')}
              </div>
              <div className="hx-gos">
                <button className={'hx-go' + (view?.id === c.id && view.tab === 'jobs' ? ' on' : '')} title="פותח את המשרות, התגובה והפעולות של הלקוח" onClick={() => toggle(c.id, 'jobs')}>פעולות</button>
                <button className={'hx-go' + (view?.id === c.id && view.tab === 'edit' ? ' on' : '')} title="עריכת שם, תפקיד, חברה, טלפון, מייל והערה" onClick={() => toggle(c.id, 'edit')}>עדכן פרטים</button>
              </div>
            </div>
            {act === c.id && <ActionPanel c={c} onDone={() => setAct(null)} />}
            {view?.id === c.id && view.tab === 'edit' && (
              <div className="hx-detail"><Editor key={c.id} c={c} /></div>
            )}
            {view?.id === c.id && view.tab === 'jobs' && (
              <div className="hx-detail">
                {c.replyText && <ReplyBox c={c} />}
                <div className="hx-jl">
                  {c.jobs.length === 0 && (
                    <div className="hx-job">
                      <div className="mut">אין כרגע משרה מתאימה בחברה הזאת. כשתיכנס, הלקוח יעלה כאן לבד.</div>
                      {c.next?.startsWith('לשלוח') && (
                        <div className="hx-acts"><button className="hx-b main" title="מכין הודעת היכרות כללית, בלי משרה" onClick={() => setAct(c.id)}>הכן הודעת היכרות</button></div>
                      )}
                    </div>
                  )}
                  {c.jobs.map((j) => (
                    <div key={j.id} className={"hx-job" + (j.priorApplied !== null ? " hx-prior" : "")}>
                      <div className="hx-jt"><b>{j.title}</b>{j.priorApplied !== null && <em className="hx-tag" title="הגשת כבר לחברה הזאת באותה כותרת בדיוק. כנראה אותה מודעה מלוח אחר. הסימון לקריאה בלבד.">כבר הגשת לאותה משרה</em>}<span>{j.company}{j.applied && j.appliedDays !== null ? ` · הוגשה לפני ${j.appliedDays} ימים${j.silent ? ' · בלי מענה' : ''}` : (jobAge(j.posted, j.seenAt)?.label ? ` · ${jobAge(j.posted, j.seenAt)!.label}` : '')}</span></div>
                      <div className="hx-stage"><Bar stage={j.stage} /><small>{STAGES[j.stage - 1]}</small></div>
                      <div className="hx-acts">
                        {j.url && <a className="hx-b" title="פותח את המודעה בלשונית חדשה" href={j.url} target="_blank" rel="noreferrer">פתח משרה</a>}
                        <StepButtons j={j} friends={friendsOf(c)} />
                        {!j.applied && c.kind !== 'prior' && <button className="hx-b main" title={c.status === 'friend' ? 'פותח נוסח הודעה מוכן ושם קובץ קורות החיים למשרה הזאת' : 'פותח נוסח בקשת חברות מוכן למשרה הזאת'} onClick={() => setAct(c.id)}>
                          {c.status === 'friend' ? 'הכן הודעה' : 'הכן בקשת חברות'}</button>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {rows.length === 0 && <div className="hx-empty">אין לקוחות שמתאימים לסינון.</div>}
        {rows.length > shown && <button className="hx-more" title="טוען עוד 60 לקוחות" onClick={() => setShown(shown + 60)}>הצג עוד</button>}
      </div>
      )}
    </>
  );
}
