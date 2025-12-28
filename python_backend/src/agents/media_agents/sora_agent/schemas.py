"""
Sora Agent Schemas
OpenAI Video Generation API (Sora 2) - Production Implementation
Per latest OpenAI Video API documentation
"""
from typing import Optional, Literal, List
from pydantic import BaseModel, Field


# Model options per OpenAI docs
SoraModel = Literal["sora-2", "sora-2-pro"]

# Size options per OpenAI docs
SoraSize = Literal[
    "1280x720",    # HD 16:9
    "1920x1080",   # Full HD 16:9
    "1024x576",    # Compact 16:9
    "720x1280",    # HD 9:16 Portrait
    "1080x1920",   # Full HD 9:16 Portrait
    "480x480",     # Square
]

# Video job status per OpenAI docs
SoraStatus = Literal["queued", "in_progress", "completed", "failed"]


# ============================================================================
# REQUEST SCHEMAS
# ============================================================================

class SoraGenerateRequest(BaseModel):
    """
    Text-to-video generation request
    POST /videos
    """
    prompt: str = Field(..., min_length=1, max_length=5000, description="Video description")
    model: Optional[SoraModel] = Field("sora-2", description="sora-2 (fast) or sora-2-pro (quality)")
    size: Optional[SoraSize] = Field("1280x720", description="Video resolution")
    seconds: Optional[str] = Field("8", description="Duration: 5-20 seconds as string")


class SoraImageToVideoRequest(BaseModel):
    """
    Image-to-video generation request (image as first frame)
    POST /videos with input_reference
    """
    prompt: str = Field(..., min_length=1, max_length=5000, description="Video description")
    imageUrl: str = Field(..., description="Image URL or base64 data URL (first frame)")
    model: Optional[SoraModel] = Field("sora-2", description="Model to use")
    size: Optional[SoraSize] = Field("1280x720", description="Video resolution (must match image)")
    seconds: Optional[str] = Field("8", description="Duration in seconds")


class SoraRemixRequest(BaseModel):
    """
    Remix completed video request
    POST /videos/{id}/remix
    """
    previousVideoId: str = Field(..., description="ID of completed video to remix")
    prompt: str = Field(..., min_length=1, max_length=5000, description="Description of changes")


class SoraStatusRequest(BaseModel):
    """Request to check video status"""
    videoId: str = Field(..., description="Video job ID")


class SoraFetchRequest(BaseModel):
    """Request to fetch completed video"""
    videoId: str = Field(..., description="Video job ID")
    variant: Optional[Literal["video", "thumbnail", "spritesheet"]] = Field("video")


# ============================================================================
# RESPONSE SCHEMAS
# ============================================================================

class SoraVideoData(BaseModel):
    """Video job data from OpenAI"""
    id: str
    status: SoraStatus
    model: Optional[str] = None
    progress: Optional[int] = Field(None, ge=0, le=100)
    size: Optional[str] = None
    seconds: Optional[str] = None
    created_at: Optional[int] = None


class SoraGenerateResponse(BaseModel):
    """Response from video generation start"""
    success: bool
    videoId: Optional[str] = None
    status: Optional[SoraStatus] = None
    data: Optional[SoraVideoData] = None
    error: Optional[str] = None


class SoraStatusResponse(BaseModel):
    """Response from status check"""
    success: bool
    data: Optional[dict] = None
    error: Optional[str] = None


class SoraFetchResponse(BaseModel):
    """Response from video fetch"""
    success: bool
    data: Optional[dict] = None
    videoUrl: Optional[str] = None
    error: Optional[str] = None


# ============================================================================
# CONSTANTS
# ============================================================================

SORA_MODELS = [
    {
        "id": "sora-2",
        "name": "Sora 2",
        "description": "Fast, flexible video generation for rapid iteration",
        "estimatedTime": "1-3 minutes"
    },
    {
        "id": "sora-2-pro",
        "name": "Sora 2 Pro",
        "description": "Higher quality production output for cinematic footage",
        "estimatedTime": "3-5 minutes"
    },
]

SORA_SIZES = [
    {"value": "1280x720", "label": "HD 16:9", "aspect": "16:9"},
    {"value": "1920x1080", "label": "Full HD 16:9", "aspect": "16:9"},
    {"value": "1024x576", "label": "Compact 16:9", "aspect": "16:9"},
    {"value": "720x1280", "label": "HD 9:16 Portrait", "aspect": "9:16"},
    {"value": "1080x1920", "label": "Full HD 9:16 Portrait", "aspect": "9:16"},
    {"value": "480x480", "label": "Square", "aspect": "1:1"},
]

SORA_DURATIONS = [
    {"value": "5", "label": "5 seconds"},
    {"value": "8", "label": "8 seconds"},
    {"value": "10", "label": "10 seconds"},
    {"value": "15", "label": "15 seconds"},
    {"value": "16", "label": "16 seconds (YouTube Short max)"},
    {"value": "20", "label": "20 seconds (maximum)"},
]
