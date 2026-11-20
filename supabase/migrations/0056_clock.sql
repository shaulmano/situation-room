-- שעון אמין לחדר המצב, 20.11.2026.
--
-- הקרון של GitHub מדלג על רוב הריצות התכופות (שתיים מתוך 48 בחצי שעה),
-- ולכן הסריקה הייתה תלויה בסוכן קלוד מתוזמן שרק העיר אותה. כאן השעון
-- יושב ב-Supabase עצמו: pg_cron מפעיל פונקציה, והיא שולחת
-- workflow_dispatch ל-GitHub דרך pg_net. אין מודל בדרך ואין מחשב.
--
-- הטוקן יושב ב-vault בשם github_dispatch. שאול הכניס אותו בעצמו, והוא
-- לא נכתב בשום קובץ כי המאגר ציבורי. תוקפו שנה מ-20.11.2026, וצריך
-- להחליף אותו לפני כן, אחרת כל ההפעלות נכשלות בשקט עם 401.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create or replace function public.gh_dispatch(
  p_repo text, p_workflow text, p_inputs jsonb default '{}'::jsonb
) returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault, net
as $fn$
declare
  tok text;
  req bigint;
begin
  select decrypted_secret into tok
    from vault.decrypted_secrets where name = 'github_dispatch';
  if tok is null then
    raise exception 'no github_dispatch secret in vault';
  end if;
  select net.http_post(
    url := 'https://api.github.com/repos/' || p_repo
           || '/actions/workflows/' || p_workflow || '/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || tok,
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'situation-room-clock',
      'Content-Type', 'application/json'),
    body := jsonb_build_object('ref', 'main', 'inputs', p_inputs)
  ) into req;
  return req;
end
$fn$;

-- הפונקציה חשופה ל-PostgREST כברירת מחדל. בלי זה כל מי שיש לו את מפתח
-- ה-anon הציבורי יכול להפעיל וורקפלו בשם שאול.
revoke all on function public.gh_dispatch(text, text, jsonb) from public, anon, authenticated;

-- סריקת הלוחות, כל 90 דקות בדיוק כמו שהקרון ביקש: על השעה וחצי שעה
-- לסירוגין, 16 פעמים ביום. המרווח הוא של השעון ולכן אין צורך בשומר
-- של 80 דקות. concurrency ב-notify.yml מתור ריצה שמגיעה בזמן ריצה אחרת.
select cron.schedule('scan-boards-a', '0 0,3,6,9,12,15,18,21 * * *',
  $cmd$select public.gh_dispatch('shaulmano/shaul-job-search', 'notify.yml')$cmd$);
select cron.schedule('scan-boards-b', '30 1,4,7,10,13,16,19,22 * * *',
  $cmd$select public.gh_dispatch('shaulmano/shaul-job-search', 'notify.yml')$cmd$);

-- החיפוש הממוקד בלינקדאין על שבעת התפקידים, כל ארבע שעות, מסומן ידני.
select cron.schedule('scan-linkedin-targeted', '40 2,6,10,14,18,22 * * *',
  $cmd$select public.gh_dispatch('shaulmano/situation-room', 'scan.yml',
    jsonb_build_object(
      'sources', 'linkedin',
      'roles', 'QA Director|QA Manager|Head of QA|QA Team Leader|Project Manager|Program Manager|Release Manager',
      'manual', 'true'))$cmd$);

notify pgrst, 'reload schema';
