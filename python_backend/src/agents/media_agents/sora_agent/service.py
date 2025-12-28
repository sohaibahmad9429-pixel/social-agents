"""
Sora Agent Service
OpenAI Video Generation API (Sora 2) - Production Implementation
Per latest OpenAI Video API documentation
"""
import logging
import time
import base64
import httpx
from typing import Optional

from openai import AsyncOpenAI

from .schemas import (
    SoraGenerateRequest,
    SoraImageToVideoRequest,
    SoraRemixRequest,
    SoraStatusRequest,
    SoraFetchRequest,
    SoraGenerateResponse,
    SoraStatusResponse,
    SoraFetchResponse,
    SoraVideoData,
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


async def url_to_bytes(url: str) -> tuple[bytes, str]:
    """Convert URL or data URL to bytes and detect mime type"""
    if url.startswith("data:"):
        header, b64_data = url.split(",", 1)
        mime_type = header.split(";")[0].split(":")[1] if ":" in header else "image/png"
        return base64.b64decode(b64_data), mime_type
    else:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(url)
            response.raise_for_status()
            content_type = response.headers.get("content-type", "image/png")
            return response.content, content_type


async def generate_video(request: SoraGenerateRequest) -> SoraGenerateResponse:
    """
    Generate video from text prompt using OpenAI Sora
    
    Per docs: POST /videos
    Returns job ID and initial status (queued/in_progress)
    """
    try:
        client = get_openai_client()
        
        logger.info(f"Starting Sora video generation: model={request.model}, size={request.size}")
        
        # Build parameters per OpenAI Video API
        params = {
            "model": request.model or "sora-2",
            "prompt": request.prompt,
            "size": request.size or "1280x720",
            "seconds": request.seconds or "8",
        }
        
        # Call OpenAI videos.create
        response = await client.videos.create(**params)
        
        logger.info(f"Video job started: id={response.id}, status={response.status}")
        
        return SoraGenerateResponse(
            success=True,
            videoId=response.id,
            status=response.status,
            data=SoraVideoData(
                id=response.id,
                status=response.status,
                model=getattr(response, "model", request.model),
                progress=getattr(response, "progress", 0),
                size=getattr(response, "size", request.size),
                seconds=getattr(response, "seconds", request.seconds),
                created_at=getattr(response, "created_at", None),
            )
        )
        
    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        return SoraGenerateResponse(success=False, error=str(e))
    
    except Exception as e:
        logger.error(f"Sora video generation error: {e}", exc_info=True)
        error_msg = str(e)
        if "api_key" in error_msg.lower():
            error_msg = "Invalid API key"
        elif "rate_limit" in error_msg.lower():
            error_msg = "Rate limit exceeded"
        elif "content" in error_msg.lower() and "policy" in error_msg.lower():
            error_msg = "Content policy violation - adjust your prompt"
        
        return SoraGenerateResponse(success=False, error=error_msg)


async def generate_image_to_video(request: SoraImageToVideoRequest) -> SoraGenerateResponse:
    """
    Generate video with image as first frame
    
    Per docs: POST /videos with input_reference parameter
    Image must match target video resolution
    """
    try:
        client = get_openai_client()
        
        logger.info(f"Starting image-to-video: model={request.model}")
        
        # Get image bytes
        image_bytes, mime_type = await url_to_bytes(request.imageUrl)
        
        # Build parameters
        params = {
            "model": request.model or "sora-2",
            "prompt": request.prompt,
            "size": request.size or "1280x720",
            "seconds": request.seconds or "8",
            "input_reference": image_bytes,
        }
        
        response = await client.videos.create(**params)
        
        logger.info(f"Image-to-video job started: id={response.id}")
        
        return SoraGenerateResponse(
            success=True,
            videoId=response.id,
            status=response.status,
            data=SoraVideoData(
                id=response.id,
                status=response.status,
                model=getattr(response, "model", request.model),
                progress=getattr(response, "progress", 0),
                size=getattr(response, "size", request.size),
                seconds=getattr(response, "seconds", request.seconds),
            )
        )
        
    except Exception as e:
        logger.error(f"Image-to-video error: {e}", exc_info=True)
        return SoraGenerateResponse(success=False, error=str(e))


async def remix_video(request: SoraRemixRequest) -> SoraGenerateResponse:
    """
    Remix a completed video with targeted adjustments
    
    Per docs: POST /videos/{id}/remix
    Best for single, focused changes
    """
    try:
        client = get_openai_client()
        
        logger.info(f"Starting video remix: video_id={request.previousVideoId}")
        
        # Remix existing video - per docs this is a POST to /videos/{id}/remix
        # The SDK may expose this as videos.remix() or similar
        # Using the low-level approach if not available
        response = await client.post(
            f"/videos/{request.previousVideoId}/remix",
            body={"prompt": request.prompt},
            cast_to=object  # Raw response
        )
        
        video_id = response.get("id") if isinstance(response, dict) else getattr(response, "id", None)
        status = response.get("status") if isinstance(response, dict) else getattr(response, "status", "queued")
        
        logger.info(f"Remix job started: id={video_id}")
        
        return SoraGenerateResponse(
            success=True,
            videoId=video_id,
            status=status,
            data=SoraVideoData(
                id=video_id,
                status=status,
                progress=0,
            )
        )
        
    except Exception as e:
        logger.error(f"Video remix error: {e}", exc_info=True)
        return SoraGenerateResponse(success=False, error=str(e))


async def get_video_status(request: SoraStatusRequest) -> SoraStatusResponse:
    """
    Get video generation status
    
    Per docs: GET /videos/{id}
    Returns status (queued, in_progress, completed, failed) and progress %
    """
    try:
        client = get_openai_client()
        
        logger.info(f"Checking video status: {request.videoId}")
        
        response = await client.videos.retrieve(request.videoId)
        
        video_data = {
            "video": {
                "id": response.id,
                "status": response.status,
                "progress": getattr(response, "progress", 0),
                "model": getattr(response, "model", None),
                "size": getattr(response, "size", None),
                "seconds": getattr(response, "seconds", None),
                "created_at": getattr(response, "created_at", None),
            }
        }
        
        # Check for error if failed
        if response.status == "failed":
            error = getattr(response, "error", None)
            if error:
                video_data["video"]["error"] = getattr(error, "message", str(error))
        
        logger.info(f"Video status: {response.status}, progress: {getattr(response, 'progress', 0)}%")
        
        return SoraStatusResponse(
            success=True,
            data=video_data
        )
        
    except Exception as e:
        logger.error(f"Video status error: {e}", exc_info=True)
        return SoraStatusResponse(success=False, error=str(e))


async def fetch_video_content(request: SoraFetchRequest) -> SoraFetchResponse:
    """
    Download completed video content
    
    Per docs: GET /videos/{id}/content
    Supports variants: video (MP4), thumbnail (WebP), spritesheet (JPG)
    """
    try:
        client = get_openai_client()
        
        variant = request.variant or "video"
        logger.info(f"Fetching video content: {request.videoId}, variant={variant}")
        
        # Download the video content
        content = await client.videos.download_content(request.videoId, variant=variant)
        
        # Convert to base64 data URL for frontend
        if variant == "video":
            content_bytes = await content.read() if hasattr(content, 'read') else content
            if isinstance(content_bytes, bytes):
                video_b64 = base64.b64encode(content_bytes).decode("utf-8")
                video_url = f"data:video/mp4;base64,{video_b64}"
            else:
                # If it returns a URL directly
                video_url = str(content_bytes)
        else:
            # Thumbnail or spritesheet
            content_bytes = await content.read() if hasattr(content, 'read') else content
            if variant == "thumbnail":
                video_url = f"data:image/webp;base64,{base64.b64encode(content_bytes).decode('utf-8')}"
            else:
                video_url = f"data:image/jpeg;base64,{base64.b64encode(content_bytes).decode('utf-8')}"
        
        logger.info(f"Video content fetched successfully")
        
        return SoraFetchResponse(
            success=True,
            data={"videoData": video_url},
            videoUrl=video_url
        )
        
    except Exception as e:
        logger.error(f"Video fetch error: {e}", exc_info=True)
        return SoraFetchResponse(success=False, error=str(e))


async def list_videos(limit: int = 20, after: Optional[str] = None, order: str = "desc") -> dict:
    """
    List videos with pagination
    
    Per docs: GET /videos
    """
    try:
        client = get_openai_client()
        
        params = {"limit": limit, "order": order}
        if after:
            params["after"] = after
        
        response = await client.videos.list(**params)
        
        return {
            "success": True,
            "videos": [
                {
                    "id": v.id,
                    "status": v.status,
                    "model": getattr(v, "model", None),
                    "created_at": getattr(v, "created_at", None),
                }
                for v in response.data
            ],
            "has_more": response.has_more,
        }
        
    except Exception as e:
        logger.error(f"List videos error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


async def delete_video(video_id: str) -> dict:
    """
    Delete a video
    
    Per docs: DELETE /videos/{id}
    """
    try:
        client = get_openai_client()
        
        await client.videos.delete(video_id)
        
        logger.info(f"Video deleted: {video_id}")
        
        return {"success": True, "deleted": video_id}
        
    except Exception as e:
        logger.error(f"Delete video error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}
