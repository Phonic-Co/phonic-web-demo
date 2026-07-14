import type { ConfigMessage, ToolCallOutputMessage, ConversationItem, Events } from "./types";

export class PhonicClient {
    private wsBaseUrl: string;
    private ws: WebSocket | null = null;
    private listeners = new Set<(e: Events) => void>();
    private items: Array<ConversationItem> = [];
    private nextItemIdx = 0;
    private isAssistantSpeaking = false;
    private isUserSpeaking = false;
    private audioQueue: Array<{ pcm: Int16Array; opts?: { firstChunkIsoDateTime?: string } }> = [];

    constructor(wsBaseUrl: string) {
        this.wsBaseUrl = wsBaseUrl;
    }

    on(handler: (e: Events) => void) {
        this.listeners.add(handler);
    }

    off(handler: (e: Events) => void) {
        this.listeners.delete(handler);
    }

    getConversationItems() {
        return this.items.slice();
    }

    async connect(sessionToken: string): Promise<void> {
        if (this.ws) return;
        const hasQuery = this.wsBaseUrl.includes("?");
        const url = `${this.wsBaseUrl}${hasQuery ? "&" : "?"}session_token=${encodeURIComponent(sessionToken)}`;
        this.ws = new WebSocket(url);
        this.ws.addEventListener("open", () => {
            this.flushAudioQueue();
            this.emit({ type: "open" });
        });
        this.ws.addEventListener("close", (evt) =>
            this.emit({ type: "close", code: evt.code, reason: evt.reason }),
        );
        this.ws.addEventListener("error", (err) =>
            this.emit({ type: "error", error: err }),
        );
        this.ws.addEventListener("message", (msg) => this.handleMessage(msg.data));
    }

    startConversation(config: ConfigMessage) {
        if (!this.ws) return;
        const send = () => this.ws?.send(JSON.stringify(config));
        if (this.ws.readyState === WebSocket.OPEN) {
            send();
            return;
        }
        const onOpen = () => {
            this.ws?.removeEventListener("open", onOpen);
            send();
        };
        this.ws.addEventListener("open", onOpen);
    }

    sendAudioChunk(pcm: Int16Array, opts?: { firstChunkIsoDateTime?: string }) {
        if (!this.ws) return;

        if (this.ws.readyState === WebSocket.OPEN) {
            const audio = this.int16ToBase64(pcm);
            const payload: Record<string, unknown> = { type: "audio_chunk", audio };
            if (opts?.firstChunkIsoDateTime)
                payload.iso_date_time = opts.firstChunkIsoDateTime;
            this.ws.send(JSON.stringify(payload));
        } else {
            this.audioQueue.push({ pcm, opts });
        }
    }

    sendToolCallOutput(params: { tool_call_id: string; output: unknown }) {
        if (!this.ws) return;
        const payload: ToolCallOutputMessage = {
            type: "tool_call_output",
            ...params,
        };
        this.ws.send(JSON.stringify(payload));
    }

    close(code?: number) {
        this.audioQueue = [];
        this.ws?.close(code ?? 1000);
    }

    reset() {
        this.items = [];
        this.nextItemIdx = 0;
        this.isAssistantSpeaking = false;
        this.isUserSpeaking = false;
        this.audioQueue = [];
        this.listeners.clear();
    }

    private flushAudioQueue() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        for (const { pcm, opts } of this.audioQueue) {
            const audio = this.int16ToBase64(pcm);
            const payload: Record<string, unknown> = { type: "audio_chunk", audio };
            if (opts?.firstChunkIsoDateTime)
                payload.iso_date_time = opts.firstChunkIsoDateTime;
            this.ws.send(JSON.stringify(payload));
        }
        this.audioQueue = [];
    }

    private emit(e: Events) {
        for (const l of this.listeners) l(e);
    }

    private handleMessage(raw: unknown) {
        if (typeof raw !== "string") return;
        try {
            const msg = JSON.parse(raw);
            switch (msg.type) {
                case "ready_to_start_conversation":
                    break;
                case "input_text": {
                    const text: string = typeof msg.text === "string" ? msg.text : "";
                    const last = this.items[this.items.length - 1];
                    if (last && last.role === "user") {
                        const prefix =
                            last.text === null || last.text === "" ? "" : `${last.text} `;
                        this.items[this.items.length - 1] = {
                            ...last,
                            text: `${prefix}${text}`,
                        };
                    } else {
                        this.items.push({
                            itemIdx: this.nextItemIdx++,
                            role: "user",
                            text,
                        });
                    }
                    this.emit({ type: "input_text", text });
                    break;
                }
                case "audio_chunk": {
                    const text: string = typeof msg.text === "string" ? msg.text : "";
                    if (!this.isAssistantSpeaking) {
                        this.items.push({
                            itemIdx: this.nextItemIdx++,
                            role: "assistant",
                            text,
                        });
                        this.isAssistantSpeaking = true;
                    } else {
                        const last = this.items[this.items.length - 1];
                        if (last && last.role === "assistant") {
                            this.items[this.items.length - 1] = {
                                ...last,
                                text: `${last.text ?? ""}${text}`,
                            };
                        } else {
                            this.items.push({
                                itemIdx: this.nextItemIdx++,
                                role: "assistant",
                                text,
                            });
                        }
                    }
                    this.emit({ type: "audio_chunk", audio: msg.audio, text });
                    break;
                }
                case "assistant_started_speaking": {
                    this.isAssistantSpeaking = true;
                    this.emit({ type: "assistant_started_speaking" });
                    break;
                }
                case "assistant_finished_speaking": {
                    this.isAssistantSpeaking = false;
                    this.emit({ type: "assistant_finished_speaking" });
                    break;
                }
                case "user_started_speaking": {
                    if (!this.isUserSpeaking) {
                        this.items.push({
                            itemIdx: this.nextItemIdx++,
                            role: "user",
                            text: null,
                        });
                    }
                    this.isUserSpeaking = true;
                    this.emit({ type: "user_started_speaking" });
                    break;
                }
                case "user_finished_speaking": {
                    this.isUserSpeaking = false;
                    this.emit({ type: "user_finished_speaking" });
                    break;
                }
                case "tool_call":
                    this.emit({
                        type: "tool_call",
                        tool_call_id: msg.tool_call_id,
                        tool_name: msg.tool_name,
                        parameters: msg.parameters,
                    });
                    break;
                case "tool_call_output_processed":
                    this.emit({
                        type: "tool_call_output_processed",
                        tool_call_id: msg.tool_call_id,
                    });
                    break;
                case "tool_call_interrupted":
                    this.emit({
                        type: "tool_call_interrupted",
                        tool_call_id: msg.tool_call_id,
                    });
                    break;
                case "input_cancelled": {
                    const last = this.items[this.items.length - 1];
                    if (last && last.role === "user" && last.text === null) {
                        this.items = this.items.slice(0, -1);
                    }
                    break;
                }
                case "error":
                    this.emit({ type: "error", error: msg });
                    break;
                default:
                    break;
            }
        } catch {
            // ignore
        }
    }

    private int16ToBase64(data: Int16Array): string {
        const buf = new Uint8Array(data.buffer);
        let binary = "";
        for (let i = 0; i < buf.byteLength; i++)
            binary += String.fromCharCode(buf[i]);
        return btoa(binary);
    }
}
