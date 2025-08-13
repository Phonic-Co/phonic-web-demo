export enum ConversationStatus {
    Idle = "idle",
    CreatingToken = "creating_token",
    Connecting = "connecting",
    Connected = "connected",
    Ready = "ready",
    Disconnected = "disconnected",
    Error = "error"
}

export type VoiceConversationConfig = {
    wsBaseUrl?: string;
    workletUrl?: string;
    sampleRate?: number;
    onToolCall?: (toolCall: {
        tool_call_id: string;
        tool_name: string;
        parameters: Record<string, unknown>;
    }) => void;
};
