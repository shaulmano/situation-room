// Connections.csv, as LinkedIn writes it: three or four lines of preamble
// about the export, a blank line, and only then the header row. Everything
// before "First Name" is skipped rather than assumed to be a fixed number of
// lines, because that preamble has changed twice already.
export type ParsedContact = {
  full_name: string;
  company: string | null;
  title: string | null;
  linkedin_url: string | null;
  email: string | null;
  connected_on: string | null;
};

// RFC 4180 by hand: quoted fields hold commas and newlines, and a doubled quote
// inside a quoted field is one literal quote. Company names such as
// "Doe, Smith & Co." are the whole reason this is not a split(',').
function toRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ',') { row.push(field); field = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += c;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

// "05 Jun 2024" in most exports, an ISO date in some. Anything else is left
// empty rather than guessed, the date only sorts the list.
function toDate(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${m[1].padStart(2, '0')}`;
}

export function parseConnections(text: string): ParsedContact[] {
  const rows = toRows(text.replace(/^\uFEFF/, ''));
  const head = rows.findIndex(
    (r) => r.some((c) => c.trim().toLowerCase() === 'first name')
  );
  if (head < 0) return [];

  const cols = rows[head].map((c) => c.trim().toLowerCase());
  const at = (name: string) => cols.indexOf(name);
  const iFirst = at('first name');
  const iLast = at('last name');
  const iUrl = at('url');
  const iMail = at('email address');
  const iCompany = at('company');
  const iTitle = at('position');
  const iWhen = at('connected on');

  const out: ParsedContact[] = [];
  for (const r of rows.slice(head + 1)) {
    const cell = (i: number) => (i >= 0 && i < r.length ? r[i].trim() : '');
    const name = [cell(iFirst), cell(iLast)].filter(Boolean).join(' ').trim();
    if (!name) continue;
    out.push({
      full_name: name.slice(0, 160),
      company: cell(iCompany).slice(0, 160) || null,
      title: cell(iTitle).slice(0, 160) || null,
      linkedin_url: cell(iUrl) || null,
      email: cell(iMail) || null,
      connected_on: toDate(cell(iWhen)),
    });
  }
  return out;
}
