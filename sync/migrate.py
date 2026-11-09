"""מריץ קובץ מיגרציה מול Supabase של חדר המצב.

‏9.11.2026. עד היום כל מיגרציה הודבקה ידנית ל-SQL editor בדפדפן של שאול,
כי קלוד לא ניגש למסד הזה ישירות: מחבר Supabase מאפשר ארגון אחד בלבד,
והארגון של חדר המצב אינו זה שמחזיק את manomatic.

לרנר של GitHub יש את המפתחות ממילא, והוא זה שמריץ את ייצור קורות החיים.
אין שום סיבה שאותה מיגרציה תעבור דרך העתק־הדבק.

    python sync/migrate.py supabase/migrations/0006_interviews.sql

מריץ את הקובץ כבלוק אחד. כל המיגרציות כאן כתובות עם if not exists, ולכן
ריצה חוזרת לא שוברת כלום.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cv_requests import sql, summary


def main():
    if len(sys.argv) < 2:
        raise SystemExit("usage: python sync/migrate.py <path to .sql>")
    path = sys.argv[1]
    with open(path, encoding="utf-8") as fh:
        body = fh.read()
    summary(f"running {os.path.basename(path)}, {len(body)} chars")
    sql(body)
    summary("done")

    # מוכיח שהעמודות באמת שם. PostgREST מחזיק סכימה במטמון, ובלי
    # notify pgrst הוא ממשיך לענות "column does not exist" בלי שום שגיאה
    # על המסך. זה כבר קרה פעמיים בפרויקט הזה.
    rows = sql(
        "select column_name from information_schema.columns "
        "where table_name = 'applications' order by column_name;")
    names = [r["column_name"] for r in rows]
    summary("applications columns: " + ", ".join(names))


if __name__ == "__main__":
    main()
