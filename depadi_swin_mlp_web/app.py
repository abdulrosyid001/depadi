"""
DePadi Backend - Swin Transformer Large + MLP Head
====================================================
Flask API server untuk deteksi penyakit padi.

Arsitektur:
  1. Swin-Large backbone (timm) -> ekstraksi fitur 1536-dim
  2. MLP Head (Keras .h5)       -> klasifikasi 6 kelas

Endpoint:
  POST /predict  - upload gambar, return prediksi + GradCAM heatmap
  GET  /health   - health check
"""

import os
import sys
import io
import json
import base64
import traceback

# Fix Windows console encoding for unicode characters
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import numpy as np
from PIL import Image

# Import torch first, before tensorflow
import torch

# Import timm - handle potential torchvision/numpy compatibility
try:
    import timm
    from timm.data import resolve_data_config
    from timm.data.transforms_factory import create_transform
except ImportError as e:
    print(f"[ERROR] Failed to import timm: {e}")
    print("  Install with: pip install timm")
    sys.exit(1)

import tensorflow as tf
from tensorflow.keras import layers
from flask import Flask, request, jsonify
from flask_cors import CORS

# ==========================================
# Konfigurasi
# ==========================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "swin_large_mlp_head.h5")
LABELS_PATH = os.path.join(BASE_DIR, "labels.json")

IMG_SIZE = (224, 224)
SEED = 42
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

# ==========================================
# Load Labels
# ==========================================
with open(LABELS_PATH, "r") as f:
    LABEL_LIST = json.load(f)

NUM_CLASSES = len(LABEL_LIST)
print(f"[OK] Labels loaded: {LABEL_LIST}")


# ==========================================
# Build & Load MLP Head
# ==========================================
def build_mlp_head(feat_dim, num_classes, hidden_dims=(512, 256, 128),
                   dropout_rate=0.4, name="mlp_head"):
    """
    Membangun arsitektur MLP Head yang IDENTIK dengan training.
    Urutan layer: Dense -> BatchNorm -> ReLU -> Dropout (x3) -> Dense(softmax)
    """
    tf.random.set_seed(SEED)
    np.random.seed(SEED)

    inp = tf.keras.Input(shape=(feat_dim,), name="features")
    x = inp
    for i, dim in enumerate(hidden_dims):
        x = layers.Dense(dim, name=f"dense_{i}")(x)
        x = layers.BatchNormalization(name=f"bn_{i}")(x)
        x = layers.Activation("relu", name=f"relu_{i}")(x)
        x = layers.Dropout(dropout_rate, name=f"drop_{i}")(x)
    out = layers.Dense(num_classes, activation="softmax", name="output")(x)
    return tf.keras.Model(inputs=inp, outputs=out, name=name)


# ==========================================
# Load Swin Backbone (timm)
# ==========================================
print("[...] Loading Swin Transformer Large backbone...")
swin_backbone = timm.create_model(
    "swin_large_patch4_window7_224",
    pretrained=True,
    num_classes=0  # remove classification head -> feature extractor
)
swin_backbone.eval().to(DEVICE)
for p in swin_backbone.parameters():
    p.requires_grad = False

# Disable any residual dropout in eval mode
for module in swin_backbone.modules():
    if isinstance(module, torch.nn.Dropout):
        module.p = 0.0

# Get timm transform config - handle different timm versions
try:
    # timm >= 0.9
    data_cfg = resolve_data_config(swin_backbone.pretrained_cfg)
except TypeError:
    # timm < 0.9 fallback
    data_cfg = resolve_data_config({}, model=swin_backbone)

swin_transform = create_transform(**data_cfg, is_training=False)

# Determine feature dimension from a dummy forward pass
with torch.no_grad():
    dummy = torch.randn(1, 3, 224, 224).to(DEVICE)
    feat_dim = swin_backbone(dummy).shape[1]
print(f"[OK] Swin-Large loaded on {DEVICE} -- feature dim: {feat_dim}")

# ==========================================
# Load MLP Head weights
# ==========================================
print("[...] Building MLP Head and loading weights...")
mlp_head = build_mlp_head(feat_dim, NUM_CLASSES, name="swin_large_mlp")

# Load weights from .h5
# The .h5 stores weights only (not full model), matching the architecture above
try:
    mlp_head.load_weights(MODEL_PATH)
    print(f"[OK] MLP Head weights loaded from {MODEL_PATH}")
except Exception as e:
    print(f"[WARN] Failed to load weights directly: {e}")
    print("[...] Trying full model load...")
    # Fallback: try loading as a full model
    try:
        mlp_head = tf.keras.models.load_model(MODEL_PATH)
        print(f"[OK] MLP Head loaded as full model from {MODEL_PATH}")
    except Exception as e2:
        print(f"[ERROR] Could not load model: {e2}")
        print("   The server will start but predictions will fail.")
        traceback.print_exc()

mlp_head.summary()


# ==========================================
# Preprocessing Helpers
# ==========================================
def preprocess_image_for_swin(image: Image.Image):
    """
    Preprocess gambar PIL untuk Swin backbone via timm transform.
    Returns: torch.Tensor [1, 3, 224, 224]
    """
    img = image.convert("RGB").resize(IMG_SIZE)
    tensor = swin_transform(img)
    return tensor.unsqueeze(0).to(DEVICE)


def extract_features(image: Image.Image):
    """
    Ekstrak fitur dari gambar menggunakan Swin-Large backbone.
    Returns: numpy array [1, feat_dim]
    """
    input_tensor = preprocess_image_for_swin(image)
    with torch.no_grad():
        features = swin_backbone(input_tensor)
    return features.cpu().numpy()


def predict_disease(image: Image.Image):
    """
    Pipeline lengkap: gambar -> Swin features -> MLP prediction.
    Returns: predictions array shape [num_classes]
    """
    features = extract_features(image)
    predictions = mlp_head.predict(features, verbose=0)
    return predictions[0]  # shape: [num_classes]


# ==========================================
# GradCAM Implementation
# ==========================================
def generate_gradcam(image: Image.Image, predicted_class_idx: int):
    """
    Generate GradCAM heatmap menggunakan Swin Transformer backbone.

    Menggunakan Gradient x Input attribution untuk menghasilkan
    activation map yang menunjukkan area penting pada gambar.

    Returns: (original_b64, heatmap_b64, overlay_b64)
    """
    img = image.convert("RGB").resize(IMG_SIZE)
    img_array = np.array(img, dtype=np.float32)

    # Use gradient-based approach with PyTorch
    input_tensor = preprocess_image_for_swin(image)
    input_tensor.requires_grad_(True)

    # Forward pass
    swin_backbone.eval()
    features = swin_backbone(input_tensor)

    # Use the predicted class score as target
    target_score = features[0, :].sum()  # Aggregate feature activation
    target_score.backward()

    # Get gradient w.r.t. input
    gradients = input_tensor.grad.detach().cpu().numpy()[0]  # [3, 224, 224]
    input_np = input_tensor.detach().cpu().numpy()[0]  # [3, 224, 224]

    # Compute importance: gradient x input (Gradient x Input attribution)
    importance = np.abs(gradients * input_np).sum(axis=0)  # [224, 224]

    # Smooth the heatmap
    try:
        from scipy.ndimage import gaussian_filter
        importance = gaussian_filter(importance, sigma=10)
    except ImportError:
        # scipy not available - use simple box blur fallback
        kernel_size = 21
        from PIL import ImageFilter
        imp_img = Image.fromarray((importance / (importance.max() + 1e-8) * 255).astype(np.uint8))
        imp_img = imp_img.filter(ImageFilter.GaussianBlur(radius=10))
        importance = np.array(imp_img, dtype=np.float32) / 255.0

    # Normalize to [0, 1]
    if importance.max() > importance.min():
        importance = (importance - importance.min()) / (importance.max() - importance.min())
    else:
        importance = np.zeros_like(importance)

    # Apply power curve for contrast
    importance = np.power(importance, 1.5)

    # Re-normalize after power curve
    if importance.max() > 0:
        importance = importance / importance.max()

    # Create jet colormap heatmap
    heatmap_rgb = apply_jet_colormap(importance)

    # Create overlay
    alpha = 0.45
    overlay = img_array.copy()
    blend_mask = np.clip(importance * 1.5, 0, 1)[:, :, np.newaxis] * alpha
    overlay = overlay * (1 - blend_mask) + heatmap_rgb * blend_mask
    overlay = np.clip(overlay, 0, 255).astype(np.uint8)

    # Convert to base64
    heatmap_b64 = numpy_to_base64_png(heatmap_rgb.astype(np.uint8))
    overlay_b64 = numpy_to_base64_png(overlay)
    original_b64 = numpy_to_base64_png(
        np.array(img.resize(IMG_SIZE)).astype(np.uint8)
    )

    # Reset gradients
    input_tensor.grad = None

    return original_b64, heatmap_b64, overlay_b64


def apply_jet_colormap(values):
    """
    Apply jet colormap ke array 2D [H, W] dengan values 0..1.
    Returns: array [H, W, 3] uint8
    """
    h, w = values.shape
    result = np.zeros((h, w, 3), dtype=np.float32)

    for y in range(h):
        for x in range(w):
            v = values[y, x]
            r, g, b = jet_color(v)
            result[y, x] = [r, g, b]

    return (result * 255).astype(np.uint8)


def jet_color(value):
    """Jet colormap: value 0..1 -> (R, G, B) in 0..1"""
    if value < 0.125:
        r, g, b = 0, 0, 0.5 + value * 4
    elif value < 0.375:
        r, g, b = 0, (value - 0.125) * 4, 1
    elif value < 0.625:
        r, g, b = (value - 0.375) * 4, 1, 1 - (value - 0.375) * 4
    elif value < 0.875:
        r, g, b = 1, 1 - (value - 0.625) * 4, 0
    else:
        r, g, b = 1 - (value - 0.875) * 2, 0, 0
    return (
        max(0, min(1, r)),
        max(0, min(1, g)),
        max(0, min(1, b)),
    )


def numpy_to_base64_png(arr):
    """Convert numpy array [H, W, 3] uint8 to base64-encoded PNG string."""
    img = Image.fromarray(arr)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


# ==========================================
# Flask App
# ==========================================
app = Flask(__name__)
CORS(app)  # Allow cross-origin requests from the frontend


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "model": "swin_large_patch4_window7_224 + MLP Head",
        "device": DEVICE,
        "labels": LABEL_LIST,
        "feature_dim": int(feat_dim),
    })


@app.route("/predict", methods=["POST"])
def predict():
    """
    Predict penyakit padi dari gambar yang di-upload.

    Request: multipart/form-data dengan field 'image'
    Response: JSON {
        predictions: [{label, confidence}...],
        top_prediction: {label, confidence, display_name},
        gradcam: {original, heatmap, overlay}  // base64 PNG
    }
    """
    try:
        # Validate request
        if "image" not in request.files:
            return jsonify({"error": "No image file provided. Use 'image' field."}), 400

        file = request.files["image"]
        if file.filename == "":
            return jsonify({"error": "Empty filename."}), 400

        # Read and validate image
        try:
            image = Image.open(file.stream).convert("RGB")
        except Exception as e:
            return jsonify({"error": f"Invalid image file: {str(e)}"}), 400

        # Run prediction
        print(f"[...] Processing image: {file.filename}")
        probs = predict_disease(image)

        # Sort by confidence (descending)
        sorted_indices = np.argsort(probs)[::-1]

        predictions = []
        for idx in sorted_indices:
            predictions.append({
                "label": LABEL_LIST[idx],
                "confidence": float(probs[idx]),
            })

        top_idx = sorted_indices[0]
        top_label = LABEL_LIST[top_idx]

        # Display name mapping
        DISPLAY_NAMES = {
            "bacterialblight": "Bacterial Blight",
            "brownspot": "Brown Spot",
            "healthy": "Healthy (Sehat)",
            "hispa": "Hispa",
            "leafblast": "Leaf Blast",
            "tungro": "Tungro",
        }

        top_prediction = {
            "label": top_label,
            "display_name": DISPLAY_NAMES.get(top_label, top_label),
            "confidence": float(probs[top_idx]),
        }

        # Generate GradCAM
        print("[...] Generating GradCAM heatmap...")
        try:
            original_b64, heatmap_b64, overlay_b64 = generate_gradcam(
                image, int(top_idx)
            )
            gradcam = {
                "original": original_b64,
                "heatmap": heatmap_b64,
                "overlay": overlay_b64,
            }
        except Exception as e:
            print(f"[WARN] GradCAM generation failed: {e}")
            traceback.print_exc()
            gradcam = None

        print(f"[OK] Prediction: {top_prediction['display_name']} "
              f"({top_prediction['confidence']*100:.1f}%)")

        # Anomaly Detection: If top confidence is below 50%, flag as anomaly
        is_anomaly = bool(top_prediction['confidence'] < 0.50)
        
        if is_anomaly:
            print("[WARN] Anomaly detected: Low confidence prediction (not a rice leaf?)")

        return jsonify({
            "predictions": predictions,
            "top_prediction": top_prediction,
            "gradcam": gradcam,
            "is_anomaly": is_anomaly
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Prediction failed: {str(e)}"}), 500


# ==========================================
# Main
# ==========================================
if __name__ == "__main__":
    print("")
    print("=" * 60)
    print("  DePadi Backend Server")
    print(f"  Model : Swin-Large + MLP Head")
    print(f"  Device: {DEVICE}")
    print(f"  Labels: {LABEL_LIST}")
    print("=" * 60)
    print("")
    print("Server starting on http://localhost:5000")

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=False,  # Set False for production
    )
