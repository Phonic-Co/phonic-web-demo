import { useCallback, useRef, useState, useMemo } from "react";
import { PhonicClient, type ConversationItem, type ConfigMessage } from "../../lib/phonic";
import { createMicrophoneCapture, base64ToInt16Array, base64ToUint8Array } from "../../lib/audio";
import { ConversationStatus, type VoiceConversationConfig } from "../../lib/types";
import { useAudioStream } from "../../lib/hooks/useAudioStream";

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
    wsBaseUrl: "wss://api.phonic.ai/v1/sts/ws",
    workletUrl: "/pcm-processor.worklet.js",
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
    const isMutedRef = useRef(false);

    // Audio stream management
    const { startStream, stopStream, resumeStream, endStream, appendAudioChunk, resetStream } = useAudioStream({
        onAudioPlaybackComplete: () => {
            // Handle audio playback completion if needed
        },
    });

    // Start conversation
    const startConversation = useCallback(async (conversationConfig: ConfigMessage, sessionToken: string) => {
        try {
            setStatus(ConversationStatus.Connecting);

            // Clean up any existing state first
            if (clientRef.current) {
                clientRef.current.close();
                clientRef.current = null;
            }
            if (micRef.current) {
                micRef.current.stop();
                micRef.current = null;
            }
            await endStream();
            resetStream();

            // Reset state
            setConversationItems([]);
            setIsMicrophoneEnabled(false);
            setIsMuted(false);
            isMutedRef.current = false;

            // Initialize client
            const client = new PhonicClient(fullConfig.wsBaseUrl);

            // Set up event handlers
            client.on((event) => {
                setConversationItems(client.getConversationItems());

                if (event.type === "audio_chunk") {
                    // Auto-detect audio format and convert appropriately
                    const audioData = base64ToInt16Array(event.audio);
                    appendAudioChunk(audioData);
                }

                if (event.type === "user_started_speaking") {
                    stopStream();
                } else if (event.type === "user_finished_speaking") {
                    resumeStream();
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

            // Start audio stream with auto-detected sample rate
            await startStream({ sampleRate: 44100 });

            // Start microphone
            const mic = createMicrophoneCapture({
                workletUrl: fullConfig.workletUrl,
                onPcm: (pcm: Int16Array) => {
                    client.sendAudioChunk(pcm);
                },
                desiredSampleRate: 44100,
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
    }, [fullConfig, startStream, appendAudioChunk, stopStream, resumeStream, endStream, resetStream]);

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

        // Stop client and reset its state
        if (clientRef.current) {
            clientRef.current.close();
            clientRef.current.reset();
            clientRef.current = null;
        }

        // Stop audio stream
        await endStream();

        setStatus(ConversationStatus.Disconnected);
        setConversationItems([]);
    }, [endStream]);

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

            // Use worklet-level muting for better performance
            if (micRef.current) {
                if (newMutedState) {
                    micRef.current.mute();
                } else {
                    micRef.current.unmute();
                }
            }

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
