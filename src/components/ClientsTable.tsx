'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { STAGES, SILENT_LIMIT, type Client } from '@/lib/clients';
import { referralMessage, connectNote, cvFileFor } from '@/lib/outreach';
import { isAgency } from '@/lib/pickContact';

type Group = 'recruiter' | 'dev' | 'other';
const GL: Record<Group, string> = { recruiter: 'מגייסות ו-HR', dev: 'מנהלי פיתוח', other: 'אחרים' };
const SL = { none: 'לא חבר', requested: 'נשלחה בקשה', friend: 'חבר' } as const;

/** סימון אחד לשלב אחד. ההגשה והראיון והסגירה נרשמים דרך הנתיבים הקיימים. */
function StepButtons({ j }: { j: import('@/lib/clients').ClientJob }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function post(url: string, body: object) {
    setBusy(true);
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    if (!r || !r.ok) { alert('לא נשמר. נסה שוב.'); return; }
    router.refresh();
  }
  if (!j.applied) return (<>
    <button className="hx-b" disabled={busy} onClick={() => post('/api/jobs/applied', { id: j.id })}>הוגשה ישירות</button>
    <button className="hx-b" disabled={busy} onClick={() => post('/api/jobs/applied', { id: j.id, internal: true })}>הוגשה דרך מכר או HR</button>
  </>);
  if (!j.appId || j.closed) return null;
  return (<>
    {j.stage < 6 && <button className="hx-b" disabled={busy} onClick={() => post('/api/applications/step', { id: j.appId, status: 'interview', kind: 'interview' })}>נקבע ראיון</button>}
    <button className="hx-b" disabled={busy} onClick={() => post('/api/applications/step', { id: j.appId, status: 'rejected' })}>נסגרה, נדחה</button>
  </>);
}

function Bar({ stage }: { stage: number }) {
  return (
    <div className="hx-bar" title={stage ? STAGES[stage - 1] : 'אין משרה'}>
      {STAGES.map((s, i) => <i key={s} className={i < stage ? (stage === 7 ? 'off' : stage >= 5 ? 'ok' : 'on') : ''} />)}
    </div>
  );
}

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' }) : '—');

function Editor({ c }: { c: Client }) {
  const router = useRouter();
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
    setMsg('נשמר'); router.refresh();
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
  const router = useRouter();
  const job = c.jobs.find((j) => !j.applied) ?? c.jobs[0];
  const request = c.status === 'none';
  const initial = request
    ? connectNote(null, c.company)
    : job
    ? referralMessage({ contactName: c.name, company: c.company ?? '', jobTitle: job.title, contactTitle: c.title,
        jobUrl: job.url, applied: job.applied, agency: isAgency(c.company), attached: true })
    : '';
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const file = job ? cvFileFor(null, job.title) : null;

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
    onDone(); router.refresh();
  }
  return (
    <div className="hx-act">
      <div className="hx-actt">
        <b>{request ? 'בקשת חברות עם הערה' : 'הודעה עם קורות חיים'}</b>
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

export default function ClientsTable({ clients }: { clients: Client[] }) {
  const [group, setGroup] = useState<Group>('recruiter');
  const [status, setStatus] = useState<'all' | keyof typeof SL>('all');
  const [withJob, setWithJob] = useState(false);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [act, setAct] = useState<string | null>(null);
  const [shown, setShown] = useState(40);

  const inGroup = useMemo(() => clients.filter((c) => c.group === group), [clients, group]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return inGroup
      .filter((c) => (status === 'all' || c.status === status)
        && (!withJob || c.jobs.length > 0)
        && (!s || `${c.name} ${c.company ?? ''} ${c.title ?? ''} ${c.jobs.map((j) => j.title).join(' ')}`.toLowerCase().includes(s)))
      .sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.stage - a.stage || b.jobs.length - a.jobs.length);
  }, [inGroup, status, withJob, q]);

  const cnt = (k: 'none' | 'requested' | 'friend') => inGroup.filter((c) => c.status === k).length;
  const total = inGroup.length || 1;
  const waiting = inGroup.filter((c) => c.next && c.jobs.length && !c.next.startsWith('מחכה')).length;

  return (
    <>
      <div className="hx-kpis">
        <div className="hx-kpi"><small>לקוחות בקבוצה</small><b>{inGroup.length}</b></div>
        <div className="hx-kpi"><small>עם משרה פתוחה</small><b>{inGroup.filter((c) => c.jobs.length).length}</b></div>
        <div className="hx-kpi warn"><small>מחכים לפעולה שלך</small><b>{waiting}</b></div>
        <div className="hx-kpi"><small>הוגשה דרכם משרה</small><b>{inGroup.filter((c) => c.stage >= 5).length}</b></div>
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
                {c.silentCount >= SILENT_LIMIT && <em className="hx-tag">{c.silentCount} הגשות בלי מענה</em>}
              </div>
              <div><span className={'hx-pill ' + c.status}>{SL[c.status]}</span></div>
              <div className="hx-jobs">
                {c.jobs.length ? <><b>{c.jobs.length}</b> <span>{c.jobs[0].title}</span></> : <span className="mut">אין משרה</span>}
              </div>
              <div className="hx-stage">
                <Bar stage={c.stage} />
                <small>{c.stage ? STAGES[c.stage - 1] : 'ממתין למשרה'}</small>
              </div>
              <div className={'hx-next' + (c.urgent || c.next?.startsWith('פנה ישירות') ? ' red' : '')}>
                {c.next && /^לשלוח/.test(c.next) && c.jobs.length
                  ? <button className="hx-nbtn" onClick={() => setAct(act === c.id ? null : c.id)}>{c.next}</button>
                  : c.urgent ? <a className="hx-nbtn" href="/warm">{c.next}</a>
                  : (c.next ?? '—')}
              </div>
              <button className="hx-go" aria-label="פרטי הלקוח והמשרות" onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? '▴' : '▾'}</button>
            </div>
            {act === c.id && <ActionPanel c={c} onDone={() => setAct(null)} />}
            {open === c.id && (
              <div className="hx-detail">
                <Editor key={c.id} c={c} />
                {c.replyText && <div className="hx-reply"><small>מה שכתבה לך</small>{c.replyText}</div>}
                <div className="hx-jl">
                  {c.jobs.length === 0 && <div className="mut">אין כרגע משרה מתאימה בחברה הזאת. כשתיכנס, הלקוח יעלה כאן לבד.</div>}
                  {c.jobs.map((j) => (
                    <div key={j.id} className="hx-job">
                      <div className="hx-jt"><b>{j.title}</b><span>{j.company}{j.applied && j.appliedDays !== null ? ` · הוגשה לפני ${j.appliedDays} ימים${j.silent ? ' · בלי מענה' : ''}` : j.ageDays !== null ? ` · פורסמה לפני ${j.ageDays} ימים` : ''}</span></div>
                      <div className="hx-stage"><Bar stage={j.stage} /><small>{STAGES[j.stage - 1]}</small></div>
                      <div className="hx-acts">
                        {j.url && <a className="hx-b" href={j.url} target="_blank" rel="noreferrer">פתח משרה</a>}
                        <StepButtons j={j} />
                        {!j.applied && <button className="hx-b main" onClick={() => setAct(c.id)}>
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
