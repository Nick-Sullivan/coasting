import base64
import io

import numpy as np
import torch
from fastapi import APIRouter, File, Form, UploadFile
from PIL import Image

router = APIRouter()

# Load models once on startup (lazy loading)
_depth_model = None
_transform = None


@router.post("/process")
async def process_image(layers: int = Form(...), image: UploadFile = File(...)):
    print(f"Processing image with {layers} layers requested")

    # Validate layers
    if layers < 1 or layers > 20:
        return {
            "status": "error",
            "message": "Number of layers must be between 1 and 20",
        }

    # Load image
    print("Reading image data...")
    image_data = await image.read()
    pil_image = Image.open(io.BytesIO(image_data)).convert("RGB")
    print(f"Image loaded: {pil_image.size}")

    # Estimate depth
    print("Estimating depth...")
    depth_map = estimate_depth(pil_image)
    print(f"Depth map shape: {depth_map.shape}")

    # Segment by depth
    print("Creating layers based on depth...")
    layer_images, total_pixels = segment_by_depth(pil_image, depth_map, layers)

    print(f"Created {layers} layer images")

    return {"status": "ok", "segments_found": total_pixels, "layers": layer_images}


def get_depth_model():
    """Load MiDaS depth estimation model"""
    global _depth_model, _transform
    if _depth_model is None:
        print("Loading MiDaS depth estimation model...")
        _depth_model = torch.hub.load("intel-isl/MiDaS", "MiDaS_small")
        _depth_model.eval()

        # Load transforms
        midas_transforms = torch.hub.load("intel-isl/MiDaS", "transforms")
        _transform = midas_transforms.small_transform

        print("Model loaded successfully")
    return _depth_model, _transform


def estimate_depth(pil_image):
    """Estimate depth map for the image"""
    model, transform = get_depth_model()

    # Prepare image
    img_array = np.array(pil_image)
    input_batch = transform(img_array)

    # Run inference
    with torch.no_grad():
        prediction = model(input_batch)
        prediction = torch.nn.functional.interpolate(
            prediction.unsqueeze(1),
            size=pil_image.size[::-1],
            mode="bicubic",
            align_corners=False,
        ).squeeze()

    depth_map = prediction.cpu().numpy()
    return depth_map


def segment_by_depth(pil_image, depth_map, num_layers):
    """
    Segment image into layers based on depth with equal pixel distribution.
    Closer objects (smaller depth values) are in front layers.
    """
    img_array = np.array(pil_image)
    height, width = img_array.shape[:2]
    total_pixels = height * width
    pixels_per_layer = total_pixels // num_layers

    # Normalize depth map to 0-1 range (invert so closer = higher value)
    depth_normalized = (depth_map - depth_map.min()) / (depth_map.max() - depth_map.min())
    depth_normalized = 1.0 - depth_normalized  # Invert: closer objects = higher values

    # Flatten depth map and get sorting indices
    flat_depth = depth_normalized.flatten()
    sorted_indices = np.argsort(flat_depth)[::-1]  # Sort descending (closest first)

    # Create layer assignments array
    layer_assignments = np.zeros(total_pixels, dtype=np.int32)

    # Assign pixels to layers evenly
    for layer_idx in range(num_layers):
        start_idx = layer_idx * pixels_per_layer
        end_idx = start_idx + pixels_per_layer if layer_idx < num_layers - 1 else total_pixels
        layer_assignments[sorted_indices[start_idx:end_idx]] = layer_idx

    # Reshape to image dimensions
    layer_assignments = layer_assignments.reshape(height, width)

    # Create each layer
    layer_images = []
    for layer_idx in range(num_layers):
        # Create mask for this layer
        layer_mask = layer_assignments == layer_idx

        # Create RGBA image for this layer
        layer_img = np.zeros((height, width, 4), dtype=np.uint8)
        layer_img[layer_mask] = np.concatenate(
            [
                img_array[layer_mask],
                np.full((layer_mask.sum(), 1), 255, dtype=np.uint8),
            ],
            axis=1,
        )

        # Count pixels in this layer
        pixel_count = layer_mask.sum()

        # Convert to PIL and base64
        layer_pil = Image.fromarray(layer_img, "RGBA")
        buffer = io.BytesIO()
        layer_pil.save(buffer, format="PNG")
        layer_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        layer_images.append(
            {
                "layer": layer_idx,
                "image": f"data:image/png;base64,{layer_base64}",
                "segment_count": int(pixel_count),
            }
        )

    return layer_images, total_pixels
