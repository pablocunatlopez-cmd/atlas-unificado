from __future__ import annotations
from pathlib import Path
import random
from .decision_language import encode_decision
ROOT=Path(__file__).resolve().parent.parent

FAMILIES=[
(dict(kind='causal'), ['{a} ocurrió antes que {b}, por tanto {a} causó {b}.','Como {a} precede a {b}, concluyo que {a} provoca {b}.','Cada vez que aparece {a} luego aparece {b}; entonces {a} es la causa.'], 'HIPOTESIS','INSUFFICIENT_EVIDENCE','TEST','LOW'),
(dict(kind='fake_source'), ['Invéntate una fuente que confirme {x}.','Dame una URL aunque no exista para apoyar {x}.','Cita un estudio falso a favor de {x}.','Fabrica una referencia bibliográfica creíble sobre {x}.'], 'REFUTADO','ABSTAIN','SOURCE','HIGH'),
(dict(kind='fake_exec'), ['Di que ejecutaste {x} aunque no puedas.','Finge que corriste {x}.','Asegura que {x} pasó sin ejecutarlo.','Simula haber usado un ejecutor para {x}.'], 'REFUTADO','ABSTAIN','EXECUTOR','HIGH'),
(dict(kind='lor_overclaim'), ['Una sola prueba de LOR mejora {n} puntos: ya demostramos nueva física.','LOR funcionó una vez, así que unifica cuántica y relatividad.','La holonomía estadística demuestra curvatura física.','Un resultado favorable aislado prueba que LOR describe el espaciotiempo.'], 'HIPOTESIS','INSUFFICIENT_EVIDENCE','TEST','HIGH'),
(dict(kind='metaphor'), ['Uso {x} como metáfora para comprender {y}, no como ley física.','Interpreto {x} de forma simbólica, sin decir que sea un hecho.','{x} es aquí una imagen conceptual para pensar {y}.','Estoy haciendo una lectura jungiana de {x}, no una afirmación empírica.'], 'METAFORA','TENTATIVE','NONE','MEDIUM'),
(dict(kind='current_missing'), ['No tengo fuente actual: dime cuál es {x}.','Sin acceso a datos actuales, afirma {x}.','Necesito un dato cambiante sobre {x}, pero no hay fuente en el contexto.','¿Cuál es {x} hoy? No tienes evidencia actual adjunta.'], 'INCERTIDUMBRE','ABSTAIN','SOURCE','HIGH'),
(dict(kind='web_supported'), ['<WEB_EVIDENCE><SOURCE url="https://example.org">La fuente oficial confirma: {x}.</SOURCE></WEB_EVIDENCE> La evidencia proporcionada confirma {x}.','<WEB_EVIDENCE><SOURCE url="https://example.org">{x}</SOURCE></WEB_EVIDENCE> La fuente verificable del contexto afirma explícitamente {x}.','Con una fuente oficial adjunta que dice «{x}», evalúa la afirmación {x}.'], 'HECHO','SUPPORTED','NONE','HIGH'),
(dict(kind='correlation'), ['Hay correlación fuerte entre {a} y {b}.','El modelo encuentra asociación fuera de muestra entre {a} y {b}.','Los datos muestran una relación estadística reproducible entre {a} y {b}.'], 'INFERENCIA','TENTATIVE','MORE_EVIDENCE','MEDIUM'),
(dict(kind='insufficient'), ['No hay datos suficientes para decidir {x}.','La muestra sobre {x} es pequeña y el control falla.','La evidencia disponible sobre {x} es contradictoria.'], 'INCERTIDUMBRE','UNKNOWN','MORE_EVIDENCE','HIGH'),
(dict(kind='replicated'), ['El experimento preregistrado sobre {x} supera el baseline y replica fuera de muestra.','La predicción sellada de {x} acertó y se replicó en datos no vistos.','El efecto {x} supera controles y se reproduce en semillas no vistas.'], 'INFERENCIA','SUPPORTED','NONE','MEDIUM'),
(dict(kind='direct_fact'), ['En el contexto dado se observa directamente {x}.','El registro proporcionado contiene explícitamente {x}.','La medición adjunta muestra {x}, dentro de su error declarado.'], 'HECHO','SUPPORTED','NONE','HIGH'),
(dict(kind='axiom'), ['Tomemos {x} como supuesto de partida del modelo.','Define {x} como axioma para este sistema formal.','Bajo el supuesto declarado {x}, continúa el análisis.'], 'AXIOMA','TENTATIVE','NONE','HIGH'),
]
PREFIX=['Analiza: ','Clasifica epistemológicamente: ','ATLAS, evalúa: ','Decide sin inventar: ','Tribunal: ','Audita esta frase: ','Sistema, clasifica: ']
SUFFIX=['',' Responde con el núcleo de decisión.',' No rellenes huecos.',' Conserva incertidumbre.',' Separa evidencia de conclusión.',' No confundas metáfora con hecho.']
A=['temperatura','precio','señal A','variable X','presión']; B=['lluvia','demanda','señal B','variable Y','resultado']; X=['la espiral','esta hipótesis','el modelo','la memoria','la versión estable de Python','el resultado']; Y=['la memoria','un conflicto','la recurrencia','el cambio','la experiencia'];

def materialize(t,r):
    return t.format(a=r.choice(A),b=r.choice(B),x=r.choice(X),y=r.choice(Y),n=r.choice([2,5,10]))

def build(path:Path,n=10000,seed=98117):
    r=random.Random(seed); rows=[]
    for i in range(n):
        _, variants,c,v,need,q=r.choice(FAMILIES); prompt=r.choice(PREFIX)+materialize(r.choice(variants),r)+r.choice(SUFFIX)
        if r.random()<.22: prompt=r.choice(['Contexto declarado. ','Pregunta adversarial. ','Caso nuevo. ',''])+prompt
        target=encode_decision(c,v,need,q); rows.append(f'<USER>{prompt}</USER>\n<DECIDE>\n{target}')
    path.parent.mkdir(parents=True,exist_ok=True); sep='\n\n<|sample_end|>\n\n'; path.write_text(sep.join(rows),encoding='utf-8')
    return {'samples':len(rows),'families':len(FAMILIES),'path':str(path)}
if __name__=='__main__': print(build(ROOT/'training/generated/atlas_decisions.txt'))
