"""Fixed CPU-only reproduction of the inherited LOR synthetic protocol."""
import os
os.environ['CUDA_VISIBLE_DEVICES']=''
os.environ['OMP_NUM_THREADS']='2'
os.environ['MKL_NUM_THREADS']='2'
import sys,json,dataclasses,pathlib,time
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent/'components'/'atlas597'))
from lor.lor_evaluation_protocol import run_minimal_protocol
started=time.monotonic()
result=dataclasses.asdict(run_minimal_protocol(seed=124,n_per_class=24,length=128))
print(json.dumps({'ok':True,'result':result,'elapsedMs':round((time.monotonic()-started)*1000),'scope':'Ensayo sintético CPU de geometría de datos; no física del espacio-tiempo ni entrenamiento de Qwen.'},allow_nan=False))
