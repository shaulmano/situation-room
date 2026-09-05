/**
 * Turn what a person typed into what the scrapers get asked, and into what
 * counts as a hit when a posting comes back.
 *
 * "ראש צוות בדיקות" is not a query. The boards want role strings, and the same
 * role is posted in Hebrew on Drushim, in English on LinkedIn and in
 * transliteration on half of AllJobs — so one phrase has to become a handful of
 * terms or two thirds of the postings are never returned at all.
 *
 * This is the dictionary path: free, instant, and it only knows what is written
 * here. `expandWithClaude` wraps it and asks a model when a key is configured,
 * which is the only way an unlisted profession ever works — but it falls back
 * to this, so a missing key or a failed call costs nothing.
 *
 * ── asking and recognising are not the same list ──
 * The first draft used one list for both and it was visibly wrong on the real
 * pool: "מפתח פייתון" queried "Software Engineer", which is a fine thing to ask
 * a board, and then matched "Manager, Software Engineering – Network Simulation
 * and Testing", which is not a Python job by any reading. Broad is right for a
 * query and wrong for a filter, so they are separate here:
 *
 *   terms  — what the sources are asked. Broad. Costs scan time, not precision.
 *   match  — the narrow words that identify the family. Any one of them.
 *   must   — a technology the person named. If they said Python, a posting that
 *            never says Python is not their job, whatever else it matches.
 *
 * ── and seniority is a filter, not a flavour ──
 * Family words alone are far too loose, measured on the real pool: "ראש צוות
 * בדיקות" matched 189 of 1,009 and "מנהל פרויקטים" matched 766, because the
 * pool is full of postings that carry test/project somewhere in the title. The
 * word the person used for rank has to be required of the posting too — which
 * is the same two-part test the bot itself applies, a family word AND a
 * management word, and for the same reason.
 */

export type Expansion = {
  terms: string[];
  match: string[];
  must: string[];
  seniority: 'lead' | 'ic' | null;
  by: 'dictionary' | 'claude';
  /** False when nothing was recognised — the screen says so rather than pretending. */
  confident: boolean;
};

/** How many terms are actually put to the sources. Each one costs scan time. */
export const QUERY_TERMS = 8;

type Family = { match: string[]; base: string[]; lead: string[] };

const FAMILIES: Record<string, Family> = {
  qa: {
    // 'automation' is deliberately absent, the same way it is in the bot: on its
    // own it qualifies "Head of Automation", which is an automation job, not a
    // QA one. A real QA post always carries qa/quality/test as well.
    match: ['qa', 'qc', 'sqa', 'בדיקות', 'בודק', 'בודקת', 'quality', 'test', 'tester', 'איכות'],
    base: ['QA', 'QA Engineer', 'בדיקות תוכנה', 'בודק תוכנה', 'Test Engineer', 'QA Automation'],
    lead: ['QA Manager', 'QA Team Leader', 'ראש צוות בדיקות', 'מנהל בדיקות', 'Head of QA',
           'Test Lead', 'QA Lead'],
  },
  project: {
    match: ['פרויקט', 'project', 'pmo', 'תוכנית', 'תכנית', 'program', 'programme'],
    base: ['Project Manager', 'מנהל פרויקטים', 'PMO', 'Project Coordinator'],
    lead: ['Program Manager', 'מנהל תוכניות', 'Head of PMO', 'Senior Project Manager',
           'ראש תחום פרויקטים'],
  },
  release: {
    match: ['שחרור', 'ריליס', 'ריליז', 'release', 'delivery', 'דליברי', 'דליוורי', 'גרסאות'],
    base: ['Release Manager', 'מנהל גרסאות', 'Delivery Manager', 'Release Engineer'],
    lead: ['Head of Delivery', 'Delivery Lead', 'ראש תחום דליברי'],
  },
  dev: {
    match: ['מפתח', 'מפתחת', 'פיתוח', 'developer', 'programmer', 'backend', 'frontend',
            'fullstack', 'full stack', 'באקאנד', 'פרונט'],
    base: ['Software Developer', 'מפתח תוכנה', 'Backend Developer', 'Full Stack Developer',
           'Software Engineer'],
    lead: ['Team Leader', 'ראש צוות פיתוח', 'Tech Lead', 'R&D Manager', 'מנהל פיתוח',
           'Engineering Manager'],
  },
  devops: {
    match: ['devops', 'דבאופס', 'sre', 'תשתיות', 'infrastructure', 'kubernetes', 'k8s',
            'ענן', 'cloud'],
    base: ['DevOps Engineer', 'מהנדס DevOps', 'SRE', 'Cloud Engineer', 'Infrastructure Engineer'],
    lead: ['DevOps Team Leader', 'ראש צוות DevOps', 'Head of Infrastructure', 'מנהל תשתיות'],
  },
  data: {
    match: ['data', 'נתונים', 'bi', 'analyst', 'אנליסט', 'אנליסטית', 'dwh', 'etl', 'דאטה'],
    base: ['Data Analyst', 'אנליסט נתונים', 'BI Developer', 'Data Engineer', 'מפתח BI'],
    lead: ['Data Team Leader', 'ראש צוות דאטה', 'Head of Data', 'מנהל BI'],
  },
  it: {
    match: ['תמיכה', 'support', 'helpdesk', 'help desk', 'sysadmin', 'רשתות', 'network',
            'נטוורק', 'מערכות מידע', 'סיסטם'],
    base: ['IT Support', 'תמיכה טכנית', 'System Administrator', 'Helpdesk', 'איש מערכות מידע'],
    lead: ['IT Manager', 'מנהל מערכות מידע', 'Head of IT', 'ראש צוות תמיכה'],
  },
  product: {
    match: ['מוצר', 'product', 'ux', 'ui', 'חוויית משתמש'],
    base: ['Product Manager', 'מנהל מוצר', 'Product Owner', 'UX Designer'],
    lead: ['Head of Product', 'VP Product', 'ראש תחום מוצר', 'Group Product Manager'],
  },
  security: {
    match: ['אבטחת מידע', 'סייבר', 'security', 'cyber', 'soc', 'ciso', 'אבטחה'],
    base: ['Information Security', 'אבטחת מידע', 'Security Engineer', 'SOC Analyst',
           'Cyber Security'],
    lead: ['CISO', 'Head of Security', 'מנהל אבטחת מידע', 'Security Team Leader'],
  },
};

/**
 * A named technology sharpens a family rather than replacing it — and becomes a
 * requirement. `ask` is put to the sources; `say` is what the posting itself has
 * to contain, in either language, because a board writes Python in English and
 * the recruiter writes פייתון above it.
 */
const TECH: { hit: string[]; ask: string[]; say: string[] }[] = [
  { hit: ['python', 'פייתון'], ask: ['Python Developer', 'מפתח פייתון'], say: ['python', 'פייתון'] },
  { hit: ['java ', 'ג\'אווה', 'jאווה'], ask: ['Java Developer', 'מפתח ג\'אווה'], say: ['java', 'ג\'אווה'] },
  { hit: ['javascript'], ask: ['JavaScript Developer'], say: ['javascript', 'js'] },
  { hit: ['typescript'], ask: ['TypeScript Developer'], say: ['typescript'] },
  { hit: ['react'], ask: ['React Developer', 'מפתח React'], say: ['react'] },
  { hit: ['node'], ask: ['Node.js Developer', 'מפתח Node'], say: ['node'] },
  { hit: ['c#', '.net', 'דוטנט'], ask: ['C# Developer', '.NET Developer'], say: ['c#', '.net', 'דוטנט'] },
  { hit: ['golang', ' go '], ask: ['Go Developer', 'Golang Developer'], say: ['golang', 'go '] },
  { hit: ['php'], ask: ['PHP Developer', 'מפתח PHP'], say: ['php'] },
  { hit: ['android'], ask: ['Android Developer', 'מפתח אנדרואיד'], say: ['android', 'אנדרואיד'] },
  { hit: ['ios'], ask: ['iOS Developer', 'מפתח iOS'], say: ['ios'] },
  { hit: ['sap'], ask: ['SAP Consultant', 'יועץ SAP'], say: ['sap'] },
  { hit: ['salesforce'], ask: ['Salesforce Developer'], say: ['salesforce'] },
  { hit: ['sql'], ask: ['SQL Developer', 'מפתח SQL'], say: ['sql'] },
];

const LEAD = ['ראש צוות', 'ראש תחום', 'מנהל', 'מנהלת', 'ראש', 'סמנכ', 'head', 'lead',
              'leader', 'manager', 'director', 'vp', 'chief', 'principal'];
const IC = ['ג\'וניור', 'junior', 'סטודנט', 'student', 'מתמחה', 'intern', 'entry'];

/**
 * What a posting has to say for a leadership search to accept it. Not the same
 * list as LEAD: "ראש" on its own reads the intent in a phrase someone typed,
 * but inside a job title it also catches ראשי, ראשון and מראש, so it stays out.
 */
const LEAD_IN_TITLE = ['ראש צוות', 'ראש תחום', 'מנהל', 'מנהלת', 'סמנכ', 'head', 'lead',
                       'manager', 'director', 'vp', 'chief', 'principal', 'מוביל'];

const norm = (s: string) =>
  ` ${s.toLowerCase().replace(/[.,;:!?()"']/g, ' ').replace(/\s+/g, ' ').trim()} `;

const uniq = (list: string[]) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of list) {
    const k = norm(t);
    if (k.trim() && !seen.has(k)) { seen.add(k); out.push(t); }
  }
  return out;
};

export function expand(input: string): Expansion {
  const raw = input.trim();
  const low = norm(raw);
  if (!raw) {
    return { terms: [], match: [], must: [], seniority: null, by: 'dictionary', confident: false };
  }

  const seniority: Expansion['seniority'] =
    LEAD.some((w) => low.includes(w)) ? 'lead' : IC.some((w) => low.includes(w)) ? 'ic' : null;

  const families = Object.values(FAMILIES).filter((f) => f.match.some((w) => low.includes(w)));
  const techs = TECH.filter((t) => t.hit.some((w) => low.includes(w)));

  // What the person typed goes first and always. It is the most precise thing
  // anyone will produce, and on a board that indexes titles literally it is
  // usually the query that returns the actual posting.
  const terms = [raw, ...techs.flatMap((t) => t.ask)];
  for (const f of families) terms.push(...(seniority === 'lead' ? f.lead : f.base));

  const match = families.flatMap((f) => f.match);
  const must = techs.flatMap((t) => t.say);

  // Nothing recognised. Better a weak query than none: the phrase itself and its
  // words, which at least reaches a board's own fuzzy search — and the same
  // words become the filter, since there is nothing better to filter on.
  if (families.length === 0 && techs.length === 0) {
    const words = raw.split(/\s+/).filter((w) => w.length > 2);
    terms.push(...words);
    match.push(raw, ...words);
  }

  return {
    terms: uniq(terms).slice(0, 14),
    match: uniq(match),
    must: uniq(must),
    seniority,
    by: 'dictionary',
    confident: families.length > 0 || techs.length > 0,
  };
}

/**
 * The rule, in the shape the scanner also reads.
 *
 * The scan is Python and this is TypeScript, and both decide the same question.
 * Porting the matcher would leave two copies that agree the day they are written
 * and stop agreeing after the first fix to one of them — invisibly, because a
 * posting silently dropped looks exactly like one that was never returned. So
 * the rule is data, computed once here and only evaluated on either side.
 */
export type Rule = { any: string[]; all: string[][] };

export function rule(e: Pick<Expansion, 'match' | 'must' | 'seniority'>): Rule {
  const all: string[][] = [];
  if (e.must.length) all.push(e.must);
  if (e.seniority === 'lead') all.push(LEAD_IN_TITLE);
  return { any: e.match, all };
}

/**
 * Does this posting belong in this search's feed?
 *
 * The title, and nothing else. The description would pull in every posting that
 * merely mentions the word — a backend role saying "works closely with QA" is
 * not a QA job. The company name is just as bad and less obvious: it put
 * "Operations Manager" and "Release & Project Manager" into a search for מנהל
 * אבטחת מידע, because the employer happened to be a security firm. Where you
 * work is not what you do.
 */
export function matches(
  e: Pick<Expansion, 'match' | 'must' | 'seniority'>,
  title: string
): boolean {
  return matchesRule(rule(e), title);
}

/**
 * The one place the rule is interpreted on this side. Asking for a leadership
 * role and getting an engineering post is not a near miss — it is a different
 * job — which is why rank sits in `all` rather than widening `any`.
 */
export function matchesRule(r: Rule, title: string): boolean {
  const hay = norm(title);
  const has = (list: string[]) => list.some((t) => t.trim() && hay.includes(norm(t).trim()));
  if (!has(r.any)) return false;
  return r.all.every((group) => has(group));
}
