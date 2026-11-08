"""מה שאול סוגר ב-X, ומה אפשר ללמוד מזה.

כפתור ה-X רושם dismissed_at ומעלים את המשרה, וזהו. מצטברות שם מאות החלטות
אמיתיות על מה לא מתאים, ואף אחד לא הסתכל בהן. שער התחום שנכתב ב-8.11.2026
נבנה מניחוש של קלוד מה לא מעניין את שאול. הקובץ הזה מחליף את הניחוש בנתון.

קריאה בלבד. הוא לא משנה שום שורה ולא מפעיל שום מסנן, רק מדפיס.

    python sync/dismiss_patterns.py
"""
import os
import re
from collections import Counter

from cv_requests import sql, summary  # אותו חיבור, אותה דרך החוצה

# מילה שמופיעה בפחות מזה לא אומרת כלום, גם אם נסגרה בכל פעם.
MIN_SEEN = 4
# מתחת לזה הדפוס חלש מכדי לפעול לפיו.
MIN_RATE = 0.70

# מילות קישור שאין טעם לספור.
STOP = {
    'manager', 'מנהל', 'מנהלת', 'מנהל/ת', 'מנהל.ת', 'לחברה', 'דרוש', 'דרושה',
    'דרוש/ה', 'the', 'and', 'for', 'with', 'של', 'את', 'עם', 'בחברת', 'בחברה',
    'senior', 'team', 'lead', 'leader', 'head', 'director', 'ת', 'ה',
}


def words(title):
    for w in re.split(r"[^\w֐-׿&+/-]+", (title or '').lower()):
        w = w.strip('/-')
        if len(w) > 2 and w not in STOP:
            yield w


def main():
    rows = sql(
        "select title, company, source, (dismissed_at is not null) as dismissed "
        "from jobs where on_target = true;")
    if not rows:
        summary("no on-target jobs")
        return

    total = len(rows)
    closed = [r for r in rows if r["dismissed"]]
    summary(f"on-target jobs: {total}, closed with X: {len(closed)} "
            f"({100 * len(closed) / total:.0f}%)")

    # מילה בכותרת
    seen, shut = Counter(), Counter()
    for r in rows:
        for w in set(words(r.get("title"))):
            seen[w] += 1
            if r["dismissed"]:
                shut[w] += 1

    summary("")
    summary("=== WORDS IN THE TITLE, by how often they end in X ===")
    ranked = [(w, shut[w], seen[w], shut[w] / seen[w])
              for w in seen if seen[w] >= MIN_SEEN and shut[w] / seen[w] >= MIN_RATE]
    for w, c, n, rate in sorted(ranked, key=lambda x: (-x[3], -x[2]))[:30]:
        summary(f"  {rate:5.0%}  {c:>3}/{n:<3}  {w}")

    # ומה דווקא נשמר, כדי לראות שהמסנן לא יבלע את מה שכן מעניין
    summary("")
    summary("=== WORDS HE ALMOST NEVER CLOSES ===")
    keepers = [(w, shut[w], seen[w], shut[w] / seen[w])
               for w in seen if seen[w] >= MIN_SEEN and shut[w] / seen[w] <= 0.25]
    for w, c, n, rate in sorted(keepers, key=lambda x: (x[3], -x[2]))[:20]:
        summary(f"  {rate:5.0%}  {c:>3}/{n:<3}  {w}")

    # חברה
    cseen, cshut = Counter(), Counter()
    for r in rows:
        c = (r.get("company") or "").strip()
        if not c:
            continue
        cseen[c] += 1
        if r["dismissed"]:
            cshut[c] += 1

    summary("")
    summary("=== COMPANIES he closes every time ===")
    cranked = [(c, cshut[c], cseen[c], cshut[c] / cseen[c])
               for c in cseen if cseen[c] >= 3 and cshut[c] / cseen[c] >= MIN_RATE]
    for c, k, n, rate in sorted(cranked, key=lambda x: (-x[3], -x[2]))[:20]:
        summary(f"  {rate:5.0%}  {k:>3}/{n:<3}  {c}")

    # מקור
    summary("")
    summary("=== BY SOURCE ===")
    sseen, sshut = Counter(), Counter()
    for r in rows:
        s = r.get("source") or "?"
        sseen[s] += 1
        if r["dismissed"]:
            sshut[s] += 1
    for s in sorted(sseen, key=lambda s: -sseen[s]):
        summary(f"  {sshut[s] / sseen[s]:5.0%}  {sshut[s]:>3}/{sseen[s]:<4}  {s}")


if __name__ == "__main__":
    main()
