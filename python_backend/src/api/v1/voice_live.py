"""
Voice Live WebSocket endpoint using ADK Bidi-streaming.

Based on: https://github.com/google/adk-samples/tree/main/python/agents/bidi-demo
"""

import asyncio
import json
import logging
import uuid
import base64
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from google.adk.runners import Runner
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.adk.sessions import InMemorySessionService
from google.genai import types

from src.voice_agent.agent import agent

logger = logging.getLogger(__name__)

# Router
router = APIRouter(prefix="/api/v1/voice", tags=["voice"])

# Application name constant
APP_NAME = "voice-agent"

# ========================================
# Phase 1: Application Initialization (once at startup)
# ========================================

# Session service for managing user sessions
session_service = InMemorySessionService()

# Runner connects the agent with session management
runner = Runner(
    app_name=APP_NAME,
    agent=agent,
    session_service=session_service
)

# ========================================
# Test endpoint
# ========================================
@router.get("/test")
async def test():
    """Test endpoint to verify router is registered."""
    return {"status": "ok", "message": "Voice Live API is running with ADK"}


# ========================================
# WebSocket endpoint
# ========================================
@router.websocket("/live")
async def voice_live_websocket(websocket: WebSocket):
    """WebSocket endpoint for bidirectional streaming with ADK.
    
    Supports:
    - Binary audio frames (16kHz PCM)
    - JSON messages for text, images, and config
    """
    await websocket.accept()
    logger.info("[Voice Live] WebSocket connection accepted")
    
    # Generate unique IDs for this session
    user_id = f"user-{uuid.uuid4().hex[:8]}"
    session_id = f"session-{uuid.uuid4().hex[:8]}"
    
    # Default voice (can be overridden by client config message)
    selected_voice = "Sulafat"
    
    # ========================================
    # Phase 2: Session Initialization
    # ========================================
    
    # Automatically determine response modality based on model
    model_name = agent.model
    is_native_audio = "native-audio" in model_name.lower()
    
    if is_native_audio:
        response_modalities = ["AUDIO"]
        run_config = RunConfig(
            streaming_mode=StreamingMode.BIDI,
            response_modalities=response_modalities,
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
            session_resumption=types.SessionResumptionConfig(),
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=selected_voice
                    )
                )
            ),
        )
        logger.info(f"[Voice Live] Native audio model: {model_name}, using AUDIO modality")
    else:
        response_modalities = ["TEXT"]
        run_config = RunConfig(
            streaming_mode=StreamingMode.BIDI,
            response_modalities=response_modalities,
            session_resumption=types.SessionResumptionConfig(),
        )
        logger.info(f"[Voice Live] Half-cascade model: {model_name}, using TEXT modality")
    
    # Get or create session
    session = await session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id
    )
    if not session:
        await session_service.create_session(
            app_name=APP_NAME, user_id=user_id, session_id=session_id
        )
    
    # Create LiveRequestQueue for message passing
    live_request_queue = LiveRequestQueue()
    
    # ========================================
    # Phase 3: Active Session (concurrent bidirectional communication)
    # ========================================
    
    async def upstream_task():
        """Receives messages from WebSocket and sends to LiveRequestQueue."""
        logger.debug("[Voice Live] upstream_task started")
        try:
            while True:
                message = await websocket.receive()
                
                # Handle binary frames (audio data)
                if "bytes" in message:
                    audio_data = message["bytes"]
                    logger.debug(f"[Voice Live] Received audio chunk: {len(audio_data)} bytes")
                    
                    audio_blob = types.Blob(
                        mime_type="audio/pcm;rate=16000",
                        data=audio_data
                    )
                    live_request_queue.send_realtime(audio_blob)
                
                # Handle text frames (JSON messages)
                elif "text" in message:
                    text_data = message["text"]
                    try:
                        json_message = json.loads(text_data)
                        msg_type = json_message.get("type")
                        
                        # Handle config message (voice selection, etc.)
                        if msg_type == "config":
                            voice = json_message.get("voice", "Sulafat")
                            logger.info(f"[Voice Live] Config received, voice: {voice}")
                            # Note: Voice config is set in RunConfig, would need to recreate run_live
                        
                        # Handle image data
                        elif msg_type == "image":
                            logger.debug("[Voice Live] Received image data")
                            image_data = base64.b64decode(json_message["data"])
                            mime_type = json_message.get("mimeType", "image/jpeg")
                            
                            image_blob = types.Blob(
                                mime_type=mime_type,
                                data=image_data
                            )
                            live_request_queue.send_realtime(image_blob)
                        
                        # Handle text message
                        elif msg_type == "text":
                            content = types.Content(
                                parts=[types.Part(text=json_message["text"])]
                            )
                            live_request_queue.send_content(content)
                        
                        # Handle close request
                        elif msg_type == "close":
                            logger.info("[Voice Live] Client requested close")
                            break
                            
                    except json.JSONDecodeError:
                        logger.warning(f"[Voice Live] Invalid JSON: {text_data[:100]}")
                        
        except WebSocketDisconnect:
            logger.info("[Voice Live] Client disconnected (upstream)")
        except asyncio.CancelledError:
            logger.debug("[Voice Live] upstream_task cancelled")
            raise
        except Exception as e:
            logger.error(f"[Voice Live] upstream_task error: {e}")
    
    async def downstream_task():
        """Receives Events from run_live() and sends to WebSocket."""
        logger.debug("[Voice Live] downstream_task started")
        try:
            async for event in runner.run_live(
                user_id=user_id,
                session_id=session_id,
                live_request_queue=live_request_queue,
                run_config=run_config,
            ):
                # Serialize event to JSON and send to client
                event_json = event.model_dump_json(exclude_none=True, by_alias=True)
                logger.debug(f"[Voice Live] Event: {event_json[:200]}...")
                await websocket.send_text(event_json)
                
        except WebSocketDisconnect:
            logger.info("[Voice Live] Client disconnected (downstream)")
        except asyncio.CancelledError:
            logger.debug("[Voice Live] downstream_task cancelled")
            raise
        except Exception as e:
            logger.error(f"[Voice Live] downstream_task error: {e}")
    
    # Run both tasks concurrently
    try:
        logger.info("[Voice Live] Starting concurrent upstream/downstream tasks")
        await asyncio.gather(upstream_task(), downstream_task())
    except WebSocketDisconnect:
        logger.info("[Voice Live] Client disconnected")
    except Exception as e:
        logger.error(f"[Voice Live] Session error: {e}")
    finally:
        # ========================================
        # Phase 4: Session Termination
        # ========================================
        logger.info("[Voice Live] Closing live_request_queue")
        live_request_queue.close()
        logger.info("[Voice Live] Session ended")
