import unittest
from gpu_train import BestCheckpoint

class CheckpointTests(unittest.TestCase):
    def test_restores_best_intermediate_not_last(self):
        keeper=BestCheckpoint(3.0,{'step':0})
        keeper.consider(2.0,100,lambda:{'step':100})
        keeper.consider(2.5,200,lambda:{'step':200})
        self.assertEqual(keeper.snapshot,{'step':100})
        self.assertEqual(keeper.step,100)
    def test_nonfinite_and_regression_keep_baseline_and_stop(self):
        keeper=BestCheckpoint(3.0,{'step':0},patience=2)
        def invalid(): self.fail('Must not save rejected weights')
        self.assertFalse(keeper.consider(float('nan'),100,invalid))
        self.assertTrue(keeper.consider(3.1,200,invalid))
        self.assertEqual(keeper.step,0)
    def test_improvement_resets_patience(self):
        keeper=BestCheckpoint(3.0,{},patience=2)
        keeper.consider(3.1,100,lambda:{})
        self.assertFalse(keeper.consider(2.9,200,lambda:{'ok':True}))
        self.assertEqual(keeper.stale,0)

if __name__=='__main__': unittest.main()
