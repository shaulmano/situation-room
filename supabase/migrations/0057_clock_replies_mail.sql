-- מי כתב בלינקדאין, מתוך מייל ההתראה, כל שעה ב-:50.
-- cron.yml job=replies_mail. ראה sync/replies_mail.py.
select cron.schedule('replies-mail', '50 * * * *',
  $cmd$select public.gh_dispatch('shaulmano/situation-room', 'cron.yml',
    jsonb_build_object('job', 'replies_mail'))$cmd$);
