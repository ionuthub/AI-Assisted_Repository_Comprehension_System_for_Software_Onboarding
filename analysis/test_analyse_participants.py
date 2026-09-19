import unittest
from scipy import stats
import numpy as np
from analyse_participants import signed_rank, describe, add_marks
from pathlib import Path
from tempfile import TemporaryDirectory


class AnalysisTests(unittest.TestCase):
    def test_published_wilcoxon_example(self):
        result = signed_rank([6, 8, 14, 16, 23, 24, 28, 29, 41, -48, 49, 56, 60, -67, 75])
        self.assertEqual(result['statistic'], 24)
        self.assertEqual(result['p'], 0.041259765625)

    def test_ties_and_zeros_against_exhaustive_scipy(self):
        d = np.array([0, 1, 1, -2, 3, 3, -3, 4], dtype=float)
        for alternative in ('two-sided', 'greater'):
            reference = stats.wilcoxon(d, alternative=alternative, method=stats.PermutationMethod(n_resamples=np.inf))
            actual = signed_rank(d, alternative)
            self.assertEqual(actual['statistic'], reference.statistic)
            self.assertEqual(actual['p'], reference.pvalue)

    def test_no_difference_and_direction(self):
        self.assertEqual(signed_rank([0, 0])['p'], 1)
        self.assertEqual(signed_rank([-1, -1, -2])['rank_biserial'], -1)
        self.assertEqual(signed_rank([1, 1, 2], 'greater')['p'], .125)

    def test_quantile_convention(self):
        self.assertEqual(describe([0, 1, 2, 3])['q1'], .75)

    def test_rejects_correct_mark_on_skipped_task(self):
        with TemporaryDirectory() as folder:
            path = Path(folder) / 'marks.csv'
            path.write_text('participant_id,sequence,manual_repository,manual_tasks_correct,manual_task1_correct,manual_task2_correct,manual_task3_correct,manual_task4_correct\nP01,A,fixture,1,1,0,0,0\n')
            rows = [dict(participant_id='P01', sequence='A', manual_repository='fixture', manual_skipped=1)]
            documents = {'P01': {'conditions': [{'condition': 'manual', 'tasks': [{'completed': x} for x in [False, True, True, True]]}]}}
            with self.assertRaisesRegex(ValueError, 'Skipped task marked correct'):
                add_marks(rows, documents, path, 'per-task')


if __name__ == '__main__':
    unittest.main()
