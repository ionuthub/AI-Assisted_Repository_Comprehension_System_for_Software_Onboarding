# AI-Assisted Repository Comprehension System for Software Onboarding

BSc Computer Science dissertation artefact for *Design and Evaluation of an AI-Assisted Repository Comprehension System for Software Onboarding*.

The tool helps users understand unfamiliar JavaScript and TypeScript repositories. It accepts a public GitHub URL and provides a repository overview, import analysis, TF-IDF code search, grounded question answering, file inspection and an evidence panel.

## Scope

The evaluated scope is initial repository comprehension on desktop and laptop browsers. Mobile and tablet use, long-term maintenance and code changes are outside the evaluated scope.

## Main folders

| Folder | Purpose |
| --- | --- |
| `src/` | Browser application |
| `api/` | Server-side Gemini proxy |
| `e2e/` | End-to-end tests |
| `analysis/` | Technical evaluation scripts |
| `study/` | Final evaluation records |
| `docs/` | Technical documentation |

## Documentation

| File | Purpose |
| --- | --- |
| [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) | Functional and non-functional requirements |
| [`docs/TRACEABILITY_MATRIX.md`](docs/TRACEABILITY_MATRIX.md) | Requirements mapped to implementation and tests |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System design and data flow |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | Interface design system |
| [`docs/TESTING.md`](docs/TESTING.md) | Software verification and final accuracy result |
| [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md) | Main technical and evaluation limits |
| [`study/PHASE3_PROTOCOL.md`](study/PHASE3_PROTOCOL.md) | Final evaluation protocol |
| [`study/AI-DISCLOSURE.md`](study/AI-DISCLOSURE.md) | AI-use disclosure |
| [`analysis/README.md`](analysis/README.md) | Technical analysis workflow |

## Main features

- Repository overview and technology detection
- Import-based file ranking
- Client-side TF-IDF search
- Grounded answers using retrieved repository evidence
- Evidence display with file and relevance information
- Repository coverage reporting

## Technology

React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TF-IDF retrieval, Google Gemini and Vercel.

## Run locally

Requires Node.js 20 or 22, npm and a Gemini API key.

```bash
git clone https://github.com/ionuthub/AI-Assisted_Repository_Comprehension_System_for_Software_Onboarding.git
npm install
npm run dev
```

Checks:

```bash
npm run typecheck
npm run lint
npx vitest run
npx playwright test
npm run build
```

## Security

The Gemini API key stays server-side. The API checks allowed origins, request size and context size. Rate limiting works only when Upstash Redis is configured.

## AI use

AI tools were used during development, testing, analysis, review and writing support. Details are recorded in [`study/AI-DISCLOSURE.md`](study/AI-DISCLOSURE.md).

The researcher remains responsible for the final scope, marking decisions, interpretation and submitted work.

## Licence

MIT. See [`LICENSE.md`](LICENSE.md).
