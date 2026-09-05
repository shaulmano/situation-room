"""
What everybody is looking for, and how a posting is judged against it.

The scan asks twelve sources once and carries the union of every active search's
terms. Not one crawl per user: ten crawls at the same hour is what gets a source
to block us, and a blocked source does not come back - Indeed went that way and
il.indeed.com has answered 403 to every scripted request since.

Nothing here decides *what* matches. That rule was computed by expand() in the
app when the search was saved and stored on the row; this file only evaluates
it. Two implementations of the matcher would agree the day they were written and
quietly stop agreeing after the first fix to one of them, and the failure is
invisible: a posting silently dropped looks exactly like a posting that was
never returned.
"""
import os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gmail_sync import sql, q

# The scan's real budget is 25 minutes of GitHub Actions and the sources' own
# patience. Terms are what a run costs - twelve sources times this number - so
# it is capped globally rather than per person, and shared round-robin so five
# searches by one user cannot starve the one search by another.
MAX_TERMS = 16
PER_SEARCH = 6


def active():
    """Every active search, newest last. Includes the rule; excludes nothing."""
    return sql(
        "select s.id, s.user_id, s.label, s.terms, s.rule "
        "from searches s where s.active order by s.created_at"
    )


def query_terms(searches, offset=0):
    """
    The shopping list for one run: interleaved so every search contributes its
    first term before any search contributes its second, then capped.

    `offset` rotates the starting point between runs. A search whose sixth term
    never fits would otherwise never be asked at all; rotating means it is asked
    a few times a day instead of never, which is the difference between slow and
    broken.
    """
    lists = [[t for t in (s.get("terms") or [])][:PER_SEARCH] for s in searches]
    if not lists:
        return []

    out, seen = [], set()
    for depth in range(PER_SEARCH):
        for i in range(len(lists)):
            terms = lists[(i + offset) % len(lists)]
            if depth >= len(terms):
                continue
            key = terms[depth].strip().lower()
            if key and key not in seen:
                seen.add(key)
                out.append(terms[depth])
            if len(out) >= MAX_TERMS:
                return out
    return out


def _norm(s):
    return " " + " ".join(str(s or "").lower().replace(",", " ").split()) + " "


def matches(rule, title):
    """
    Evaluate a stored rule. `any` is one-of; every group in `all` is also
    one-of, and all groups have to hold.

    A rule that is missing or empty matches nothing on purpose. The alternative
    - treating it as "match everything" - would fill one person's feed with
    every posting in the pool the first time a row was written without one.
    """
    if not rule:
        return False
    hay = _norm(title)
    anys = rule.get("any") or []
    if not anys:
        return False
    if not any(t.strip() and _norm(t).strip() in hay for t in anys):
        return False
    for group in rule.get("all") or []:
        if not any(t.strip() and _norm(t).strip() in hay for t in group):
            return False
    return True


def write_matches(searches, jobs):
    """
    Link postings to the searches they answer.

    Every screen joins search_matches, so a job with no row here is invisible no
    matter how well it fits - which is exactly how thirty Malam and SQLink
    postings once sat in the table, on target and undismissed, showing on no
    screen at all. A scan scores what it saved, in the same run.

    Returns {search_id: count} for the run's log.
    """
    rows, per = [], {}
    for s in searches:
        for j in jobs:
            if matches(s.get("rule"), j.get("title") or ""):
                rows.append((s["id"], j["id"], s["user_id"]))
                per[s["id"]] = per.get(s["id"], 0) + 1
    if not rows:
        return per

    for i in range(0, len(rows), 400):
        chunk = rows[i:i + 400]
        vals = ",".join(
            "(%s,%s,%s)" % (q(sid), q(jid), q(uid)) for sid, jid, uid in chunk
        )
        sql(
            "insert into search_matches (search_id, job_id, user_id) values %s "
            "on conflict (search_id, job_id) do nothing;" % vals
        )
    return per
