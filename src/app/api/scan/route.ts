import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';
import { currentUser, unauthorized, forbidden } from '@/lib/auth';

const REPO = 'shaulmano/situation-room';
const WORKFLOW = 'scan.yml';

// POST — ask GitHub to run the scan workflow.
//
// ⛔ Owner only, and not as a preference. A full scan is ~20 minutes of the
// 2,000 free Actions minutes a private repo gets each month: one user pressing
// this ten times burns the month for everybody and every scheduled sync stops
// until the 1st. It also multiplies the requests hitting the job boards, which
// is what gets a source blocked — Indeed was lost that way and did not come
// back. Everyone else gets results from the schedule, which carries their own
// search terms anyway; there is nothing here for them to press.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return unauthorized();
  if (!user.isOwner) return forbidden('סריקה ידנית שמורה לבעל המערכת');

  // Optional subset: rescanning twelve sources to retry one is fifteen minutes
  // of work for thirty seconds of need.
  const body = await req.json().catch(() => ({}));
  const raw: unknown = (body as { sources?: unknown }).sources;
  const sources = Array.isArray(raw)
    ? raw.filter((x): x is string => typeof x === 'string' && /^[a-z0-9]+$/.test(x))
    : [];

  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'לא הוגדר טוקן להפעלת הסריקה' },
      { status: 501 }
    );
  }

  // One at a time. Two overlapping runs would interleave their rows and the
  // progress bar would count both as one.
  const sb = serverClient();
  const { data: running } = await sb
    .from('scan_runs')
    .select('id, started_at')
    .eq('status', 'running')
    .gte('started_at', new Date(Date.now() - 45 * 60_000).toISOString())
    .limit(1);

  if (running && running.length > 0) {
    return NextResponse.json({ ok: true, already: true, run: running[0] });
  }

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main', inputs: { sources: sources.join(' ') } }),
    }
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: `GitHub ${res.status}: ${(await res.text()).slice(0, 200)}` },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true });
}

// GET — progress of the current or last run. Readable by anyone signed in: a
// scan is one shared job over one shared pool, and "a scan is running" is not
// anyone's private information.
export async function GET() {
  if (!(await currentUser())) return unauthorized();

  const { data } = await serverClient()
    .from('scan_runs')
    .select('id, started_at, finished_at, total, done, status, note')
    .order('started_at', { ascending: false })
    .limit(1);

  return NextResponse.json({ run: data?.[0] ?? null });
}
