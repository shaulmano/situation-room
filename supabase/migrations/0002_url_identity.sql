-- A job is identified by its url. The bot's jobs.jsonl and the live scan give
-- the same posting two different ids, which put 108 duplicates on the screen.
create unique index if not exists jobs_url_key on jobs(url) where url is not null;
