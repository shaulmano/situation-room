"""בודק מה שכבת ה-API באמת מחזירה לאתר, ולא מה שיש במסד.

‏10.11.2026. שאול לא ראה את הסינון החדש, בזמן שהשאילתה הישירה למסד הראתה
‏28 משרות שאמורות להופיע. בין המסד למסך יושב PostgREST, שמחזיק מטמון סכימה
משלו, והמלכודת הזאת כבר הפילה את הפרויקט פעמיים: אחרי ALTER TABLE הוא
ממשיך להתנהג כאילו העמודה לא קיימת, והמסכים מציגים אפס בלי שום שגיאה.

שאילתה למסד לא יכולה לתפוס את זה, כי היא עוקפת את PostgREST. הקובץ הזה
ניגש בדיוק כמו האתר, עם אותו מפתח ציבורי ואותה שאילתה.

קריאה בלבד.
"""
import json
import os
import urllib.request

REF = os.environ["SUPABASE_PROJECT_REF"]
TOKEN = os.environ["SUPABASE_ACCESS_TOKEN"]


def api(url, token):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def main():
    keys = api(f"https://api.supabase.com/v1/projects/{REF}/api-keys", TOKEN)
    anon = next((k["api_key"] for k in keys if k.get("name") == "anon"), None)
    if not anon:
        anon = next((k["api_key"] for k in keys
                     if "anon" in str(k.get("name", "")).lower()), None)
    if not anon:
        print("could not find the public key; names were: "
              + ", ".join(str(k.get("name")) for k in keys))
        return

    base = f"https://{REF}.supabase.co/rest/v1"
    # בדיוק מה שמסך המשרות מבקש.
    select = ("score,cv_id,jobs!inner(id,title,source,first_seen,on_target,"
              "dismissed_at,manual,found_for)")
    url = f"{base}/matches?select={select}&limit=3"
    req = urllib.request.Request(url, headers={"apikey": anon,
                                               "Authorization": f"Bearer {anon}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = json.loads(r.read().decode())
        print(f"PostgREST answered, {len(body)} rows")
        if body:
            print("columns it returned for jobs: "
                  + ", ".join(sorted(body[0].get("jobs", {}).keys())))
        else:
            # ריק זה תשובה בפני עצמה: RLS חוסם ללא התחברות, וזה תקין.
            print("no rows, which is expected without a signed-in user (RLS)")
    except urllib.error.HTTPError as e:
        detail = e.read().decode()[:400]
        print(f"PostgREST refused the query: HTTP {e.code}")
        print(detail)
        print()
        print("If it names a column, the schema cache is stale and the whole")
        print("board query fails, which looks exactly like 'there is no data'.")


if __name__ == "__main__":
    main()
