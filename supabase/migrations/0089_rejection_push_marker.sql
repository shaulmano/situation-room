-- 28.11.2026: סימון לדחיות, כדי שהסיכום היומי ידע אילו עוד לא נספרו.
-- בעמודה applications לא הייתה שום דרך לדעת מתי סומנה דחייה ואם כבר
-- דווחה, ולכן הפוש הנפרד על כל דחייה נשען על ארגומנט מהוורקפלו.
alter table applications
  add column if not exists rejected_marked_at timestamptz,
  add column if not exists rejected_pushed_at timestamptz;
notify pgrst, 'reload schema';
