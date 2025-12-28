"""
Gemini Image Agent
Provides image generation and editing using Google Gemini API

Features:
- Text-to-image generation
- Image editing (text + image → image)
- Multi-turn conversational editing
- Up to 14 reference images (Gemini 3 Pro)
- Google Search grounding
- 1K/2K/4K resolution output
- Multiple aspect ratios
"""

from .schemas import (
    GeminiImageGenerateRequest,
    GeminiImageEditRequest,
    GeminiMultiTurnRequest,
    GeminiImageResponse,
    ConversationMessage,
    ConversationPart,
    InlineImage,
    ImageConfig,
)

from .service import (
    generate_image,
    edit_image,
    multi_turn_edit,
)

__all__ = [
    # Schemas
    "GeminiImageGenerateRequest",
    "GeminiImageEditRequest", 
    "GeminiMultiTurnRequest",
    "GeminiImageResponse",
    "ConversationMessage",
    "ConversationPart",
    "InlineImage",
    "ImageConfig",
    # Service functions
    "generate_image",
    "edit_image",
    "multi_turn_edit",
]
