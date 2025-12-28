"""
Image Generation Service
OpenAI gpt-image-1.5 implementation per latest API docs
"""
import logging
import time
import base64
import httpx
from typing import Optional

from openai import AsyncOpenAI

from .schemas import (
    FrontendImageRequest,
    ImageEditRequest,
    ImageReferenceRequest,
    ImageGenerationResponse,
    ImageGenerationData,
    ImageGenerationMetadata,
)
from ....config import settings

logger = logging.getLogger(__name__)

# Lazy client initialization
_openai_client: Optional[AsyncOpenAI] = None


def get_openai_client() -> AsyncOpenAI:
    """Get or create async OpenAI client"""
    global _openai_client
    
    if _openai_client is None:
        api_key = settings.OPENAI_API_KEY
        if not api_key:
            raise ValueError("OPENAI_API_KEY is not configured")
        _openai_client = AsyncOpenAI(api_key=api_key)
    
    return _openai_client


def base64_to_data_url(b64_data: str, format: str = "png") -> str:
    """Convert base64 to data URL"""
    return f"data:image/{format};base64,{b64_data}"


async def url_to_bytes(url: str) -> tuple[bytes, str]:
    """Convert URL or data URL to bytes and detect mime type"""
    if url.startswith("data:"):
        # Parse data URL
        header, b64_data = url.split(",", 1)
        mime_type = header.split(";")[0].split(":")[1] if ":" in header else "image/png"
        return base64.b64decode(b64_data), mime_type
    else:
        # Fetch from HTTP URL
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(url)
            response.raise_for_status()
            content_type = response.headers.get("content-type", "image/png")
            return response.content, content_type


async def generate_image(request: FrontendImageRequest) -> ImageGenerationResponse:
    """
    Generate image using OpenAI gpt-image-1.5
    
    Per docs:
    - Sizes: 1024x1024, 1536x1024, 1024x1536
    - Quality: low, medium, high, auto
    - Background: transparent, opaque, auto
    - Format: png, jpeg, webp
    - Moderation: auto, low
    """
    start_time = time.time()
    
    try:
        client = get_openai_client()
        opts = request.options or {}
        
        # Get size, handle 'auto'
        size = getattr(opts, 'size', None) or "1024x1024"
        if size == "auto":
            size = "1024x1024"
        
        # Build OpenAI API params
        params = {
            "model": "gpt-image-1.5",
            "prompt": request.prompt,
            "response_format": "b64_json",
            "size": size,
        }
        
        # Add quality
        quality = getattr(opts, 'quality', None)
        if quality and quality != "auto":
            params["quality"] = quality
        
        # Add background
        background = getattr(opts, 'background', None)
        if background and background != "auto":
            params["background"] = background
        
        # Add moderation
        moderation = getattr(opts, 'moderation', None)
        if moderation and moderation != "auto":
            params["moderation"] = moderation
        
        # Add n (number of images)
        n = getattr(opts, 'n', None)
        if n and n > 1:
            params["n"] = n
        
        logger.info(f"Generating image: size={size}, quality={quality}")
        
        response = await client.images.generate(**params)
        
        if not response.data or len(response.data) == 0:
            return ImageGenerationResponse(
                success=False,
                error="No image data received from API"
            )
        
        image_data = response.data[0]
        b64_image = image_data.b64_json
        
        if not b64_image:
            return ImageGenerationResponse(
                success=False,
                error="No base64 data in response"
            )
        
        # Convert to data URL
        output_format = getattr(opts, 'format', None) or "png"
        image_url = base64_to_data_url(b64_image, output_format)
        
        generation_time = int((time.time() - start_time) * 1000)
        
        logger.info(f"Image generated successfully in {generation_time}ms")
        
        metadata = ImageGenerationMetadata(
            model="gpt-image-1.5",
            promptUsed=request.prompt,
            revisedPrompt=getattr(image_data, "revised_prompt", None),
            size=size,
            quality=quality,
            format=output_format
        )
        
        return ImageGenerationResponse(
            success=True,
            data=ImageGenerationData(
                imageUrl=image_url,
                metadata=metadata
            )
        )
        
    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        return ImageGenerationResponse(success=False, error=str(e))
    
    except Exception as e:
        logger.error(f"Image generation error: {e}", exc_info=True)
        error_msg = str(e)
        if "api_key" in error_msg.lower():
            error_msg = "Invalid API key"
        elif "rate_limit" in error_msg.lower():
            error_msg = "Rate limit exceeded"
        
        return ImageGenerationResponse(success=False, error=error_msg)


async def generate_image_edit(request: ImageEditRequest) -> ImageGenerationResponse:
    """
    Edit image with optional mask (inpainting)
    
    Per OpenAI docs:
    - Mask indicates areas to edit (alpha channel required)
    - Supports all output options: size, quality, format, background
    """
    start_time = time.time()
    
    try:
        client = get_openai_client()
        
        logger.info(f"Image edit request: {request.prompt[:50]}...")
        
        # Get image bytes
        image_bytes, _ = await url_to_bytes(request.originalImageUrl)
        
        # Get size, handle 'auto'
        size = request.size or "1024x1024"
        if size == "auto":
            size = "1024x1024"
        
        # Build params
        params = {
            "model": "gpt-image-1.5",
            "image": image_bytes,
            "prompt": request.prompt,
            "response_format": "b64_json",
            "size": size,
        }
        
        # Add mask if provided
        if request.maskImageUrl:
            mask_bytes, _ = await url_to_bytes(request.maskImageUrl)
            params["mask"] = mask_bytes
        
        # Add quality
        if request.quality and request.quality != "auto":
            params["quality"] = request.quality
        
        # Add background
        if request.background and request.background != "auto":
            params["background"] = request.background
        
        logger.info(f"Calling images.edit: size={size}, quality={request.quality}")
        
        response = await client.images.edit(**params)
        
        if not response.data or len(response.data) == 0:
            return ImageGenerationResponse(
                success=False,
                error="No edited image data received"
            )
        
        b64_image = response.data[0].b64_json
        
        if not b64_image:
            return ImageGenerationResponse(
                success=False,
                error="No base64 data in edit response"
            )
        
        # Use requested format
        output_format = request.format or "png"
        image_url = base64_to_data_url(b64_image, output_format)
        generation_time = int((time.time() - start_time) * 1000)
        
        logger.info(f"Image edited successfully in {generation_time}ms")
        
        return ImageGenerationResponse(
            success=True,
            data=ImageGenerationData(
                imageUrl=image_url,
                metadata=ImageGenerationMetadata(
                    model="gpt-image-1.5",
                    promptUsed=request.prompt,
                    size=size,
                    quality=request.quality,
                    format=output_format
                )
            )
        )
        
    except Exception as e:
        logger.error(f"Image edit error: {e}", exc_info=True)
        return ImageGenerationResponse(success=False, error=str(e))


async def generate_image_reference(request: ImageReferenceRequest) -> ImageGenerationResponse:
    """
    Generate image using reference images
    
    Per OpenAI docs:
    - Multiple reference images supported (up to 5 with high fidelity for gpt-image-1.5)
    - input_fidelity='high' preserves faces, logos, fine details
    - Supports all output options: size, quality, format, background
    """
    start_time = time.time()
    
    try:
        client = get_openai_client()
        
        logger.info(f"Reference image request: {request.prompt[:50]}...")
        
        # Get all reference image bytes
        images = []
        for url in request.referenceImages[:5]:  # Max 5 for high fidelity
            img_bytes, _ = await url_to_bytes(url)
            images.append(img_bytes)
        
        # Get size, handle 'auto'
        size = request.size or "1024x1024"
        if size == "auto":
            size = "1024x1024"
        
        params = {
            "model": "gpt-image-1.5",
            "image": images,
            "prompt": request.prompt,
            "response_format": "b64_json",
            "size": size,
        }
        
        # Add input fidelity - key feature per docs
        if request.input_fidelity == "high":
            params["input_fidelity"] = "high"
        
        # Add quality
        if request.quality and request.quality != "auto":
            params["quality"] = request.quality
        
        # Add background
        if request.background and request.background != "auto":
            params["background"] = request.background
        
        logger.info(f"Calling images.edit with {len(images)} reference images, fidelity={request.input_fidelity}")
        
        response = await client.images.edit(**params)
        
        if not response.data or len(response.data) == 0:
            return ImageGenerationResponse(
                success=False,
                error="No image data received"
            )
        
        b64_image = response.data[0].b64_json
        
        if not b64_image:
            return ImageGenerationResponse(
                success=False,
                error="No base64 data in response"
            )
        
        output_format = request.format or "png"
        image_url = base64_to_data_url(b64_image, output_format)
        generation_time = int((time.time() - start_time) * 1000)
        
        logger.info(f"Reference image generated in {generation_time}ms")
        
        return ImageGenerationResponse(
            success=True,
            data=ImageGenerationData(
                imageUrl=image_url,
                metadata=ImageGenerationMetadata(
                    model="gpt-image-1.5",
                    promptUsed=request.prompt,
                    size=size,
                    quality=request.quality,
                    format=output_format
                )
            )
        )
        
    except Exception as e:
        logger.error(f"Reference image error: {e}", exc_info=True)
        return ImageGenerationResponse(success=False, error=str(e))
