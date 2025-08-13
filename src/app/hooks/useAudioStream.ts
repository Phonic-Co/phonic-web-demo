import { useCallback, useRef } from "react";

export function useAudioStream() {
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioBufferRef = useRef<Float32Array[]>([]);
    const isPlayingRef = useRef(false);
    const nextTimeRef = useRef(0);

    const startStream = useCallback(
        ({ sampleRate = 44100 }: { sampleRate?: number } = {}) => {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext ||
                    (window as any).webkitAudioContext)({
                        sampleRate,
                    });
            }
            audioBufferRef.current = [];
            nextTimeRef.current = audioContextRef.current.currentTime;
            isPlayingRef.current = true;
        },
        []
    );

    const stopStream = useCallback(() => {
        isPlayingRef.current = false;
    }, []);

    const resumeStream = useCallback(() => {
        if (audioContextRef.current && !isPlayingRef.current) {
            isPlayingRef.current = true;
            nextTimeRef.current = audioContextRef.current.currentTime;
        }
    }, []);

    const endStream = useCallback(async () => {
        isPlayingRef.current = false;
        audioBufferRef.current = [];

        if (audioContextRef.current) {
            await audioContextRef.current.close();
            audioContextRef.current = null;
        }
    }, []);

    const appendAudioChunk = useCallback((audioData: Int16Array | Uint8Array) => {
        if (!audioContextRef.current || !isPlayingRef.current) return;

        try {
            // Convert audio data to Float32Array
            let float32Data: Float32Array;

            if (audioData instanceof Int16Array) {
                // Convert Int16 to Float32
                float32Data = new Float32Array(audioData.length);
                for (let i = 0; i < audioData.length; i++) {
                    float32Data[i] = audioData[i] / 32767; // Convert to -1.0 to 1.0 range
                }
            } else {
                // Convert Uint8Array to Float32
                float32Data = new Float32Array(audioData.length);
                for (let i = 0; i < audioData.length; i++) {
                    float32Data[i] = (audioData[i] - 128) / 128; // Convert to -1.0 to 1.0 range
                }
            }

            // Create audio buffer
            const audioBuffer = audioContextRef.current.createBuffer(
                1,
                float32Data.length,
                audioContextRef.current.sampleRate
            );

            audioBuffer.getChannelData(0).set(float32Data);

            // Create and schedule audio source
            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);

            // Schedule playback to ensure smooth audio streaming
            const now = audioContextRef.current.currentTime;
            const scheduledTime = Math.max(now, nextTimeRef.current);

            source.start(scheduledTime);
            nextTimeRef.current = scheduledTime + audioBuffer.duration;

        } catch (error) {
            console.error("Error playing audio chunk:", error);
        }
    }, []);

    return {
        startStream,
        stopStream,
        resumeStream,
        endStream,
        appendAudioChunk,
    };
}
