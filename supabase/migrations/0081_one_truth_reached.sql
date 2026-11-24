-- אמת אחת: "פניתי" הוא עובדה אחת על אדם אחד, בכל המסכים.
--
-- 24.11.2026, שאול: "זה פשוט לא הגיוני שיש לי כפילויות ואני יושב שעות על מנת
-- להבין אם שלחתי או לא. יש וחייבת להיות רק אמת אחת. אני לא אמור לעבוד על
-- ההגשות יותר משעה ביום."
--
-- נמדד: 37 אנשים בטאב המפרסמים, ולעשרה מהם יש שורה ב-contacts שאומרת שכבר
-- פנה אליהם (contacted_at, או שיחה בתיבה). 0036 סימן רק בכיוון אחד, מפרסם
-- לאיש קשר ורק דרך ה-API, ורק לפי slug. ה-slug נשבר על לוכסן סוגר:
-- `maya-zilberstein/` מול `maya-zilberstein`.
--
-- עכשיו זה בבסיס הנתונים ולא בקוד של מסך, ולכן כל נתיב כתיבה מכוסה:
-- API, סוכן התיבה, סריקת המיילים והמסכים. הצלבה לפי slug (עם לוכסן מנוקה),
-- ואם אין, לפי שם מדויק רק כשיש איש קשר אחד בשם הזה (יש 16 שמות כפולים).

create or replace function slug_of(u text) returns text
language sql immutable as $$
  select lower(split_part(split_part(split_part(coalesce(u,''), '/in/', 2), '?', 1), '/', 1))
$$;

create or replace function name_key(t text) returns text
language sql immutable as $$
  select lower(regexp_replace(coalesce(t,''), '[^[:alpha:]]', '', 'g'))
$$;

-- מתי פנה אליו, לפי הוכחה כלשהי. שיחה בתיבה (li_seen_at) נחשבת: יש שרשור.
create or replace function reached_at(c contacts) returns timestamptz
language sql immutable as $$
  select least(c.contacted_at, c.wide_sent_at, c.first_pitch_at, c.li_seen_at)
$$;

-- איש קשר שפנו אליו: מסמן את כל המשרות שהוא פרסם כפנייה שנעשתה.
create or replace function contact_to_posters() returns trigger
language plpgsql as $$
declare r timestamptz; sg text; nk text; uniq boolean;
begin
  r := reached_at(new);
  if r is null then return new; end if;
  sg := slug_of(new.linkedin_url);
  nk := name_key(new.full_name);
  select count(*) = 1 into uniq from contacts x where name_key(x.full_name) = nk;
  update jobs j set poster_sent_at = r
   where j.poster_sent_at is null and j.poster_skipped_at is null
     and coalesce(j.recruiter_url,'') <> ''
     and ((sg <> '' and slug_of(j.recruiter_url) = sg)
          or (uniq and nk <> '' and name_key(j.recruiter_name) = nk));
  return new;
end $$;

drop trigger if exists trg_contact_to_posters on contacts;
create trigger trg_contact_to_posters
  after insert or update of contacted_at, wide_sent_at, first_pitch_at, li_seen_at, linkedin_url
  on contacts for each row execute function contact_to_posters();

-- משרה שסומנה שנשלחה: מסמנת את איש הקשר שלה.
create or replace function poster_to_contact() returns trigger
language plpgsql as $$
declare sg text; nk text;
begin
  if new.poster_sent_at is null then return new; end if;
  sg := slug_of(new.recruiter_url);
  nk := name_key(new.recruiter_name);
  update contacts c set contacted_at = new.poster_sent_at
   where c.contacted_at is null
     and ((sg <> '' and slug_of(c.linkedin_url) = sg)
          or (nk <> '' and name_key(c.full_name) = nk
              and (select count(*) from contacts x where name_key(x.full_name) = nk) = 1));
  return new;
end $$;

drop trigger if exists trg_poster_to_contact on jobs;
create trigger trg_poster_to_contact
  after update of poster_sent_at on jobs
  for each row when (new.poster_sent_at is not null)
  execute function poster_to_contact();

-- מפרסם שנמצא אחרי שכבר פנו אליו: המשרה נכנסת מסומנת. רק בהכנסה או בשינוי
-- המפרסם, ולא בביטול ידני, אחרת "בטל" היה חוזר מיד.
create or replace function job_poster_known() returns trigger
language plpgsql as $$
declare r timestamptz; sg text; nk text;
begin
  if new.poster_sent_at is not null or new.poster_skipped_at is not null then return new; end if;
  if coalesce(new.recruiter_url,'') = '' then return new; end if;
  if tg_op = 'UPDATE' and new.recruiter_url is not distinct from old.recruiter_url then return new; end if;
  sg := slug_of(new.recruiter_url);
  nk := name_key(new.recruiter_name);
  select min(reached_at(c)) into r from contacts c
   where reached_at(c) is not null
     and ((sg <> '' and slug_of(c.linkedin_url) = sg)
          or (nk <> '' and name_key(c.full_name) = nk
              and (select count(*) from contacts x where name_key(x.full_name) = nk) = 1));
  if r is not null then new.poster_sent_at := r; end if;
  return new;
end $$;

drop trigger if exists trg_job_poster_known on jobs;
create trigger trg_job_poster_known
  before insert or update of recruiter_url, recruiter_name on jobs
  for each row execute function job_poster_known();

-- השלמה אחורה, בשני הכיוונים. הטריגרים עושים את העבודה: נוגעים בשורה בלי
-- לשנות ערך.
update contacts set contacted_at = contacted_at
 where reached_at(contacts) is not null;
update jobs set poster_sent_at = poster_sent_at
 where poster_sent_at is not null;

notify pgrst, 'reload schema';
