-- חברות זהב: סימוני החלטה יומית על חברה. כמו הפנייה הרחבה, גם שליחה וגם
-- ויתור נספרים מול המכסה היומית.
alter table companies add column if not exists gold_done_at timestamptz;
alter table companies add column if not exists gold_skipped_at timestamptz;
create index if not exists companies_gold_idx on companies(gold_done_at, gold_skipped_at);
notify pgrst, 'reload schema';
