"""
Content Improvement Service
AI-powered social media content description improvement
"""
import logging
from langchain.agents import create_agent

from .schemas import ImproveContentRequest, ImproveContentResponse, PLATFORM_GUIDELINES
from .prompts import build_improvement_system_prompt
from langchain_google_genai import ChatGoogleGenerativeAI
from ...config import settings

logger = logging.getLogger(__name__)


async def improve_content_description(
    request: ImproveContentRequest
) -> ImproveContentResponse:
    """
    Improve social media content description using AI
    """
    try:
        # Validate platform
        if request.platform not in PLATFORM_GUIDELINES:
            raise ValueError(f"Unsupported platform: {request.platform}")
        
        # Build prompts
        system_prompt = build_improvement_system_prompt(
            request.platform,
            request.postType
        )
        
        user_prompt = f'Improve this: """{request.description}"""'
        if request.additionalInstructions:
            user_prompt += f"\n\nInstructions: {request.additionalInstructions}"
        
        # Create model
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
        
        # Extract improved description
        messages = result.get("messages", [])
        last_message = messages[-1] if messages else None
        improved_description = str(last_message.content).strip() if last_message else ""
        
        logger.info(f"Content improved for {request.platform}")
        
        return ImproveContentResponse(
            success=True,
            improvedDescription=improved_description,
            metadata={
                "platform": request.platform,
                "postType": request.postType
            }
        )
        
    except Exception as e:
        logger.error(f"Content improvement error: {e}", exc_info=True)
        raise
