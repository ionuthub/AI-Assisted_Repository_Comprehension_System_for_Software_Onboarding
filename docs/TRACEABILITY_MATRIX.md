# Traceability matrix

This table uses the same FR1–FR12 and NFR1–NFR12 identifiers as `REQUIREMENTS.md` and the dissertation. Test locations identify coverage, not an assertion that every current check passes; run results must be tied to the checked commit.

## Functional requirements

| Req | Implementation | Test evidence |
| --- | --- | --- |
| FR1 | `src/lib/github.ts` | `github.test.ts`, malformed-URL e2e test |
| FR2 | `ingestionFilters.ts`, `github.ts` | `ingestionFilters.test.ts`, `github.test.ts` |
| FR3 | `repositoryScanner.ts`, `projectAnalyzer.ts`, `RepositoryOverview.tsx` | Automated build and integration coverage |
| FR4 | `staticAnalysis.ts`, `RepositoryOverview.tsx` | Automated build and integration coverage |
| FR5 | `semanticSearch.ts`, `WorkspaceSearchView.tsx` | `semanticSearch.test.ts` |
| FR6 | `Index.tsx`, `api/explain-code.ts` | `promptBuilder.test.ts`, `generationProtocol.test.ts` |
| FR7 | `EvidencePanel.tsx` | `EvidencePanel.test.tsx` |
| FR8 | `WorkspaceQAView.tsx` | `WorkspaceQAView.test.tsx` |
| FR9 | `github.ts`, `CoveragePanel.tsx` | `github.test.ts` |
| FR10 | `staticAnalysis.ts`, `FileInsightsPanel.tsx`, `CodeViewer.tsx` | `CodeViewer.test.tsx` |
| FR11 | `src/pages/Study.tsx` | `e2e/basic-flow.spec.ts`, `e2e/study-flow.spec.ts` |
| FR12 | JSON serialisation and download in `src/pages/Study.tsx` | Participant-export assertions in `e2e/study-flow.spec.ts` |

## Non-functional requirements

| Req | Implementation | Test or evidence |
| --- | --- | --- |
| NFR1 | ES2020 build, Vercel | Production build |
| NFR2 | Limits and recovery in `github.ts` | `github.test.ts` |
| NFR3 | `semanticSearch.ts` | `score_questions.mjs`, repeatability tooling |
| NFR4 | `recordMetric` in the project store and `Index.tsx` | Source inspection of repository-analysis and Q&A timing; no latency pass threshold |
| NFR5 | `api/explain-code.ts` | Source inspection and automated tests |
| NFR6 | `api/explain-code.ts`, `promptBuilder.ts` | `promptBuilder.test.ts` |
| NFR7 | Path validation and React escaping | `github.test.ts` |
| NFR8 | `ErrorBoundary.tsx`, `Index.tsx`, generation error state | `generationProtocol.test.ts`, `WorkspaceQAView.test.tsx`; full crash recovery is not established by a not-found route test |
| NFR9 | ARIA and keyboard support | component and e2e tests |
| NFR10 | Evidence wording | `EvidencePanel.test.tsx` |
| NFR11 | CI and automated test suite | Commit-specific typecheck, lint, unit, build and Playwright results; see `TESTING.md` |
| NFR12 | `LICENSE.md`, public evaluation records and private participant records | MIT licence and evidence locations in `study/README.md` |

## Final evaluation evidence

| Result | File or script |
| --- | --- |
| 24-question accuracy gate | `study/ground-truth.*.md`, `study/marking.*.md`, `study/final-results.json` |
| Retrieval measurement | `analysis/score_questions.mjs` |
| Citation checking | `analysis/check_citations.py` |
| Repository matching | `analysis/verify_study_repos.py`, `analysis/repo_stats.py` |
