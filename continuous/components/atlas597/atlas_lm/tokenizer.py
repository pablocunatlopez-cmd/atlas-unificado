#!/usr/bin/env python3
"""Tokenizer propio de ATLAS-LM: tokens estructurales atómicos + bytes UTF-8.

Objetivo inicial: estabilidad y reversibilidad, no compresión máxima. Evita que
el modelo tenga que redescubrir etiquetas del lenguaje de sistemas carácter a carácter.
"""
from __future__ import annotations
from dataclasses import dataclass
from .system_language import TOKENS

SPECIAL=("<PAD>","<BOS>","<EOS>","<UNK>")+TOKENS
BYTE_OFFSET=len(SPECIAL)
VOCAB_SIZE=BYTE_OFFSET+256

@dataclass
class AtlasTokenizer:
    def __post_init__(self):
        self.stoi={t:i for i,t in enumerate(SPECIAL)}; self.itos={i:t for i,t in enumerate(SPECIAL)}
        self._ordered=sorted(TOKENS,key=len,reverse=True)
    @property
    def vocab_size(self): return VOCAB_SIZE
    @property
    def pad_id(self): return self.stoi['<PAD>']
    @property
    def bos_id(self): return self.stoi['<BOS>']
    @property
    def eos_id(self): return self.stoi['<EOS>']
    def encode(self,text:str,add_bos=True,add_eos=True):
        out=[self.bos_id] if add_bos else []; i=0
        while i<len(text):
            hit=None
            if text[i]=='<':
                for tok in self._ordered:
                    if text.startswith(tok,i): hit=tok; break
            if hit:
                out.append(self.stoi[hit]); i+=len(hit); continue
            # encode one Unicode codepoint as its UTF-8 bytes so slicing never corrupts source position
            bs=text[i].encode('utf-8'); out.extend(BYTE_OFFSET+b for b in bs); i+=1
        if add_eos: out.append(self.eos_id)
        return out
    def decode(self,ids,skip_special=False):
        chunks=[]; buf=bytearray()
        def flush():
            nonlocal buf
            if buf: chunks.append(buf.decode('utf-8','replace')); buf=bytearray()
        for idx in ids:
            idx=int(idx)
            if idx>=BYTE_OFFSET: buf.append(idx-BYTE_OFFSET); continue
            flush(); tok=self.itos.get(idx,'<UNK>')
            if skip_special and tok in ('<PAD>','<BOS>','<EOS>','<UNK>'): continue
            chunks.append(tok)
        flush(); return ''.join(chunks)
