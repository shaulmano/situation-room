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

  // One count query per search rather than one big fetch: a search can match a
  // few hundred postings and none of those rows are wanted here, only the size.
  const counts = await Promise.all(
    rows.map(async (s) => {
      const { count } = await sb
        .from('search_matches')
        .select('job_id', { count: 'exact', head: true })
        .eq('search_id', s.id);
      return count ?? 0;
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
              count={counts[i]}
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
