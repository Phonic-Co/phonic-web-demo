import { useCallback, useRef, useState } from "react";
import { PhonicClient, type ConversationItem, type ConfigMessage } from "@phonic-web/sdk";
import { createSessionToken } from "../actions";

type UsePhonicClientOptions = {
    wsBaseUrl: string;
    onAudioChunk?: (audioBase64: string) => void;
    onUserStartedSpeaking?: () => void;
    onUserFinishedSpeaking?: () => void;
};

export function usePhonicClient({
    wsBaseUrl,
    onAudioChunk,
    onUserStartedSpeaking,
    onUserFinishedSpeaking,
}: UsePhonicClientOptions) {
    const clientRef = useRef<PhonicClient | null>(null);
    const [status, setStatus] = useState("idle");
    const [conversationItems, setConversationItems] = useState<ConversationItem[]>([]);

    const updateStatus = useCallback((newStatus: string) => {
        setStatus(newStatus);
    }, []);

    const connect = useCallback(async (config: ConfigMessage) => {
        try {
            updateStatus("creating session token...");

            const tokenRes = await createSessionToken();
            if (tokenRes.error || !tokenRes.data) {
                throw new Error(tokenRes.error?.message ?? "failed to create session token");
            }

            updateStatus("connecting...");

            const client = new PhonicClient(wsBaseUrl);

            // Set up event handlers
            client.on((event) => {
                const items = client.getConversationItems();
                setConversationItems(items);

                // Handle audio chunks
                if (event.type === "audio_chunk") {
                    onAudioChunk?.(event.audio);
                }

                // Handle user speech events
                if (event.type === "user_started_speaking") {
                    onUserStartedSpeaking?.();
                } else if (event.type === "user_finished_speaking") {
                    onUserFinishedSpeaking?.();
                }

                // Handle status changes
                if (event.type === "open") {
                    updateStatus("connected");
                } else if (event.type === "close") {
                    updateStatus("disconnected");
                } else if (event.type === "error") {
                    updateStatus("error");
                }
            });

            await client.connect(tokenRes.data.sessionToken);
            client.startConversation(config);

            clientRef.current = client;
            updateStatus("ready");

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "connection failed";
            updateStatus(`error: ${errorMessage}`);
            throw error;
        }
    }, [wsBaseUrl, onAudioChunk, onUserStartedSpeaking, onUserFinishedSpeaking, updateStatus]);

    const disconnect = useCallback(() => {
        if (clientRef.current) {
            clientRef.current.close();
            clientRef.current = null;
        }
        updateStatus("disconnected");
        setConversationItems([]);
    }, [updateStatus]);

    const sendAudioChunk = useCallback((pcm: Int16Array, opts?: { firstChunkIsoDateTime?: string }) => {
        if (clientRef.current) {
            clientRef.current.sendAudioChunk(pcm, opts);
        }
    }, []);

    const sendToolCallOutput = useCallback((params: { tool_call_id: string; output: unknown }) => {
        if (clientRef.current) {
            clientRef.current.sendToolCallOutput(params);
        }
    }, []);

    return {
        status,
        conversationItems,
        connect,
        disconnect,
        sendAudioChunk,
        sendToolCallOutput,
        isConnected: status === "connected" || status === "ready",
    };
}
