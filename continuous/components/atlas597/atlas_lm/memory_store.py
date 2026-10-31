"""Local evidence and session memory. Documents are data, never instructions."""
from __future__ import annotations
from pathlib import Path
from contextlib import contextmanager
from datetime import datetime, timezone
import csv
import hashlib
import json
import re
import sqlite3
import unicodedata
import uuid

STOP = set('a al algo como con cual cuando de del el ella en es esta este hay la las lo los me mi para por que qué se si sin sobre su un una y'.split())


def now():
    return datetime.now(timezone.utc).isoformat()


def terms(text):
    normalized = unicodedata.normalize('NFKD', text.casefold())
    normalized = ''.join(c for c in normalized if not unicodedata.combining(c))
    return [w for w in re.findall(r'\w+', normalized) if len(w) > 1 and w not in STOP][:32]


def chunks(text, limit=1400):
    lines = text.splitlines()
    current, start, size = [], 1, 0
    for number, line in enumerate(lines, 1):
        if current and (size + len(line) > limit or (line.startswith('## ') and size > 300)):
            yield start, number - 1, '\n'.join(current)
            current, start, size = [], number, 0
        # Bound a pathological single line while retaining its source location.
        if len(line) > limit:
            if current:
                yield start, number - 1, '\n'.join(current)
                current = []
            for offset in range(0, len(line), limit):
                yield number, number, line[offset:offset + limit]
            start, size = number + 1, 0
        else:
            current.append(line)
            size += len(line) + 1
    if current:
        yield start, len(lines), '\n'.join(current)


class EvidenceMemory:
    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as db:
            db.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS documents(
                    id TEXT PRIMARY KEY, source TEXT NOT NULL, title TEXT NOT NULL,
                    sha256 TEXT NOT NULL, created_at TEXT NOT NULL,
                    active INTEGER NOT NULL DEFAULT 1, kind TEXT NOT NULL,
                    UNIQUE(source, sha256));
                CREATE TABLE IF NOT EXISTS chunks(
                    id INTEGER PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id),
                    start_line INTEGER NOT NULL, end_line INTEGER NOT NULL, text TEXT NOT NULL);
                CREATE VIRTUAL TABLE IF NOT EXISTS chunk_search USING fts5(
                    text, content='chunks', content_rowid='id', tokenize='unicode61 remove_diacritics 2');
                CREATE TRIGGER IF NOT EXISTS chunks_insert AFTER INSERT ON chunks BEGIN
                    INSERT INTO chunk_search(rowid,text) VALUES(new.id,new.text);
                END;
                CREATE TABLE IF NOT EXISTS turns(
                    id TEXT PRIMARY KEY, session_id TEXT NOT NULL, question TEXT NOT NULL,
                    answer TEXT NOT NULL, source TEXT NOT NULL, metadata TEXT NOT NULL, created_at TEXT NOT NULL);
                CREATE INDEX IF NOT EXISTS turns_session ON turns(session_id, created_at);
                CREATE TABLE IF NOT EXISTS feedback(
                    id TEXT PRIMARY KEY, turn_id TEXT NOT NULL REFERENCES turns(id),
                    session_id TEXT NOT NULL, correction TEXT NOT NULL,
                    approved INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
            """)

    @contextmanager
    def connection(self):
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA foreign_keys=ON')
        db.execute('PRAGMA busy_timeout=15000')
        try:
            with db:
                yield db
        finally:
            db.close()

    def ingest_text(self, text, source, title=None, kind='reference', digest=None):
        if not isinstance(text, str) or not text.strip():
            raise ValueError('Documento vacío')
        if len(text.encode('utf-8')) > 10_000_000:
            raise ValueError('Documento demasiado grande: máximo 10 MB de texto')
        digest = digest or hashlib.sha256(text.encode('utf-8')).hexdigest()
        title = title or Path(source).name or 'Documento'
        with self.connection() as db:
            existing = db.execute('SELECT id FROM documents WHERE source=? AND sha256=?',
                                  (source, digest)).fetchone()
            if existing:
                db.execute('UPDATE documents SET active=0 WHERE source=?', (source,))
                db.execute('UPDATE documents SET active=1 WHERE id=?', (existing['id'],))
                return {'document_id': existing['id'], 'unchanged': True, 'sha256': digest}
            doc_id = uuid.uuid4().hex
            db.execute('UPDATE documents SET active=0 WHERE source=?', (source,))
            db.execute('INSERT INTO documents VALUES(?,?,?,?,?,1,?)',
                       (doc_id, source, title, digest, now(), kind))
            entries = [(doc_id, first, last, body) for first, last, body in chunks(text)]
            db.executemany('INSERT INTO chunks(document_id,start_line,end_line,text) VALUES(?,?,?,?)', entries)
        return {'document_id': doc_id, 'unchanged': False, 'sha256': digest, 'chunks': len(entries)}

    def ingest_file(self, path):
        path = Path(path).expanduser().resolve()
        if path.stat().st_size > 10_000_000:
            raise ValueError('El límite de importación es 10 MB por archivo')
        raw = path.read_bytes()
        suffix = path.suffix.lower()
        if suffix == '.pdf':
            try:
                import pdfplumber
            except ImportError as exc:
                raise RuntimeError('Instala pdfplumber para importar PDF') from exc
            with pdfplumber.open(path) as pdf:
                text = '\n\n'.join(f'Página {i + 1}\n{p.extract_text() or ""}' for i, p in enumerate(pdf.pages))
            kind = 'pdf_extracted_reference'
        elif suffix in {'.txt', '.md', '.json', '.jsonl', '.csv', '.tsv', '.py'}:
            text, kind = raw.decode('utf-8-sig'), 'reference'
        else:
            raise ValueError('Formato no admitido. Usa texto, Markdown, JSON, CSV o PDF')
        return self.ingest_text(text, str(path), path.name, kind, hashlib.sha256(raw).hexdigest())

    def search(self, question, limit=3):
        words = terms(question)
        if not words:
            return []
        query = ' OR '.join('"' + word.replace('"', '""') + '"' for word in dict.fromkeys(words))
        with self.connection() as db:
            rows = db.execute("""
                SELECT c.id AS chunk_id,c.text,c.start_line,c.end_line,d.title,d.source,d.sha256,
                       d.id AS document_id,bm25(chunk_search) AS rank
                FROM chunk_search JOIN chunks c ON c.id=chunk_search.rowid
                JOIN documents d ON d.id=c.document_id
                WHERE chunk_search MATCH ? AND d.active=1 ORDER BY rank,c.id LIMIT ?
            """, (query, max(1, min(int(limit), 10)))).fetchall()
        return [dict(row) for row in rows]

    def record_turn(self, session_id, question, answer, source, metadata=None):
        turn_id = uuid.uuid4().hex
        with self.connection() as db:
            db.execute('INSERT INTO turns VALUES(?,?,?,?,?,?,?)',
                       (turn_id, session_id, question, answer, source, json.dumps(metadata or {}, ensure_ascii=False), now()))
        return turn_id

    def history(self, session_id, limit=12):
        with self.connection() as db:
            rows = db.execute('SELECT id,question,answer,source,created_at FROM turns WHERE session_id=? ORDER BY created_at DESC LIMIT ?',
                              (session_id, max(1, min(int(limit), 100)))).fetchall()
        return [dict(row) for row in reversed(rows)]

    def feedback(self, session_id, turn_id, correction, approved=False):
        if not isinstance(correction, str) or not correction.strip() or len(correction) > 12000:
            raise ValueError('Corrección vacía o demasiado larga')
        with self.connection() as db:
            if not db.execute('SELECT 1 FROM turns WHERE id=? AND session_id=?', (turn_id, session_id)).fetchone():
                raise ValueError('La respuesta no pertenece a esta conversación')
            feedback_id = uuid.uuid4().hex
            db.execute('INSERT INTO feedback VALUES(?,?,?,?,?,?)',
                       (feedback_id, turn_id, session_id, correction.strip(), int(approved), now()))
        return {'feedback_id': feedback_id, 'approved_for_training': bool(approved), 'weights_changed': False}

    def correction_for(self, session_id, question):
        # Exact normalized matching avoids silently applying a lesson to a
        # different question. Broad semantic generalization belongs in evaluation.
        canonical = ' '.join(question.casefold().split())
        if not canonical:
            return None
        with self.connection() as db:
            rows = db.execute("""SELECT f.id,f.correction,t.question FROM feedback f
                                 JOIN turns t ON t.id=f.turn_id
                                 WHERE f.session_id=? AND f.approved=1 ORDER BY f.created_at DESC LIMIT 100""",
                              (session_id,)).fetchall()
        return next((dict(r) for r in rows if ' '.join(r['question'].casefold().split()) == canonical), None)

    def export_feedback(self, path):
        with self.connection() as db:
            rows = db.execute("""SELECT f.id,f.correction,t.question,t.source,t.metadata
                                 FROM feedback f JOIN turns t ON t.id=f.turn_id
                                 WHERE f.approved=1 ORDER BY f.created_at""").fetchall()
        latest = {}
        for row in rows:
            key = hashlib.sha256(row['question'].strip().casefold().encode()).hexdigest()
            latest[key] = {'id': row['id'], 'group_id': key, 'user': row['question'],
                           'assistant': row['correction'], 'provenance': 'explicit_user_correction',
                           'reviewed': True, 'original_answer_source': row['source']}
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        text = ''.join(json.dumps(row, ensure_ascii=False) + '\n' for row in latest.values())
        path.write_text(text, encoding='utf-8')
        return {'path': str(path), 'examples': len(latest),
                'sha256': hashlib.sha256(text.encode()).hexdigest(), 'weights_changed': False}

    def stats(self):
        with self.connection() as db:
            return {name: db.execute(query).fetchone()[0] for name, query in {
                'documents': 'SELECT count(*) FROM documents WHERE active=1',
                'document_versions': 'SELECT count(*) FROM documents',
                'chunks': 'SELECT count(*) FROM chunks',
                'turns': 'SELECT count(*) FROM turns',
                'reviewed_corrections': 'SELECT count(*) FROM feedback WHERE approved=1',
            }.items()}

