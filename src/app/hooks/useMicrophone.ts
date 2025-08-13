import { useCallback, useRef, useState, useEffect } from "react";
import { createMicrophoneCapture } from "@phonic-web/sdk";

type UseMicrophoneOptions = {
    workletUrl: string;
    onPcm?: (pcm: Int16Array) => void;
    desiredSampleRate?: number;
};

export function useMicrophone({
    workletUrl,
    onPcm,
    desiredSampleRate = 44100,
}: UseMicrophoneOptions) {
    const micRef = useRef<ReturnType<typeof createMicrophoneCapture> | null>(null);
    const onPcmRef = useRef(onPcm);
    const [isCapturing, setIsCapturing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Update the callback ref when onPcm changes
    useEffect(() => {
        onPcmRef.current = onPcm;
    }, [onPcm]);

    const startCapture = useCallback(async () => {
        try {
            setError(null);

            if (micRef.current) {
                await micRef.current.start();
                setIsCapturing(true);
                return;
            }

            const mic = createMicrophoneCapture({
                workletUrl,
                onPcm: (pcm: Int16Array) => {
                    onPcmRef.current?.(pcm);
                },
                desiredSampleRate,
            });

            await mic.start();
            micRef.current = mic;
            setIsCapturing(true);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to start microphone";
            setError(errorMessage);
            setIsCapturing(false);
            throw new Error(errorMessage);
        }
    }, [workletUrl, onPcm, desiredSampleRate]);

    const stopCapture = useCallback(() => {
        if (micRef.current) {
            micRef.current.stop();
            micRef.current = null;
        }
        setIsCapturing(false);
        setError(null);
    }, []);

    const toggleCapture = useCallback(async () => {
        if (isCapturing) {
            stopCapture();
        } else {
            await startCapture();
        }
    }, [isCapturing, startCapture, stopCapture]);

    return {
        isCapturing,
        error,
        startCapture,
        stopCapture,
        toggleCapture,
    };
}
