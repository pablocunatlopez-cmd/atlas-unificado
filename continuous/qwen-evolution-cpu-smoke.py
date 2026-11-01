"""CPU-only random tiny architecture fixture, never the real Qwen checkpoint."""
import argparse
import json
import os
from pathlib import Path

os.environ["CUDA_VISIBLE_DEVICES"] = ""
os.environ["OMP_NUM_THREADS"] = "2"
os.environ["MKL_NUM_THREADS"] = "2"

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    args = parser.parse_args()
    root = Path(args.root).resolve()
    import torch
    from transformers import Qwen3_5Config, Qwen3_5ForConditionalGeneration
    from peft import LoraConfig, get_peft_model
    torch.set_num_threads(2)
    torch.manual_seed(731)
    text = {"vocab_size": 128, "hidden_size": 64, "intermediate_size": 128, "num_hidden_layers": 2, "num_attention_heads": 4, "num_key_value_heads": 2, "head_dim": 16, "linear_conv_kernel_dim": 4, "linear_num_key_heads": 2, "linear_num_value_heads": 4, "linear_key_head_dim": 16, "linear_value_head_dim": 16, "layer_types": ["linear_attention", "full_attention"], "full_attention_interval": 2, "eos_token_id": 1, "pad_token_id": 0, "use_cache": False, "max_position_embeddings": 128, "rope_parameters": {"rope_type": "default", "rope_theta": 10000, "partial_rotary_factor": 0.25, "mrope_section": [1, 1, 0], "mrope_interleaved": True}, "mtp_num_hidden_layers": 1}
    vision = {"depth": 1, "hidden_size": 32, "intermediate_size": 64, "num_heads": 2, "out_hidden_size": 64, "num_position_embeddings": 16, "patch_size": 16, "spatial_merge_size": 2, "temporal_patch_size": 2, "deepstack_visual_indexes": []}
    model = Qwen3_5ForConditionalGeneration(Qwen3_5Config(text_config=text, vision_config=vision, image_token_id=124, video_token_id=125, vision_start_token_id=126, vision_end_token_id=127))
    fixture = root / "cpu-fixture"
    base = fixture / "base"
    base.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(base, safe_serialization=True)
    model.requires_grad_(False)
    adapted = get_peft_model(model, LoraConfig(r=4, lora_alpha=8, target_modules=["up_proj", "down_proj"], task_type="CAUSAL_LM", bias="none"))
    trainable = [(name, parameter) for name, parameter in adapted.named_parameters() if parameter.requires_grad]
    assert trainable and all("lora_" in name and ".mlp." in name for name, _ in trainable)
    adapted.enable_input_require_grads()
    adapted.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})
    before = {name: parameter.detach().clone() for name, parameter in trainable}
    optimizer = torch.optim.AdamW([parameter for _, parameter in trainable], lr=0.001)
    tokens = torch.randint(3, 120, (1, 12))
    loss = adapted(input_ids=tokens, labels=tokens, use_cache=False).loss
    loss.backward()
    optimizer.step()
    changed = [name for name, parameter in trainable if not torch.equal(before[name], parameter.detach())]
    assert changed, 'No parameter changed after the CPU backward.'
    assert all(parameter.device.type == 'cpu' for parameter in adapted.parameters()), 'Fixture left CPU.'
    adapter = fixture / "adapter"
    adapted.save_pretrained(adapter, safe_serialization=True, save_embedding_layers=False)
    result = {"fixture": "random-small-Qwen3_5ForConditionalGeneration", "realQwenWeightsLoaded": False, "realQwenWeightsChanged": False, "cudaInitialized": torch.cuda.is_initialized(), "layers": text["layer_types"], "loss": float(loss.detach()), "trainableParameters": sum(parameter.numel() for _, parameter in trainable), "adapterParametersChanged": changed, "conversionVerified": False, "scope": "Comprueba imports, forma del modelo híbrido, backward y guardado PEFT con pesos aleatorios diminutos en CPU; no acredita memoria ni entrenamiento de Qwen9B."}
    (root / "cpu-adapter-proof.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    main()
