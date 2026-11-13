import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';

// מי פרסם את המודעה. 13.11.2026: הרשת של האתר לא מגיעה ללינקדאין, ולכן
// המשיכה רצה על הראנר, בדיוק כמו כל שאר הגישה למסד.
//
// best-effort בכוונה: אם ההפעלה נכשלת, הסימון "הוגשה" עדיין נרשם. הריצה
// המתוזמנת סורקת ממילא את כל ההגשות של השבוע האחרון שאין להן מפרסם, ולכן
// כישלון כאן מתקן את עצמו בתוך שעה.
async function fetchPoster(jobId: string) {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return;
  await fetch(
    'https://api.github.com/repos/shaulmano/situation-room/actions/workflows/cv.yml/dispatches',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main', inputs: { mode: 'poster', request_id: jobId } }),
    }
  ).catch(() => null);
}

// Applying happens on someone else's site, so nothing can observe it. This is
// the one thing only Shaul can tell the system, and it has to cost one tap.
export async function POST(req: NextRequest) {
  const { id, cv_id } = await req.json();
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  const sb = serverClient();
  const { data: job, error: jobErr } = await sb
    .from('jobs')
    .select('id, title, company, source, recruiter_name')
    .eq('id', id)
    .single();

  if (jobErr || !job) {
    return NextResponse.json({ error: jobErr?.message ?? 'job not found' }, { status: 404 });
  }

  const { error } = await sb.from('applications').insert({
    job_id: job.id,
    cv_id: cv_id ?? null,
    company: job.company,
    role: job.title,
    channel: job.source === 'LinkedIn' ? 'linkedin' : 'form',
    sent_at: new Date().toISOString(),
    status: 'sent',
    // Keeps the Gmail backfill from inserting a duplicate for the same posting.
    gmail_thread_id: `manual:${job.id}`,
  });

  if (error && !error.message.includes('duplicate')) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // רק ללינקדאין ורק אם אין כבר מפרסם שמור. אין טעם לשלוח ראנר על משרה
  // שהסריקה כבר הביאה את המפרסם שלה.
  if (job.source === 'LinkedIn' && !job.recruiter_name) {
    await fetchPoster(job.id);
  }
  return NextResponse.json({ ok: true });
}
