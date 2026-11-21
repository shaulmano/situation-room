"""Build alias keys so contacts and jobs find their company in the gold pool.

Exact company_key matching misses "Scytale" vs "Scytale AI", "Akita Cyber
Security Ltd" vs "Akita". An alias maps a name seen on a contact or a job to the
company_key of a pool company. Conservative on purpose:
  * names are compared as whole tokens, never as raw prefixes (so "Dream" does
    not become "DreaMed" and "Final" does not become "Finally Foods");
  * only generic words (technologies, ai, security, ...) may differ;
  * a name with more than one candidate company is skipped, never guessed.
Rebuilds only its own derived rows (how='tokens'). Run: python sync/company_aliases.py [--dry]
"""
import os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gmail_sync import sql, q

LEGAL = {"ltd", "limited", "inc", "incorporated", "llc", "corp", "corporation", "gmbh", "בעמ", "co", "company"}
GENERIC = {
    "technologies", "technology", "tech", "systems", "system", "software", "security", "cyber", "labs", "lab",
    "israel", "ai", "io", "com", "group", "networks", "network", "solutions", "semiconductor", "semiconductors",
    "global", "international", "holdings", "studios", "studio",
    "innovation", "innovations", "robotics", "engineering", "il", "app", "apps", "platform",
    "טכנולוגיות", "מערכות", "ישראל", "תוכנה", "קבוצת", "בעמ",
}
MIN = 4


def tokens(name):
    return [t for t in re.split(r"[^0-9a-zA-Zא-ת]+", (name or "").lower()) if t]


def core(name):
    t = [x for x in tokens(name) if x not in LEGAL]
    c = [x for x in t if x not in GENERIC]
    return "".join(c) if c else "".join(t)


def variants(name):
    k = core(name)
    out = {k} if len(k) >= MIN else set()
    for suf in ("ai", "io", "com", "labs", "security", "technologies", "systems", "software"):
        if k.endswith(suf) and len(k) - len(suf) >= 5:
            out.add(k[: -len(suf)])
    return out


SUFFIXES = ("ai", "io", "labs", "security", "technologies", "systems", "software")


def compatible(a, b):
    """One name must contain the other's words, or differ only by a glued generic suffix.
    "Elad Software Systems" and "Elad Technologies" fail: each has a word the other lacks."""
    ta = {t for t in tokens(a) if t not in LEGAL}
    tb = {t for t in tokens(b) if t not in LEGAL}
    if not ta or not tb:
        return False
    if ta <= tb or tb <= ta:
        # the extra words must be generic: "Peak" is not "Peak Medical"
        return (ta ^ tb) <= GENERIC
    ja, jb = "".join(sorted(ta)), "".join(sorted(tb))
    return any(jb == ja + x or ja == jb + x for x in SUFFIXES)


def main():
    dry = "--dry" in sys.argv
    comps = sql("select company_key, name from companies where company_key <> ''")
    ck_exact = {c["company_key"] for c in comps}
    by_variant = {}
    names = {}
    for c in comps:
        names[c["company_key"]] = c["name"]
        for v in variants(c["name"]):
            by_variant.setdefault(v, set()).add(c["company_key"])
    seen = {}
    for r in sql("select company, company_key from contacts where company_key is not null and company_key <> ''"):
        seen[r["company_key"]] = r["company"]
    for r in sql("select distinct company from jobs where on_target and closed_at is null and coalesce(company,'') <> ''"):
        k = re.sub(r"[\W_]+", "", (r["company"] or "").lower())
        k = re.sub(r"(ltd|limited|inc|incorporated|llc|corp|corporation|gmbh|בעמ)$", "", k)
        seen.setdefault(k, r["company"])
    # derived rows are rebuilt each run, so a rule fix removes old mistakes
    if not dry:
        sql("delete from company_aliases where how = 'tokens'")
    added = skipped_amb = 0
    for alias_key, name in seen.items():
        if not alias_key or alias_key in ck_exact:
            continue
        cands = set()
        for v in variants(name):
            cands |= by_variant.get(v, set())
        cands = {k for k in cands if compatible(name, names[k])}
        if len(cands) == 1:
            target = next(iter(cands))
            if target == alias_key:
                continue
            added += 1
            print("alias: %s -> %s" % (name, target))
            if not dry:
                sql("insert into company_aliases(alias_key, company_key, how) values (%s, %s, 'tokens') "
                    "on conflict (alias_key) do nothing" % (q(alias_key), q(target)))
        elif len(cands) > 1:
            skipped_amb += 1
    print("aliases added %d, ambiguous skipped %d" % (added, skipped_amb))


if __name__ == "__main__":
    main()
