"""Schemas module - Re-exports from agent folders"""

# Note: content_strategist_agent has been replaced by deep_agents
# These schemas are now defined locally for backwards compatibility
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

# Content Block for multimodal input (backwards compatibility)
class ContentBlock(BaseModel):
    type: str  # "text", "image", "file"
    mimeType: Optional[str] = None
    data: Optional[str] = None
    text: Optional[str] = None

# Chat Strategist Request (backwards compatibility)
class ChatStrategistRequest(BaseModel):
    message: str
    threadId: Optional[str] = None
    workspaceId: Optional[str] = None
    contentBlocks: Optional[List[ContentBlock]] = None
    modelId: Optional[str] = None
    enableReasoning: Optional[bool] = True

# Chat Strategist Response (backwards compatibility)
class ChatStrategistResponse(BaseModel):
    response: str
    thinking: Optional[str] = None
    suggestions: Optional[List[str]] = None

# Content Improvement imports
from ..agents.content_improvement_agent import (
    ImproveContentRequest,
    ImproveContentResponse,
    PLATFORM_GUIDELINES,
)
from ..agents.media_prompt_agent import (
    ImprovePromptRequest,
    ImprovePromptResponse,
    MediaType,
    MediaProvider,
    MEDIA_TYPE_GUIDELINES,
)
from .audiences import (
    AudienceSubtype,
    CustomerFileSource,
    CustomerDataField,
    CreateCustomAudienceRequest,
    CreateLookalikeRequest,
    AudienceResponse,
    AudienceListItem,
    UploadUsersRequest,
    UploadUsersResponse,
)

__all__ = [
    # Content Strategist Agent (backwards compatibility)
    "ChatStrategistRequest",
    "ChatStrategistResponse",
    "ContentBlock",
    # Content Improvement
    "ImproveContentRequest",
    "ImproveContentResponse",
    "PLATFORM_GUIDELINES",
    # Media Prompt Improvement
    "ImprovePromptRequest",
    "ImprovePromptResponse",
    "MediaType",
    "MediaProvider",
    "MEDIA_TYPE_GUIDELINES",
    # Audiences
    "AudienceSubtype",
    "CustomerFileSource",
    "CustomerDataField",
    "CreateCustomAudienceRequest",
    "CreateLookalikeRequest",
    "AudienceResponse",
    "AudienceListItem",
    "UploadUsersRequest",
    "UploadUsersResponse",
]
