# mellea-lrc-viz

A viewer for [mellea-lrc](https://github.com/gt-csse/mellea-lrc) validation
results. Open a `validated.json` and read what happened to each citation in a
filing — whether the authority resolved, whether the case name, year and court
agreed, and whether the cited page supports what it was cited for.

It runs entirely in the browser. There is no server, no database, and no
connection to mellea-lrc: you supply the file, it renders it. Nothing you open
leaves your machine.

---

## Requirements

**Node.js 20.9 or newer**, which includes `npm`. Check what you have:

```bash
node --version
npm --version
```

If you need it, install from [nodejs.org](https://nodejs.org/) or with a version
manager:

```bash
# macOS, via Homebrew
brew install node

# any platform, via nvm
nvm install 20 && nvm use 20
```

Next.js 16 requires Node 20.9+; older versions fail at build with a message
naming the version it wants.

---

## Run it locally

```bash
git clone https://github.com/gt-csse/mellea-lrc-viz.git
cd mellea-lrc-viz
npm install
npm run dev
```

Open <http://localhost:3000>. Use **Open result JSON** in the header and pick a
`validated.json`.

| command | what it does |
|---|---|
| `npm run dev` | development server on port 3000, with hot reload |
| `npm run build` | production build |
| `npm start` | serve the production build (run `build` first) |
| `npm run typecheck` | `tsc --noEmit`, no build output |

To use another port: `npm run dev -- --port 4000`.

---

## Getting a file to open

The viewer reads the artifact `mellea-lrc` writes. From a mellea-lrc checkout:

```bash
uv run --env-file .env mellea-lrc validate \
  --from-file examples/sample-filing.txt --output validated.json
```

The file must be a schema 2 `validated_document` artifact — that is,
`{"schema_version": 2, "artifact_type": "validated_document", "source": …,
"citations": […]}`. Anything else is refused with *"Expected a schema 2
validated_document serialization artifact."*

An extraction-only artifact will not open. The viewer renders validation nodes,
and extraction produces none.

---

## What you get

Three tabs, with the citation list on the left. Selecting a citation drives all
three.

**Citation Summary** — the bibliographic comparison. What the filing claims
against what the record says, field by field, with the disagreements marked.
This is the view to start in.

**Document** — the filing's own text with every citation highlighted in place.
Click a highlight to select that citation; select a citation and the text
scrolls to it.

**Validation Viz** — the progression as a graph: each check that ran, in
dependency order, with its outcome. Selecting a node shows what it asked, what
came back, and why it concluded what it did. This is where a result is
explained rather than just stated.

---

## Deploy to Vercel

The app is static and needs no environment variables, so deployment is close to
a no-op.

### From the dashboard

1. Push this repository to GitHub.
2. At [vercel.com/new](https://vercel.com/new), import it.
3. Take every default — Vercel detects Next.js and fills in the framework,
   build command, and output directory.
4. **Deploy.**

Every push to the default branch redeploys; pushes to other branches get preview
URLs.

### From the CLI

```bash
npm install -g vercel
vercel          # preview deployment
vercel --prod   # production
```

The first run asks which scope and project to use and writes `.vercel/`, which
is gitignored.

### Notes

- **No environment variables.** Nothing here holds a key, so there is nothing to
  configure in project settings.
- **The build is `npm run build`.** If Vercel ever fails to detect it, set the
  framework preset to Next.js and leave the rest blank.
- **Node version** is set in Vercel's project settings under *General → Node.js
  Version*. Pick 20.x or newer.
- Any static host works — `npm run build` output is deployable anywhere that can
  run a Next.js server, and Vercel is simply the least configuration.

---

## License

MIT.
