-- A job is identified by its url. The bot's jobs.jsonl and the live scan give
-- the same posting two different ids, which put 108 duplicates on the screen.
--
-- Not a partial index: `create unique index ... where url is not null` looks
-- tidier but Postgres then refuses `on conflict (url)` unless the predicate is
-- repeated, and every scan died with 42P10. A plain unique index already allows
-- any number of NULLs, since NULLs are distinct to it.
drop index if exists jobs_url_key;
create unique index jobs_url_key on jobs(url);
