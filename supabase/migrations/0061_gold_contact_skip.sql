-- חברות זהב: ויתור על איש קשר בודד. נפרד מ-skipped_at של מסך מכרים,
-- כי שאול מפריד בין המסכים: ויתור כאן לא משנה שום דבר שם.
alter table contacts add column if not exists gold_skipped_at timestamptz;
notify pgrst, 'reload schema';
