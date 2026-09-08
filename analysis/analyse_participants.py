#!/usr/bin/env python3
"""Offline analysis of private comparative-v1 exports; never publishes participant data."""
import argparse
import csv
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

import numpy as np
import scipy
from scipy import stats

NASA = ('mentalDemand', 'physicalDemand', 'temporalDemand', 'performance', 'effort', 'frustration')
SEQUENCES = {
    'A': [('manual', 'warehouse-dispatch'), ('codemap', 'clinic-triage')],
    'B': [('codemap', 'clinic-triage'), ('manual', 'warehouse-dispatch')],
    'C': [('manual', 'clinic-triage'), ('codemap', 'warehouse-dispatch')],
    'D': [('codemap', 'warehouse-dispatch'), ('manual', 'clinic-triage')],
}


def require(ok, message):
    if not ok:
        raise ValueError(message)


def number(value, low, high, label):
    require(type(value) in (int, float) and math.isfinite(value) and low <= value <= high,
            f'{label}: invalid number {value!r}')
    return value


def read_export(path):
    d = json.loads(path.read_text())
    require(d['schemaVersion'] == 4 and d['protocolVersion'] == 'comparative-v1', f'{path.name}: unsupported schema')
    pid = d['participant']['id']
    require(isinstance(pid, str) and bool(pid.strip()), 'Missing participant ID')
    seq = d['assignment']['sequenceId']
    require(seq in SEQUENCES, f'{pid}: unknown sequence')
    expected = SEQUENCES[seq]
    require([(x['condition'], x['repositoryKey']) for x in d['assignment']['sequence']] == expected, f'{pid}: inconsistent assignment')
    require([(c['condition'], c['repository']['name']) for c in d['conditions']] == expected, f'{pid}: wrong condition order/repository')
    row = {'participant_id': pid, 'sequence': seq}
    for order, c in enumerate(d['conditions'], 1):
        label = c['condition']
        require(c['order'] == order, f'{pid}: inconsistent condition order')
        tasks = c['tasks']
        require([t['id'] for t in tasks] == [1, 2, 3, 4], f'{pid}: expected four ordered tasks')
        for t in tasks:
            number(t['durationMs'], 0, math.inf, f'{pid}: duration')
            require(type(t['completed']) is bool and isinstance(t['answer'], str), f'{pid}: invalid task record')
        responses = c['nasaTlx']['responses']
        require(set(responses) == set(NASA), f'{pid}: incomplete NASA-TLX')
        for key in NASA:
            require(number(responses[key], 0, 100, key) % 5 == 0, f'{pid}: invalid NASA step')
        mean = sum(responses.values()) / 6
        recorded = number(c['nasaTlx']['rawScore'], 0, 100, 'NASA score')
        require(abs(recorded - mean) <= 0.0500001, f'{pid}: NASA score disagrees with responses')
        row.update({f'{label}_repository': c['repository']['name'],
                    f'{label}_total_seconds': sum(t['durationMs'] for t in tasks) / 1000,
                    f'{label}_minutes': sum(t['durationMs'] for t in tasks) / 60000,
                    f'{label}_skipped': sum(not t['completed'] for t in tasks),
                    f'{label}_nasa_raw': recorded})
    responses = d['sus']['responses']
    require(d['sus']['appliesTo'] == 'codemap' and len(responses) == 10, f'{pid}: incomplete SUS')
    require(all(type(x) is int and 1 <= x <= 5 for x in responses), f'{pid}: invalid SUS response')
    score = 2.5 * sum(x - 1 if i % 2 == 0 else 5 - x for i, x in enumerate(responses))
    require(d['sus']['score'] == score, f'{pid}: SUS score disagrees with responses')
    row['sus_score'] = score
    return row, d


def signed_rank(differences, alternative='two-sided'):
    """Exact sign enumeration, average tied ranks, Wilcox zero removal.

    Twice-ranks are integers, so tied-rank tail comparisons are exact.
    Intended for this small study (at most 20 nonzero pairs).
    """
    require(alternative in ('two-sided', 'greater'), 'Unsupported alternative')
    d = np.round(np.asarray(differences, dtype=float), 10)
    require(np.all(np.isfinite(d)), 'Non-finite difference')
    d = d[d != 0]
    require(len(d) <= 20, 'Exact enumeration limited to 20 nonzero differences')
    if not len(d):
        return dict(n_nonzero=0, w_plus=0, w_minus=0, statistic=0, p=1.0, rank_biserial=0.0)
    ranks = np.rint(2 * stats.rankdata(abs(d), method='average')).astype(int)
    plus = int(sum(ranks[d > 0])); total = int(sum(ranks))
    distribution = Counter({0: 1})
    for rank in ranks:
        next_counts = distribution.copy()
        for value, count in distribution.items():
            next_counts[value + int(rank)] += count
        distribution = next_counts
    tails = sum(count for value, count in distribution.items() if value >= plus)
    if alternative == 'two-sided':
        tails = min(tails, sum(count for value, count in distribution.items() if value <= plus)) * 2
    return dict(n_nonzero=len(d), w_plus=plus / 2, w_minus=(total - plus) / 2,
                statistic=(min(plus, total - plus) if alternative == 'two-sided' else plus) / 2,
                p=min(1.0, tails / (2 ** len(d))), rank_biserial=(2 * plus - total) / total)


def describe(values):
    values = np.asarray(values, dtype=float)
    q1, median, q3 = np.quantile(values, [.25, .5, .75], method='linear')
    return dict(n=len(values), mean=float(np.mean(values)), median=float(median),
                q1=float(q1), q3=float(q3), minimum=float(min(values)), maximum=float(max(values)))


def add_marks(rows, documents, path, mode):
    with path.open(newline='') as stream:
        marks = list(csv.DictReader(stream))
    by_id = {m['participant_id']: m for m in marks}
    require(len(by_id) == len(marks) and set(by_id) == {r['participant_id'] for r in rows}, 'Marking IDs must match exports exactly, without duplicates')
    for row in rows:
        m = by_id[row['participant_id']]
        require(m['sequence'] == row['sequence'], 'Marking sequence mismatch')
        for label in ('manual', 'codemap'):
            require(m[f'{label}_repository'] == row[f'{label}_repository'], 'Marking repository mismatch')
            total = int(m[f'{label}_tasks_correct'])
            require(0 <= total <= 4 - row[f'{label}_skipped'], 'Correct total exceeds answered tasks')
            if mode == 'per-task':
                values = [int(m[f'{label}_task{i}_correct']) for i in range(1, 5)]
                require(all(v in (0, 1) for v in values) and sum(values) == total, 'Invalid per-task marks or sum')
                condition = next(c for c in documents[row['participant_id']]['conditions'] if c['condition'] == label)
                require(all(not value or task['completed'] for value, task in zip(values, condition['tasks'])), 'Skipped task marked correct')
            row[f'{label}_tasks_correct'] = total


def analyse(rows, marking_mode):
    require(len(rows) >= 2, 'At least two paired participants required')
    result = {'participant_count': len(rows), 'sequence_counts': dict(Counter(r['sequence'] for r in rows)),
              'methods': {'time': 'sum of all four task durationMs, including skipped attempts; no questionnaire time',
                          'nasa': 'exported one-decimal raw score, checked against all six responses',
                          'quantiles': 'NumPy linear (Hyndman-Fan type 7)',
                          'tests': 'exact conditional sign enumeration of average tied ranks; zero differences removed; H1-H3 two-sided; H4 greater than 68; no multiplicity adjustment',
                          'direction': 'Codemap minus manual; SUS minus 68',
                          'marking': marking_mode,
                          'sus_ci': 'two-sided 95% Student t interval for the mean, df=n-1'},
              'skipped_tasks': {label: sum(r[f'{label}_skipped'] for r in rows) for label in ('manual', 'codemap')},
              'descriptives': {}, 'hypotheses': {}}
    for label, metric in [('H1', 'minutes'), ('H2', 'tasks_correct'), ('H3', 'nasa_raw')]:
        if metric == 'tasks_correct' and marking_mode == 'not supplied':
            result['hypotheses'][label] = {'status': 'not calculated: no marking supplied'}
            continue
        for condition in ('manual', 'codemap'):
            key = f'{condition}_{metric}'
            result['descriptives'][key] = describe([r[key] for r in rows])
        result['hypotheses'][label] = signed_rank([r[f'codemap_{metric}'] - r[f'manual_{metric}'] for r in rows])
    sus = [r['sus_score'] for r in rows]
    result['descriptives']['sus'] = describe(sus)
    radius = float(stats.t.ppf(.975, len(sus) - 1) * stats.sem(sus))
    result['descriptives']['sus']['mean_ci95'] = [float(np.mean(sus) - radius), float(np.mean(sus) + radius)]
    result['hypotheses']['H4'] = signed_rank([s - 68 for s in sus], 'greater')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exports', required=True, type=Path, help='Private directory containing study-*-comparative.json')
    parser.add_argument('--marking', type=Path)
    parser.add_argument('--marking-mode', choices=['per-task', 'reported-totals'], default='per-task')
    parser.add_argument('--marking-source', help='Required provenance description if marking is supplied')
    parser.add_argument('--output', required=True, type=Path, help='Private output directory outside the repository')
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    require(not args.output.resolve().is_relative_to(repo), 'Output must be outside the public repository')
    files = sorted(args.exports.glob('study-*-comparative.json'))
    require(bool(files), 'No participant exports found')
    rows = []; documents = {}
    for path in files:
        row, document = read_export(path)
        require(row['participant_id'] not in documents, 'Duplicate participant ID')
        rows.append(row); documents[row['participant_id']] = document
    require(len({d['coreArtefactCommit'] for d in documents.values()}) == 1, 'Mixed core artefact versions')
    mode = 'not supplied'
    if args.marking:
        require(bool(args.marking_source), '--marking-source is required')
        add_marks(rows, documents, args.marking, args.marking_mode)
        mode = args.marking_mode
    result = analyse(rows, mode)
    result['provenance'] = {'core_artefact_commit': next(iter(documents.values()))['coreArtefactCommit'],
                            'script_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                            'inputs': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in files},
                            'marking_source': args.marking_source,
                            'marking_sha256': hashlib.sha256(args.marking.read_bytes()).hexdigest() if args.marking else None,
                            'numpy': np.__version__, 'scipy': scipy.__version__}
    if mode == 'reported-totals':
        result['limitation'] = 'H2 recalculates supplied aggregate correctness totals; this does not verify the original task-level judgements.'
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / 'participant-summary.json').write_text(json.dumps(result, indent=2, allow_nan=False) + '\n')
    with (args.output / 'participant-measures.csv').open('w', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0])); writer.writeheader(); writer.writerows(rows)
    print(json.dumps({'participants': len(rows), 'marking_mode': mode, 'hypotheses': result['hypotheses']}, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, TypeError) as exc:
        raise SystemExit(f'Invalid study input: {exc}') from exc
