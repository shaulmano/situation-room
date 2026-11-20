-- אימות שמשרה עדיין פתוחה. 20.11.2026, שאול הראה את Fetcherr, Program
-- Manager: לינקדאין אומרת "No longer accepting applications" והמסך סימן
-- אותה כ"משרה פתוחה". closed_at נכתב רק על ידי sync/liveness.py.
alter table jobs add column if not exists closed_at timestamptz;
alter table jobs add column if not exists live_checked_at timestamptz;
create index if not exists jobs_live_idx on jobs(live_checked_at);
notify pgrst, 'reload schema';
