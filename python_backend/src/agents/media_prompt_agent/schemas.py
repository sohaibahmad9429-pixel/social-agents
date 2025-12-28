"""
Media Prompt Improvement Schemas
Pydantic models for AI generation prompt improvement
"""
from typing import Optional, Literal
from pydantic import BaseModel, Field


MediaType = Literal["image-generation", "image-editing", "video-generation", "video-editing"]
MediaProvider = Literal["openai", "google", "midjourney", "runway", "veo", "imagen", "stable-diffusion"]


class ImprovePromptRequest(BaseModel):
    """Request to improve AI generation prompt"""
    originalPrompt: str = Field(..., description="Original prompt to improve")
    mediaType: MediaType = Field(..., description="Type of media being generated")
    mediaSubType: Optional[str] = Field(None, description="Specific subtype (e.g., 'portrait', 'landscape')")
    provider: Optional[MediaProvider] = Field(None, description="Target AI provider")
    model: Optional[str] = Field(None, description="Specific model name")
    userInstructions: Optional[str] = Field(None, description="User guidance for improvements")
    modelId: Optional[str] = Field(None, description="LLM model ID to use for improvement")


class ImprovePromptResponse(BaseModel):
    """Response with improved prompt"""
    success: bool = Field(..., description="Success status")
    improvedPrompt: str = Field(..., description="AI-improved generation prompt")


# Media type guidelines
MEDIA_TYPE_GUIDELINES = {
    "image-generation": {
        "focus": "Visual composition, lighting, style, details",
        "keywords": ["composition", "lighting", "color palette", "style", "mood", "details", "quality"],
        "aspectRatios": ["1:1", "4:5", "16:9", "9:16"]
    },
    "image-editing": {
        "focus": "Specific edits, transformations, enhancements",
        "keywords": ["modify", "enhance", "transform", "adjust", "refine"],
        "aspectRatios": ["preserve original"]
    },
    "video-generation": {
        "focus": "Motion, pacing, camera movement, scene transitions",
        "keywords": ["motion", "camera", "pacing", "transitions", "duration", "style"],
        "aspectRatios": ["16:9", "9:16", "1:1"]
    },
    "video-editing": {
        "focus": "Cuts, effects, transitions, timing",
        "keywords": ["edit", "cut", "transition", "effect", "timing"],
        "aspectRatios": ["preserve original"]
    }
}
