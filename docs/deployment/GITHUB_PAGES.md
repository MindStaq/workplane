# GitHub Pages

The project site is a static landing page in [`website/`](../../website/).

**Live URL:** https://mindstaq.github.io/workplane/

## Deploy

Pushes to `main` that touch `website/` trigger [`.github/workflows/deploy-pages.yml`](../../.github/workflows/deploy-pages.yml).

### First-time setup (if deploy fails with “Get Pages site failed”)

GitHub Pages must exist with **Build type: GitHub Actions**. Enable once as a repo admin:

**UI:** **Settings → Pages → Build and deployment → Source: GitHub Actions**

**CLI:**

```bash
gh api --method POST repos/MindStaq/workplane/pages -f build_type=workflow
```

Then re-run **Actions → Deploy GitHub Pages**.

After the first successful workflow run, the site is live at https://mindstaq.github.io/workplane/

## Link the repo

1. **Settings → General → Website** → `https://mindstaq.github.io/workplane/`
2. Or run: `gh repo edit MindStaq/workplane --homepage https://mindstaq.github.io/workplane/`

The root README and npm `homepage` field point here for discoverability.

## Local preview

```bash
npx --yes serve website
# open http://localhost:3000
```
