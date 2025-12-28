"""
Content Improvement Schemas
Pydantic models for content description improvement
"""
from typing import Optional, Literal
from pydantic import BaseModel, Field


Platform = Literal["instagram", "facebook", "twitter", "linkedin", "tiktok", "youtube"]
PostType = Literal["post", "feed", "carousel", "reel", "story", "video", "short", "slideshow"]


class ImproveContentRequest(BaseModel):
    """Request to improve content description"""
    description: str = Field(..., description="Current content description to improve")
    platform: Platform = Field(..., description="Target social media platform")
    postType: Optional[PostType] = Field(None, description="Type of post")
    additionalInstructions: Optional[str] = Field(
        None, description="Optional user-provided guidance for improvements"
    )
    modelId: Optional[str] = Field(None, description="LLM model ID to use")


class ImproveContentResponse(BaseModel):
    """Response with improved content"""
    success: bool = Field(..., description="Success status")
    improvedDescription: str = Field(..., description="AI-improved description")
    metadata: dict = Field(..., description="Metadata about the improvement")


# Platform guidelines for character limits and features
PLATFORM_GUIDELINES = {
    "instagram": {
        "characterLimit": 2200,
        "useHashtags": True,
        "useEmojis": True,
        "tone": "Visual, engaging, lifestyle-focused"
    },
    "facebook": {
        "characterLimit": 63206,
        "useHashtags": False,
        "useEmojis": True,
        "tone": "Conversational, community-focused"
    },
    "twitter": {
        "characterLimit": 280,
        "useHashtags": True,
        "useEmojis": True,
        "tone": "Concise, witty, newsworthy"
    },
    "linkedin": {
        "characterLimit": 3000,
        "useHashtags": True,
        "useEmojis": False,
        "tone": "Professional, thought-leadership"
    },
    "tiktok": {
        "characterLimit": 2200,
        "useHashtags": True,
        "useEmojis": True,
        "tone": "Trendy, authentic, entertaining"
    },
    "youtube": {
        "characterLimit": 5000,
        "useHashtags": True,
        "useEmojis": True,
        "tone": "Informative, engaging, SEO-optimized"
    }
}
