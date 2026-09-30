# How mmohamud.me is built

- `src/template.html` is the page design (styles, scripts, form). Editable sections are `{{markers}}`.
- `src/content.seed.json` is the starting content, extracted from the original page (English + Somali).
- `src/visuals/*.svg` are the project illustrations, matched to projects by their `visual` key.
- `scripts/build.mjs` fills the template and writes `_site/` (plus your images, resume, fonts, etc).
- Content edited in admin.mmohamud.me → Portfolio is stored in Supabase and used instead of the seed file.

Local preview: `node scripts/build.mjs` then open `_site/index.html`.
The old root `index.html` is no longer used by the build and can be deleted once the new build is live.
