-- One timestamp per contact, set when Shaul asks that person for a referral.
-- A timestamp rather than a boolean, because what the job screen needs to show
-- is how long ago it was: that is what decides whether a follow-up is due, and
-- whether a second job at the same company should go to someone else.
alter table contacts add column if not exists contacted_at timestamptz;
