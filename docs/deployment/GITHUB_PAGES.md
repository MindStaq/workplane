# GitHub Pages

The project site is a static landing page in [`website/`](../../website/).

**Live URL:** https://mindstaq.github.io/workplane/

## Deploy

Pushes to `main` that touch `website/` trigger [`.github/workflows/deploy-pages.yml`](../../.github/workflows/deploy-pages.yml).

First-time setup (repo admin):

1. **Settings → Pages → Build and deployment**
2. Source: **GitHub Actions** (not “Deploy from branch”)

After the first successful workflow run, the site is live.

## Link the repo

1. **Settings → General → Website** → `https://mindstaq.github.io/workplane/`
2. Or run: `gh repo edit MindStaq/workplane --homepage https://mindstaq.github.io/workplane/`

The root README and npm `homepage` field point here for discoverability.

## Local preview

```bash
npx --yes serve website
# open http://localhost:3000
```
