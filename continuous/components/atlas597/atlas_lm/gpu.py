from __future__ import annotations
from dataclasses import asdict, dataclass
import json, shutil, subprocess

@dataclass
class GPUStatus:
    nvidia_smi: bool
    gpu_name: str | None
    vram_gb: float | None
    driver: str | None
    torch_installed: bool
    torch_version: str | None
    torch_cuda: bool
    torch_cuda_version: str | None
    device: str
    recommended_profile: str
    notes: list[str]


def _nvidia_probe():
    exe=shutil.which('nvidia-smi')
    if not exe: return False,None,None,None
    try:
        p=subprocess.run([exe,'--query-gpu=name,memory.total,driver_version','--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=8)
        if p.returncode!=0 or not p.stdout.strip(): return True,None,None,None
        line=p.stdout.strip().splitlines()[0]
        parts=[x.strip() for x in line.split(',')]
        name=parts[0] if parts else None
        mem=float(parts[1])/1024 if len(parts)>1 else None
        drv=parts[2] if len(parts)>2 else None
        return True,name,mem,drv
    except Exception:
        return True,None,None,None


def probe_gpu() -> GPUStatus:
    smi,name,vram,driver=_nvidia_probe(); notes=[]
    installed=False; version=None; cuda=False; cuda_ver=None
    try:
        import torch
        installed=True; version=str(torch.__version__); cuda=bool(torch.cuda.is_available()); cuda_ver=getattr(torch.version,'cuda',None)
        if cuda:
            try:
                name=torch.cuda.get_device_name(0)
                vram=float(torch.cuda.get_device_properties(0).total_memory/1024**3)
            except Exception: pass
    except Exception as e:
        notes.append('PyTorch no está instalado: '+type(e).__name__)
    if smi and not cuda:
        notes.append('NVIDIA detectada, pero PyTorch no tiene CUDA activa. Instala una build CUDA de PyTorch.')
    if not smi:
        notes.append('nvidia-smi no está disponible en este entorno.')
    if cuda and vram is not None:
        # Conservative research profiles; actual batch is calibrated separately.
        if vram >= 20: profile='large-research'
        elif vram >= 10: profile='medium-12gb'
        elif vram >= 7: profile='small-8gb'
        else: profile='micro-6gb'
    else: profile='cpu-safe'
    return GPUStatus(smi,name,vram,driver,installed,version,cuda,cuda_ver,'cuda' if cuda else 'cpu',profile,notes)


def auto_train_settings(status: GPUStatus | None=None) -> dict:
    s=status or probe_gpu(); v=s.vram_gb or 0
    if s.torch_cuda:
        try:
            from atlas_paths import layout
            calibration=json.loads((layout()['eval']/'gpu_calibration.json').read_text(encoding='utf-8'))
            if calibration['gpu']==s.gpu_name and calibration['torch']==s.torch_version:
                batch=calibration['recommended_batch']
                if type(batch) is int and 1<=batch<=1024 and calibration['profile'] in {'decision','micro','small'}:
                    return {'device':'cuda','profile':s.recommended_profile,'training_profile':calibration['profile'],
                            'seq':calibration['seq'],'batch':batch,'grad_accum':1,'amp':True,
                            'precision':calibration['precision'],'steps':1000,'measured':True,
                            'memory_budget_bytes':calibration['memory_budget_bytes']}
        except (OSError, ValueError, KeyError, TypeError):
            pass
    if s.torch_cuda and v>=10:
        return {'device':'cuda','profile':'medium-12gb','seq':384,'batch':64,'grad_accum':2,'amp':True,'steps':8000}
    if s.torch_cuda and v>=7:
        return {'device':'cuda','profile':'small-8gb','seq':320,'batch':32,'grad_accum':2,'amp':True,'steps':6000}
    if s.torch_cuda:
        return {'device':'cuda','profile':'micro-6gb','seq':256,'batch':16,'grad_accum':4,'amp':True,'steps':4000}
    return {'device':'cpu','profile':'cpu-safe','seq':224,'batch':8,'grad_accum':1,'amp':False,'steps':300}


def as_json() -> str:
    s=probe_gpu(); return json.dumps({'gpu':asdict(s),'train_auto':auto_train_settings(s)},ensure_ascii=False,indent=2)
