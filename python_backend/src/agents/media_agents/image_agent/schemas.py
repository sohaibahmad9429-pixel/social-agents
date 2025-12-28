"""
Image Generation Schemas
OpenAI gpt-image-1.5 support per latest API docs
"""
from typing import Optional, Literal, List
from pydantic import BaseModel, Field


# Type definitions per OpenAI docs
ImageSize = Literal["1024x1024", "1536x1024", "1024x1536", "auto"]
ImageQuality = Literal["low", "medium", "high", "auto"]
ImageFormat = Literal["png", "jpeg", "webp"]
ImageBackground = Literal["transparent", "opaque", "auto"]
InputFidelity = Literal["low", "high"]
Moderation = Literal["auto", "low"]


# ============================================================================
# GENERATION REQUEST - Frontend sends { prompt, options: {...} }
# ============================================================================

class FrontendImageOptions(BaseModel):
    """Options object from frontend"""
    model: Optional[str] = Field("gpt-image-1.5", description="Model to use")
    size: Optional[ImageSize] = Field("1024x1024", description="Image size")
    quality: Optional[ImageQuality] = Field("medium", description="Quality level")
    format: Optional[ImageFormat] = Field("png", description="Output format")
    background: Optional[ImageBackground] = Field("auto", description="Background type")
    moderation: Optional[Moderation] = Field("auto", description="Moderation level")
    output_compression: Optional[int] = Field(None, ge=0, le=100, description="JPEG/WebP compression 0-100%")
    n: Optional[int] = Field(1, ge=1, le=10, description="Number of images to generate")


class FrontendImageRequest(BaseModel):
    """Image generation request: { prompt, options }"""
    prompt: str = Field(..., min_length=1, max_length=32000, description="Image generation prompt")
    options: Optional[FrontendImageOptions] = Field(default_factory=FrontendImageOptions)


# ============================================================================
# EDIT REQUEST - Inpainting with mask
# ============================================================================

class ImageEditRequest(BaseModel):
    """
    Image editing with optional mask (inpainting)
    Per OpenAI docs: supports size, quality, format, background
    """
    originalImageUrl: str = Field(..., description="Original image (URL or base64 data URL)")
    maskImageUrl: Optional[str] = Field(None, description="Mask image with alpha channel")
    prompt: str = Field(..., min_length=1, max_length=32000, description="Edit prompt")
    # Output options per OpenAI docs
    size: Optional[ImageSize] = Field("1024x1024", description="Output image size")
    quality: Optional[ImageQuality] = Field("medium", description="Quality: low/medium/high")
    format: Optional[ImageFormat] = Field("png", description="Output format: png/jpeg/webp")
    background: Optional[ImageBackground] = Field("auto", description="Background: transparent/opaque/auto")
    output_compression: Optional[int] = Field(None, ge=0, le=100, description="Compression for JPEG/WebP")


# ============================================================================
# REFERENCE REQUEST - Generate new image using reference images
# ============================================================================

class ImageReferenceRequest(BaseModel):
    """
    Reference-based image generation
    Per OpenAI docs: supports multiple reference images and input_fidelity
    - gpt-image-1.5: First 5 images preserved with high fidelity
    - input_fidelity='high': Preserves faces, logos, fine details
    """
    referenceImages: List[str] = Field(..., description="Reference image URLs (max 5 for high fidelity)")
    prompt: str = Field(..., min_length=1, max_length=32000, description="Generation prompt")
    input_fidelity: Optional[InputFidelity] = Field("low", description="'high' preserves faces/logos")
    # Output options
    size: Optional[ImageSize] = Field("1024x1024", description="Output image size")
    quality: Optional[ImageQuality] = Field("medium", description="Quality level")
    format: Optional[ImageFormat] = Field("png", description="Output format")
    background: Optional[ImageBackground] = Field("auto", description="Background type")


# ============================================================================
# RESPONSE SCHEMAS - Match frontend expectations
# ============================================================================

class ImageGenerationMetadata(BaseModel):
    """Metadata about generated image"""
    model: str = "gpt-image-1.5"
    promptUsed: str
    revisedPrompt: Optional[str] = None
    size: Optional[str] = None
    quality: Optional[str] = None
    format: Optional[str] = None


class ImageGenerationData(BaseModel):
    """Data wrapper - Frontend expects { imageUrl, metadata }"""
    imageUrl: str = Field(..., description="Data URL of generated image")
    metadata: Optional[ImageGenerationMetadata] = None


class ImageGenerationResponse(BaseModel):
    """Response format: { success, data: { imageUrl, metadata }, error? }"""
    success: bool
    data: Optional[ImageGenerationData] = None
    error: Optional[str] = None


# ============================================================================
# PRESETS
# ============================================================================

class ImagePreset(BaseModel):
    """Preset configuration for image generation"""
    id: str
    name: str
    description: str
    icon: str
    size: ImageSize
    quality: ImageQuality
    format: ImageFormat
    background: ImageBackground
    category: Literal["platform", "quality", "style"]


