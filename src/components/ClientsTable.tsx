'use client';
import { createContext, useContext, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { STAGES, SILENT_LIMIT, CLOSED_NOTE, type Client } from '@/lib/clients';
import { referralMessage, connectNote, cvFileFor, inviteMessage } from '@/lib/outreach';
import { isAgency } from '@/lib/pickContact';

/** רענון אחרי שמירה: אחד לכל המסך, עם חיווי גלובלי כל עוד השרת טוען מחדש. */
const Refresh = createContext<() => void>(() => {});

type Group = 'recruiter' | 'dev' | 'other';
const GL: Record<Group, string> = { recruiter: 'מגייסות ו-HR', dev: 'מנהלי פיתוח', other: 'אחרים' };
const SL = { none: 'לא חבר', requested: 'נשלחה בקשה', friend: 'חבר' } as const;

/** סימון אחד לשלב אחד. ההגשה והשיחה והראיון והסגירה נרשמים דרך הנתיבים הקיימים. */
function StepButtons({ j, friends }: { j: import('@/lib/clients').ClientJob; friends: Client[] }) {
  const [busy, setBusy] = useState(false);
  const refresh = useContext(Refresh);
  const [pick, setPick] = useState(false);
  const [closing, setClosing] = useState(false);
  async function post(url: string, body: object): Promise<boolean> {
    setBusy(true);
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    if (!r || !r.ok) { alert('לא נשמר. נסה שוב.'); return false; }
    return true;
  }
  /** הוגשה דרך מכר: ההגשה נרשמת כפנימית, ומי שנבחר מסומן שפנית אליו על המשרה הזאת. */
  async function viaFriend(f: Client | null) {
    if (!(await post('/api/jobs/applied', { id: j.id, internal: true }))) return;
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
    <button className="hx-b" disabled={busy} onClick={async () => { if (await post('/api/jobs/applied', { id: j.id })) refresh(); }}>הוגשה ישירות</button>
    <button className={'hx-b' + (pick ? ' on' : '')} disabled={busy} onClick={() => setPick(!pick)}>הוגשה דרך מכר או HR</button>
    {pick && (
      <div className="hx-pick">
        <small>דרך מי הוגשה? הבחירה מסמנת שפנית אליו על המשרה הזאת.</small>
        {friends.map((f) => (
          <button key={f.id} className="hx-b" disabled={busy} onClick={() => viaFriend(f)}>{f.name}{f.title ? ' · ' + f.title : ''}</button>
        ))}
        {friends.length === 0 && <small className="mut">אין אצלך איש קשר בחברה הזאת. אפשר לסמן בלי שם.</small>}
        <button className="hx-b" disabled={busy} onClick={() => viaFriend(null)}>בלי לציין מי</button>
      </div>
    )}
  </>);
  if (!j.appId) return null;
  if (j.closed) return <span className="hx-tag gray">{j.closeReason ?? 'נסגרה'}</span>;
  return (<>
    {j.stage < 5 && <button className="hx-b" disabled={busy} onClick={() => step({ id: j.appId, status: 'conversation', kind: 'call' })}>נקבעה שיחה</button>}
    {j.stage < 6 && <button className="hx-b" disabled={busy} onClick={() => step({ id: j.appId, status: 'interview', kind: 'interview' })}>נקבע ראיון</button>}
    <button className={'hx-b' + (closing ? ' on' : '')} disabled={busy} onClick={() => setClosing(!closing)}>סגירת המשרה</button>
    {closing && (
      <div className="hx-pick">
        <small>למה נסגרה?</small>
        <button className="hx-b" disabled={busy} onClick={() => step({ id: j.appId, status: 'rejected', note: '' })}>נדחה</button>
        <button className="hx-b" disabled={busy} onClick={() => step({ id: j.appId, status: 'rejected', note: CLOSED_NOTE })}>המשרה נסגרה</button>
        <button className="hx-b" disabled={busy} onClick={() => step({ id: j.appId, status: 'offer', kind: 'offer' })}>קיבלתי הצעה</button>
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
        {c.replyDraft && <button className="hx-b" onClick={copy}>{copied ? 'הועתקה' : 'העתק תשובה'}</button>}
        {c.profile && <a className="hx-b" href={c.profile} target="_blank" rel="noreferrer">פתח בלינקדאין</a>}
        <button className="hx-b main" disabled={busy} onClick={done}>טיפלתי</button>
      </div>
    </div>
  );
}

function Bar({ stage }: { stage: number }) {
  return (
    <div className="hx-bar" title={stage ? STAGES[stage - 1] : 'אין משרה'}>
      {STAGES.map((s, i) => <i key={s} title={`${i + 1}. ${s}${i + 1 === stage ? ' (השלב הנוכחי)' : i < stage ? ' ✓' : ''}`} className={i < stage ? (stage === 7 ? 'off' : stage >= 4 ? 'ok' : 'on') : ''} />)}
    </div>
  );
}

/** מחכה לפעולה שלו: יש צעד הבא שאינו המתנה למישהו אחר. */
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
        {editable && <button className="hx-b main" disabled={!dirty || busy} onClick={save}>{busy ? 'שומר…' : 'שמור'}</button>}
        {c.profile && <a className="hx-b" href={c.profile} target="_blank" rel="noreferrer">פרופיל בלינקדאין</a>}
        {msg && <span className="hx-msg">{msg}</span>}
        {!editable && <span className="mut">נמצא בחיפוש מגייסים. עריכה אחרי שיאשר חברות.</span>}
      </div>
    </div>
  );
}

/** הפעולה של "הצעד הבא": ההודעה מוכנה, ורק אחרי "שלחתי" השלב מתקדם. */
function ActionPanel({ c, onDone }: { c: Client; onDone: () => void }) {
  const refresh = useContext(Refresh);
  const job = c.jobs.find((j) => !j.applied) ?? c.jobs[0];
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
        <button className="hx-b" onClick={copy}>{copied ? 'הועתק' : 'העתק'}</button>
        {c.profile && <a className="hx-b" href={c.profile} target="_blank" rel="noreferrer">פתח בלינקדאין</a>}
        <button className="hx-b main" disabled={busy} onClick={() => mark('sent')}>{request ? 'ביקשתי' : 'שלחתי'}</button>
        <button className="hx-b" disabled={busy} onClick={() => mark('skip')}>לא לפנות</button>
      </div>
      <small className="mut">אחרי "{request ? 'ביקשתי' : 'שלחתי'}" השלב מתקדם והשורה עוברת ל"מחכה לתשובה". הנוסח הוא טיוטה: ערוך לפני העתקה.</small>
    </div>
  );
}

export default function ClientsTable(props: { clients: Client[]; initial?: { waiting?: boolean; replied?: boolean; group?: Group } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Refresh.Provider value={() => start(() => router.refresh())}>
      {pending && <div className="hx-toast">נשמר. מרענן את הרשימה…</div>}
      <Inner {...props} />
    </Refresh.Provider>
  );
}

function Inner({ clients, initial }: { clients: Client[]; initial?: { waiting?: boolean; replied?: boolean; group?: Group } }) {
  const [group, setGroup] = useState<Group>(initial?.group ?? 'recruiter');
  const [status, setStatus] = useState<'all' | keyof typeof SL>('all');
  const [withJob, setWithJob] = useState(false);
  const [onlyReplied, setOnlyReplied] = useState(!!initial?.replied);
  const [onlyWaiting, setOnlyWaiting] = useState(!!initial?.waiting);
  const [q, setQ] = useState('');
  const [view, setView] = useState<{ id: string; tab: 'jobs' | 'edit' } | null>(null);
  const toggle = (id: string, tab: 'jobs' | 'edit') => setView(view?.id === id && view.tab === tab ? null : { id, tab });
  const [act, setAct] = useState<string | null>(null);
  const [shown, setShown] = useState(40);

  /** מי שמכירים בחברה של הלקוח: מגייסים ו-HR קודם, כי דרכם מגישים. */
  const friendsOf = (c: Client) => (!c.companyKey ? [] : clients.filter((x) => x.kind === 'contact' && x.companyKey === c.companyKey)
    .sort((a, b) => ['recruiter', 'dev', 'other'].indexOf(a.group) - ['recruiter', 'dev', 'other'].indexOf(b.group) || a.name.localeCompare(b.name)));

  const inGroup = useMemo(() => clients.filter((c) => c.group === group), [clients, group]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return inGroup
      .filter((c) => (status === 'all' || c.status === status)
        && (!withJob || c.jobs.length > 0)
        && (!onlyReplied || !!c.repliedAt)
        && (!onlyWaiting || isWaiting(c))
        && (!s || `${c.name} ${c.company ?? ''} ${c.title ?? ''} ${c.jobs.map((j) => j.title).join(' ')}`.toLowerCase().includes(s)))
      // מי שענה נשאר גבוה גם אחרי שטופל: ראשון מי שמחכה לך, אחריו הענייה האחרונה.
      .sort((a, b) => Number(b.urgent) - Number(a.urgent) || (b.repliedAt ?? '').localeCompare(a.repliedAt ?? '') || b.stage - a.stage || b.jobs.length - a.jobs.length);
  }, [inGroup, status, withJob, onlyReplied, onlyWaiting, q]);

  const cnt = (k: 'none' | 'requested' | 'friend') => inGroup.filter((c) => c.status === k).length;
  const total = inGroup.length || 1;
  const waiting = inGroup.filter(isWaiting).length;

  return (
    <>
      <div className="hx-kpis">
        <div className="hx-kpi"><small>לקוחות בקבוצה</small><b>{inGroup.length}</b></div>
        <div className="hx-kpi"><small>עם משרה פתוחה</small><b>{inGroup.filter((c) => c.jobs.length).length}</b></div>
        <button className={'hx-kpi warn hx-kpib' + (onlyWaiting ? ' on' : '')} onClick={() => { setOnlyWaiting(!onlyWaiting); setShown(40); }} title="הצג רק מי שמחכה לפעולה שלך"><small>מחכים לפעולה שלך</small><b>{waiting}</b></button>
        <div className="hx-kpi"><small>הוגשה דרכם משרה</small><b>{inGroup.filter((c) => c.stage >= 4 && c.stage < 7).length}</b></div>
      </div>

      <div className="hx-card">
        <div className="hx-stack">
          <i style={{ flex: cnt('none') || 0.001, background: '#B9CBDD' }} />
          <i style={{ flex: cnt('requested') || 0.001, background: '#A8690A' }} />
          <i style={{ flex: cnt('friend') || 0.001, background: '#0B8F63' }} />
        </div>
        <div className="hx-leg">
          <span><u style={{ background: '#B9CBDD' }} />לא חבר {cnt('none')}</span>
          <span><u style={{ background: '#A8690A' }} />נשלחה בקשה {cnt('requested')}</span>
          <span><u style={{ background: '#0B8F63' }} />חבר {cnt('friend')}</span>
          <span className="mut">{Math.round((cnt('friend') / total) * 100)}% חברים</span>
        </div>
      </div>

      <div className="hx-card hx-filters">
        <input className="hx-search" placeholder="חיפוש לפי שם, חברה, תפקיד או משרה…" value={q}
          onChange={(e) => { setQ(e.target.value); setShown(40); }} />
        <div className="hx-chips"><span className="lab">סוג</span>
          {(['recruiter', 'dev', 'other'] as Group[]).map((g) => (
            <button key={g} className={group === g ? 'on' : ''} onClick={() => { setGroup(g); setShown(40); }}>
              {GL[g]} {clients.filter((c) => c.group === g).length}
            </button>
          ))}
        </div>
        <div className="hx-chips"><span className="lab">חברות</span>
          {(['all', 'none', 'requested', 'friend'] as const).map((s) => (
            <button key={s} className={status === s ? 'on' : ''} onClick={() => { setStatus(s); setShown(40); }}>
              {s === 'all' ? 'הכול' : SL[s]} {s === 'all' ? inGroup.length : cnt(s)}
            </button>
          ))}
          <button className={onlyReplied ? 'on' : ''} onClick={() => { setOnlyReplied(!onlyReplied); setShown(40); }}>ענו לי {inGroup.filter((c) => c.repliedAt).length}</button>
          <button className={withJob ? 'on' : ''} onClick={() => { setWithJob(!withJob); setShown(40); }}>רק עם משרה {inGroup.filter((c) => c.jobs.length).length}</button>
        </div>
      </div>

      <div className="hx-card hx-table">
        <div className="hx-cnt">מציג <b>{Math.min(shown, rows.length)}</b> מתוך <b>{rows.length}</b>
          {rows.length < inGroup.length && <span className="mut"> · {inGroup.length - rows.length} מוסתרים בגלל הסינון, מתוך {inGroup.length} בסוג הזה</span>}</div>
        <div className="hx-head">
          <span>לקוח וחברה</span><span>חברות</span><span>משרות</span><span>שלב</span><span>הצעד הבא</span><span />
        </div>
        {rows.slice(0, shown).map((c) => (
          <div key={c.id} className={'hx-rowwrap' + (c.urgent ? ' urgent' : '')}>
            <div className="hx-row">
              <div className="hx-who">
                <b>{c.name || '(ללא שם)'}</b>
                <span>{[c.company, c.title].filter(Boolean).join(' · ')}</span>
                {c.kind === 'prior' && <em className="hx-tag gray">נשלחה במאי, לא אושרה</em>}
                {c.silentCount >= SILENT_LIMIT && <em className="hx-tag">{c.silentCount} הגשות בלי מענה</em>}
              </div>
              <div><span className={'hx-pill ' + c.status}>{SL[c.status]}</span></div>
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
                  ? <button className="hx-nbtn" onClick={() => setAct(act === c.id ? null : c.id)}>{c.next}</button>
                  : c.urgent ? <button className="hx-nbtn" onClick={() => toggle(c.id, 'jobs')}>{c.next}</button>
                  : (c.next ?? '—')}
              </div>
              <div className="hx-gos">
                <button className={'hx-go' + (view?.id === c.id && view.tab === 'jobs' ? ' on' : '')} onClick={() => toggle(c.id, 'jobs')}>פעולות</button>
                <button className={'hx-go' + (view?.id === c.id && view.tab === 'edit' ? ' on' : '')} onClick={() => toggle(c.id, 'edit')}>עדכן פרטים</button>
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
                        <div className="hx-acts"><button className="hx-b main" onClick={() => setAct(c.id)}>הכן הודעת היכרות</button></div>
                      )}
                    </div>
                  )}
                  {c.jobs.map((j) => (
                    <div key={j.id} className="hx-job">
                      <div className="hx-jt"><b>{j.title}</b><span>{j.company}{j.applied && j.appliedDays !== null ? ` · הוגשה לפני ${j.appliedDays} ימים${j.silent ? ' · בלי מענה' : ''}` : j.ageDays !== null ? ` · פורסמה לפני ${j.ageDays} ימים` : ''}</span></div>
                      <div className="hx-stage"><Bar stage={j.stage} /><small>{STAGES[j.stage - 1]}</small></div>
                      <div className="hx-acts">
                        {j.url && <a className="hx-b" href={j.url} target="_blank" rel="noreferrer">פתח משרה</a>}
                        <StepButtons j={j} friends={friendsOf(c)} />
                        {!j.applied && c.kind !== 'prior' && <button className="hx-b main" onClick={() => setAct(c.id)}>
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
        {rows.length > shown && <button className="hx-more" onClick={() => setShown(shown + 60)}>הצג עוד</button>}
      </div>
    </>
  );
}
