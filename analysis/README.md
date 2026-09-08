# Analysis and measurement scripts

The files in `analysis/` support technical evaluation of the artefact. They do not form part of the normal application runtime.

The evaluated application build is fixed at `85ab075065732b3652acabf8f67d2cee33e14d6f`. Analysis scripts may be updated provided they do not change `src/` or `api/`.

## Main scripts

| Script | Purpose |
| --- | --- |
| `capture_gate.mjs` | Captures generated answers and evidence |
| `accuracy_gate.py` | Scores marked gate captures |
| `marking_sheet.py` | Builds and collects marking sheets |
| `check_citations.py` | Checks ground-truth source ranges |
| `compare_runs.py` | Compares repeated captures |
| `score_questions.mjs` | Measures retrieval scores for the evaluation questions |
| `verify_study_repos.py` | Checks the two study repositories |
| `repo_stats.py` | Reports repository size and composition |

Final gate outcomes are recorded in `study/marking.*.md` and `study/final-results.json`.

## Reproduce the participant analysis

Use Python 3.11 or later in an isolated environment, with the versions in
`requirements-participants.txt`. Keep the twelve `study-Pxx-comparative.json`
exports, completed marking CSV and generated outputs outside this public
repository. These contain participant data. The script performs no network calls.

```sh
python -m venv /path/to/private/analysis-env
/path/to/private/analysis-env/bin/pip install -r analysis/requirements-participants.txt
/path/to/private/analysis-env/bin/python -m unittest discover -s analysis -p 'test_analyse_participants.py'
/path/to/private/analysis-env/bin/python analysis/analyse_participants.py \
  --exports /path/to/private/exports \
  --marking /path/to/private/participant-marking.csv \
  --marking-source 'Retained researcher marking sheet, date/version' \
  --output /path/to/private/results
```

The marking CSV uses `study/participant-marking-template.csv`. The script checks
participant IDs, assigned repositories, all eight binary task marks, condition
totals and skipped tasks. It does not decide whether an answer is correct; those
judgements require the fixed answer keys and retained researcher marking.
Omit `--marking` and `--marking-source` to calculate timing, workload and SUS only.

If only the dissertation's participant correctness totals are available, use
`--marking-mode reported-totals` and describe the table in `--marking-source`.
This explicitly labels H2 as a recalculation of reported totals, not an independent
verification of task marking. Required columns in that mode are `participant_id`,
`sequence`, `manual_repository`, `manual_tasks_correct`, `codemap_repository`, and
`codemap_tasks_correct`. Never reconstruct per-task marks from aggregate totals.

The outputs are `participant-measures.csv` and `participant-summary.json`, with
input checksums, script checksum, package versions, sample size and sequence counts.
Inspect those counts against the intended sample; the script does not silently
assume twelve complete participants. It validates schema/assignment, rejects
missing or non-finite measurements, and recomputes NASA-TLX and SUS from responses.

Timing sums all four task durations in milliseconds, including skipped attempts;
it is time spent on the task set, not time to four correct answers. NASA-TLX uses
the checked, exported one-decimal mean. SUS applies only to Codemap. Quartiles use
NumPy's `linear` method (Hyndman–Fan type 7); do not round participant measurements
before calculating group statistics.

H1–H3 use two-sided paired Wilcoxon tests; H4 is one-sided against SUS 68.
Differences are Codemap minus manual (or SUS minus 68). Zero differences are
removed, ties receive average ranks and all possible signs of the nonzero ranks
are enumerated. This gives an exact conditional permutation p-value even with
tied ranks; it avoids treating SciPy's untied-rank `method='exact'` as exact when
ties exist. Rank-biserial correlation is `(W+ − W−)/(W+ + W−)`. The 95% confidence
interval for mean SUS uses Student's t distribution with `n − 1` degrees of freedom.
No multiplicity adjustment is applied, matching the stated hypothesis analysis.

Method references: [SciPy Wilcoxon documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.wilcoxon.html)
and [NumPy quantile documentation](https://numpy.org/doc/stable/reference/generated/numpy.quantile.html).
