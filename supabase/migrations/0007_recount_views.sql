-- חישוב מחדש של "נצפה על ידי מגייס".
--
-- 9.11.2026. שאול שאל מאיפה מגיע הנתון. התשובה: לינקדאין שולח מייל
-- "your application was viewed", והסנכרון הריץ
--     update applications set status='acknowledged' where company=X and status='sent'
-- כלומר מייל אחד צבע כל הגשה פתוחה לאותה חברה, לפי השם בלבד, בלי קשר
-- למשרה ובלי קשר לתאריך. במסד: comblack עם עשר הגשות מסומנות כנצפו,
-- Extreme עם חמש. סך הכל 36 "נצפו" על פני חמש עשרה חברות.
--
-- בג'ימייל יש בדיוק 23 מיילי צפייה, על 18 חברות. 36 הוא לא מספר שקיים.
--
-- כאן: מאפסים את מה שהמנגנון הישן צבע, ומחילים כל מייל על הגשה אחת,
-- האחרונה לאותה חברה שנשלחה לפני המייל. זה עדיין ניחוש, כי לינקדאין לא
-- אומר באיזו משרה מדובר, אבל ניחוש על שורה אחת הוא לא אותו דבר כמו
-- לצבוע עשר.
--
-- status_by='shaul' לא נגעים בו: מה ששאול רשם ידנית גובר תמיד.

update applications set status = 'sent'
where status = 'acknowledged' and status_by = 'auto';

update applications set status='acknowledged' where id = (select id from applications where company='Quantum Talents' and status='sent' and status_by='auto' and sent_at <= '2026-03-29T07:01:21Z' order by sent_at desc limit 1);
update applications set status='acknowledged' where id = (select id from applications where company='Ivory Software Systems' and status='sent' and status_by='auto' and sent_at <= '2026-03-30T12:26:02Z' order by sent_at desc limit 1);
update applications set status='acknowledged' where id = (select id from applications where company='Autofleet' and status='sent' and status_by='auto' and sent_at <= '2026-03-30T11:16:33Z' order by sent_at desc limit 1);
update applications set status='acknowledged' where id = (select id from applications where company='Extreme' and status='sent' and status_by='auto' and sent_at <= '2026-03-30T07:19:36Z' order by sent_at desc limit 1);
update applications set status='acknowledged' where id = (select id from applications where company='P-Cure Ltd' and status='sent' and status_by='auto' and sent_at <= '2026-03-15T15:23:41Z' order by sent_at desc limit 1);
update applications set status='acknowledged' where id = (select id from applications where company='Extreme' and status='sent' and status_by='auto' and sent_at <= '2026-03-15T13:21:47Z' order by sent_at desc limit 1);
update applications set status='acknowledged' where id = (select id from applications where company='Medulla' and status='sent' and status_by='auto' and sent_at <= '2026-03-15T11:18:21Z' order by sent_at desc limit 1);
update applications set status='acknowledged' where id = (select id from applications where company='Antidote Health' and status='sent' and status_by='auto' and sent_at <= '2026-03-11T09:23:00Z' order by sent_at desc limit 1);
update applications set status='acknowledged' where id = (select id from applications where company='Israel Hayom ישראל היום' and status='sent' and status_by='auto' and sent_at <= '2026-03-04T19:02:59Z' order by sent_at desc limit 1);
update applications set status='acknowledged' where id = (select id from applications where company='comblack' and status='sent' and status_by='auto' and sent_at <= '2026-03-03T08:00:52Z' order by sent_at desc limit 1);
update applications set status='acknowledged' where id = (select id from applications where company='Antidote Health' and status='sent' and status_by='auto' and sent_at <= '2026-02-24T11:40:14Z' order by sent_at desc limit 1);
update applications set status='acknowledged' where id = (select id from applications where company='Medulla' and status='sent' and status_by='auto' and sent_at <= '2026-02-24T07:30:11Z' order by sent_at desc limit 1);
update applications set status='acknowledged' where id = (select id from applications where company='Logica-IT' and status='sent' and status_by='auto' and sent_at <= '2026-02-23T13:08:24Z' order by sent_at desc limit 1);
update applications set status='acknowledged' where id = (select id from applications where company='Apprentice' and status='sent' and status_by='auto' and sent_at <= '2026-02-23T09:55:47Z' order by sent_at desc limit 1);
update applications set status='acknowledged' where id = (select id from applications where company='Extreme' and status='sent' and status_by='auto' and sent_at <= '2026-02-23T06:25:20Z' order by sent_at desc limit 1);
update applications set status='acknowledged' where id = (select id from applications where company='Mondarine' and status='sent' and status_by='auto' and sent_at <= '2026-02-19T11:05:36Z' order by sent_at desc limit 1);
update applications set status='acknowledged' where id = (select id from applications where company='Telefire' and status='sent' and status_by='auto' and sent_at <= '2026-02-19T06:25:20Z' order by sent_at desc limit 1);
update applications set status='acknowledged' where id = (select id from applications where company='Datacube' and status='sent' and status_by='auto' and sent_at <= '2026-02-17T10:38:36Z' order by sent_at desc limit 1);
update applications set status='acknowledged' where id = (select id from applications where company='Silicom Ltd. - Connectivity Solutions' and status='sent' and status_by='auto' and sent_at <= '2026-02-16T06:16:47Z' order by sent_at desc limit 1);
update applications set status='acknowledged' where id = (select id from applications where company='Sivron' and status='sent' and status_by='auto' and sent_at <= '2026-02-12T12:05:09Z' order by sent_at desc limit 1);
update applications set status='acknowledged' where id = (select id from applications where company='CyberproAI' and status='sent' and status_by='auto' and sent_at <= '2026-02-12T10:43:43Z' order by sent_at desc limit 1);
update applications set status='acknowledged' where id = (select id from applications where company='Antidote Health' and status='sent' and status_by='auto' and sent_at <= '2026-01-28T11:16:40Z' order by sent_at desc limit 1);
update applications set status='acknowledged' where id = (select id from applications where company='Jeen.ai' and status='sent' and status_by='auto' and sent_at <= '2025-12-29T13:52:40Z' order by sent_at desc limit 1);

-- מה שנשאר פתוח ומעל ארבעה עשר יום הוא שקט, לא תשובה שמתעכבת.
update applications set status='silent'
where status='sent' and status_by='auto'
  and sent_at < now() - interval '14 days';

notify pgrst, 'reload schema';
