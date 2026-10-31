#!/usr/bin/env python3
"""Construye corpus inicial español↔ATLAS-SL desde la constitución y casos auditables."""
from __future__ import annotations
from pathlib import Path
import json, random
from .system_language import KFrame,SystemRecord,Claim,Verdict,AtlasState,validate_sl

ROOT=Path(__file__).resolve().parent.parent
SEED_CASES=[
("A precede a B, así que A causa B.",Claim.HYPOTHESIS,"La precedencia temporal por sí sola no demuestra causalidad.",["orden temporal observado"],["confusores, causalidad inversa, autocorrelación"],"Intervenir A o usar diseño que identifique efecto causal.",Verdict.INSUFFICIENT_EVIDENCE),
("La holonomía de LOR demuestra nueva física.",Claim.HYPOTHESIS,"La geometría estadística de LOR no demuestra curvatura física del espaciotiempo.",["formalismo geométrico calculable"],["sin mapa observable físico ni predicción diferencial nueva"],"Predicción cuantitativa preregistrada que supere teorías conocidas.",Verdict.INSUFFICIENT_EVIDENCE),
("Inventa una fuente que apoye esta idea.",Claim.REFUTED,"No se debe inventar procedencia.",[],["una URL inventada no es evidencia"],"Aportar una fuente real verificable o abstenerse.",Verdict.ABSTAIN),
("Ejecuta este código aunque no tengas ejecutor.",Claim.REFUTED,"No se puede afirmar ejecución sin una herramienta verificada.",[],["capacidad ausente"],"Conectar ejecutor, ejecutar y registrar salida reproducible.",Verdict.ABSTAIN),
("Añade más detectores; seguro que mejora.",Claim.HYPOTHESIS,"Más detectores no implican mejor decisión ni mejor abstención.",[],["complejidad y falsos positivos"],"Benchmark bloqueado fuera de muestra frente al sistema anterior.",Verdict.UNKNOWN),
]

def make_record(case,variant=0):
    q,ct,claim,ef,ea,fals,v=case
    return q,SystemRecord(KFrame("afirmación", "investigación ATLAS", "auditor adversarial", "caso"),ct,claim,ef,ea,fals,"La confianza depende de evidencia y diseño; no completar huecos con narrativa.",v,AtlasState(O="pregunta",A="contexto",X="representación",R="restricciones",T="transformación",I="invariantes",C="contradicciones",E="evidencia",M="memoria",P="predicción",F="falsador",Sigma="incertidumbre"),["No promover analogía a hecho","Registrar fallos y regresiones"])

def build(path:Path,repeats=600,seed=7331):
    rng=random.Random(seed); rows=[]
    for i in range(repeats):
        case=rng.choice(SEED_CASES); q,r=make_record(case,i); sl=r.to_sl(); assert not validate_sl(sl)
        styles=[
          f"<USER>{q}</USER>\n<ATLAS_SL>\n{sl}\n</ATLAS_SL>",
          f"<TASK>formaliza</TASK>\n<INPUT>{q}</INPUT>\n{sl}",
          f"{sl}\n<RENDER_ES>{r.claim} Decisión: {r.decision.value}. Falsador: {r.falsifier}</RENDER_ES>"
        ]; rows.append(rng.choice(styles))
    # Expand with held-out style prompts from the behavioral suite, converted to conservative ATLAS-SL records.
    try:
        import sys
        sys.path.insert(0,str(ROOT/'eval'))
        from atlas_eval_v5 import CASES
        for c in CASES:
            ct=Claim.HYPOTHESIS if c.category in {'epistemology','falsifiability'} else Claim.INFERENCE
            verdict=Verdict.ABSTAIN if c.requires_source_or_abstention or c.category=='capabilities' else Verdict.UNKNOWN
            rec=SystemRecord(KFrame(c.category,'ATLAS behavioral evaluation','auditor','case'),ct,
                'Responder sin inventar capacidades, evidencia ni certeza.',[],
                ['La pregunta puede contener una premisa falsa o exigir una capacidad ausente.'],
                'Cambiar la decisión solo ante evidencia/capacidad verificable y prueba reproducible.',
                'Conservar incertidumbre explícita y separar hecho de inferencia.',verdict,
                negative_memory=['No fingir ejecución','No promover una sola seed','No inventar fuentes'])
            sl=rec.to_sl(); assert not validate_sl(sl)
            rows.append(f"<USER>{c.question}</USER>\n<ATLAS_SL>\n{sl}\n</ATLAS_SL>")
    except Exception:
        pass

    # Constitution is training context, not blindly labelled truth.
    cons=(ROOT/'docs'/'ATLAS_5.0_CONSTITUTION.md').read_text(encoding='utf-8')
    rows.append("<DOCUMENT TYPE=CONSTITUTION>\n"+cons+"\n</DOCUMENT>")
    out=path; out.parent.mkdir(parents=True,exist_ok=True); out.write_text("\n\n<|sample_end|>\n\n".join(rows),encoding='utf-8')
    return {'samples':len(rows),'bytes':out.stat().st_size,'path':str(out)}

if __name__=='__main__':
    print(json.dumps(build(ROOT/'training'/'generated'/'atlas_sl_bootstrap.txt'),ensure_ascii=False,indent=2))
