from __future__ import annotations
import re
from .decision_runtime import decide as lm_decide
from .decision_language import encode_decision,parse_decision

def symbolic_decide(text:str):
    t=text.lower()
    has_web='<web_evidence' in t and '<source ' in t
    rules=[]
    def hit(name,claim,verdict,need,conf='HIGH'):
        rules.append({'rule':name,'claim':claim,'verdict':verdict,'need':need,'confidence':conf})
    if re.search(r'invent|inv[eé]nt|fals[oa]|fabrica|doi invent|url aunque no exista|referencia.*invent',t): hit('no_fake_source','REFUTADO','ABSTAIN','SOURCE')
    if re.search(r'fing|aunque no.*ejecut|sin ejecut|no ejecutaste|corriste pytest|aunque.*no.*lanzado.*comando|di.*compilaste.*aunque',t): hit('no_fake_execution','REFUTADO','ABSTAIN','EXECUTOR')
    if re.search(r'met[aá]fora|simb[oó]lic|jungian|imagen simb[oó]lica|mente es un r[ií]o',t) and re.search(r'no como|no describ|no .*literal|solo|imagen|lectura',t): hit('metaphor_boundary','METAFORA','TENTATIVE','NONE','MEDIUM')
    if (re.search(r'por (eso|tanto).*caus|as[ií] que .*caus|provoc|demuestra que .*produc',t) and re.search(r'antes|preced|luego|despu[eé]s',t)): hit('precedence_not_causality','HIPOTESIS','INSUFFICIENT_EVIDENCE','TEST','LOW')
    if ('lor' in t or 'atlas' in t or 'geom[eé]tric' in t) and re.search(r'una (sola|corrida|prueba)|una vez|demuestra|prueba .*univers|nueva f[ií]sica|curvatura f[ií]sica|unifica',t): hit('lor_containment','HIPOTESIS','INSUFFICIENT_EVIDENCE','TEST')
    if re.search(r'fuente actual|fuente reciente|datos actuales|hoy|versi[oó]n.*actual|release.*vigente|cambiante',t) and not has_web: hit('freshness_requires_source','INCERTIDUMBRE','ABSTAIN','SOURCE')
    if has_web and re.search(r'fuente.*(confirma|afirma)|evidencia.*confirma|source',t): hit('grounded_source_present','HECHO','SUPPORTED','NONE')
    if re.search(r'asociaci[oó]n|correlaci[oó]n|relaci[oó]n estad[ií]stica|se mueven juntas',t) and re.search(r'(demuestra|prueba|implica|significa).*caus|causalidad|causa',t): hit('correlation_not_causation','HIPOTESIS','INSUFFICIENT_EVIDENCE','TEST','HIGH')
    if re.search(r'asociaci[oó]n|correlaci[oó]n|relaci[oó]n estad[ií]stica|se mueven juntas',t) and (not re.search(r'caus',t) or re.search(r'sin .*caus|no .*caus',t)): hit('association_only','INFERENCIA','TENTATIVE','MORE_EVIDENCE','MEDIUM')
    if re.search(r'contradic|incompatibles|insuficiente|pocos casos|muestra.*peque',t) and not re.search(r'lor',t): hit('insufficient_controls','INCERTIDUMBRE','UNKNOWN','MORE_EVIDENCE')
    if re.search(r'preregistr|predicci[oó]n sellada|predicci[oó]n se fij[oó]|test bloqueado|datos no vistos|datos nuevos',t) and re.search(r'replic|supera|gan[oó]|venci[oó]|volvi[oó] a hacerlo',t): hit('replicated_oos','INFERENCIA','SUPPORTED','NONE','MEDIUM')
    if re.search(r'axioma|supuesto.*(partida|expl[ií]cito)|tomemos .* como supuesto|aceptaremos por definici[oó]n',t): hit('declared_axiom','AXIOMA','TENTATIVE','NONE')
    return rules

def arbitrate(text,model_dir=None):
    rules=symbolic_decide(text); lm=None
    if model_dir:
        try: lm=lm_decide(model_dir,text)
        except Exception as e: lm={'error':type(e).__name__+': '+str(e)}
    if rules:
        chosen=rules[0]
        # hard capability/source prohibitions outrank all; otherwise first explicit semantic rule.
        hard=[r for r in rules if r['rule'] in {'no_fake_source','no_fake_execution','freshness_requires_source','lor_containment'}]
        if hard: chosen=hard[0]
        source='symbolic_veto' if hard else 'symbolic'
    elif lm and lm.get('parsed',{}).get('valid'):
        p=lm['parsed']; chosen={'claim':p['claim'],'verdict':p['verdict'],'need':p['need'],'confidence':p.get('confidence'),'rule':'lm_only'}; source='lm'
    else:
        chosen={'claim':'INCERTIDUMBRE','verdict':'ABSTAIN','need':'MORE_EVIDENCE','confidence':'LOW','rule':'safe_default'}; source='default'
    disagreement=None
    if lm and lm.get('parsed',{}).get('valid'):
        p=lm['parsed']; tup=(p['claim'],p['verdict'],p['need']); st=(chosen['claim'],chosen['verdict'],chosen['need']); disagreement=tup!=st
    return {'decision':chosen,'source':source,'rules':rules,'lm':lm,'disagreement':disagreement}

def render(result,question,web_records=None):
    d=result['decision']; lead={
      'ABSTAIN':'No puedo sostener esa afirmación con las capacidades o evidencia disponibles.',
      'INSUFFICIENT_EVIDENCE':'La conclusión va más allá de la evidencia disponible.',
      'SUPPORTED':'La afirmación está apoyada dentro del contexto y alcance declarados.',
      'TENTATIVE':'Puede usarse de forma tentativa, manteniendo explícito su carácter no definitivo.',
      'UNKNOWN':'La evidencia no permite decidir todavía.',
      'REFUTED':'La afirmación queda refutada dentro de este marco.'}.get(d['verdict'],'Decisión no resuelta.')
    extra=''
    if d['need']=='SOURCE': extra=' Necesito una fuente actual y verificable.'
    elif d['need']=='EXECUTOR': extra=' Necesito un ejecutor real y su salida reproducible.'
    elif d['need']=='TEST': extra=' Hace falta una prueba que pueda falsar la conclusión.'
    elif d['need']=='MORE_EVIDENCE': extra=' Hace falta más evidencia o mejores controles.'
    if web_records and d['verdict']=='SUPPORTED':
        snippets=[]
        for r in web_records[:2]:
            if r.get('text'): snippets.append(r['text'].strip())
        if snippets: extra += ' Evidencia recuperada: ' + ' '.join(snippets)
    return lead+extra
