#!/usr/bin/env python3
"""ATLAS 5.3-dev — deliberación estructurada sin LLM.

No sustituye a un modelo lingüístico. Expone estado, deuda técnica y próximos
experimentos a partir de artefactos reales, capacidades y memoria negativa.
"""
from __future__ import annotations
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any
import json, re

@dataclass
class CoreFinding:
    priority:int; kind:str; statement:str; evidence:list[str]; falsifier:str; action:str

class OfflineDeliberator:
    def __init__(self,root:Path,capability,ledger): self.root=Path(root); self.capability=capability; self.ledger=ledger

    def _count_tests(self)->int:
        total=0
        for p in self.root.rglob('test_*.py'):
            try: total += len(re.findall(r'^\s*def\s+test_',p.read_text(encoding='utf-8',errors='ignore'),re.M))
            except OSError: pass
        return total

    def _jsonl_count(self,p:Path)->int:
        try: return sum(1 for x in p.read_text(encoding='utf-8').splitlines() if x.strip())
        except OSError: return 0

    def _eval_case_count(self)->int:
        try:
            txt=(self.root/'eval'/'atlas_eval_v5.py').read_text(encoding='utf-8')
            return txt.count('EvalCase(')
        except OSError: return 0

    def _lor_robustness(self)->dict[str,Any]:
        p=self.root/'eval'/'LOR_ROBUSTNESS_10_SEEDS_2026-09-03.json'
        try: return json.loads(p.read_text(encoding='utf-8'))
        except Exception: return {}

    def inventory(self)->dict[str,Any]:
        py=list(self.root.rglob('*.py'))
        return {
          'python_files':len(py),'test_cases':self._count_tests(),'eval_cases':self._eval_case_count(),
          'training_examples':self._jsonl_count(self.root/'training'/'sombra_examples.jsonl'),
          'negative_memory_entries':len(self.ledger.data.get('negative_memory',[])),
          'has_constitution':(self.root/'docs'/'ATLAS_5.0_CONSTITUTION.md').is_file(),
          'has_lor_protocol':(self.root/'lor'/'lor_evaluation_protocol.py').is_file(),
          'has_discrete_holonomy':(self.root/'lor'/'discrete_holonomy.py').is_file(),
          'has_ab_benchmark':(self.root/'eval'/'atlas_benchmark_v5.py').is_file(),
          'has_legacy_4_3':(self.root/'legacy_4_3').is_dir(),
        }

    def findings(self)->list[CoreFinding]:
        inv=self.inventory(); out=[]
        if not self.capability.has_language_model:
            out.append(CoreFinding(100,'CAPABILITY_GAP','No hay backend lingüístico verificado; el núcleo puede auditar y ejecutar pruebas, pero no mantener diálogo generativo autónomo.',[f'provider={self.capability.provider.value}',f'model={self.capability.model_name or "none"}',f'verified={self.capability.verified}',f'eval_cases={inv["eval_cases"]}'],'Conectar el mismo modelo a rama directa y rama ATLAS y medir al menos 24 casos sin inventar capacidades.','Conectar un 7B/8B local real y ejecutar `python atlas.py benchmark` antes de fine-tuning.'))
        if inv['has_lor_protocol']:
            rr=self._lor_robustness()
            evidence=['Existe lor/discrete_holonomy.py y el protocolo distingue geometría de datos de física.']
            statement='LOR/holonomía sigue sin demostrar ventaja robusta frente a baselines.'
            if rr:
                evidence += [f"10-seed verdict={rr.get('verdict')}",f"delta_median={rr.get('delta_median')}",f"fraction_harm={rr.get('fraction_harm')}",f"negative_control_bad={rr.get('fraction_negative_control_bad')}"]
                statement=f"El último barrido multisemilla clasifica LOR como {rr.get('verdict')}; la mediana de mejora no justifica promoción epistemológica."
            out.append(CoreFinding(90,'EPISTEMIC_DEBT',statement,evidence,'Si no supera baselines fuertes, múltiples seeds, controles de reparametrización y datos reales preregistrados, mantener REDUNDANT/INSUFFICIENT_EVIDENCE o refutar para esa tarea.','Añadir baselines más fuertes y evaluación externa; no optimizar para rescatar LOR.'))
        if inv['training_examples']<100:
            out.append(CoreFinding(72,'TRAINING_GAP',f"Linaje Sombra tiene {inv['training_examples']} ejemplos; sirve para infraestructura, no para fine-tuning serio.",[f"training_examples={inv['training_examples']}"],'Si ampliar ejemplos no mejora un benchmark ciego A/B, el dataset no aporta valor.','Generar ejemplos a partir de fallos reales y mantener un split de evaluación que nunca entre al entrenamiento.'))
        if inv['eval_cases']<40:
            out.append(CoreFinding(68,'EVAL_GAP',f"La suite conductual tiene {inv['eval_cases']} casos; ya permite A/B pero todavía es pequeña para conclusiones fuertes.",[f"test_cases={inv['test_cases']}",f"eval_cases={inv['eval_cases']}"],'Si pequeñas reformulaciones de los prompts cambian mucho el score, la suite está sobreajustada.','Crear paraphrase/adversarial sets y un conjunto ciego congelado de 40+ casos.'))
        if inv['negative_memory_entries']<12:
            out.append(CoreFinding(60,'MEMORY_GAP','La memoria negativa aún es corta para guiar auto-mejora prolongada.',[f"negative_memory_entries={inv['negative_memory_entries']}"],'Si añadir fallos estructurados no reduce reincidencia en evaluación, la memoria no aporta valor.','Registrar fallos de proveedor, JSON, benchmarks y experimentos con contexto reproducible.'))
        out.sort(key=lambda x:-x.priority); return out

    def consult(self,question:str)->dict[str,Any]:
        q=question.lower(); fs=self.findings()
        if any(k in q for k in ('necesit','mejor','siguiente','ayud','prioridad')): selected=fs[:5]
        elif any(k in q for k in ('lor','holonom','curvatura','conex')): selected=[f for f in fs if f.kind=='EPISTEMIC_DEBT'] or fs[:2]
        elif any(k in q for k in ('modelo','hablar','llm','qwen','ollama')): selected=[f for f in fs if f.kind=='CAPABILITY_GAP'] or fs[:2]
        else: selected=fs[:3]
        return {'mode':'OFFLINE_CORE_DELIBERATION','warning':'Esto es deliberación estructurada del núcleo, no una respuesta de un LLM ni conciencia.','question':question,'capability':self.capability.to_dict(),'inventory':self.inventory(),'findings':[asdict(f) for f in selected],'decision':selected[0].action if selected else 'No hay acción prioritaria derivable.'}
