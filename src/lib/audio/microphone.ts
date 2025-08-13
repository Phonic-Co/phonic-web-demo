import { resampleFloat32, floatToInt16 } from "./utils";

export type MicrophoneCapture = {
    start: () => Promise<void>;
    stop: () => void;
    isCapturing: () => boolean;
};

export function createMicrophoneCapture(params: {
    onPcm: (pcm: Int16Array) => void;
    desiredSampleRate?: number;
    bufferSize?: 256 | 512 | 1024 | 2048 | 4096 | 8192 | 16384;
    workletUrl: string;
}): MicrophoneCapture {
    const desired = params.desiredSampleRate ?? 44100;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let node: AudioWorkletNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let capturing = false;

    const start = async () => {
        if (capturing) return;
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctx = new AudioContextClass();
        source = ctx.createMediaStreamSource(stream);
        await ctx.audioWorklet.addModule(params.workletUrl);
        node = new AudioWorkletNode(ctx, "pcm-processor", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
        node.port.onmessage = (ev: MessageEvent) => {
            const input = ev.data as Float32Array;
            const resampled = resampleFloat32(input, ctx!.sampleRate, desired);
            const int16 = floatToInt16(resampled);
            if (int16.length > 0) params.onPcm(int16);
        };
        source.connect(node);
        capturing = true;
    };

    const stop = () => {
        capturing = false;
        try {
            node?.disconnect();
            source?.disconnect();
            ctx?.close();
        } catch { }
        node = null;
        source = null;
        ctx = null;
        if (stream) {
            for (const t of stream.getTracks()) t.stop();
            stream = null;
        }
    };

    const isCapturing = () => capturing;

    return { start, stop, isCapturing };
}
