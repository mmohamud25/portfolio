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
function hero(h) {
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
          <a href="#contact" class="btn btn--primary" id="heroCta">${tr("heroCta", h.cta)}</a>
          <a href="#work" class="btn btn--ghost" id="heroWork">${tr("heroWork", h.work)}</a>
          <a href="${attr(safeUrl(h.resume))}" download class="btn btn--ghost btn--sm">Resume PDF &#8595;</a>
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

function about(a) {
  return `<!-- 01 ABOUT -->
<section class="section" id="about">
${head("01 / ABOUT", "aboutTitle", tr("aboutTitle", a.title), "aboutSub", tr("aboutSub", a.sub))}
  <div class="section__body fu">
${a.paragraphs.map((p, i) => `    <p style="font-size:17px;color:var(--ink-mid);line-height:1.75;max-width:660px;${i < a.paragraphs.length - 1 ? "margin-bottom:24px;" : ""}" id="aboutP${i + 1}">${tr(`aboutP${i + 1}`, p)}</p>`).join("\n")}
  </div>
</section>`;
}

function experience(e) {
  return `<!-- 02 EXPERIENCE -->
<section class="section section--alt" id="experience">
${head("02 / EXPERIENCE", "expTitle", tr("expTitle", e.title))}
  <div class="section__body fu">
${e.items.map((x, i) => `    <div class="timeline__row">
      <div class="timeline__year">${esc(x.years)}</div>
      <div>
        <div class="timeline__role">${esc(x.role)}</div>
        <div class="timeline__org">${esc(x.org)}</div>
        <div class="tl-chips">
${x.chips.map((c) => `          ${chip(c)}`).join("\n")}
        </div>
      </div>
      <div>
        <p class="timeline__desc" id="exp${i}Desc">${tr(`exp${i}Desc`, x.desc)}</p>
      </div>
    </div>`).join("\n")}
  </div>
</section>`;
}

function skills(s, certs, edu) {
  const certRows = certs.map((c) => `      <div class="cert-row${c.earned ? " live" : ""}">
        <div class="cert-dot ${c.earned ? "on" : "off"}"></div>
        <div>
          <div class="cert-name">${esc(c.name)}</div>
          <div class="cert-meta">${esc(c.meta)}${c.link ? ` &nbsp;·&nbsp; <a href="${attr(safeUrl(c.link.url))}" target="_blank" style="color:var(--accent);">${esc(c.link.text)}</a>` : ""}</div>
          <div class="cert-badge ${c.earned ? "on" : "off"}">${esc(c.badge || (c.earned ? "Certified" : "In Progress"))}</div>
        </div>
      </div>`).join("\n");
  const eduRows = edu.map((d) => `      <div class="cert-row${d.current ? " live" : ""}">
        <div><div class="cert-name">${esc(d.name)}</div><div class="cert-meta">${esc(d.meta)}</div></div>
      </div>`).join("\n");
  return `<!-- 03 SKILLS -->
<section class="section" id="skills">
${head("03 / SKILLS", "skillsTitle", tr("skillsTitle", s.title))}
  <div class="section__body fu">
${s.groups.map((g) => `    <div class="skill-group">
      <h4>${esc(g.name)}</h4>
      <div class="chips-wrap">
${g.chips.map((c) => `        ${chip(c, "chip chip--solid")}`).join("\n")}
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

function work(w, visuals) {
  return `<!-- 04 WORK -->
<section class="section section--alt" id="work">
${head("04 / WORK", "workTitle", tr("workTitle", w.title), "workSub", tr("workSub", w.sub))}
  <div class="section__body fu">

${w.projects.map((p) => `    <div class="project${p.featured ? " project--featured glow" : ""}" style="margin-bottom:20px;">
      <div>
        <span class="mono-label mono-label--accent">${esc(p.label)}</span>
        <h3 class="project__title" style="margin-top:10px;">${esc(p.title)}</h3>
        <p class="project__blurb">${esc(p.blurb)}</p>
        <div class="proj-stack">
${p.chips.map((c) => `          ${chip(c)}`).join("\n")}
        </div>${p.metrics?.length ? `
        <div class="proj-metrics">
${p.metrics.map((m) => `          <div><div class="project__metric-value">${esc(m.value)}</div><div class="project__metric-label">${esc(m.label)}</div></div>`).join("\n")}
        </div>` : ""}
        <div style="display:flex;gap:20px;margin-top:18px;align-items:center;flex-wrap:wrap;">
${p.links.map((l) => `          <a href="${attr(safeUrl(l.url))}" target="_blank" class="project__cta"${l.muted ? ' style="color:var(--ink-dim);"' : ""}>${esc(l.text)} &#8594;</a>`).join("\n")}
        </div>
      </div>
      <div class="project__visual">
        ${visuals[p.visual] || DEFAULT_VISUAL}
      </div>
    </div>`).join("\n\n")}

  </div>
</section>`;
}

function now(n) {
  return `<!-- 05 /NOW -->
<section class="section" id="now">
${head("05 / NOW", "nowTitle", tr("nowTitle", n.title))}
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
const visuals = {};
if (existsSync("src/visuals")) for (const f of await readdir("src/visuals")) if (f.endsWith(".svg")) visuals[f.replace(/\.svg$/, "")] = await readFile(join("src/visuals", f), "utf8");

let html = await readFile("src/template.html", "utf8");
const parts = {
  "{{meta.title}}": esc(C.meta.title),
  "{{meta.description}}": attr(C.meta.description),
  "{{status}}": tr("statusText", C.status),
  "{{hero}}": hero(C.hero),
  "{{stats}}": stats(C.stats),
  "{{about}}": about(C.about),
  "{{experience}}": experience(C.experience),
  "{{skills}}": skills(C.skills, C.certifications, C.education),
  "{{work}}": work(C.work, visuals),
  "{{now}}": now(C.now),
  "{{writing.title}}": tr("writingTitle", C.writing.title),
  "{{contact}}": contact(C.contact),
  "{{contact.submit}}": tr("submitBtn", C.contact.submit),
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
const SKIP = new Set(["_site", "src", "scripts", "node_modules", "index.html", "package.json", "package-lock.json", "README.md"]);
for (const f of await readdir(".")) {
  if (f.startsWith(".") || SKIP.has(f) || f.endsWith(".sql") || f.endsWith(".mjs")) continue;
  await cp(f, join(OUT, f), { recursive: true });
}
await writeFile(join(OUT, "index.html"), html);
console.log("Built _site/index.html");
