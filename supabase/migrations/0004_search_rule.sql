-- The matching rule, stored beside the search rather than written twice.
--
-- The scan is Python and the app is TypeScript, and both have to decide the
-- same question: does this posting belong to this search. Porting the matcher
-- would give two copies that agree on the day they are written and quietly stop
-- agreeing after the first fix to one of them — and the failure is invisible,
-- because a posting that is silently dropped looks exactly like a posting that
-- was never returned.
--
-- So the rule travels as data. expand() computes it once when the search is
-- saved; both sides only evaluate it:
--
--   { "any": ["qa","בדיקות",...],          -- one of these, or it is not a match
--     "all": [["python","פייתון"],          -- and one from each of these groups
--             ["manager","lead","מנהל"]] }
--
-- "all" holds groups rather than words because its two uses are different
-- questions that both have to hold: a technology the person named, and the rank
-- they asked for. An empty "all" is the common case.
alter table searches add column if not exists rule jsonb;

comment on column searches.rule is
  'Match rule evaluated identically by the app and the scanner. See 0004.';
