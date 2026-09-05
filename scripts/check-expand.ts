/** Dev check: what an expansion produces, and how it lands on the real pool. */
import { readFileSync } from 'fs';
import { expand, matches, QUERY_TERMS } from '../src/lib/expand';

const jobs: { title: string; company: string | null }[] =
  JSON.parse(readFileSync(process.argv[2], 'utf8'));

for (const phrase of process.argv.slice(3)) {
  const e = expand(phrase);
  const hits = jobs.filter((j) => matches(e, j.title));
  console.log('\n"%s"  [%s]%s', phrase, e.seniority ?? '-', e.confident ? '' : '  (לא זוהה)');
  console.log('  שואלים : %s', e.terms.slice(0, QUERY_TERMS).join(' · '));
  console.log('  מזהים  : %s', e.match.join(', '));
  if (e.must.length) console.log('  חובה   : %s', e.must.join(', '));
  console.log('  נמצאו  : %d / %d', hits.length, jobs.length);
  for (const h of hits.slice(0, 3)) console.log('     %s', h.title.slice(0, 66));
}
