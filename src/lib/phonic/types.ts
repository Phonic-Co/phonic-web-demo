export type ConfigMessage = {
    type: "config";
    agent?: string;
    project?: string;
    model?: string;
    system_prompt?: string;
    audio_speed?: number;
    welcome_message?: string;
    voice_id?: string;
    input_format?: string;
    output_format?: string;
    vad_prebuffer_duration_ms?: number;
    vad_min_speech_duration_ms?: number;
    vad_min_silence_duration_ms?: number;
    vad_threshold?: number;
    no_input_poke_sec?: number | null;
    no_input_poke_text?: string;
    no_input_end_conversation_sec?: number;
    tools?: string[];
};

export type ToolCallOutputMessage = {
    type: "tool_call_output";
    tool_call_id: string;
    output: unknown;
};

export type ConversationItem = {
    itemIdx: number;
    role: "user" | "assistant";
    text: string | null;
};

export type Events =
    | { type: "open" }
    | { type: "close"; code: number; reason: string }
    | { type: "error"; error: unknown }
    | { type: "input_text"; text: string }
    | { type: "audio_chunk"; audio: string; text: string }
    | { type: "assistant_started_speaking" }
    | { type: "assistant_finished_speaking" }
    | { type: "user_started_speaking" }
    | { type: "user_finished_speaking" }
    | {
        type: "tool_call";
        tool_call_id: string;
        tool_name: string;
        parameters: Record<string, unknown>;
    }
    | { type: "tool_call_output_processed"; tool_call_id: string }
    | { type: "tool_call_interrupted"; tool_call_id: string };
