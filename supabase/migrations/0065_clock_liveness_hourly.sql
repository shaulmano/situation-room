-- אימות משרות: כל שעה במקום כל שעתיים, כי הקצב מוגבל ל-429 של לינקדאין.
select cron.unschedule('liveness');
select cron.schedule('liveness', '20 * * * *',
  $cmd$select public.gh_dispatch('shaulmano/situation-room', 'cron.yml',
    jsonb_build_object('job', 'liveness'))$cmd$);
