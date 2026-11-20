-- חברות זהב: משיכה יומית של מאגר החברות, 04:30 בישראל בחורף.
-- cron.yml job=companies. ראה sync/companies_sync.py.
select cron.schedule('companies-daily', '30 2 * * *',
  $cmd$select public.gh_dispatch('shaulmano/situation-room', 'cron.yml',
    jsonb_build_object('job', 'companies'))$cmd$);
