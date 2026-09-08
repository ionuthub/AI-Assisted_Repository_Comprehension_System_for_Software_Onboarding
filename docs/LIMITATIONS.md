# Limitations

## Artefact

- **Per-file size:** files larger than 5 MB are skipped.
- **GitHub API dependency:** repository ingestion depends on GitHub availability and rate limits.
- **Retrieval remains partly lexical:** the pipeline combines TF-IDF with file-path, symbol and import-graph signals, so vocabulary mismatch can still reduce retrieval quality.
- **Regex analysis:** structural analysis targets common JavaScript and TypeScript syntax and does not cover every language or syntax form.
- **Desktop scope:** the evaluated interface is intended for desktop and laptop browsers.
- **Accessibility:** automated accessibility checks are present, but full WCAG 2.2 AA conformance is not claimed.
- **Rate limiting:** the server-side request limit depends on Upstash Redis being configured.
- **Type safety:** `strictNullChecks` is disabled.
- **Dependency advisories:** npm audit advisories still require separate security triage.

## Evaluation

The accuracy result is based on two purpose-built JavaScript/TypeScript repositories and 24 predefined questions. It therefore does not establish the same accuracy for every repository, language or comprehension task.

The reference answers were AI-assisted and checked with tools against the complete study repositories. They are described as **tool-verified**, not as independently authored human ground truth. The researcher made the final binary verdicts.

The technical benchmark measures generated-answer correctness. The dissertation separately reports a completed counterbalanced, within-participant comparison involving twelve Year 3 Computer Science students. Each participant attempted four tasks manually and four with Codemap on different repositories. Paired correctness, task-attempt duration and Raw NASA-TLX were analysed; SUS applies only to Codemap.

The participant findings are limited to this small convenience sample and the two controlled repositories. They do not establish professional-developer productivity, long-term onboarding benefit or a separate causal effect of retrieval, generation or the evidence panel. Skipped tasks contribute to total task-attempt duration and count as incorrect. High Codemap SUS scores do not establish greater usability than manual browsing, for which SUS was not collected. Binary marking was performed by one researcher; there is no independent inter-rater reliability estimate.

Approval and consent evidence is addressed in the dissertation's Section 4.7 and Appendix B. Technical checks and internally consistent statistics do not establish ethics compliance.

AI assistance used during development, checking and writing is disclosed in [`../study/AI-DISCLOSURE.md`](../study/AI-DISCLOSURE.md).
