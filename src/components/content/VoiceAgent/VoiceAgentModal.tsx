'use client';

/**
 * VoiceAgentModal - ADK Voice Agent Interface
 * 
 * Connects to Python backend ADK WebSocket for real-time voice conversations.
 * Uses LiveRequestQueue + Runner.run_live() pattern for audio streaming.
 * Supports bidirectional audio, transcriptions, and image sharing.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Mic, MicOff, Loader2, Volume2, Settings, ChevronDown, Video, VideoOff, Monitor, Camera, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Available voices for Gemini Live API - Optimized for Social Media Strategist
export const VOICE_OPTIONS = [
  { id: 'Sulafat', name: 'Sulafat', description: 'Woman - Warm, perfect for friendly guidance' },
  { id: 'Achird', name: 'Achird', description: 'Woman - Friendly, approachable expert' },
  { id: 'Puck', name: 'Puck', description: 'Man - Upbeat, energetic & engaging' },
  { id: 'Charon', name: 'Charon', description: 'Man - Informative, strategy advisor' },
  { id: 'Aoede', name: 'Aoede', description: 'Woman - Breezy, casual & creative' },
  { id: 'Fenrir', name: 'Fenrir', description: 'Man - Excitable, enthusiastic ideas' },
  { id: 'Sadachbia', name: 'Sadachbia', description: 'Woman - Lively, dynamic conversations' },
  { id: 'Laomedeia', name: 'Laomedeia', description: 'Woman - Upbeat, positive energy' },
  { id: 'Rasalgethi', name: 'Rasalgethi', description: 'Man - Informative, teaching mode' },
  { id: 'Vindemiatrix', name: 'Vindemiatrix', description: 'Woman - Gentle, calm guidance' },
];

// Supported languages for Gemini Live API native audio
// Note: Language detection is handled automatically by the model
const LANGUAGE_OPTIONS = [
  { id: 'en-US', name: 'English' },
  { id: 'en-IN', name: 'English (India)' },
  { id: 'hi-IN', name: 'Hindi' },
  { id: 'ur-PK', name: 'Urdu' },
  { id: 'ar-XA', name: 'Arabic' },
  { id: 'de-DE', name: 'German' },
  { id: 'es-US', name: 'Spanish' },
];

interface VoiceAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContentGenerated: (content: any) => void;
  userId: string;
  initialVoice?: string;
  initialLanguage?: string;
}

type VoiceState = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking' | 'error';

interface TranscriptEntry {
  id: string;
  text: string;
  isUser: boolean;
}

// Audio Processor Worklet code
const AUDIO_PROCESSOR_WORKLET = `
class AudioProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const channelData = input[0];
      // Convert Float32 to Int16 PCM
      const pcmData = new Int16Array(channelData.length);
      for (let i = 0; i < channelData.length; i++) {
        pcmData[i] = Math.max(-32768, Math.min(32767, channelData[i] * 32768));
      }
      // Send the Int16 buffer to the main thread
      this.port.postMessage(pcmData.buffer, [pcmData.buffer]);
    }
    return true;
  }
}
registerProcessor('audio-processor', AudioProcessor);
`;



// Retry configuration
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

// Python backend WebSocket URL
const getWebSocketUrl = () => {
  // Import is not possible here (client component), so replicate the logic
  // Use NEXT_PUBLIC_PYTHON_BACKEND_URL which is already configured in render.yaml
  let backendUrl = process.env.NEXT_PUBLIC_PYTHON_BACKEND_URL || 'localhost:8000';

  // Normalize URL
  if (!backendUrl.startsWith('http://') && !backendUrl.startsWith('https://')) {
    // Handle Render service hostname
    if (backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1')) {
      backendUrl = `http://${backendUrl}`;
    } else {
      // Render internal hostname - add .onrender.com if needed
      backendUrl = backendUrl.replace(/:\d+$/, '');
      if (!backendUrl.includes('.')) {
        backendUrl = `${backendUrl}.onrender.com`;
      }
      backendUrl = `https://${backendUrl}`;
    }
  }

  // Convert http(s) to ws(s)
  const wsUrl = backendUrl.replace(/^http/, 'ws');
  return `${wsUrl}/api/v1/voice/live`;
};

export function VoiceAgentModal({
  isOpen,
  onClose,
  onContentGenerated,
  userId,
  initialVoice = 'Sulafat',
  initialLanguage = 'en-US',
}: VoiceAgentModalProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [selectedVoice] = useState(initialVoice);
  const [selectedLanguage] = useState(initialLanguage);
  const [hasGeneratedContent, setHasGeneratedContent] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Retry and reconnection state
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showRetryButton, setShowRetryButton] = useState(false);

  // Video sharing state
  const [showVideoMenu, setShowVideoMenu] = useState(false);
  const [videoMode, setVideoMode] = useState<'none' | 'webcam' | 'screen'>('none');
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  // Refs for WebSocket and audio
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isActiveRef = useRef(false);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef(0); // For seamless audio scheduling
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]); // Track active audio sources for interruption
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null); // For retry scheduling

  // Video sharing refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoFrameIntervalRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setTranscripts([]);
      setError(null);
      setVoiceState('idle');
      setStatusText('');
      setRetryCount(0);
      setShowRetryButton(false);
    }
  }, [isOpen]);

  // Cleanup retry timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Start voice session via Python WebSocket backend
   */
  const startSession = useCallback(async (isRetry: boolean = false) => {
    // Guard: Close any existing connection first
    if (wsRef.current) {
      wsRef.current.onclose = null; // Prevent error callback on intentional close
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    setVoiceState('connecting');
    setError(null);
    setShowRetryButton(false);
    setStatusText(isRetry ? `Reconnecting (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})...` : 'Connecting...');
    isActiveRef.current = true;

    try {
      // Connect to Python backend WebSocket
      const wsUrl = getWebSocketUrl();
      console.log('[Voice Live] Connecting to:', wsUrl);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[Voice Live] WebSocket connected');
        // Send initial config with selected voice
        ws.send(JSON.stringify({
          type: 'config',
          voice: selectedVoice
        }));
        setStatusText('Ready');
        startAudioCapture();
        setVoiceState('listening');
      };

      ws.onmessage = async (event) => {
        try {
          // Parse ADK Event format
          const adkEvent = JSON.parse(event.data);
          console.log('[Voice Live] ADK Event:', Object.keys(adkEvent));

          // Handle turn complete
          if (adkEvent.turnComplete) {
            console.log('[Voice Live] Turn complete');
            setVoiceState('listening');
            return;
          }

          // Handle interruption (VAD detected user speech)
          if (adkEvent.interrupted) {
            console.log('[Voice Live] Interrupted - stopping playback');
            stopAudioPlayback();
            setVoiceState('listening');
            return;
          }

          // Handle input transcription (user's spoken words)
          if (adkEvent.inputTranscription?.text) {
            const text = adkEvent.inputTranscription.text;
            const isFinished = adkEvent.inputTranscription.finished;
            if (text && isFinished) {
              setTranscripts(prev => [
                ...prev,
                { id: `user_${Date.now()}`, text, isUser: true }
              ]);
            }
          }

          // Handle output transcription (agent's spoken words)
          if (adkEvent.outputTranscription?.text) {
            const text = adkEvent.outputTranscription.text;
            const isFinished = adkEvent.outputTranscription.finished;
            if (text && isFinished) {
              setTranscripts(prev => [
                ...prev,
                { id: `ai_${Date.now()}`, text, isUser: false }
              ]);
            }
          }

          // Handle content (audio, text responses)
          if (adkEvent.content?.parts) {
            setVoiceState('speaking');
            for (const part of adkEvent.content.parts) {
              // Handle audio data
              if (part.inlineData?.mimeType?.startsWith('audio/pcm')) {
                const audioData = base64ToArrayBuffer(part.inlineData.data);
                scheduleAudioChunk(audioData);
              }
              // Handle text (if model returns text instead of audio)
              if (part.text) {
                console.log('[Voice Live] Text response:', part.text);
              }
            }
          }

          // Handle tool results (e.g., write_content tool)
          if (adkEvent.actions?.artifactDelta?.parts) {
            for (const part of adkEvent.actions.artifactDelta.parts) {
              if (part.text) {
                console.log('[Voice Live] Tool generated content:', part.text);
                setHasGeneratedContent(true);
                onContentGenerated({
                  type: 'written_content',
                  platform: 'text',
                  content: part.text,
                });
              }
            }
          }

          // Handle function call results directly
          if (adkEvent.functionResponse) {
            const response = adkEvent.functionResponse;
            if (response.name === 'write_content' && response.response?.content) {
              console.log('[Voice Live] write_content result:', response.response.content);
              setHasGeneratedContent(true);
              onContentGenerated({
                type: 'written_content',
                platform: 'text',
                content: response.response.content,
              });
            }
          }

        } catch (e) {
          console.error('[Voice Live] Error parsing ADK event:', e);
        }
      };

      ws.onerror = (e) => {
        // Only handle errors for the current connection
        if (wsRef.current !== ws) return;
        console.error('[Voice Live] WebSocket error:', e);
        handleConnectionError('WebSocket connection failed');
      };

      ws.onclose = (e) => {
        // Only handle close for the current connection
        if (wsRef.current !== ws) return;
        console.log('[Voice Live] WebSocket closed:', e.code, e.reason);
        if (isActiveRef.current) {
          handleConnectionError('Connection closed unexpectedly');
        }
      };

    } catch (err: any) {
      console.error('[Voice Live] Error starting session:', err);
      handleConnectionError(err.message || 'Failed to connect');
    }
  }, [selectedVoice, retryCount]);

  /**
   * Handle connection errors with exponential backoff retry
   */
  const handleConnectionError = useCallback((errorMessage: string) => {
    if (retryCount < MAX_RETRY_ATTEMPTS && isActiveRef.current) {
      const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
      console.log(`[Voice Live] Retry attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS} in ${delay}ms`);

      setIsRetrying(true);
      setError(`Connection failed. Retrying in ${delay / 1000}s...`);
      setVoiceState('connecting');
      setStatusText(`Retrying (${retryCount + 1}/${MAX_RETRY_ATTEMPTS})...`);

      retryTimeoutRef.current = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        startSession(true);
        setIsRetrying(false);
      }, delay);
    } else {
      // Max retries reached or user stopped
      setError(errorMessage + '. Please try again.');
      setVoiceState('error');
      setShowRetryButton(true);
      setIsRetrying(false);
    }
  }, [retryCount, startSession]);

  /**
   * Manual retry after max retries exhausted
   */
  const handleManualRetry = useCallback(() => {
    setRetryCount(0);
    startSession(false);
  }, [startSession]);

  /**
   * Start audio capture and send to Gemini
   */
  const startAudioCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      // Create audio context for capture
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);

      // Analyser for visualization
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      startVisualization();

      // Register and initialize AudioWorklet (Modern approach)
      const workletBlob = new Blob([AUDIO_PROCESSOR_WORKLET], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(workletBlob);

      await audioContextRef.current.audioWorklet.addModule(workletUrl);
      const workletNode = new AudioWorkletNode(audioContextRef.current, 'audio-processor');
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = (event) => {
        if (!isActiveRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        const pcmBuffer = event.data;

        // Send audio as binary WebSocket frame (more efficient than base64 JSON)
        // ADK backend expects raw PCM bytes
        wsRef.current.send(pcmBuffer);
      };

      source.connect(workletNode);
      workletNode.connect(audioContextRef.current.destination);

    } catch (err: any) {
      console.error('[Gemini Live] Error starting audio capture:', err);
      setError('Microphone access denied or audio initialization failed');
      setVoiceState('error');
    }
  };

  // Note: Tool calls are now handled by ADK backend (google_search tool)

  /**
   * Stop audio playback immediately (for VAD interruption)
   */
  const stopAudioPlayback = () => {
    // Stop all active audio sources
    for (const source of activeSourcesRef.current) {
      try {
        source.stop();
      } catch (e) {
        // Source may have already ended
      }
    }
    activeSourcesRef.current = [];

    // Clear the audio queue
    audioQueueRef.current = [];

    // Reset playback state
    isPlayingRef.current = false;
    nextPlayTimeRef.current = 0;
  };

  /**
   * Schedule audio chunk for seamless playback (low latency streaming)
   */
  const scheduleAudioChunk = async (audioData: ArrayBuffer) => {
    try {
      // Initialize playback context at 24kHz (Gemini output rate)
      if (!playbackContextRef.current || playbackContextRef.current.state === 'closed') {
        playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
        nextPlayTimeRef.current = 0;
      }

      const ctx = playbackContextRef.current;

      // Resume context if suspended (browser autoplay policy)
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      setVoiceState('speaking');
      isPlayingRef.current = true;

      // Use DataView for proper little-endian PCM16 handling
      const dataView = new DataView(audioData);
      const numSamples = audioData.byteLength / 2;
      const float32Array = new Float32Array(numSamples);

      for (let i = 0; i < numSamples; i++) {
        const int16 = dataView.getInt16(i * 2, true);
        float32Array[i] = int16 / 32768;
      }

      // Create audio buffer at 24kHz
      const audioBuffer = ctx.createBuffer(1, float32Array.length, 24000);
      audioBuffer.getChannelData(0).set(float32Array);

      // Create source and connect
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      // Track active source for interruption handling
      activeSourcesRef.current.push(source);

      // Schedule seamlessly - no gaps between chunks
      const now = ctx.currentTime;
      const startTime = Math.max(now, nextPlayTimeRef.current);
      nextPlayTimeRef.current = startTime + audioBuffer.duration;

      source.onended = () => {
        // Remove from active sources
        activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);

        // Check if this was the last scheduled chunk
        if (activeSourcesRef.current.length === 0) {
          isPlayingRef.current = false;
          if (isActiveRef.current) {
            setVoiceState('listening');
          }
        }
      };

      source.start(startTime);
    } catch (e) {
      console.error('[Gemini Live] Playback error:', e);
    }
  };

  /**
   * Audio visualization
   */
  const startVisualization = () => {
    const update = () => {
      if (!analyserRef.current || !isActiveRef.current) {
        setAudioLevel(0);
        return;
      }

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setAudioLevel(avg / 255);

      animationFrameRef.current = requestAnimationFrame(update);
    };
    update();
  };

  /**
   * Stop session
   */
  const stopSession = useCallback(() => {
    isActiveRef.current = false;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => { });
      audioContextRef.current = null;
    }

    if (playbackContextRef.current) {
      playbackContextRef.current.close().catch(() => { });
      playbackContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }

    analyserRef.current = null;
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    nextPlayTimeRef.current = 0;
    setVoiceState('idle');
    setAudioLevel(0);
    setStatusText('');
    setIsPaused(false);

    // Stop video capture
    if (videoFrameIntervalRef.current) {
      clearInterval(videoFrameIntervalRef.current);
      videoFrameIntervalRef.current = null;
    }
    setVideoMode('none');
    setVideoStream(null);
    setShowVideoMenu(false);

    // Cancel any pending retry
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    setRetryCount(0);
    setIsRetrying(false);
    setShowRetryButton(false);
  }, []);

  /**
   * Toggle pause/resume (mute/unmute microphone)
   */
  const togglePause = useCallback(() => {
    if (!mediaStreamRef.current) return;

    const audioTracks = mediaStreamRef.current.getAudioTracks();
    const newPausedState = !isPaused;

    // Mute/unmute all audio tracks
    audioTracks.forEach(track => {
      track.enabled = !newPausedState;
    });

    setIsPaused(newPausedState);

    if (newPausedState) {
      setStatusText('Paused');
      setVoiceState('processing'); // Show paused visual state
    } else {
      setStatusText('');
      setVoiceState('listening');
    }
  }, [isPaused]);

  /**
   * Start webcam capture
   */
  const startWebcam = useCallback(async () => {
    try {
      // ADK Recommendation: Request ideal resolution of 768x768
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 768 },
          height: { ideal: 768 },
          facingMode: 'user'
        }
      });
      setVideoStream(stream);
      setVideoMode('webcam');
      setShowVideoMenu(false);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Start sending video frames
      startVideoFrameCapture();
    } catch (err) {
      console.error('[Video] Webcam access failed:', err);
    }
  }, []);

  /**
   * Start screen capture
   */
  const startScreenCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setVideoStream(stream);
      setVideoMode('screen');
      setShowVideoMenu(false);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Handle stream end (user stops sharing)
      stream.getTracks().forEach(track => {
        track.addEventListener('ended', () => {
          stopVideoCapture();
        });
      });

      // Start sending video frames
      startVideoFrameCapture();
    } catch (err) {
      console.error('[Video] Screen capture failed:', err);
    }
  }, []);

  /**
   * Stop video capture
   */
  const stopVideoCapture = useCallback(() => {
    if (videoFrameIntervalRef.current) {
      clearInterval(videoFrameIntervalRef.current);
      videoFrameIntervalRef.current = null;
    }

    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      setVideoStream(null);
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setVideoMode('none');
  }, [videoStream]);

  /**
   * Start capturing and sending video frames to Gemini
   */
  const startVideoFrameCapture = useCallback(() => {
    if (videoFrameIntervalRef.current) {
      clearInterval(videoFrameIntervalRef.current);
    }

    // Send frames every 1 second (1 FPS) as per ADK recommended maximum
    videoFrameIntervalRef.current = window.setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ws = wsRef.current;

      if (!video || !canvas || !ws || ws.readyState !== WebSocket.OPEN) {
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // ADK Recommendation: 768px resolution for optimal processing
      const MAX_DIMENSION = 768;
      let width = video.videoWidth;
      let height = video.videoHeight;

      if (width > height) {
        if (width > MAX_DIMENSION) {
          height = (height * MAX_DIMENSION) / width;
          width = MAX_DIMENSION;
        }
      } else {
        if (height > MAX_DIMENSION) {
          width = (width * MAX_DIMENSION) / height;
          height = MAX_DIMENSION;
        }
      }

      canvas.width = width;
      canvas.height = height;

      if (canvas.width > 0 && canvas.height > 0) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // ADK Recommendation: Use 0.85 quality for optimal detail/bandwidth balance
        const base64 = canvas.toDataURL('image/jpeg', 0.85);
        const data = base64.slice(base64.indexOf(',') + 1);

        // Send video frame via WebSocket as JSON image message
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'image',
            data: data,
            mimeType: 'image/jpeg'
          }));
          console.log(`[Video] Frame sent via WebSocket (${width}x${height} @ 1 FPS)`);
        }
      }
    }, 1000); // 1 FPS as per ADK recommendation
  }, []);

  // Helper: Base64 to ArrayBuffer (handles both standard base64 and base64url)
  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    // Convert base64url to standard base64
    // Replace URL-safe characters: - with +, _ with /
    let standardBase64 = base64.replace(/-/g, '+').replace(/_/g, '/');

    // Add padding if needed
    while (standardBase64.length % 4) {
      standardBase64 += '=';
    }

    const binary = atob(standardBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  };



  const handleClose = () => {
    stopSession();
    onClose();
  };

  // Auto-start session when modal opens
  useEffect(() => {
    if (isOpen && voiceState === 'idle') {
      startSession();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Get status text
  const getStatusText = () => {
    switch (voiceState) {
      case 'idle': return 'Ready';
      case 'connecting': return 'Connecting...';
      case 'listening': return 'Listening...';
      case 'processing': return 'Processing...';
      case 'speaking': return 'Speaking...';
      case 'error': return 'Error';
      default: return '';
    }
  };

  const isActive = voiceState === 'listening' || voiceState === 'speaking' || voiceState === 'processing' || voiceState === 'connecting';

  // Get shadow color based on state
  const getShadowColor = () => {
    switch (voiceState) {
      case 'speaking': return 'rgba(139, 92, 246, 0.6)';
      case 'listening': return 'rgba(59, 130, 246, 0.6)';
      case 'processing': return 'rgba(245, 158, 11, 0.6)';
      case 'connecting': return 'rgba(249, 115, 22, 0.6)';
      case 'error': return 'rgba(239, 68, 68, 0.6)';
      default: return 'rgba(59, 130, 246, 0.5)';
    }
  };

  // Determine if orb should be centered (active conversation, no content yet)
  const shouldCenter = isActive && !hasGeneratedContent;
  const orbSize = shouldCenter ? 'w-40 h-40' : 'w-20 h-20';
  const iconSize = shouldCenter ? 'h-16 w-16' : 'h-9 w-9';
  const statusSize = shouldCenter ? 'text-base' : 'text-xs';

  return (
    <div className={`fixed z-50 transition-all duration-500 ease-in-out ${shouldCenter
      ? 'inset-0 flex items-center justify-center'
      : 'bottom-8 right-8'
      }`}>
      <div className={`relative flex flex-col items-center ${shouldCenter ? 'gap-3' : 'gap-3'}`}>
        {/* Voice orb - click to toggle start/stop */}
        <div className={`relative ${isActive ? 'animate-pulse-glow' : ''}`}>
          {isActive && (
            <>
              <div
                className={`absolute rounded-full border-2 animate-orb-ring pointer-events-none ${shouldCenter ? '-inset-8 border-cyan-400/50 dark:border-cyan-300/40' : '-inset-3 border-cyan-400/50 dark:border-cyan-300/40'}`}
                style={{ '--ring-delay': '0ms', boxShadow: '0 0 25px rgba(159, 72, 52, 0.93), 0 0 50px rgba(190, 60, 46, 0.97)' } as any}
              />
              <div
                className={`absolute rounded-full border-2 animate-orb-ring pointer-events-none ${shouldCenter ? '-inset-16 border-blue-400/35 dark:border-blue-300/25' : '-inset-6 border-blue-400/35 dark:border-blue-300/25'}`}
                style={{ '--ring-delay': '800ms', boxShadow: '0 0 20px rgba(99, 171, 79, 0.91), 0 0 40px rgba(77, 175, 50, 0.63)' } as any}
              />
              {shouldCenter && (
                <div
                  className="absolute -inset-24 rounded-full border border-indigo-400/20 dark:border-indigo-300/15 animate-orb-ring pointer-events-none"
                  style={{ '--ring-delay': '1600ms', boxShadow: '0 0 15px rgba(99, 111, 215, 0.84), 0 0 30px rgba(63, 109, 190, 0.75)' } as any}
                />
              )}
            </>
          )}

          <button
            onClick={() => {
              if (voiceState === 'idle' || voiceState === 'error') {
                startSession();
              } else {
                // Toggle pause/resume (mute/unmute mic)
                togglePause();
              }
            }}
            className={`${orbSize} rounded-full flex items-center justify-center transition-all duration-500 cursor-pointer ${voiceState === 'idle' ? 'bg-gradient-to-br from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
              : voiceState === 'connecting' ? 'bg-gradient-to-br from-orange-500 to-amber-500'
                : isPaused ? 'bg-gradient-to-br from-gray-500 to-slate-400'
                  : voiceState === 'listening' ? 'bg-gradient-to-br from-blue-500 to-cyan-300'
                    : voiceState === 'processing' ? 'bg-gradient-to-br from-amber-500 to-yellow-300'
                      : voiceState === 'speaking' ? 'bg-gradient-to-br from-violet-500 to-purple-300'
                        : 'bg-gradient-to-br from-red-500 to-rose-500'
              }`}
            style={{
              transform: `scale(${1 + audioLevel * 0.2})`,
            }}
          >
            {voiceState === 'connecting' ? (
              <Loader2 className={`${iconSize} text-white animate-spin`} />
            ) : isPaused ? (
              <MicOff className={`${iconSize} text-white`} />
            ) : voiceState === 'processing' ? (
              <Loader2 className={`${iconSize} text-white animate-spin`} />
            ) : voiceState === 'speaking' ? (
              <Volume2 className={`${iconSize} text-white animate-pulse`} />
            ) : voiceState === 'error' ? (
              <MicOff className={`${iconSize} text-white`} />
            ) : (
              <Mic className={`${iconSize} text-white`} />
            )}
          </button>
        </div>

        {/* Camera button - only show when voice is active */}
        {isActive && (
          <div className="relative">
            <button
              onClick={() => {
                if (videoMode !== 'none') {
                  stopVideoCapture();
                } else {
                  setShowVideoMenu(!showVideoMenu);
                }
              }}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 shadow-md ${videoMode !== 'none'
                ? 'bg-gradient-to-br from-green-500 to-emerald-500 text-white'
                : 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600'
                }`}
              title={videoMode !== 'none' ? 'Stop sharing' : 'Share video'}
            >
              {videoMode !== 'none' ? (
                <div className="relative">
                  <VideoOff className="h-4 w-4" />
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                </div>
              ) : (
                <Video className="h-4 w-4" />
              )}
            </button>

            {/* Video options dropdown */}
            {showVideoMenu && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[140px] z-50">
                <button
                  onClick={startScreenCapture}
                  className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  <Monitor className="h-4 w-4" />
                  Share Screen
                </button>
                <button
                  onClick={startWebcam}
                  className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  <Camera className="h-4 w-4" />
                  Webcam
                </button>
              </div>
            )}
          </div>
        )}

        {/* Status text with X button */}
        <div className="flex items-center gap-2 relative z-50">
          <span className={`${shouldCenter ? 'text-xs font-normal' : statusSize + ' font-medium'} transition-all duration-500 ${voiceState === 'listening' ? 'text-blue-700 dark:text-blue-300'
            : voiceState === 'speaking' ? 'text-violet-700 dark:text-violet-300'
              : voiceState === 'processing' ? 'text-amber-700 dark:text-amber-300'
                : voiceState === 'connecting' ? 'text-orange-700 dark:text-orange-300'
                  : voiceState === 'error' ? 'text-red-700 dark:text-red-300'
                    : 'text-gray-700 dark:text-gray-300'
            }`}>
            {getStatusText()}
          </span>

          {/* Retry button - shown when max retries exhausted */}
          {showRetryButton && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleManualRetry();
              }}
              className="w-6 h-6 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-colors cursor-pointer shadow-md z-50"
              title="Retry connection"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className={`${shouldCenter ? 'w-6 h-6' : 'w-4 h-4'} rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors cursor-pointer shadow-md z-50`}
            title="Stop session"
          >
            <X className={`${shouldCenter ? 'h-3 w-3' : 'h-2.5 w-2.5'}`} />
          </button>
        </div>
      </div>


      {/* Pulsing glow animation styles */}
      <style jsx>{`
        @keyframes pulse-glow {
          0%, 100% { 
            filter: brightness(1);
          }
          50% { 
            filter: brightness(1.1);
          }
        }
        @keyframes orb-ring {
          0% {
            transform: scale(0.85);
            opacity: 0;
          }
          30% {
            opacity: 0.6;
          }
          100% {
            transform: scale(1.4);
            opacity: 0;
          }
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
        .animate-orb-ring {
          animation: orb-ring 2.5s ease-out infinite;
          animation-delay: var(--ring-delay, 0ms);
        }
      `}</style>

      {/* Hidden video element for capturing frames */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="hidden"
      />

      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Video preview - small thumbnail when sharing */}
      {videoMode !== 'none' && videoStream && (
        <div className="fixed bottom-4 right-4 w-32 h-24 rounded-lg overflow-hidden shadow-lg border-2 border-green-500 z-50">
          <video
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            ref={(el) => {
              if (el && videoStream) {
                el.srcObject = videoStream;
              }
            }}
          />
          <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-green-500 text-white text-[10px] rounded font-medium">
            {videoMode === 'screen' ? 'Screen' : 'Camera'}
          </div>
        </div>
      )}
    </div>
  );
}
