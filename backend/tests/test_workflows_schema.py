import json
import os
from pathlib import Path
import pytest

WORKFLOWS_DIR = Path(__file__).resolve().parent.parent.parent / "workflows"
BENCHMARKS_DIR = Path(__file__).resolve().parent.parent.parent / "benchmarks" / "scenes"


def _validate_comfy_api_graph(graph: dict):
    assert isinstance(graph, dict), "Workflow API format must be a dictionary of nodes"
    assert len(graph) > 0, "Workflow graph must not be empty"

    for node_id, node_data in graph.items():
        assert isinstance(node_id, str), f"Node ID {node_id} must be a string"
        assert isinstance(node_data, dict), f"Node {node_id} must be a dictionary"
        assert "class_type" in node_data, f"Node {node_id} missing 'class_type'"
        assert isinstance(node_data["class_type"], str), f"Node {node_id} 'class_type' must be string"
        assert "inputs" in node_data, f"Node {node_id} missing 'inputs'"
        assert isinstance(node_data["inputs"], dict), f"Node {node_id} 'inputs' must be dict"

        # Validate input connections [target_node_id, output_index]
        for input_name, input_val in node_data["inputs"].items():
            if isinstance(input_val, list) and len(input_val) == 2 and isinstance(input_val[0], str) and isinstance(input_val[1], int):
                target_id, slot_idx = input_val
                assert target_id in graph, f"Node {node_id} references non-existent node {target_id} in input {input_name}"
                assert slot_idx >= 0, f"Node {node_id} connection to {target_id} has negative slot {slot_idx}"


def test_qwen_image_2_1_edit_schema():
    workflow_path = WORKFLOWS_DIR / "qwen-image-2-1-edit.json"
    assert workflow_path.exists(), f"File {workflow_path} not found"

    with open(workflow_path, "r", encoding="utf-8") as f:
        graph = json.load(f)

    _validate_comfy_api_graph(graph)

    # Class types inventory
    class_types = [node["class_type"] for node in graph.values()]

    expected_nodes = [
        "UNETLoader",
        "CLIPLoader",
        "VAELoader",
        "LoraLoaderModelOnly",
        "LoadImage",
        "TextEncodeQwenImage21",
        "KSampler",
        "VAEDecode",
        "SaveImage",
    ]

    for expected in expected_nodes:
        assert expected in class_types, f"Expected node '{expected}' not found in Qwen workflow"

    # Specific parameter validations
    unet_node = next(n for n in graph.values() if n["class_type"] == "UNETLoader")
    assert unet_node["inputs"]["unet_name"] == "qwen_image_2.1_int8_convrot.safetensors"

    clip_node = next(n for n in graph.values() if n["class_type"] == "CLIPLoader")
    assert clip_node["inputs"]["clip_name"] == "qwen3.5_9b_qwen_image_2.1_pe_i2i.int8_convrot.safetensors"

    vae_node = next(n for n in graph.values() if n["class_type"] == "VAELoader")
    assert vae_node["inputs"]["vae_name"] == "qwen_image_2.1_vae_bf16.safetensors"

    lora_node = next(n for n in graph.values() if n["class_type"] == "LoraLoaderModelOnly")
    assert lora_node["inputs"]["lora_name"] == "Qwen-Image-Lightning-4steps-V1.0.safetensors"
    assert lora_node["inputs"]["strength_model"] == 1.0

    encode_node = next(n for n in graph.values() if n["class_type"] == "TextEncodeQwenImage21")
    assert "prompt" in encode_node["inputs"]
    assert "image_1" in encode_node["inputs"]
    assert "resolution" in encode_node["inputs"]

    ksampler_node = next(n for n in graph.values() if n["class_type"] == "KSampler")
    assert ksampler_node["inputs"]["steps"] == 4
    assert ksampler_node["inputs"]["cfg"] == 1.0
    assert ksampler_node["inputs"]["sampler_name"] == "euler"
    assert ksampler_node["inputs"]["scheduler"] == "simple"
    assert ksampler_node["inputs"]["denoise"] == 0.75


def test_moss_image_layout_schema():
    workflow_path = WORKFLOWS_DIR / "moss-image-layout.json"
    assert workflow_path.exists(), f"File {workflow_path} not found"

    with open(workflow_path, "r", encoding="utf-8") as f:
        graph = json.load(f)

    _validate_comfy_api_graph(graph)

    class_types = [node["class_type"] for node in graph.values()]

    # Validate essential nodes (allowing canonical ComfyUI names)
    assert any(c in class_types for c in ["MOSSImageHFDiTLoader", "MossImageModelLoader", "MOSSImageHFLoader"]), "Missing MOSS model loader"
    assert any(c in class_types for c in ["MOSSImageCLIPLoader", "MossImageTextEncoderLoader"]), "Missing MOSS text encoder loader"
    assert any(c in class_types for c in ["VAELoader", "MOSSImageHFVAELoader"]), "Missing VAE loader"
    assert "ModelSamplingSD3" in class_types, "Missing ModelSamplingSD3"
    assert "SkipLayerGuidanceDiTSimple" in class_types, "Missing SkipLayerGuidanceDiTSimple"
    assert any(c in class_types for c in ["CLIPTextEncode", "MossImageTextEncode"]), "Missing Layout text encode"
    assert "KSampler" in class_types, "Missing KSampler"
    assert "VAEDecode" in class_types, "Missing VAEDecode"
    assert "SaveImage" in class_types, "Missing SaveImage"

    # Specific parameter validations
    shift_node = next(n for n in graph.values() if n["class_type"] == "ModelSamplingSD3")
    assert shift_node["inputs"]["shift"] == 5.0

    slg_node = next(n for n in graph.values() if n["class_type"] == "SkipLayerGuidanceDiTSimple")
    assert slg_node["inputs"]["single_layers"] == "22"

    ksampler_node = next(n for n in graph.values() if n["class_type"] == "KSampler")
    assert ksampler_node["inputs"]["steps"] == 50
    assert ksampler_node["inputs"]["cfg"] == 3.0
    assert ksampler_node["inputs"]["sampler_name"] == "euler"
    assert ksampler_node["inputs"]["scheduler"] == "sgm_uniform"
    assert ksampler_node["inputs"]["denoise"] == 1.0


def test_compiled_scene_payloads():
    scenes = ["scene_a_product_compiled.json", "scene_b_portrait_compiled.json", "scene_c_occlusion_compiled.json"]
    for scene_file in scenes:
        file_path = BENCHMARKS_DIR / scene_file
        assert file_path.exists(), f"Compiled scene {scene_file} not found"

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        assert "summary" in data
        assert "caption" in data["summary"]
        assert len(data["summary"]["caption"]) > 10

        assert "items" in data
        assert isinstance(data["items"], list) and len(data["items"]) >= 3

        assert data.get("bbox_coord_space") == "abs_centralized"
        assert data.get("bbox_format") == "yxyx"

        for idx, item in enumerate(data["items"]):
            assert "label" in item and item["label"] in ["object", "character", "text"]
            assert "caption" in item and len(item["caption"]) > 0
            assert "bbox" in item and len(item["bbox"]) == 4

            y_min, x_min, y_max, x_max = item["bbox"]
            assert isinstance(y_min, int) and isinstance(x_min, int) and isinstance(y_max, int) and isinstance(x_max, int)
            assert y_min < y_max, f"Item {idx} has invalid vertical coordinates: {y_min} >= {y_max}"
            assert x_min < x_max, f"Item {idx} has invalid horizontal coordinates: {x_min} >= {x_max}"

            if item["label"] == "text":
                assert "text" in item and len(item["text"].strip()) > 0
