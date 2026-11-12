-- ‏12.11.2026, שתי החלטות של שאול.
--
-- ‏1. גרסה נפרדת ל-Release Manager. הקובץ שהעלה הוא שחרור נקי: שערי שחרור,
--    ‏CI/CD, go/no-go. הוא לא מדבר על Professional Services, ולכן הוא לא
--    מחליף את delivery, שממשיך לנקד משרות Service Delivery Manager.
--
-- ‏2. הורדת rnd-program-manager. זאת הגרסה שניצחה בכל שורה בלוח ב-3.11
--    כשהניקוד נשבר, ושאול אינו מחפש תפקידי R&D Program Manager.
--    ‏matches נמחק בקסקייד; השאר מאופס ביד כי אין להם on delete cascade.

insert into cvs (id, label, filename, content, updated_at)
values ('release', 'Release Manager', 'Shaul_Mano_Release_Manager.pdf', $cv$Shaul Mano
Release Manager | Release & Program Management | CI/CD | Enterprise SaaS
Rosh HaAyin, Israel | 052-4304747 | shaul.mano@gmail.com | linkedin.com/in/shaul-mano-0a7a392

PROFESSIONAL SUMMARY
Release Manager with 15+ years in high-tech, owning end-to-end release management across the software
lifecycle in enterprise SaaS and cybersecurity, most recently across 3+ concurrent product lines serving a live
portfolio of 70-120 active enterprise customers. Runs the full release cycle: release planning, release
orchestration, quality gates and exit criteria, go/no-go decision gates, hotfix and emergency release
coordination, Jenkins CI/CD pipelines, risk registers, and executive release-readiness reporting. The operating
bridge between R&D, QA, Product Management, Professional Services, Support, and C-level stakeholders, turning
fragmented execution into predictable on-time releases. Certified Scrum Master.

CORE COMPETENCIES
Release Management & Go/No-Go | Release Planning & Orchestration | Quality Gates & Exit Criteria | Hotfix &
Emergency Release Coordination | CI/CD Release Pipelines (Jenkins) | Release Readiness Reporting | Program
Governance & Portfolio Management | Risk Registers & Mitigation Planning | Change Management | Root Cause
Analysis | Stakeholder Alignment & Executive Reporting | Agile / Scrum at Scale | Customer Delivery & Escalation
Management | Offshore and Onshore Team Management | Process Design & Release Automation

PROFESSIONAL EXPERIENCE
Independent Delivery & Systems Consulting | 2026 - Present
Self-employed
• Owned build, deployment, and release of a production consultant and task management system for an
external client, plus ongoing production support; live and cloud-hosted for several months.
• Ran the full lifecycle solo, from client requirements through release and live operation.
• Built and deployed a full-stack finance tracking application (Python/FastAPI, React, PostgreSQL) on cloud
infrastructure.

Professional Services, Program Operations & QA Manager | Qmarkets | 2018 - 2026
Enterprise SaaS innovation-management platform, global customer base
• Owned end-to-end release management across 3+ concurrent product lines, running release orchestration
and formal go/no-go decisions to consistently hit committed release milestones.
• Built the release governance framework: release gates, quality gates, and exit criteria applied across all
product lines, producing consistent on-time releases and a measurable reduction in customer escalations.
• Cut post-release production defects by 35% by enforcing quality gates before release and running systematic
root cause analysis.
• Shortened release readiness cycles by sponsoring Selenium automation and Jenkins CI/CD pipelines across 3
products.
• Gave executives live release-readiness visibility through EazyBI dashboards tracking milestone status and exit
criteria.
• Coordinated releases and go-lives for a live portfolio of 70-120 active enterprise customers, owning the
escalation path between customers, R&D, and Product Management.
• Led a 7-person global team including offshore members, defining OKRs and delivery KPIs and running Agile
sprint cycles in Jira and Xray.

QA Manager and Scrum Master | Promisec | 2013 - 2018
Endpoint security vendor, enterprise and Fortune-500 customers
• Owned release planning, hotfix coordination, risk registers, and executive milestone reporting for all
company products, shipping releases with no surprises to customers.
• Removed regression bottlenecks from the release path by leading the move from manual testing to
Agile-driven automated workflows as acting Scrum Master.

Senior QA Team Leader | RSA Security | 2008 - 2013
Enterprise security division, Fortune-500 customer base
• Owned final version releases and emergency hotfix releases to Fortune-500 customers with zero critical
post-release incidents.
• Managed a 9-person distributed team including 3 offshore members in India, establishing remote
collaboration protocols across time zones.

Earlier Experience
QA Team Leader at Symantec (VERITAS), and engineering roles at Precise, Ebsure, and M-Systems. Grounded
delivery strategy in TRD, ERD, and MRD documentation, owned the full defect lifecycle, and resolved critical
production issues on-site with Support and R&D.

TOOLS & METHODOLOGIES
• Delivery & Program: Monday.com (Expert / Admin), Jira, Xray, MS Project, Confluence, Jenkins, GitHub
• Reporting: EazyBI (advanced), executive dashboards, delivery and quality KPI reporting, SQL
• Methodologies: Agile, Scrum, Waterfall, release gates, change management, risk-based delivery, RCA
• Technical: Python, Java, Selenium; SQL Server, MariaDB, Oracle; Azure Cloud, VMware, Linux, Windows

EDUCATION & CERTIFICATIONS
• Certified Scrum Master (CSM)
• ISTQB Certified Tester, SELA Institute
• Test Automation (Python, Java, Selenium)
• Software Engineering Studies, Tel Aviv College
• Languages: Hebrew (native), English (fluent)$cv$, now())
on conflict (id) do update
  set label = excluded.label,
      filename = excluded.filename,
      content = excluded.content,
      updated_at = now();

update cv_requests set base_cv_id = null where base_cv_id = 'rnd-program-manager';
update outreach set cv_id = null where cv_id = 'rnd-program-manager';
update referrals set cv_id = null where cv_id = 'rnd-program-manager';

delete from cvs where id = 'rnd-program-manager';
