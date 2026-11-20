"""Mirror the public Israeli tech-company registry into the companies table.

Source: github.com/matanarbel-startapp/techmap (ODbL, attribution required).
Runs daily from cron.yml. New registry ids are the "news": first_seen_at is only
set on insert, so the count of rows with first_seen_at today is what is new.

Run: python sync/companies_sync.py [--dry]
"""
import glob, json, os, re, subprocess, sys, tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gmail_sync import sql, q

REPO = "https://github.com/matanarbel-startapp/techmap.git"
BATCH = 200
SIZE = {"xs": ("S", "1-10"), "s": ("S", "11-50"), "m": ("M", "51-200"),
        "l": ("E", "201-1,000"), "xl": ("E", "1,001+")}
# מילות עיר לגוש דן. התאמה לפי שם העיר כפי שהמאגר רושם אותו.
GUSH_DAN = {
    "תל אביב - יפו", "תל אביב", "רמת גן", "גבעתיים", "בני ברק", "פתח תקווה",
    "הרצליה", "רעננה", "כפר סבא", "הוד השרון", "ראש העין", "חולון", "בת ים",
    "ראשון לציון", "רחובות", "יהוד-מונוסון", "יהוד", "אור יהודה", "קרית אונו",
    "גני תקווה", "אלעד", "רמת השרון", "נס ציונה", "לוד", "רמלה", "מודיעין-מכבים-רעות",
    "מודיעין", "נתניה", "בית דגן", "שוהם", "אזור", "סביון", "גבעת שמואל",
}
LEGAL_SUFFIX = re.compile(r"(ltd|limited|inc|incorporated|llc|corp|corporation|gmbh|בעמ)$")


def company_key(name):
    flat = re.sub(r"[\W_]+", "", (name or "").lower())
    return LEGAL_SUFFIX.sub("", flat)


def load():
    tmp = tempfile.mkdtemp()
    subprocess.run(["git", "clone", "--depth", "1", "-q", REPO, tmp + "/t"], check=True)
    base = tmp + "/t/"
    cats = json.load(open(base + "categories.json", encoding="utf-8"))
    out, bad = {}, 0
    for f in glob.glob(base + "companies/*.json"):
        rid = os.path.basename(f)[:-5]
        try:
            r = json.load(open(f, encoding="utf-8"))
        except ValueError:
            bad += 1
            continue
        name = (r.get("name") or "").strip()
        if not name:
            continue
        code = r.get("size")
        cls, rng = SIZE.get(code, (None, None))
        a = (r.get("addresses") or [{}])[0] or {}
        city = a.get("city") or None
        out[rid] = {
            "registry_id": rid, "name": name, "company_key": company_key(name),
            "size_code": code, "size_class": cls, "size_range": rng,
            "category": cats.get(str(r.get("categoryId"))),
            "city": city, "region": "gush_dan" if city in GUSH_DAN else "other",
            "website": r.get("websiteUrl"), "careers_url": r.get("careersUrl"),
            "is_hiring": bool(r.get("isHiring")), "linkedin_id": r.get("linkedinId"),
            "comeet_id": r.get("comeetId"), "lever_id": r.get("leverId"),
        }
    return out, bad


COLS = ["registry_id", "name", "company_key", "size_code", "size_class", "size_range",
        "category", "city", "region", "website", "careers_url", "is_hiring",
        "linkedin_id", "comeet_id", "lever_id"]


def main():
    rows, bad = load()
    print("read %d companies, %d unreadable files" % (len(rows), bad))
    if len(rows) < 3000:  # sanity: a half-empty clone must never shrink the table
        raise SystemExit("too few companies, refusing to write")
    if "--dry" in sys.argv:
        return
    before = int(sql("select count(*) as n from companies")[0]["n"])
    vals = list(rows.values())
    sets = ", ".join("%s = excluded.%s" % (c, c) for c in COLS if c != "registry_id")
    for i in range(0, len(vals), BATCH):
        chunk = vals[i:i + BATCH]
        tuples = ",".join(
            "(" + ",".join(
                ("true" if r[c] else "false") if c == "is_hiring" else q(r[c]) for c in COLS
            ) + ")" for r in chunk)
        sql("insert into companies (%s) values %s on conflict (registry_id) do update set %s, updated_at = now()"
            % (",".join(COLS), tuples, sets))
    after = int(sql("select count(*) as n from companies")[0]["n"])
    print("table before %d, after %d" % (before, after))
    print("new %d" % (after - before))


if __name__ == "__main__":
    main()
