# Requirements

These identifiers match Tables 1 and 2 of the dissertation. They cover the comprehension application and the comparative study instrument. The technical evaluation identifies core artefact commit `85ab075065732b3652acabf8f67d2cee33e14d6f`; verification of a submission change must identify the commit actually checked.

## Functional requirements

| ID | Requirement | Main implementation |
| --- | --- | --- |
| FR1 | Accept a public GitHub repository URL | `src/lib/github.ts` |
| FR2 | Ingest suitable source files and report exclusions | `src/lib/ingestionFilters.ts`, `src/lib/github.ts`, `CoveragePanel.tsx` |
| FR3 | Show repository technologies, languages and files | `repositoryScanner.ts`, `projectAnalyzer.ts`, `RepositoryOverview.tsx` |
| FR4 | Analyse file relationships using imports | `staticAnalysis.ts`, `RepositoryOverview.tsx` |
| FR5 | Provide ranked natural-language code search | `semanticSearch.ts`, `WorkspaceSearchView.tsx` |
| FR6 | Answer repository questions using retrieved evidence | `Index.tsx`, `api/explain-code.ts` |
| FR7 | Show supporting evidence for generated answers | `EvidencePanel.tsx` |
| FR8 | Flag file paths named in an answer that were not retrieved | `WorkspaceQAView.tsx` |
| FR9 | Report repository coverage | `github.ts`, `CoveragePanel.tsx` |
| FR10 | Inspect and explain selected files | `staticAnalysis.ts`, `FileInsightsPanel.tsx`, `CodeViewer.tsx` |
| FR11 | Run the fixed comparative study: balanced sequence, four timed tasks per condition, Raw NASA-TLX, SUS and feedback | `src/pages/Study.tsx` |
| FR12 | Export one pseudonymised participant JSON record for post-session marking | `src/pages/Study.tsx` |

## Non-functional requirements

| ID | Requirement | Evidence |
| --- | --- | --- |
| NFR1 | Run in a current desktop browser | ES2020 build and Vercel deployment |
| NFR2 | Handle repository ingestion safely, including file-size and tree-recovery limits | `github.ts`, `github.test.ts` |
| NFR3 | Return stable retrieval results for the same query and index | `semanticSearch.ts`, retrieval tests |
| NFR4 | Instrument repository analysis and Q&A timing; no universal latency threshold | `recordMetric` in the project store and `Index.tsx` |
| NFR5 | Keep the model API key server-side | `api/explain-code.ts` |
| NFR6 | Apply origin, body, message, token and duration limits; rate limiting requires configured Redis | `api/explain-code.ts`, `promptBuilder.ts` |
| NFR7 | Safely handle untrusted content and exports | React escaping, path validation and JSON serialisation |
| NFR8 | Contain runtime failures and show answer-generation errors without discarding the workspace | `ErrorBoundary.tsx`, generation error handling |
| NFR9 | Provide labelled controls, keyboard support and semantic/ARIA state | component and end-to-end tests; no formal WCAG conformance claim |
| NFR10 | Never present retrieval scores or evidence display as proof of answer correctness | `EvidencePanel.tsx` |
| NFR11 | Pass typecheck, lint, unit tests, production build and end-to-end tests | Results for the specific checked commit; see `TESTING.md` |
| NFR12 | Publish source under a permissive licence and retain evaluation evidence | MIT licence, `study/` and private participant records |

For implementation-to-test mapping, see [`TRACEABILITY_MATRIX.md`](TRACEABILITY_MATRIX.md).
