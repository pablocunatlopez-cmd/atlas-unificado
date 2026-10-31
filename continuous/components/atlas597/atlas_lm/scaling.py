"""Predefined ATLAS-LM research scales. Parameter counts are computed, never guessed."""
from .model import AtlasLMConfig,AtlasLM

def config_for(scale:str,vocab_size:int,max_seq_len=1024):
    specs={
      'micro':dict(dim=192,n_layers=4,n_heads=4,n_kv_heads=2,hidden_dim=512),
      'small':dict(dim=384,n_layers=8,n_heads=6,n_kv_heads=2,hidden_dim=1024),
      'medium':dict(dim=640,n_layers=12,n_heads=10,n_kv_heads=2,hidden_dim=1792),
    }
    if scale not in specs: raise ValueError('scale must be '+','.join(specs))
    return AtlasLMConfig(vocab_size=vocab_size,max_seq_len=max_seq_len,version='ATLAS-LM-0.2-'+scale,**specs[scale])

def parameter_count(cfg): return sum(p.numel() for p in AtlasLM(cfg).parameters())
