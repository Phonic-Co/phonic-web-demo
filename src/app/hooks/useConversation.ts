import { useCallback, useRef, useState, useMemo } from "react";
import { PhonicClient, type ConversationItem, type ConfigMessage } from "../../lib/phonic";
import { createMicrophoneCapture, base64ToInt16Array } from "../../lib/audio";
import { ConversationStatus, type VoiceConversationConfig } from "../../lib/types";

/**
 * useConversation Hook - Complete Voice Conversation Management
 * 
 * This hook handles everything needed for real-time AI voice conversations:
 * - WebSocket connection management
 * - Microphone capture and audio playback
 * - Conversation state and history
 * - Tool call handling
 * - Mute/unmute functionality
 * 
 * This is the main hook you'll use in your app - it provides a simple API
 * for complex voice conversation functionality.
 */

const DEFAULT_CONFIG = {
    wsBaseUrl: "wss://api.phonic.co/v1/sts/ws",
    workletUrl: "/pcm-processor.worklet.js",
    sampleRate: 44100,
    onToolCall: undefined,
} as const;

export function useConversation(config: VoiceConversationConfig = {}) {
    const fullConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);

    // State
    const [status, setStatus] = useState<ConversationStatus>(ConversationStatus.Idle);
    const [conversationItems, setConversationItems] = useState<ConversationItem[]>([]);
    const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    // Refs
    const clientRef = useRef<PhonicClient | null>(null);
    const micRef = useRef<ReturnType<typeof createMicrophoneCapture> | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const nextTimeRef = useRef(0);
    const isPlayingRef = useRef(false);
    const isMutedRef = useRef(false);

    // Audio playback functions
    const startAudioStream = useCallback(() => {
        if (!audioContextRef.current) {
            const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            audioContextRef.current = new AudioContextClass({
                sampleRate: fullConfig.sampleRate,
            });
        }
        nextTimeRef.current = audioContextRef.current.currentTime;
        isPlayingRef.current = true;
    }, [fullConfig.sampleRate]);

    const stopAudioStream = useCallback(() => {
        isPlayingRef.current = false;
    }, []);

    const resumeAudioStream = useCallback(() => {
        if (audioContextRef.current && !isPlayingRef.current) {
            isPlayingRef.current = true;
            nextTimeRef.current = audioContextRef.current.currentTime;
        }
    }, []);

    const playAudioChunk = useCallback((audioData: Int16Array) => {
        if (!audioContextRef.current || !isPlayingRef.current) return;

        try {
            // Convert Int16 to Float32
            const float32Data = new Float32Array(audioData.length);
            for (let i = 0; i < audioData.length; i++) {
                float32Data[i] = audioData[i] / 32767;
            }

            // Create and schedule audio buffer
            const audioBuffer = audioContextRef.current.createBuffer(1, float32Data.length, audioContextRef.current.sampleRate);
            audioBuffer.getChannelData(0).set(float32Data);

            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);

            const now = audioContextRef.current.currentTime;
            const scheduledTime = Math.max(now, nextTimeRef.current);
            source.start(scheduledTime);
            nextTimeRef.current = scheduledTime + audioBuffer.duration;
        } catch (error) {
            console.error("Error playing audio:", error);
        }
    }, []);

    // Start conversation
    const startConversation = useCallback(async (conversationConfig: ConfigMessage, sessionToken: string) => {
        try {
            setStatus(ConversationStatus.Connecting);

            // Initialize client
            const client = new PhonicClient(fullConfig.wsBaseUrl);

            // Set up event handlers
            client.on((event) => {
                setConversationItems(client.getConversationItems());

                if (event.type === "audio_chunk") {
                    const audioData = base64ToInt16Array(event.audio);
                    playAudioChunk(audioData);
                }

                if (event.type === "user_started_speaking") {
                    stopAudioStream();
                } else if (event.type === "user_finished_speaking") {
                    resumeAudioStream();
                }

                if (event.type === "tool_call") {
                    fullConfig.onToolCall?.({
                        tool_call_id: event.tool_call_id,
                        tool_name: event.tool_name,
                        parameters: event.parameters,
                    });
                }

                if (event.type === "open") {
                    setStatus(ConversationStatus.Connected);
                } else if (event.type === "close") {
                    setStatus(ConversationStatus.Disconnected);
                } else if (event.type === "error") {
                    setStatus(ConversationStatus.Error);
                }
            });

            // Connect and start
            await client.connect(sessionToken);
            client.startConversation(conversationConfig);
            clientRef.current = client;

            // Start audio
            startAudioStream();

            // Start microphone
            const mic = createMicrophoneCapture({
                workletUrl: fullConfig.workletUrl,
                onPcm: (pcm: Int16Array) => {
                    if (!isMutedRef.current) {
                        client.sendAudioChunk(pcm);
                    }
                },
                desiredSampleRate: fullConfig.sampleRate,
            });

            await mic.start();
            micRef.current = mic;
            setIsMicrophoneEnabled(true);
            setStatus(ConversationStatus.Ready);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Connection failed";
            setStatus(ConversationStatus.Error);
            console.error("Failed to start conversation:", errorMessage);
            throw error;
        }
    }, [fullConfig, startAudioStream, playAudioChunk, stopAudioStream, resumeAudioStream]);

    // Stop conversation
    const stopConversation = useCallback(async () => {
        // Stop microphone
        if (micRef.current) {
            micRef.current.stop();
            micRef.current = null;
        }
        setIsMicrophoneEnabled(false);
        setIsMuted(false);
        isMutedRef.current = false;

        // Stop client
        if (clientRef.current) {
            clientRef.current.close();
            clientRef.current = null;
        }

        // Stop audio
        isPlayingRef.current = false;
        if (audioContextRef.current) {
            await audioContextRef.current.close();
            audioContextRef.current = null;
        }

        setStatus(ConversationStatus.Disconnected);
        setConversationItems([]);
    }, []);

    // Send tool call output
    const sendToolCallOutput = useCallback((params: { tool_call_id: string; output: unknown }) => {
        if (clientRef.current) {
            clientRef.current.sendToolCallOutput(params);
        }
    }, []);

    // Toggle mute
    const toggleMute = useCallback(() => {
        setIsMuted(prev => {
            const newMutedState = !prev;
            isMutedRef.current = newMutedState;
            return newMutedState;
        });
    }, []);

    return {
        // State
        status,
        conversationItems,
        isMicrophoneEnabled,
        isMuted,

        // Actions
        startConversation,
        stopConversation,
        sendToolCallOutput,
        toggleMute,
    };
}
