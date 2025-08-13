import { useState, useEffect } from "react";

export function useMicPermission() {
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);

    useEffect(() => {
        const checkPermission = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(track => track.stop());
                setHasPermission(true);
            } catch {
                setHasPermission(false);
            }
        };

        checkPermission();
    }, []);

    const requestPermission = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            setHasPermission(true);
            return true;
        } catch {
            setHasPermission(false);
            return false;
        }
    };

    return { hasPermission, requestPermission };
}
