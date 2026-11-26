-- 26.11.2026. נועה בר (גב מערכות) ענתה "תשלח בבקשה למייל" והסוכן עוד לא כתב
-- נוסח. ממלא ידנית, כמו 0043. לא נוגע ב-reply_done_at ולא ב-reply_pushed_at.
update contacts
set reply_draft = E'Hi Noa, thanks! I\'m sending my CV to that address now.\nShaul'
where email = 'noa.bar@gav.co.il' and reply_draft is null and reply_text ilike '%gav.co.il%';
notify pgrst, 'reload schema';
