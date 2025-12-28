"""
Media Prompt Improvement Service  
AI-powered prompt enhancement for image/video generation
"""
import logging
from langchain.agents import create_agent

from .schemas import ImprovePromptRequest, ImprovePromptResponse, MEDIA_TYPE_GUIDELINES
from .prompts import build_prompt_improvement_system_prompt
from langchain_google_genai import ChatGoogleGenerativeAI
from ...config import settings

logger = logging.getLogger(__name__)


async def improve_media_prompt(
    request: ImprovePromptRequest
) -> ImprovePromptResponse:
    """
    Improve AI generation prompt for images/videos
    
    Args:
        request: Prompt improvement request
        
    Returns:
        Improved prompt response
    """
    try:
        # Validate media type
        if request.mediaType not in MEDIA_TYPE_GUIDELINES:
            raise ValueError(f"Unsupported media type: {request.mediaType}")
        
        # Build system prompt
        system_prompt = build_prompt_improvement_system_prompt(
            request.mediaType,
            request.provider
        )
        
        # Build user prompt
        user_prompt = f"""Original Prompt:
\"\"\"{request.originalPrompt}\"\"\"
"""
        
        if request.mediaSubType:
            user_prompt += f"\nMedia Subtype: {request.mediaSubType}\n"
        
        if request.model:
            user_prompt += f"\nTarget Model: {request.model}\n"
        
        if request.userInstructions:
            user_prompt += f"\nUser Instructions: {request.userInstructions}\n"
        
        user_prompt += "\nProvide the improved prompt:"
        
        # Create simple Google Gemini model
        model = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=settings.GOOGLE_API_KEY,
            temperature=0.7,
        )
        
        # Create agent (simple, no tools)
        agent = create_agent(
            model=model,
            tools=[],
            system_prompt=system_prompt
        )
        
        # Invoke agent
        result = await agent.ainvoke({
            "messages": [{"role": "user", "content": user_prompt}]
        })
        
        # Extract improved prompt
        messages = result.get("messages", [])
        last_message = messages[-1] if messages else None
        
        if not last_message:
            raise ValueError("No response from agent")
        
        improved_prompt = (
            last_message.get("content", "")
            if isinstance(last_message, dict)
            else str(last_message.content) if hasattr(last_message, "content") else ""
        )
        
        improved_prompt = improved_prompt.strip()
        
        if not improved_prompt:
            raise ValueError("Agent returned empty response")
        
        logger.info(f"Prompt improved for {request.mediaType}")
        
        return ImprovePromptResponse(
            success=True,
            improvedPrompt=improved_prompt,
        )
        
    except Exception as e:
        logger.error(f"Prompt improvement error: {e}", exc_info=True)
        raise
