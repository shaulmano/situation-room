'use client';
import { useMemo, useState } from 'react';
import { STAGES, type Client } from '@/lib/clients';

type Group = 'recruiter' | 'dev' | 'other';
const GL: Record<Group, string> = { recruiter: 'מגייסות ו-HR', dev: 'מנהלי פיתוח', other: 'אחרים' };
const SL = { none: 'לא חבר', requested: 'נשלחה בקשה', friend: 'חבר' } as const;

function Bar({ stage }: { stage: number }) {
  return (
    <div className="hx-bar" title={stage ? STAGES[stage - 1] : 'אין משרה'}>
      {STAGES.map((s, i) => <i key={s} className={i < stage ? (stage >= 5 ? 'ok' : 'on') : ''} />)}
    </div>
  );
}

export default function ClientsTable({ clients }: { clients: Client[] }) {
  const [group, setGroup] = useState<Group>('recruiter');
  const [status, setStatus] = useState<'all' | keyof typeof SL>('all');
  const [withJob, setWithJob] = useState(true);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
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
              {s === 'all' ? 'הכול' : SL[s]}
            </button>
          ))}
          <button className={withJob ? 'on' : ''} onClick={() => { setWithJob(!withJob); setShown(40); }}>רק עם משרה</button>
        </div>
      </div>

      <div className="hx-card hx-table">
        <div className="hx-cnt">מציג <b>{Math.min(shown, rows.length)}</b> מתוך <b>{rows.length}</b></div>
        <div className="hx-head">
          <span>לקוח וחברה</span><span>חברות</span><span>משרות</span><span>שלב</span><span>הצעד הבא</span><span />
        </div>
        {rows.slice(0, shown).map((c) => (
          <div key={c.id} className={'hx-rowwrap' + (c.urgent ? ' urgent' : '')}>
            <div className="hx-row" onClick={() => setOpen(open === c.id ? null : c.id)}>
              <div className="hx-who">
                <b>{c.name || '(ללא שם)'}</b>
                <span>{[c.company, c.title].filter(Boolean).join(' · ')}</span>
              </div>
              <div><span className={'hx-pill ' + c.status}>{SL[c.status]}</span></div>
              <div className="hx-jobs">
                {c.jobs.length ? <><b>{c.jobs.length}</b> <span>{c.jobs[0].title}</span></> : <span className="mut">אין משרה</span>}
              </div>
              <div className="hx-stage">
                <Bar stage={c.stage} />
                <small>{c.stage ? STAGES[c.stage - 1] : 'ממתין למשרה'}</small>
              </div>
              <div className={'hx-next' + (c.urgent ? ' red' : '')}>{c.next ?? '—'}</div>
              <div className="hx-go">{open === c.id ? '▴' : '▾'}</div>
            </div>
            {open === c.id && (
              <div className="hx-detail">
                <div className="hx-dgrid">
                  <div><small>חברה</small><b>{c.company || '—'}</b></div>
                  <div><small>תפקיד</small><b>{c.title || '—'}</b></div>
                  <div><small>אימייל</small><b dir="ltr">{c.email || '—'}</b></div>
                  <div><small>טלפון</small><b dir="ltr">{c.phone || '—'}</b></div>
                </div>
                {c.replyText && <div className="hx-reply"><small>מה שכתבה לך</small>{c.replyText}</div>}
                <div className="hx-jl">
                  {c.jobs.length === 0 && <div className="mut">אין כרגע משרה מתאימה בחברה הזאת. כשתיכנס, הלקוח יעלה כאן לבד.</div>}
                  {c.jobs.map((j) => (
                    <div key={j.id} className="hx-job">
                      <div className="hx-jt"><b>{j.title}</b><span>{j.company}{j.applied && j.appliedDays !== null ? ` · הוגשה לפני ${j.appliedDays} ימים${j.silent ? ' · בלי מענה' : ''}` : j.ageDays !== null ? ` · פורסמה לפני ${j.ageDays} ימים` : ''}</span></div>
                      <div className="hx-stage"><Bar stage={j.stage} /><small>{STAGES[j.stage - 1]}</small></div>
                      <div className="hx-acts">
                        {j.url && <a className="hx-b" href={j.url} target="_blank" rel="noreferrer">פתח משרה</a>}
                        {!j.applied && <a className="hx-b main" href={c.status === 'friend' ? '/warm?tab=today' : '/connect'}>
                          {c.status === 'friend' ? 'פנייה' : 'בקשת חברות'}</a>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hx-acts">
                  {c.profile && <a className="hx-b" href={c.profile} target="_blank" rel="noreferrer">פרופיל בלינקדאין</a>}
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
