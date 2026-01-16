"""
Deep Agents - FastAPI Router

SSE streaming endpoint for the content writer agent.
Matches the deep-agents-ui streaming format.

Reference: https://github.com/langchain-ai/deep-agents-ui
"""
import json
import logging
from typing import Optional, AsyncGenerator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from .agent import get_agent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/deep-agents", tags=["Deep Agents"])


# =============================================================================
# Request/Response Models
# =============================================================================

class ContentBlock(BaseModel):
    """Multimodal content block."""
    type: str
    text: Optional[str] = None
    data: Optional[str] = None
    mimeType: Optional[str] = None


class ChatRequest(BaseModel):
    """Chat request matching deep-agents-ui format."""
    message: str = Field(..., description="User message")
    threadId: str = Field(..., description="Thread ID for conversation persistence")
    workspaceId: Optional[str] = Field(None, description="Workspace ID")
    modelId: Optional[str] = Field(None, description="Model ID for runtime model selection")
    contentBlocks: Optional[list[ContentBlock]] = Field(None, description="Multimodal content")
    enableReasoning: Optional[bool] = Field(True, description="Enable thinking/reasoning display")


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    agent: str


# =============================================================================
# SSE Helpers
# =============================================================================

def format_sse(data: dict) -> str:
    """Format data as SSE event."""
    return f"data: {json.dumps(data)}\n\n"


# =============================================================================
# Streaming Handler (matches content_writer.py pattern)
# =============================================================================

async def stream_agent_response(
    message: str,
    thread_id: str,
) -> AsyncGenerator[dict, None]:
    """Stream agent response using values stream mode.
    
    This matches the content_writer.py streaming pattern from the reference.
    
    Yields SSE events:
    - {"step": "streaming", "content": "..."}
    - {"step": "tool_call", "id": "...", "name": "...", "args": {...}}
    - {"step": "tool_result", "id": "...", "name": "...", "result": "..."}
    - {"step": "sub_agent", "name": "...", "status": "..."}
    - {"step": "done", "content": "..."}
    - {"step": "error", "content": "..."}
    """
    try:
        logger.info(f"Streaming chat - Thread: {thread_id}")
        
        agent = get_agent()
        
        # Track state
        printed_count = 0
        accumulated_content = ""
        seen_tool_calls = set()
        
        # Stream using values mode (matches reference)
        async for chunk in agent.astream(
            {"messages": [("user", message)]},
            config={"configurable": {"thread_id": thread_id}},
            stream_mode="values",
        ):
            if "messages" in chunk:
                messages = chunk["messages"]
                
                # Process only new messages
                if len(messages) > printed_count:
                    for msg in messages[printed_count:]:
                        
                        # AI Messages
                        if isinstance(msg, AIMessage):
                            # Process content
                            content = msg.content
                            if isinstance(content, list):
                                text_parts = [
                                    p.get("text", "") 
                                    for p in content 
                                    if isinstance(p, dict) and p.get("type") == "text"
                                ]
                                content = "\n".join(text_parts)
                            
                            if content and content.strip():
                                accumulated_content = content
                                yield {"step": "streaming", "content": accumulated_content}
                            
                            # Tool calls
                            if msg.tool_calls:
                                for tc in msg.tool_calls:
                                    tc_id = tc.get("id", "")
                                    tc_name = tc.get("name", "unknown")
                                    tc_args = tc.get("args", {})
                                    
                                    if tc_id and tc_id not in seen_tool_calls:
                                        seen_tool_calls.add(tc_id)
                                        
                                        # Check if this is a sub-agent call (task tool)
                                        if tc_name == "task":
                                            desc = tc_args.get("description", "researching...")
                                            yield {
                                                "step": "sub_agent",
                                                "id": tc_id,
                                                "name": "researcher",
                                                "status": "active",
                                                "description": desc[:60],
                                            }
                                        else:
                                            yield {
                                                "step": "tool_call",
                                                "id": tc_id,
                                                "name": tc_name,
                                                "args": tc_args,
                                            }
                        
                        # Tool Messages (results)
                        elif isinstance(msg, ToolMessage):
                            tc_id = getattr(msg, 'tool_call_id', '')
                            tc_name = getattr(msg, 'name', 'tool')
                            result = str(msg.content)[:500]  # Truncate long results
                            
                            if tc_name == "task":
                                yield {
                                    "step": "sub_agent",
                                    "id": tc_id,
                                    "name": "researcher",
                                    "status": "completed",
                                }
                            else:
                                yield {
                                    "step": "tool_result",
                                    "id": tc_id,
                                    "name": tc_name,
                                    "result": result,
                                }
                    
                    printed_count = len(messages)
        
        # Final done event
        yield {"step": "done", "content": accumulated_content}
        logger.info(f"Streaming completed - Thread: {thread_id}")
        
    except Exception as e:
        logger.error(f"Streaming error: {e}", exc_info=True)
        yield {"step": "error", "content": str(e)}


# =============================================================================
# Endpoints
# =============================================================================

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Check if the deep agents service is healthy."""
    try:
        get_agent()
        return HealthResponse(status="healthy", agent="content-writer")
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/chat")
async def chat_stream(request: ChatRequest):
    """Stream chat with the content writer agent.
    
    Returns Server-Sent Events (SSE) stream with:
    - streaming: Content being generated
    - tool_call: Tool invocation with name and args
    - tool_result: Tool execution result
    - sub_agent: Sub-agent activity
    - done: Final response
    - error: Error message
    """
    async def generate():
        try:
            message = request.message
            
            async for event in stream_agent_response(
                message=message,
                thread_id=request.threadId,
            ):
                yield format_sse(event)
                
        except Exception as e:
            logger.error(f"Chat stream error: {e}", exc_info=True)
            yield format_sse({"step": "error", "content": str(e)})
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.post("/threads/{thread_id}/history")
async def get_thread_history(thread_id: str):
    """Get conversation history for a thread."""
    return {
        "success": True,
        "threadId": thread_id,
        "messages": [],
    }
