"""
Video Generation Service - Veo 3.1
Production implementation using Google Veo API via google-genai SDK
Supports: Text-to-video, Image-to-video, Video extension, Reference images, Frame interpolation
"""
import logging
import time
import base64
from typing import Optional, List

from google import genai
from google.genai import types

from .schemas import (
    VideoGenerationRequest,
    VideoGenerationResponse,
    VideoStatusRequest,
    VideoStatusResponse,
    VideoData,
    ImageToVideoRequest,
    FrameSpecificRequest,
    ReferenceImagesRequest,
    ReferenceImage,
    VideoExtendRequest,
    VideoDownloadRequest,
    VideoDownloadResponse,
    validate_veo_config,
)
from ....config import settings

logger = logging.getLogger(__name__)

# Lazy client initialization
_genai_client: Optional[genai.Client] = None


def get_genai_client() -> genai.Client:
    """Get or create Google GenAI client"""
    global _genai_client
    
    if _genai_client is None:
        api_key = settings.gemini_key
        if not api_key:
            raise ValueError("GOOGLE_API_KEY is not configured")
        _genai_client = genai.Client(api_key=api_key)
    
    return _genai_client


def _parse_image_input(image_url: str) -> types.Image:
    """Parse image URL or base64 data URL into google-genai Image object"""
    if image_url.startswith("data:"):
        # Parse data URL: data:image/png;base64,xxxxx
        header, b64_data = image_url.split(",", 1)
        mime_type = "image/png"
        if ":" in header and ";" in header:
            mime_type = header.split(":")[1].split(";")[0]
        image_bytes = base64.b64decode(b64_data)
        return types.Image(image_bytes=image_bytes, mime_type=mime_type)
    else:
        # URL reference
        return types.Image(image_uri=image_url)


def _build_video_config(
    aspect_ratio: str = "16:9",
    resolution: str = "720p",
    duration_seconds: int = 8,
    negative_prompt: Optional[str] = None,
    person_generation: Optional[str] = None,
    seed: Optional[int] = None,
    reference_images: Optional[List] = None,
    last_frame: Optional[types.Image] = None,
) -> types.GenerateVideosConfig:
    """Build Veo config object with proper parameters"""
    config_dict = {
        "aspect_ratio": aspect_ratio,
        "resolution": resolution,
        "duration_seconds": duration_seconds,
        "number_of_videos": 1,
    }
    
    if negative_prompt:
        config_dict["negative_prompt"] = negative_prompt
    
    if person_generation:
        config_dict["person_generation"] = person_generation
    
    if seed is not None:
        config_dict["seed"] = seed
    
    if reference_images:
        config_dict["reference_images"] = reference_images
    
    if last_frame:
        config_dict["last_frame"] = last_frame
    
    return types.GenerateVideosConfig(**config_dict)


def _extract_operation_info(operation) -> tuple[str, str]:
    """Extract operation ID and name from operation object"""
    operation_name = getattr(operation, "name", "") or ""
    operation_id = operation_name.split("/")[-1] if "/" in operation_name else operation_name
    return operation_id, operation_name


def _extract_video_info(operation) -> Optional[VideoData]:
    """Extract video ID and info from completed operation"""
    if not hasattr(operation, "response") or not operation.response:
        return None
    
    generated_videos = getattr(operation.response, "generated_videos", [])
    if not generated_videos:
        return None
    
    video = generated_videos[0]
    video_file = getattr(video, "video", None)
    
    if not video_file:
        return None
    
    # Extract video ID and URI
    veo_video_id = getattr(video_file, "name", None) or getattr(video_file, "uri", None) or str(video_file)
    video_url = getattr(video_file, "uri", None)
    
    return VideoData(veoVideoId=veo_video_id, url=video_url)


# ============================================================================
# Text-to-Video
# ============================================================================

async def generate_video(request: VideoGenerationRequest) -> VideoGenerationResponse:
    """
    Generate video from text prompt using Google Veo API
    
    Returns operation ID immediately - poll get_video_status() for completion.
    """
    try:
        # Validate config
        valid, error = validate_veo_config(
            request.resolution or "720p",
            request.durationSeconds or 8,
            request.model
        )
        if not valid:
            return VideoGenerationResponse(success=False, error=error)
        
        client = get_genai_client()
        model = request.model or "veo-3.1-generate-preview"
        
        logger.info(f"[Veo] Text-to-video: model={model}")
        
        # Build config
        config = _build_video_config(
            aspect_ratio=request.aspectRatio or "16:9",
            resolution=request.resolution or "720p",
            duration_seconds=request.durationSeconds or 8,
            negative_prompt=request.negativePrompt,
            person_generation=request.personGeneration,
            seed=request.seed,
        )
        
        # Start generation
        operation = client.models.generate_videos(
            model=model,
            prompt=request.prompt,
            config=config,
        )
        
        operation_id, operation_name = _extract_operation_info(operation)
        logger.info(f"[Veo] Started: operation={operation_id}")
        
        return VideoGenerationResponse(
            success=True,
            operationId=operation_id,
            operationName=operation_name,
            status="pending"
        )
        
    except Exception as e:
        logger.error(f"[Veo] Text-to-video error: {e}", exc_info=True)
        return VideoGenerationResponse(success=False, error=str(e))


# ============================================================================
# Image-to-Video (First Frame)
# ============================================================================

async def generate_image_to_video(request: ImageToVideoRequest) -> VideoGenerationResponse:
    """
    Generate video with image as first frame
    """
    try:
        valid, error = validate_veo_config(
            request.resolution or "720p",
            request.durationSeconds or 8,
            request.model
        )
        if not valid:
            return VideoGenerationResponse(success=False, error=error)
        
        client = get_genai_client()
        model = request.model or "veo-3.1-generate-preview"
        
        logger.info(f"[Veo] Image-to-video: model={model}")
        
        # Parse image
        image = _parse_image_input(request.imageUrl)
        
        # Build config
        config = _build_video_config(
            aspect_ratio=request.aspectRatio or "16:9",
            resolution=request.resolution or "720p",
            duration_seconds=request.durationSeconds or 8,
            person_generation=request.personGeneration or "allow_adult",
        )
        
        # Start generation with image as first frame
        operation = client.models.generate_videos(
            model=model,
            prompt=request.prompt,
            image=image,
            config=config,
        )
        
        operation_id, operation_name = _extract_operation_info(operation)
        logger.info(f"[Veo] Image-to-video started: operation={operation_id}")
        
        return VideoGenerationResponse(
            success=True,
            operationId=operation_id,
            operationName=operation_name,
            status="pending"
        )
        
    except Exception as e:
        logger.error(f"[Veo] Image-to-video error: {e}", exc_info=True)
        return VideoGenerationResponse(success=False, error=str(e))


# ============================================================================
# Frame-Specific (Interpolation) - Veo 3.1 only
# ============================================================================

async def generate_frame_specific(request: FrameSpecificRequest) -> VideoGenerationResponse:
    """
    Generate video by specifying first and last frames (interpolation)
    Veo 3.1 only feature
    """
    try:
        client = get_genai_client()
        model = request.model or "veo-3.1-generate-preview"
        
        if "veo-3.1" not in model:
            return VideoGenerationResponse(
                success=False,
                error="Frame-specific generation requires Veo 3.1 model"
            )
        
        logger.info(f"[Veo] Frame-specific (interpolation): model={model}")
        
        # Parse both frames
        first_image = _parse_image_input(request.firstImageUrl)
        last_image = _parse_image_input(request.lastImageUrl)
        
        # Config with last_frame for interpolation
        config = _build_video_config(
            aspect_ratio=request.aspectRatio or "16:9",
            resolution="720p",  # Interpolation requires 720p
            duration_seconds=8,  # Must be 8 for interpolation
            person_generation=request.personGeneration or "allow_adult",
            last_frame=last_image,
        )
        
        # Start generation with first image and last_frame in config
        operation = client.models.generate_videos(
            model=model,
            prompt=request.prompt or "",
            image=first_image,
            config=config,
        )
        
        operation_id, operation_name = _extract_operation_info(operation)
        logger.info(f"[Veo] Frame-specific started: operation={operation_id}")
        
        return VideoGenerationResponse(
            success=True,
            operationId=operation_id,
            operationName=operation_name,
            status="pending"
        )
        
    except Exception as e:
        logger.error(f"[Veo] Frame-specific error: {e}", exc_info=True)
        return VideoGenerationResponse(success=False, error=str(e))


# ============================================================================
# Reference Images - Veo 3.1 only
# ============================================================================

async def generate_with_references(request: ReferenceImagesRequest) -> VideoGenerationResponse:
    """
    Generate video using 1-3 reference images for content guidance
    Veo 3.1 only feature
    """
    try:
        client = get_genai_client()
        model = request.model or "veo-3.1-generate-preview"
        
        if "veo-3.1" not in model:
            return VideoGenerationResponse(
                success=False,
                error="Reference images require Veo 3.1 model"
            )
        
        if len(request.referenceImages) > 3:
            return VideoGenerationResponse(
                success=False,
                error="Maximum 3 reference images allowed"
            )
        
        logger.info(f"[Veo] Reference images: model={model}, count={len(request.referenceImages)}")
        
        # Build reference image objects
        ref_images = []
        for ref in request.referenceImages:
            image = _parse_image_input(ref.imageUrl)
            ref_images.append(
                types.VideoGenerationReferenceImage(
                    image=image,
                    reference_type=ref.referenceType
                )
            )
        
        # Config with reference_images - must be 16:9 and 8s
        config = _build_video_config(
            aspect_ratio="16:9",  # Required for reference images
            resolution="720p",
            duration_seconds=8,  # Required for reference images
            person_generation=request.personGeneration or "allow_adult",
            reference_images=ref_images,
        )
        
        # Start generation
        operation = client.models.generate_videos(
            model=model,
            prompt=request.prompt,
            config=config,
        )
        
        operation_id, operation_name = _extract_operation_info(operation)
        logger.info(f"[Veo] Reference images started: operation={operation_id}")
        
        return VideoGenerationResponse(
            success=True,
            operationId=operation_id,
            operationName=operation_name,
            status="pending"
        )
        
    except Exception as e:
        logger.error(f"[Veo] Reference images error: {e}", exc_info=True)
        return VideoGenerationResponse(success=False, error=str(e))


# ============================================================================
# Video Extension - Veo 3.1 only
# ============================================================================

async def extend_video(request: VideoExtendRequest) -> VideoGenerationResponse:
    """
    Extend a Veo-generated video by 7 seconds (up to 20 extensions = 148s max)
    Veo 3.1 only feature
    
    Input video must be:
    - From previous Veo generation
    - Max 141 seconds
    - 720p resolution
    - 16:9 or 9:16 aspect ratio
    """
    try:
        client = get_genai_client()
        model = request.model or "veo-3.1-generate-preview"
        
        if "veo-3.1" not in model:
            return VideoGenerationResponse(
                success=False,
                error="Video extension requires Veo 3.1 model"
            )
        
        logger.info(f"[Veo] Extend video: veoVideoId={request.veoVideoId[:50]}...")
        
        # Config for extension - 720p only
        config = types.GenerateVideosConfig(
            number_of_videos=1,
            resolution=request.resolution or "720p",
        )
        
        # Get video reference from previous generation
        # The veoVideoId should be the full video reference from previous response
        video_ref = types.Video(name=request.veoVideoId)
        
        # Start extension
        operation = client.models.generate_videos(
            model=model,
            prompt=request.prompt or "",
            video=video_ref,
            config=config,
        )
        
        operation_id, operation_name = _extract_operation_info(operation)
        logger.info(f"[Veo] Extension started: operation={operation_id}")
        
        return VideoGenerationResponse(
            success=True,
            operationId=operation_id,
            operationName=operation_name,
            status="pending"
        )
        
    except Exception as e:
        logger.error(f"[Veo] Extend video error: {e}", exc_info=True)
        return VideoGenerationResponse(success=False, error=str(e))


# ============================================================================
# Status Polling
# ============================================================================

async def get_video_status(request: VideoStatusRequest) -> VideoStatusResponse:
    """
    Get status of video generation operation
    Poll every 10 seconds until done=True
    """
    try:
        client = get_genai_client()
        
        logger.info(f"[Veo] Status check: {request.operationName}")
        
        # Get operation using the full name
        operation = client.operations.get(name=request.operationName)
        
        if not operation.done:
            return VideoStatusResponse(
                success=True,
                done=False,
                status="processing",
                progress=50.0  # Veo doesn't provide granular progress
            )
        
        # Check for errors
        if hasattr(operation, "error") and operation.error:
            return VideoStatusResponse(
                success=False,
                done=True,
                status="failed",
                error=str(operation.error)
            )
        
        # Extract video info
        video_data = _extract_video_info(operation)
        
        if video_data:
            return VideoStatusResponse(
                success=True,
                done=True,
                status="completed",
                progress=100.0,
                video=video_data
            )
        
        return VideoStatusResponse(
            success=True,
            done=True,
            status="completed",
            progress=100.0,
            error="Video generated but ID not available"
        )
        
    except Exception as e:
        logger.error(f"[Veo] Status error: {e}", exc_info=True)
        return VideoStatusResponse(
            success=False,
            done=False,
            status="failed",
            error=str(e)
        )


# ============================================================================
# Video Download
# ============================================================================

async def download_video(request: VideoDownloadRequest) -> VideoDownloadResponse:
    """
    Download completed video and optionally upload to Supabase
    """
    try:
        client = get_genai_client()
        
        logger.info(f"[Veo] Download: veoVideoId={request.veoVideoId[:50]}...")
        
        # Create video reference
        video_ref = types.Video(name=request.veoVideoId)
        
        # Download video
        client.files.download(file=video_ref)
        
        # Get the downloaded file path/URL
        video_url = getattr(video_ref, "uri", None) or str(video_ref)
        
        # Optionally upload to Supabase
        if request.uploadToSupabase:
            try:
                import httpx
                from src.services.storage_service import StorageService
                
                # Download video bytes
                async with httpx.AsyncClient(timeout=120.0) as http_client:
                    response = await http_client.get(video_url)
                    if response.status_code == 200:
                        video_data = response.content
                        
                        # Upload to Supabase
                        filename = f"veo_{request.operationId or 'video'}_{int(time.time())}.mp4"
                        result = await StorageService.upload_file(
                            file_data=video_data,
                            bucket="videos",
                            path=f"veo/{filename}",
                            content_type="video/mp4"
                        )
                        
                        if result.get("success"):
                            video_url = result.get("url", video_url)
                            logger.info(f"[Veo] Uploaded to Supabase: {filename}")
                        
            except Exception as e:
                logger.warning(f"[Veo] Supabase upload failed: {e}")
        
        return VideoDownloadResponse(success=True, url=video_url)
        
    except Exception as e:
        logger.error(f"[Veo] Download error: {e}", exc_info=True)
        return VideoDownloadResponse(success=False, error=str(e))
