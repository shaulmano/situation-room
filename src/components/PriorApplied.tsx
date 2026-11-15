import type { PriorApplication } from '@/lib/priorApplication';

/**
 * שבב לקריאה בלבד: "כבר הגשת".
 *
 * 15.11.2026, שאול: "אם הוגשה תסמן אותה בדף כשהוגשה ללא אפשרות לעריכה
 * רק לידיעתי". לכן זה span ולא button, אין בו onClick, והוא לא כותב
 * כלום. הוא יושב בשורת השבבים ולא במקום הכפתורים, כדי שלא ייראה כמו
 * פעולה שאפשר לבטל.
 *
 * שני נוסחים, כי שתי הרמות אומרות דברים שונים. "כבר הגשת" היא קביעה,
 * ו"הגשת לחברה" היא ידיעה שהוא מחליט מה לעשות איתה.
 */
export default function PriorApplied({ prior }: { prior: PriorApplication | null }) {
  if (!prior) return null;
  const when = prior.when
    ? new Date(prior.when).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })
    : null;

  if (prior.exact) {
    return (
      <span
        className="chip applied"
        title={'סימנת שהגשת למשרה הזאת' + (when ? ' ב-' + when : '') +
               '. השורה הזאת הגיעה מלוח אחר בכתובת אחרת, ולכן היא נראית חדשה.'}
      >
        {'✓ כבר הגשת' + (when ? ' · ' + when : '')}
      </span>
    );
  }

  return (
    <span
      className="chip applied soft"
      title={'הגשת לחברה הזאת' + (when ? ' ב-' + when : '') +
             ' למשרה "' + prior.title + '". זאת לא אותה משרה, רק אותה חברה.'}
    >
      {'הגשת לחברה' + (when ? ' · ' + when : '')}
    </span>
  );
}
