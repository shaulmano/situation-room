// מרנדר קורות חיים לעמוד PDF אחד, ומדפיס אותו כ-base64.
//
// למה כאן ולא בתוך הנחיות המשימה המתוזמנת: הפריסה היא החלק שחוזר על עצמו
// וחייב להיראות זהה בכל פעם. אם היא יושבת בהנחיה, כל ריצה מעצבת מחדש
// ומקבלים קורות חיים שנראים אחרת בכל משרה. כאן היא קובץ אחד שמתוחזק פעם
// אחת, והמשימה מספקת רק תוכן.
//
// שימוש:  node tools/render_cv.mjs content.json  >  cv.b64
//
// מבנה content.json:
// {
//   "name": "Shaul Mano",
//   "headline": "Technical Program Manager | ...",
//   "contact": "Rosh HaAyin, Israel | ... ",
//   "summary": "פסקה אחת",
//   "competencies": "מופרד בקו אנכי |",
//   "roles": [{ "title": "...", "context": "אופציונלי", "bullets": ["..."] }],
//   "tools":  [{ "label": "Program & Release", "text": "..." }],
//   "education": "שורה או שתיים"
// }
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';

// דרך require ולא import: ה-Chromium ו-playwright מותקנים גלובלית בסביבה,
// וההתקנה הזאת נפתרת דרך NODE_PATH, שרק require מסתכל בו.
const { chromium } = createRequire(import.meta.url)('playwright');

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const c = JSON.parse(readFileSync(process.argv[2], 'utf8'));

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 10.5mm 13mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9.1pt;
         line-height: 1.26; color: #1a1a1a; margin: 0; }
  h1 { font-size: 21pt; margin: 0 0 1mm; letter-spacing: -0.3px; }
  .headline { font-size: 10pt; color: #3d3d3d; margin: 0 0 1mm; }
  .contact { font-size: 8.8pt; color: #595959; margin: 0 0 3.5mm; }
  h2 { font-size: 9.5pt; text-transform: uppercase; letter-spacing: 0.4px;
       margin: 2.7mm 0 1.2mm; padding-bottom: 0.9mm; border-bottom: 1px solid #b8b8b8; }
  .role { font-size: 9.7pt; font-weight: bold; margin: 2.2mm 0 0.4mm; }
  .role:first-of-type { margin-top: 0; }
  .context { font-size: 8.9pt; color: #5a5a5a; font-style: italic; margin: 0 0 0.9mm; }
  ul { margin: 0 0 0 4.6mm; padding: 0; }
  li { margin: 0 0 0.7mm; }
  p { margin: 0 0 1mm; }
  .label { font-weight: bold; }
</style></head><body>

<h1>${esc(c.name)}</h1>
<div class="headline">${esc(c.headline)}</div>
<div class="contact">${esc(c.contact)}</div>

${c.summary ? `<h2>Professional Summary</h2><p>${esc(c.summary)}</p>` : ''}
${c.competencies ? `<h2>Core Competencies</h2><p>${esc(c.competencies)}</p>` : ''}

<h2>Professional Experience</h2>
${(c.roles ?? []).map((r) => `
  <div class="role">${esc(r.title)}</div>
  ${r.context ? `<div class="context">${esc(r.context)}</div>` : ''}
  ${(r.bullets ?? []).length
      ? `<ul>${r.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`
      : ''}
`).join('')}

${(c.tools ?? []).length ? `<h2>Tools &amp; Methodologies</h2><p>${
  c.tools.map((t) => `<span class="label">${esc(t.label)}:</span> ${esc(t.text)}`).join('<br>')
}</p>` : ''}

${c.education ? `<h2>Education &amp; Certifications</h2><p>${esc(c.education)}</p>` : ''}

</body></html>`;

const tmp = `/tmp/cv-${process.pid}.html`;
writeFileSync(tmp, html);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${tmp}`, { waitUntil: 'load' });
const pdf = await page.pdf({ format: 'A4', printBackground: true });
await browser.close();
unlinkSync(tmp);

// עמוד אחד הוא דרישה, לא העדפה. גלישה לעמוד שני היא קורות חיים שלא נקראים
// עד הסוף, ולכן עדיף להיכשל ולקצר את התוכן מאשר להגיש שני עמודים.
const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
if (pages > 1) {
  console.error(`התוכן גלש ל-${pages} עמודים. קצר את התקציר או את מספר השורות.`);
  process.exit(2);
}

process.stdout.write(pdf.toString('base64'));
