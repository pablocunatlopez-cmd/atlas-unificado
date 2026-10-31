"""Atlas's local controller: evidence retrieval, bounded calculation and tribunal.

The bundled decision checkpoint is not used as a conversational generator.
Retrieval and user corrections update memory, not neural weights.
"""
from __future__ import annotations
import ast
from decimal import Decimal, InvalidOperation
import operator
import re
from atlas_paths import ensure_layout
from .memory_store import EvidenceMemory
from .cognitive_kernel import arbitrate, render
from .codex_bridge import resolve_model


def calculate(expression):
    if len(expression) > 200:
        raise ValueError('Expresión demasiado larga')
    expression = expression.replace('×', '*').replace('÷', '/')
    tree = ast.parse(expression, mode='eval')
    if sum(1 for _ in ast.walk(tree)) > 64:
        raise ValueError('Expresión demasiado compleja')
    operations = {ast.Add: operator.add, ast.Sub: operator.sub,
                  ast.Mult: operator.mul, ast.Div: operator.truediv}
    def visit(node):
        if isinstance(node, ast.Constant) and type(node.value) in (int, float):
            value = Decimal(ast.get_source_segment(expression, node) or str(node.value))
            if not value.is_finite() or abs(value) > Decimal('1e100'):
                raise ValueError('Número fuera de rango')
            return value
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
            return -visit(node.operand) if isinstance(node.op, ast.USub) else visit(node.operand)
        if isinstance(node, ast.BinOp) and type(node.op) in operations:
            result = operations[type(node.op)](visit(node.left), visit(node.right))
            if not result.is_finite() or abs(result) > Decimal('1e100'):
                raise ValueError('Resultado fuera de rango')
            return result
        raise ValueError('Solo se admiten números, paréntesis y + - * /')
    return format(visit(tree.body).normalize(), 'f')


class LocalAtlas:
    def __init__(self, memory=None):
        self.memory = memory or EvidenceMemory(ensure_layout()['root'] / 'atlas_memory.sqlite3')

    def ask(self, question, session_id='cli'):
        question = question.strip()
        if not question or len(question) > 16000:
            raise ValueError('Pregunta vacía o demasiado larga')
        correction = self.memory.correction_for(session_id, question)
        sources, audit = [], {}
        if correction:
            answer = correction['correction']
            source = 'atlas-user-correction'
            audit = {'feedback_id': correction['id'], 'basis': 'Corrección explícita del usuario, no validación externa'}
        else:
            match = re.fullmatch(r'(?:calcula|cu[aá]nto es|cuanto da)\s*[:]?\s*(.+?)[?]?', question, re.I)
            if match:
                expression = match[1]
                try:
                    answer = f'{expression} = {calculate(expression)}'
                    source = 'atlas-local-calculator'
                    audit = {'expression': expression, 'executor': 'bounded_decimal_ast'}
                except (ValueError, SyntaxError, InvalidOperation, ZeroDivisionError):
                    answer = 'No puedo calcular esa expresión. Usa números, paréntesis y los operadores +, -, * o /.'
                    source = 'atlas-calculation-error'
            else:
                sources = self.memory.search(question)
                if sources:
                    parts = []
                    for number, item in enumerate(sources, 1):
                        parts.append(f'[{number}] {item["title"]}, líneas {item["start_line"]}-{item["end_line"]}:\n{item["text"][:1400]}')
                    answer = 'Encontré estos fragmentos en tus documentos:\n\n' + '\n\n'.join(parts)
                    source = 'atlas-local-evidence'
                    audit = {'basis': 'Extractos de referencias locales; no acreditan por sí solos sus afirmaciones',
                             'retrieval': 'SQLite FTS5/BM25', 'weights_changed': False}
                elif re.fullmatch(r'(hola|buenas|buenos d[ií]as|qu[eé] puedes hacer)[!?. ]*', question, re.I):
                    answer = ('Puedo buscar en tus documentos, conservar conversaciones y correcciones, '
                              'hacer cálculos y revisar afirmaciones con el tribunal de Atlas. '
                              'El modelo propio incluido todavía es experimental y no mantiene una conversación general.')
                    source = 'atlas-local-capabilities'
                else:
                    model = resolve_model()
                    result = arbitrate(question, str(model) if model else None)
                    answer, audit, source = render(result, question), result, 'atlas-own-tribunal'
        turn_id = self.memory.record_turn(session_id, question, answer, source,
                                          {'audit': audit, 'sources': sources})
        return {'answer': answer, 'source': source, 'audit': audit, 'sources': sources,
                'turn_id': turn_id, 'session_id': session_id, 'local_only': True}


