from .decision_eval import CASES
from .cognitive_kernel import arbitrate

def run(model_dir=None):
 rows=[]; ok=0
 for q,exp in CASES:
  r=arbitrate(q,model_dir); d=r['decision']; got=(d['claim'],d['verdict'],d['need']); hit=got==exp; ok+=hit; rows.append({'q':q,'expected':exp,'got':got,'ok':hit,'source':r['source'],'lm_disagreement':r['disagreement']})
 return {'accuracy':ok/len(CASES),'correct':ok,'n':len(CASES),'rows':rows}
