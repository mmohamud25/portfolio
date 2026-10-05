// Builds mmohamud.me from src/template.html + content.
// Content comes from Supabase (edited in admin.mmohamud.me → Portfolio); if that isn't set up or
// reachable, it falls back to src/content.seed.json so the site always builds.
// Usage: SUPABASE_ANON_KEY=... node scripts/build.mjs   → output in _site/
import { readFile, writeFile, mkdir, rm, cp, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const SUPABASE_URL = "https://lurrqcyaybpgidzjfdvh.supabase.co";
const OUT = "_site";
const ANON = process.env.SUPABASE_ANON_KEY;

// ---------- helpers ----------
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const attr = esc;
const safeUrl = (u = "") => (/^(https?:\/\/|mailto:|#|\/|[\w.-]+\.(pdf|png|jpg|html))/i.test(u.trim()) ? u.trim() : "#");

// Tiny markdown for editor text: **bold**, _italic_, [text](url), line breaks. Everything else is escaped.
function inline(s = "", linkStyle = "color:var(--accent);text-decoration:none;") {
  let h = esc(s);
  h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
    const url = safeUrl(u.replace(/&amp;/g, "&"));
    const ext = /^https?:/.test(url);
    return `<a href="${attr(url)}"${ext ? ' target="_blank"' : ""} style="${linkStyle}">${t}</a>`;
  });
  h = h.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  h = h.replace(/(^|[\s(])_([^_]+)_(?=[\s.,;:!?)]|$)/g, "$1<em>$2</em>");
  return h.replace(/\n/g, "<br>");
}
const L = (f) => (typeof f === "string" ? f : (f?.en ?? ""));   // English text of a {en, so} field
const chip = (text, cls = "chip") => `<span class="${cls}">${esc(text)}</span>`;

// Collected for the language switch: id → { en, so } (already HTML)
const i18n = {};
function tr(id, field, linkStyle) {
  const f = typeof field === "string" ? { en: field, so: "" } : (field || {});
  i18n[id] = { en: inline(f.en || "", linkStyle), so: f.so ? inline(f.so, linkStyle) : "" };
  return i18n[id].en;
}

// ---------- sections ----------
function hero(h, show = { contact: true, work: true }) {
  return `<!-- HERO -->
<div class="hero">
  <div class="grid-bg" style="position:absolute;inset:0;pointer-events:none;z-index:0;"></div>
  <div style="position:relative;z-index:1;">
    <span class="mono-label mono-label--accent" id="heroEyebrow">${tr("heroEyebrow", h.eyebrow)}</span>
    <div class="hero__grid">
      <div>
        <h1 class="hero__name">Mohamed <span class="hero__name--accent">Mohamud</span></h1>
        <p class="hero__lede" id="heroLede">${tr("heroLede", h.lede)}</p>
        <div class="hero__chips">
${h.chips.map((c) => `          ${chip(c.text, c.accent ? "chip chip--accent" : "chip")}`).join("\n")}
        </div>
        <div class="hero__actions">
${show.contact ? `          <a href="#contact" class="btn btn--primary" id="heroCta">${tr("heroCta", h.cta)}</a>\n` : ""}${show.work ? `          <a href="#work" class="btn btn--ghost" id="heroWork">${tr("heroWork", h.work)}</a>\n` : ""}          <a href="${attr(safeUrl(h.resume))}" download class="btn btn--ghost btn--sm">Resume PDF &#8595;</a>
        </div>
      </div>
      <div class="portrait" style="max-width:280px;">
        <img src="${attr(safeUrl(h.photo))}" alt="Mohamed Mohamud" style="width:100%;height:100%;object-fit:cover;object-position:center top;border-radius:inherit;display:block;"/>
        <div class="portrait__bracket portrait__bracket--tl"></div>
        <div class="portrait__bracket portrait__bracket--tr"></div>
        <div class="portrait__bracket portrait__bracket--bl"></div>
        <div class="portrait__bracket portrait__bracket--br"></div>
      </div>
    </div>
  </div>
</div>`;
}

function stats(list) {
  return `<!-- STATS -->
<div class="stats">
${list.map((s) => `  <div>
    <div class="stat__kicker">${esc(s.kicker)}</div>
    <div class="stat__value"${s.compact ? ' style="font-size:36px;margin-top:12px;letter-spacing:-0.02em;"' : ""}>${esc(s.value)}${s.plus ? '<span style="color:var(--ink-dim);font-size:0.45em;vertical-align:middle;">+</span>' : ""}</div>
    <div class="stat__sub">${esc(s.sub)}</div>
  </div>`).join("\n")}
</div>`;
}

const head = (num, id, title, extraId, sub) => `  <div class="section__head">
    <div><span class="mono-label mono-label--accent">${num}</span></div>
    <div>
      <h2 class="section__title" id="${id}">${title}</h2>${sub !== undefined ? `
      <p class="section__sub" id="${extraId}">${sub}</p>` : ""}
    </div>
  </div>`;

function about(a, num = "", alt = "") {
  return `<!-- ${num} ABOUT -->
<section class="section${alt}" id="about">
${head(`${num} / ABOUT`, "aboutTitle", tr("aboutTitle", a.title), "aboutSub", tr("aboutSub", a.sub))}
  <div class="section__body fu">
${a.paragraphs.map((p, i) => `    <p style="font-size:17px;color:var(--ink-mid);line-height:1.75;max-width:660px;${i < a.paragraphs.length - 1 ? "margin-bottom:24px;" : ""}" id="aboutP${i + 1}">${tr(`aboutP${i + 1}`, p)}</p>`).join("\n")}
  </div>
</section>`;
}

function experience(e, num = "", alt = "") {
  return `<!-- ${num} EXPERIENCE -->
<section class="section${alt}" id="experience">
${head(`${num} / EXPERIENCE`, "expTitle", tr("expTitle", e.title))}
  <div class="section__body fu">
${e.items.map((x, i) => `    <div class="timeline__row">
      <div class="timeline__year">${esc(x.years)}</div>
      <div>
        <div class="timeline__role">${esc(x.role)}</div>
        <div class="timeline__org">${esc(x.org)}</div>
        <div class="tl-chips">
${(x.chips || []).map((c) => `          ${chip(c)}`).join("\n")}
        </div>
      </div>
      <div>
        <p class="timeline__desc" id="exp${i}Desc">${tr(`exp${i}Desc`, x.desc)}</p>
      </div>
    </div>`).join("\n")}
  </div>
</section>`;
}

function skills(s, certs, edu, num = "", alt = "") {
  const certRows = certs.map((c) => `      <div class="cert-row${c.earned ? " live" : ""}">
        <div class="cert-dot ${c.earned ? "on" : "off"}"></div>
        <div>
          <div class="cert-name">${esc(c.name)}</div>
          <div class="cert-meta">${esc(c.meta)}${c.link?.url && c.link?.text ? ` &nbsp;·&nbsp; <a href="${attr(safeUrl(c.link.url))}" target="_blank" style="color:var(--accent);">${esc(c.link.text)}</a>` : ""}</div>
          <div class="cert-badge ${c.earned ? "on" : "off"}">${esc(c.badge || (c.earned ? "Certified" : "In Progress"))}</div>
        </div>
      </div>`).join("\n");
  const eduRows = edu.map((d) => `      <div class="cert-row${d.current ? " live" : ""}">
        <div><div class="cert-name">${esc(d.name)}</div><div class="cert-meta">${esc(d.meta)}</div></div>
      </div>`).join("\n");
  return `<!-- ${num} SKILLS -->
<section class="section${alt}" id="skills">
${head(`${num} / SKILLS`, "skillsTitle", tr("skillsTitle", s.title))}
  <div class="section__body fu">
${s.groups.map((g) => `    <div class="skill-group">
      <h4>${esc(g.name)}</h4>
      <div class="chips-wrap">
${(g.chips || []).map((c) => `        ${chip(c, "chip chip--solid")}`).join("\n")}
      </div>
    </div>`).join("\n")}

    <div style="margin-top:40px;">
      <div class="mono-label mono-label--accent" style="margin-bottom:16px;">Certifications</div>
${certRows}
    </div>

    <div style="margin-top:32px;">
      <div class="mono-label mono-label--accent" style="margin-bottom:16px;">Education</div>
${eduRows}
    </div>
  </div>
</section>`;
}

const DEFAULT_VISUAL = `<svg viewBox="0 0 400 280" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;border-radius:inherit;">
  <rect width="400" height="280" fill="#0d0d0d"/>
  <rect x="0" y="0" width="400" height="32" fill="#161616"/>
  <circle cx="14" cy="16" r="5" fill="#ff5f57"/><circle cx="28" cy="16" r="5" fill="#febc2e"/><circle cx="42" cy="16" r="5" fill="#28c840"/>
  <rect x="20" y="52" width="220" height="10" rx="3" fill="rgba(200,247,107,0.22)"/>
  <rect x="20" y="74" width="330" height="8" rx="3" fill="rgba(255,255,255,0.07)"/>
  <rect x="20" y="90" width="290" height="8" rx="3" fill="rgba(255,255,255,0.07)"/>
  <rect x="20" y="118" width="170" height="130" rx="6" fill="#131313" stroke="rgba(255,255,255,0.07)"/>
  <rect x="206" y="118" width="174" height="60" rx="6" fill="#131313" stroke="rgba(200,247,107,0.2)"/>
  <rect x="206" y="188" width="174" height="60" rx="6" fill="#131313" stroke="rgba(255,255,255,0.07)"/>
</svg>`;

function work(w, visuals, num = "", alt = "") {
  return `<!-- ${num} WORK -->
<section class="section${alt}" id="work">
${head(`${num} / WORK`, "workTitle", tr("workTitle", w.title), "workSub", tr("workSub", w.sub))}
  <div class="section__body fu">

${w.projects.map((p) => `    <div class="project${p.featured ? " project--featured glow" : ""}" style="margin-bottom:20px;">
      <div>
        <span class="mono-label mono-label--accent">${esc(p.label)}</span>
        <h3 class="project__title" style="margin-top:10px;">${esc(p.title)}</h3>
        <p class="project__blurb">${esc(p.blurb)}</p>
        <div class="proj-stack">
${(p.chips || []).map((c) => `          ${chip(c)}`).join("\n")}
        </div>${p.metrics?.length ? `
        <div class="proj-metrics">
${p.metrics.map((m) => `          <div><div class="project__metric-value">${esc(m.value)}</div><div class="project__metric-label">${esc(m.label)}</div></div>`).join("\n")}
        </div>` : ""}
        <div style="display:flex;gap:20px;margin-top:18px;align-items:center;flex-wrap:wrap;">
${(p.links || []).map((l) => `          <a href="${attr(safeUrl(l.url))}" target="_blank" class="project__cta"${l.muted ? ' style="color:var(--ink-dim);"' : ""}>${esc(l.text)} &#8594;</a>`).join("\n")}
        </div>
      </div>
      <div class="project__visual" aria-hidden="true">
        ${visuals[p.visual] || DEFAULT_VISUAL}
      </div>
    </div>`).join("\n\n")}

  </div>
</section>`;
}

function now(n, num = "", alt = "") {
  return `<!-- ${num} /NOW -->
<section class="section${alt}" id="now">
${head(`${num} / NOW`, "nowTitle", tr("nowTitle", n.title))}
  <div class="section__body fu">
    <div class="now-card">
      <div class="now-card__updated">Updated ${esc(n.updated)}</div>
      <ul class="now-card__list">
${n.items.map((it, i) => `        <li class="now-card__item"><span id="now${i + 1}">${tr(`now${i + 1}`, it)}</span></li>`).join("\n")}
      </ul>
    </div>
  </div>
</section>`;
}

function contact(c) {
  return `<h2 class="contact__heading" style="margin-top:14px;" id="contactHeading">${tr("contactHeading", c.heading)}</h2>
    <div class="contact-socials">
${c.socials.map((s) => `      <a href="${attr(safeUrl(s.url))}"${s.download ? " download" : ' target="_blank"'}>${esc(s.text)}</a>`).join("\n")}
    </div>`;
}

// Recent labs: filled in the browser from lab.mmohamud.me/labs.json, and hidden (with its menu links) until a lab is published.
function labsSection(l, num = "", alt = "") {
  return `<!-- ${num} LABS -->
<section class="section${alt}" id="labs">
  <div class="section__head">
    <div><span class="mono-label mono-label--accent">${num} / LABS</span></div>
    <div>
      <h2 class="section__title" id="labsTitle">${tr("labsTitle", (l && l.title) || { en: "Recent labs.", so: "Shaybaarrada dhowaan." })}</h2>
    </div>
  </div>
  <div class="section__body fu">
    <div id="labList"><div class="blog-empty">Loading labs...</div></div>
  </div>
</section>`;
}

function writing(w, num = "", alt = "") {
  return `<!-- ${num} WRITING -->
<section class="section${alt}" id="writing">
  <div class="section__head">
    <div><span class="mono-label mono-label--accent">${num} / WRITING</span></div>
    <div>
      <h2 class="section__title" id="writingTitle">${tr("writingTitle", w.title)}</h2>
    </div>
  </div>
  <div class="section__body fu">
    <div id="blogList"><div class="blog-empty">Loading posts...</div></div>
  </div>
</section>`;
}

function contactSection(c, num = "") {
  return `<!-- ${num} CONTACT -->
<div class="contact" id="contact">
  <div class="grid-bg" style="position:absolute;inset:0;pointer-events:none;z-index:0;"></div>
  <div style="position:relative;z-index:1;">
    <span class="mono-label mono-label--accent">${num} / CONTACT</span>
    ${contact(c)}
    <div class="cform-wrap">
      <form id="cForm" action="https://formspree.io/f/xyknjrdo" method="POST">
        <label class="flbl" for="cName">Name</label>
        <input class="finp" type="text" id="cName" name="name" required placeholder="Your name"/>
        <label class="flbl" for="cEmail">Email</label>
        <input class="finp" type="email" id="cEmail" name="email" required placeholder="your@email.com"/>
        <label class="flbl" for="cMsg">Message</label>
        <textarea class="fta" id="cMsg" name="message" required placeholder="Tell me about a role or opportunity"></textarea>
        <div class="form-ok" id="formOk">MESSAGE SENT. WILL REPLY WITHIN 48 HOURS.</div>
        <button type="submit" class="btn btn--primary" style="width:100%;justify-content:center;" id="submitBtn">${tr("submitBtn", c.submit)}</button>
      </form>
    </div>
  </div>
</div>`;
}

// ---------- layout: section order/visibility and the menu (edited in Admin → Portfolio → Layout & menu) ----------
const SECTION_IDS = ["stats", "about", "experience", "skills", "work", "labs", "now", "writing", "contact"];
const NUMBERED = new Set(["about", "experience", "skills", "work", "labs", "now", "writing", "contact"]);
const DEFAULT_MENU = [["About", "about"], ["Experience", "experience"], ["Skills", "skills"], ["Work", "work"], ["Labs", "labs"], ["/now", "now"], ["Writing", "writing"], ["Contact", "contact"]];
function normalizeLayout(l = {}) {
  const seen = new Set();
  const sections = (Array.isArray(l.sections) ? l.sections : [])
    .filter((x) => SECTION_IDS.includes(x?.id) && !seen.has(x.id) && seen.add(x.id))
    .map((x) => ({ id: x.id, visible: x.visible !== false }));
  // A section that's new to a saved layout goes right after the section it follows by default.
  SECTION_IDS.forEach((id, i) => {
    if (seen.has(id)) return;
    const after = sections.findIndex((x) => x.id === SECTION_IDS[i - 1]);
    sections.splice(after === -1 ? sections.length : after + 1, 0, { id, visible: true });
    seen.add(id);
  });
  const menu = Array.isArray(l.menu) ? l.menu.filter((m) => m && (m.label || "").trim())
    : DEFAULT_MENU.map(([label, target]) => ({ label, target, url: "", newTab: false, visible: true }));
  return { sections, menu };
}

function footer(f) {
  return `<!-- FOOTER -->
<footer class="footer">
  <span>${inline(f.left)}</span>
  <span>${inline(f.middle, "color:inherit;text-decoration:underline")}</span>
  <span>${inline(f.right)}</span>
</footer>`;
}

// ---------- load content ----------
async function loadContent() {
  const seed = JSON.parse(await readFile("src/content.seed.json", "utf8"));
  if (!ANON) { console.log("No SUPABASE_ANON_KEY: building from src/content.seed.json"); return seed; }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/portfolio_content?id=eq.main&select=data`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}`);
    const rows = await res.json();
    if (!rows.length || !rows[0].data) { console.log("No published portfolio content yet: using the seed file"); return seed; }
    console.log("Building from content published in the admin");
    return { ...seed, ...rows[0].data };
  } catch (e) {
    console.log(`Couldn't load content (${e.message}): using the seed file`);
    return seed;
  }
}

// ---------- build ----------
const C = await loadContent();
for (const [path, fallback] of [["hero.chips", []], ["stats", []], ["about.paragraphs", []], ["experience.items", []], ["skills.groups", []], ["certifications", []], ["education", []], ["work.projects", []], ["now.items", []], ["contact.socials", []]]) {
  const ks = path.split("."); let o = C;
  for (const k of ks.slice(0, -1)) o = o[k] ??= {};
  if (!Array.isArray(o[ks.at(-1)])) o[ks.at(-1)] = fallback;
}
const visuals = {};
if (existsSync("src/visuals")) for (const f of await readdir("src/visuals")) if (f.endsWith(".svg")) visuals[f.replace(/\.svg$/, "")] = await readFile(join("src/visuals", f), "utf8");

let html = await readFile("src/template.html", "utf8");
// Sections in the order you chose; numbers ("01 / ABOUT") and shading follow the order.
const LAYOUT = normalizeLayout(C.layout);
const shown = new Set(LAYOUT.sections.filter((x) => x.visible).map((x) => x.id));
const R = {
  stats: () => stats(C.stats),
  about: (n, a) => about(C.about, n, a),
  experience: (n, a) => experience(C.experience, n, a),
  skills: (n, a) => skills(C.skills, C.certifications, C.education, n, a),
  work: (n, a) => work(C.work, visuals, n, a),
  now: (n, a) => now(C.now, n, a),
  labs: (n, a) => labsSection(C.labs, n, a),
  writing: (n, a) => writing(C.writing, n, a),
  contact: (n) => contactSection(C.contact, n),
};
const numOf = {};
let count = 0, shade = 0;
const blocks = [];
for (const sec of LAYOUT.sections) {
  if (!sec.visible) continue;
  if (!NUMBERED.has(sec.id)) { blocks.push(R[sec.id]()); continue; }
  const num = String(++count).padStart(2, "0");
  numOf[sec.id] = num;
  const alt = sec.id === "contact" ? "" : (shade++ % 2 ? " section--alt" : "");
  blocks.push(R[sec.id](num, alt));
}
// The menu: links to sections that are on the page, plus any outside links you added.
const menu = LAYOUT.menu.filter((m) => m.visible !== false).map((m) => {
  if (m.target === "custom") {
    const url = safeUrl(m.url || "");
    return url === "#" ? null : { label: m.label, href: url, external: true, newTab: !!m.newTab, num: "↗" };
  }
  return shown.has(m.target) && m.target !== "stats" ? { label: m.label, href: `#${m.target}`, sec: m.target, num: numOf[m.target] || "" } : null;
}).filter(Boolean);
const blank = (m) => (m.newTab ? ' target="_blank" rel="noopener"' : "");
const navlinks = menu.map((m) => `    <a href="${attr(m.href)}"${blank(m)}>${esc(m.label)}</a>`).join("\n");
const rail = menu.map((m) => `  <a href="${attr(m.href)}"${m.sec ? ` data-sec="${m.sec}"` : ""}${blank(m)}><span class="rail__num">${esc(m.num)}</span><span class="rail__line" aria-hidden="true"></span><span class="rail__label">${esc(m.label)}</span></a>`).join("\n");
const sectionIds = LAYOUT.sections.filter((x) => x.visible && NUMBERED.has(x.id)).map((x) => x.id);

const parts = {
  "{{meta.title}}": esc(C.meta.title),
  "{{meta.description}}": attr(C.meta.description),
  "{{status}}": tr("statusText", C.status),
  "{{hero}}": hero(C.hero, { contact: shown.has("contact"), work: shown.has("work") }),
  "{{sections}}": blocks.join("\n\n"),
  "{{navlinks}}": navlinks,
  "{{rail}}": rail,
  "{{sectionIds}}": JSON.stringify(sectionIds).replace(/"/g, "'").replace(/,/g, ", "),
  "{{footer}}": footer(C.footer),
};
for (const [k, v] of Object.entries(parts)) {
  if (!html.includes(k)) throw new Error(`Template is missing ${k}`);
  html = html.split(k).join(v);
}
const EN = Object.fromEntries(Object.entries(i18n).map(([k, v]) => [k, v.en]));
const SO = Object.fromEntries(Object.entries(i18n).map(([k, v]) => [k, v.so]));
const js = (o) => JSON.stringify(o, null, 2).replace(/</g, "\\u003c");
html = html.replace("{{i18n}}", `var EN = ${js(EN)};\n\nvar SO = ${js(SO)};`);
if (/\{\{[a-z.]+\}\}/i.test(html)) throw new Error("A template marker was left unfilled");

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
const SKIP = new Set(["_site", "src", "scripts", "node_modules", "index.html", "package.json", "package-lock.json", "README.md", "README-builder.md", "sitemap-generator.html"]);
for (const f of await readdir(".")) {
  if (f.startsWith(".") || SKIP.has(f) || f.endsWith(".sql") || f.endsWith(".mjs")) continue;
  await cp(f, join(OUT, f), { recursive: true });
}
await writeFile(join(OUT, "index.html"), html);
// Short links: mmohamud.me/go/<name>/ → anywhere (edited in Admin → Portfolio → Short links).
// Each is a tiny page that counts the click (same privacy rules as page views) and forwards instantly.
const TRACK_URL = "https://lurrqcyaybpgidzjfdvh.supabase.co/functions/v1/track";
let shortCount = 0;
for (const l of Array.isArray(C.shortlinks) ? C.shortlinks : []) {
  const slug = String(l.slug || "").trim().toLowerCase();
  const url = String(l.url || "").trim();
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(slug) || !/^https:\/\/[^\s"'<>]+$/.test(url)) continue;
  const js = (v) => JSON.stringify(v).replace(/</g, "\\u003c");
  const page = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Redirecting…</title>
<link rel="canonical" href="${attr(url)}">
<meta http-equiv="refresh" content="1;url=${attr(url)}">
<script>
(function () {
  var to = ${js(url)};
  try {
    var off = localStorage.getItem("mm-ignore") === "1" || navigator.doNotTrack === "1" || navigator.globalPrivacyControl;
    if (!off && navigator.sendBeacon) {
      var src = "";
      try { var h = document.referrer && new URL(document.referrer).hostname.replace(/^www\\./, ""); if (h && !/(^|\\.)mmohamud\\.me$/.test(h)) src = h; } catch (e) {}
      navigator.sendBeacon(${js(TRACK_URL)}, new Blob([JSON.stringify({ path: location.pathname, event: "short_link", detail: ${js(slug)}, source: src })], { type: "text/plain" }));
    }
  } catch (e) {}
  location.replace(to);
})();
</script>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0a0a;color:#a3a3a3;font:15px system-ui,sans-serif}a{color:#c8f76b}</style>
</head><body><p>Taking you to <a href="${attr(url)}">${esc(url)}</a>…</p></body></html>
`;
  await mkdir(join(OUT, "go", slug), { recursive: true });
  await writeFile(join(OUT, "go", slug, "index.html"), page);
  shortCount++;
}
if (shortCount) console.log(`Built ${shortCount} short link${shortCount === 1 ? "" : "s"}`);

await writeFile(join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://mmohamud.me/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>
</urlset>
`);
console.log("Built _site/index.html");
