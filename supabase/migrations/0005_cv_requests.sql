-- בקשות לקורות חיים מכוונים למשרה.
--
-- הכפתור בחדר המצב לא מייצר כלום בעצמו: הוא רק רושם כאן שורה pending.
-- משימה מתוזמנת בענן אוספת את השורות האלה, קוראת את תיאור המשרה מ-jobs
-- ואת גרסת הבסיס מ-cvs, כותבת את הגרסה המכוונת ל-result ומסמנת done.
--
-- למה דרך טבלה ולא קריאה ישירה: לאתר אין דרך לקרוא לקלוד בלי מפתח API
-- בתשלום נפרד. טבלה היא תיבת דואר: האתר כותב לתוכה, והמשימה המתוזמנת
-- קוראת ממנה, בלי שאף צד יצטרך להגיע לשני.
create table if not exists cv_requests (
  id          bigint generated always as identity primary key,
  job_id      text not null references jobs(id) on delete cascade,
  base_cv_id  text references cvs(id),
  -- pending בהמתנה, working נאסף, done מוכן, error נכשל
  status      text not null default 'pending',
  result      text,
  note        text,
  created_at  timestamptz default now(),
  done_at     timestamptz
);

create index if not exists cv_requests_status_idx  on cv_requests(status, created_at);
create index if not exists cv_requests_job_idx     on cv_requests(job_id, created_at desc);

alter table cv_requests enable row level security;
drop policy if exists owner_only on cv_requests;
create policy owner_only on cv_requests
  for all to authenticated
  using ((auth.jwt() ->> 'email') = 'shaul.mano@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'shaul.mano@gmail.com');

-- בלי זה PostgREST ימשיך לטעון שהטבלה לא קיימת, והמסך יציג אפס בלי שגיאה.
notify pgrst, 'reload schema';
