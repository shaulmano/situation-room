import { serverClient } from '@/lib/server';
import SearchForm from '@/components/SearchForm';
import SearchRow from '@/components/SearchRow';

export const dynamic = 'force-dynamic';

// What a person is looking for, in their words. The scan carries the union of
// every active search here — one sweep of the same twelve sources, one shopping
// list that happens to be everybody's. Ten separate crawls is what gets a
// source to block us, and a blocked source does not come back.
export default async function Searches() {
  const sb = serverClient();

  const { data: searches } = await sb
    .from('searches')
    .select('id, label, terms, active, created_at')
    .order('created_at', { ascending: false });

  const rows = searches ?? [];

  // The card counts what is left to do, not what matched.
  //
  // A plain match count and the jobs screen disagreed on the first search ever
  // created — 23 against 19 — and both were right: the feed drops what you have
  // already applied to. A number you cannot reconcile with the screen next to it
  // is a number you stop trusting, so the breakdown is spelled out on the card
  // rather than left as arithmetic for the reader.
  const [{ data: applied }, { data: hidden }] = await Promise.all([
    sb.from('applications').select('job_id'),
    sb.from('job_dismissals').select('job_id'),
  ]);
  const appliedIds = new Set((applied ?? []).map((a: any) => a.job_id).filter(Boolean));
  const hiddenIds = new Set((hidden ?? []).map((d: any) => d.job_id));

  const counts = await Promise.all(
    rows.map(async (s) => {
      const { data: ids } = await sb
        .from('search_matches')
        .select('job_id')
        .eq('search_id', s.id);

      const all = (ids ?? []).map((r: any) => r.job_id);
      const gone = all.filter((id) => appliedIds.has(id)).length;
      const hid = all.filter((id) => hiddenIds.has(id) && !appliedIds.has(id)).length;
      return { matched: all.length, applied: gone, dismissed: hid, open: all.length - gone - hid };
    })
  );

  return (
    <div className="shell">
      <section>
        <h2>החיפושים שלי</h2>

        {rows.length === 0 ? (
          <p className="empty">
            עוד לא הגדרת חיפוש. הקלד תפקיד למטה — הסריקה תתחיל לחפש אותו,
            ומה שכבר במאגר ותואם יופיע מיד.
          </p>
        ) : (
          rows.map((s, i) => (
            <SearchRow
              key={s.id}
              id={s.id}
              label={s.label}
              terms={s.terms ?? []}
              active={s.active}
              tally={counts[i]}
            />
          ))
        )}
      </section>

      <section>
        <h2>חיפוש חדש</h2>
        <SearchForm />
      </section>
    </div>
  );
}
