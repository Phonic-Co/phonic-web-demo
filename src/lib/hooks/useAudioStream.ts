import { useCallback, useEffect, useRef, useState } from "react";

export const useAudioStream = ({
    onAudioPlaybackComplete,
}: {
    onAudioPlaybackComplete: () => void;
}) => {
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
    const [duration, setDuration] = useState<number | null>(null);
    const totalSamplesRef = useRef(0);
    const onAudioPlaybackCompleteRef = useRef(onAudioPlaybackComplete);

    useEffect(() => {
        onAudioPlaybackCompleteRef.current = onAudioPlaybackComplete;
    });

    const startStream = useCallback(
        async ({ sampleRate }: { sampleRate: number }) => {
            if (
                audioContextRef.current &&
                audioContextRef.current.state === "running"
            ) {
                await audioContextRef.current.close();
            }

            audioContextRef.current = new AudioContext({ sampleRate });
            await audioContextRef.current.audioWorklet.addModule(
                "/audio-processor.js",
            );
            audioWorkletNodeRef.current = new AudioWorkletNode(
                audioContextRef.current,
                "audio-processor",
            );
            audioWorkletNodeRef.current.port.onmessage = (event) => {
                if (event.data.type === "finished-processing") {
                    onAudioPlaybackCompleteRef.current();
                }
            };
            audioWorkletNodeRef.current.connect(audioContextRef.current.destination);

            totalSamplesRef.current = 0;
            setDuration(null);
        },
        [],
    );

    const stopStream = useCallback(() => {
        // Tell the audio processor to clear existing audio buffers
        audioWorkletNodeRef.current?.port.postMessage({
            type: "stop-and-clear-buffers",
        });
    }, []);

    const resumeStream = useCallback(() => {
        audioWorkletNodeRef.current?.port.postMessage({
            type: "resume",
        });
    }, []);

    const endStream = useCallback(async () => {
        audioWorkletNodeRef.current?.disconnect();
        if (
            audioContextRef.current &&
            audioContextRef.current.state === "running"
        ) {
            await audioContextRef.current.close();
        }
    }, []);

    const appendAudioChunk = useCallback((chunk: Int16Array | Uint8Array) => {
        if (!audioContextRef.current) {
            throw new Error("Can't append audio chunk, AudioContext is not set yet.");
        }

        const chunkSize = chunk.length; // Note: we must read `chunk.length` BEFORE transferring the ownership. Otherwise, it will be 0.

        // Only process new chunks if we're not paused
        audioWorkletNodeRef.current?.port.postMessage(
            { type: "append-chunk", chunk },
            [chunk.buffer], // Transfer ownership to the AudioWorkletProcessor. See: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects
        );

        totalSamplesRef.current += chunkSize;

        setDuration(
            (totalSamplesRef.current / audioContextRef.current.sampleRate) * 1000,
        );
    }, []);

    const allAudioChunksAppended = useCallback(() => {
        audioWorkletNodeRef.current?.port.postMessage({
            type: "all-chunks-appended",
        });
    }, []);

    const resetStream = useCallback(() => {
        totalSamplesRef.current = 0;
        setDuration(null);
    }, []);

    useEffect(() => {
        return () => {
            endStream();
        };
    }, [endStream]);

    return {
        startStream,
        stopStream,
        resumeStream,
        endStream,
        appendAudioChunk,
        allAudioChunksAppended,
        resetStream,
        duration,
    };
};
