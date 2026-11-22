
alter table li_outbox add column if not exists kind text not null default 'gold';
notify pgrst, 'reload schema';
