-- אימות משרות פתוחות, כל שעתיים. cron.yml job=liveness.
select cron.schedule('liveness', '20 */2 * * *',
  $cmd$select public.gh_dispatch('shaulmano/situation-room', 'cron.yml',
    jsonb_build_object('job', 'liveness'))$cmd$);
