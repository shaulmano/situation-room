'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type Tally = { matched: number; applied: number; dismissed: number; open: number };

type Props = {
  id: string;
  label: string;
  terms: string[];
  active: boolean;
  tally: Tally;
};

export default function SearchRow({ id, label, terms, active, tally }: Props) {
  const router = useRouter();
  const [, start] = useTransition();
  const [busy, setBusy] = useState(false);

  async function call(method: 'PATCH' | 'DELETE', body: object) {
    setBusy(true);
    const res = await fetch('/api/searches', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) start(() => router.refresh());
  }

  const shown = terms.slice(0, 5);
  const rest = terms.length - shown.length;

  return (
    <article className={`search${active ? '' : ' off'}`}>
      <div className="head">
        <span className="label">{label}</span>
        <span className="spacer" />
        {/* What is left to act on — the same rows the jobs screen will show. */}
        <span className={`count${tally.open ? '' : ' zero'}`}>{tally.open}</span>
      </div>

      <div className="chips">
        {shown.map((t) => <span key={t} className="chip ask">{t}</span>)}
        {rest > 0 && <span className="chip">+{rest}</span>}
      </div>

      <div className="foot">
        <span>
          {active ? 'פעיל' : 'מושהה'}
          {' · '}
          {tally.matched} תאמו
          {tally.applied > 0 && ` · ${tally.applied} הגשת`}
          {tally.dismissed > 0 && ` · ${tally.dismissed} הסתרת`}
        </span>
        <span className="spacer" />
        <button disabled={busy} onClick={() => call('PATCH', { active: !active })}>
          {active ? 'השהה' : 'הפעל'}
        </button>
        <button
          disabled={busy}
          onClick={() => {
            // A search is minutes of typing and its matches rebuild on save, so
            // this is cheap to undo by re-adding — but the confirm stays,
            // because the two buttons sit next to each other on a phone.
            if (confirm(`למחוק את "${label}"?`)) call('DELETE', {});
          }}
        >
          מחק
        </button>
      </div>
    </article>
  );
}
