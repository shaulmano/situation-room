"""מריץ שאילתת קריאה מול המסד ומדפיס את התוצאה.

‏9.11.2026. שאול שאל מאיפה מגיע מספר שמוצג על המסך, ולא הייתה שום דרך
לענות בלי לבקש ממנו לפתוח SQL editor בדפדפן. קלוד לא ניגש למסד הזה
ישירות: מחבר Supabase מאפשר ארגון אחד בלבד, והארגון של חדר המצב אינו זה
שמחזיק את manomatic.

קריאה בלבד, ובכוח: כל שאילתה שלא מתחילה ב-select או ב-with נדחית כאן,
לפני שהיא יוצאת החוצה. זה לא קובץ לשינוי נתונים, ואסור שיהפוך לכזה.

    python sync/query.py "select count(*) from applications;"
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cv_requests import sql, summary

FORBIDDEN = ("insert", "update", "delete", "drop", "alter", "create",
             "truncate", "grant", "revoke")


def main():
    if len(sys.argv) < 2:
        raise SystemExit('usage: python sync/query.py "select ..."')
    query = " ".join(sys.argv[1:]).strip()
    head = query.lstrip("( \n\t").lower()
    if not (head.startswith("select") or head.startswith("with")):
        raise SystemExit("read-only: the query must start with select or with")
    # ‏";" בתוך שאילתה פותח פקודה שנייה, וזאת הדרך לעקוף את הבדיקה למעלה.
    if ";" in query.rstrip().rstrip(";"):
        raise SystemExit("read-only: one statement at a time")
    low = query.lower()
    for word in FORBIDDEN:
        if f" {word} " in f" {low} ":
            raise SystemExit(f"read-only: {word} is not allowed here")

    rows = sql(query)
    if not rows:
        summary("no rows")
        return
    cols = list(rows[0].keys())
    summary(" | ".join(cols))
    summary("-" * 60)
    for row in rows[:200]:
        summary(" | ".join(str(row.get(c, "")) for c in cols))
    summary(f"({len(rows)} rows)")


if __name__ == "__main__":
    main()
