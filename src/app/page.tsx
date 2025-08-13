"use client";

import { useCallback } from "react";
import { type ConfigMessage } from "@phonic-web/sdk";
import { ConversationControls } from "./components/ConversationControls";
import { ConversationView } from "./components/ConversationView";
import { StatusDisplay } from "./components/StatusDisplay";
import { useAudioStream } from "./hooks/useAudioStream";
import { useMicrophone } from "./hooks/useMicrophone";
import { usePhonicClient } from "./hooks/usePhonicClient";
import { base64ToInt16Array } from "./utils/base64";

export default function Home() {
  const wsBaseUrl = process.env.NEXT_PUBLIC_STS_WS_URL ?? "wss://api.phonic.co/v1/sts/ws";

  const { startStream, stopStream, resumeStream, endStream, appendAudioChunk } = useAudioStream({
    sampleRate: 44100,
    onAudioPlaybackComplete: () => {
      console.log("Audio playback completed");
    },
  });

  const {
    status,
    conversationItems,
    connect,
    disconnect,
    sendAudioChunk,
    isConnected,
  } = usePhonicClient({
    wsBaseUrl,
    onAudioChunk: (audioBase64) => {
      // Convert base64 to Int16Array and append to audio stream
      const audioData = base64ToInt16Array(audioBase64);
      appendAudioChunk(audioData);
    },
    onStatusChange: (newStatus) => {
      console.log("Status changed:", newStatus);
    },
    onUserStartedSpeaking: () => {
      // Stop assistant audio when user starts speaking
      stopStream();
    },
    onUserFinishedSpeaking: () => {
      // Resume assistant audio when user finishes speaking
      resumeStream();
    },
  });

  const handlePcm = useCallback((pcm: Int16Array) => {
    if (isConnected) {
      sendAudioChunk(pcm);
    }
  }, [isConnected, sendAudioChunk]);

  const { isCapturing, error: micError, startCapture, stopCapture } = useMicrophone({
    workletUrl: "/pcm-processor.worklet.js",
    onPcm: handlePcm,
    desiredSampleRate: 44100,
  });

  const start = async () => {
    try {
      // Start audio stream first
      startStream({ sampleRate: 44100 });
      
      // Connect to Phonic and wait for it to be ready
      const config: ConfigMessage = { 
        type: "config", 
        input_format: "pcm_44100", 
        output_format: "pcm_44100" 
      };
      await connect(config);
      
      // Small delay to ensure WebSocket is fully ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Start microphone capture
      await startCapture();
      
    } catch (error) {
      console.error("Failed to start conversation:", error);
    }
  };

  const stop = async () => {
    stopCapture();
    disconnect();
    await endStream();
  };

  const isActive = isConnected && isCapturing;
  const canStart = !isConnected && !isCapturing;
  const showError = micError;

  return (
    <div className="p-6 space-y-6">
      <StatusDisplay 
        status={status}
        isCapturing={isCapturing}
        error={showError ? micError : null}
      />
      
      <ConversationControls
        onStart={start}
        onStop={stop}
        canStart={canStart}
        isActive={isActive}
      />
      
      <ConversationView
        conversationItems={conversationItems}
        isActive={isActive}
      />
    </div>
  );
}