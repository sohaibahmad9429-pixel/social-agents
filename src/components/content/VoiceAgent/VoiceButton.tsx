'use client';

/**
 * VoiceButton - Voice Agent Component
 * 
 * Always shows floating voice orb. Click to start, click again to stop.
 */

import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Mic, ChevronDown, Settings } from 'lucide-react';
import { VoiceAgentModal, VOICE_OPTIONS } from './VoiceAgentModal';

interface VoiceButtonProps {
  userId: string;
  onContentGenerated: (content: any) => void;
  onVoiceActiveChange?: (isActive: boolean) => void;
}

export interface VoiceButtonRef {
  startVoice: () => void;
  stopVoice: () => void;
}

// localStorage keys for persisting settings
const VOICE_STORAGE_KEY = 'voice-agent-voice';
const LANGUAGE_STORAGE_KEY = 'voice-agent-language';

export const VoiceButton = forwardRef<VoiceButtonRef, VoiceButtonProps>(
  ({ userId, onContentGenerated, onVoiceActiveChange }, ref) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // Initialize from localStorage or use defaults
    const [selectedVoice, setSelectedVoice] = useState(() => {
      if (typeof window !== 'undefined') {
        return localStorage.getItem(VOICE_STORAGE_KEY) || 'Sulafat';
      }
      return 'Sulafat';
    });
    // Persist settings to localStorage when they change
    useEffect(() => {
      localStorage.setItem(VOICE_STORAGE_KEY, selectedVoice);
    }, [selectedVoice]);

    // Notify parent when voice is active/inactive
    useEffect(() => {
      onVoiceActiveChange?.(isModalOpen);
    }, [isModalOpen, onVoiceActiveChange]);

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      startVoice: () => setIsModalOpen(true),
      stopVoice: () => setIsModalOpen(false),
    }));

    // When active, show the modal with orb + controls
    if (isModalOpen) {
      return (
        <VoiceAgentModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onContentGenerated={onContentGenerated}
          userId={userId}
          initialVoice={selectedVoice}
          initialLanguage="en-US"
        />
      );
    }

    // When inactive, show just the floating orb button to start with settings
    return (
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-3">
        {/* Voice Orb */}
        <div className="relative">
          <button
            onClick={() => setIsModalOpen(true)}
            className="relative w-20 h-20 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 transition-all hover:scale-105 shadow-lg border border-white/20"
            title="Start voice agent"
          >
            <Mic className="h-9 w-9 text-white" />
          </button>
        </div>

        {/* Settings toggle button */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${showSettings
            ? 'bg-blue-500 text-white'
            : 'bg-white/80 dark:bg-gray-800/80 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            } shadow-sm border border-gray-200 dark:border-gray-700`}
          title="Settings"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>

        {/* Settings dropdown - only show when toggled */}
        {showSettings && (
          <div className="flex flex-col items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="relative">
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="appearance-none bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-md pl-2 pr-6 py-1 text-[11px] font-medium border border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:outline-none shadow-sm cursor-pointer"
              >
                {VOICE_OPTIONS.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.description} ({voice.name})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
            </div>
          </div>
        )}

        <style jsx>{`
          @keyframes glow-pulse {
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
          .animate-glow-pulse {
            animation: glow-pulse 2s ease-in-out infinite;
          }
          .animate-orb-ring {
            animation: orb-ring 2.5s ease-out infinite;
            animation-delay: var(--ring-delay, 0ms);
          }
        `}</style>
      </div>
    );
  }
);

VoiceButton.displayName = 'VoiceButton';
