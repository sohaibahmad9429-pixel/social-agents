"""
Content Improvement API Endpoint
Exposes AI-powered content improvement via REST API
"""
from fastapi import APIRouter, HTTPException
import logging

from ...agents.content_improvement_agent import (
    improve_content_description,
    ImproveContentRequest,
    ImproveContentResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/content", tags=["Content Improvement"])


@router.post("/improve", response_model=ImproveContentResponse)
async def improve_content(request: ImproveContentRequest) -> ImproveContentResponse:
    """
    Improve social media content description using AI
    
    Args:
        request: Content improvement request with description and platform
        
    Returns:
        Improved content with metadata
    """
    try:
        result = await improve_content_description(request)
        return result
    except ValueError as e:
        logger.warning(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Content improvement failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to improve content: {str(e)}"
        )
