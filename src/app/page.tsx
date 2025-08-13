"use client";

import { useCallback } from "react";
import { type ConfigMessage } from "@phonic-web/sdk";
import { useAudioStream } from "./hooks/useAudioStream";
import { useMicrophone } from "./hooks/useMicrophone";
import { usePhonicClient } from "./hooks/usePhonicClient";
import { base64ToInt16Array } from "./utils/base64";

export default function Home() {
  const wsBaseUrl = process.env.NEXT_PUBLIC_STS_WS_URL ?? "wss://api.phonic.co/v1/sts/ws";

  const { startStream, stopStream, resumeStream, endStream, appendAudioChunk } = useAudioStream();

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
      const audioData = base64ToInt16Array(audioBase64);
      appendAudioChunk(audioData);
    },
    onUserStartedSpeaking: () => stopStream(),
    onUserFinishedSpeaking: () => resumeStream(),
  });

  const handlePcm = useCallback((pcm: Int16Array) => {
    if (isConnected) {
      sendAudioChunk(pcm);
    }
  }, [isConnected, sendAudioChunk]);

  const { isCapturing, startCapture, stopCapture } = useMicrophone({
    workletUrl: "/pcm-processor.worklet.js",
    onPcm: handlePcm,
    desiredSampleRate: 44100,
  });

  const isActive = isConnected && isCapturing;

  const toggleConversation = async () => {
    if (isActive) {
      // Stop conversation
      stopCapture();
      disconnect();
      await endStream();
    } else {
      // Start conversation
      try {
        startStream({ sampleRate: 44100 });
        
        const config: ConfigMessage = { 
          type: "config", 
          input_format: "pcm_44100", 
          output_format: "pcm_44100" 
        };
        await connect(config);
        
        // Small delay to ensure WebSocket is ready
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await startCapture();
      } catch (error) {
        console.error("Failed to start conversation:", error);
      }
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Phonic Web Demo</h1>
      <p className="mb-6">Status: {status}</p>
      
      <button
        onClick={toggleConversation}
        className={`px-4 py-2 rounded font-medium ${
          isActive 
            ? 'bg-red-500 hover:bg-red-600 text-white' 
            : 'bg-blue-500 hover:bg-blue-600 text-white'
        }`}
      >
        {isActive ? 'End Conversation' : 'Start Conversation'}
      </button>
      
      {isCapturing && (
        <p className="mt-4 text-red-600">🎤 Recording...</p>
      )}
      
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Conversation</h2>
        <div className="border rounded p-4 h-64 overflow-y-auto bg-gray-50">
          {conversationItems.length === 0 ? (
            <p className="text-gray-500">
              {isActive ? "Say something to start..." : "No conversation yet"}
            </p>
          ) : (
            conversationItems.map((item) => (
              <div key={item.itemIdx} className="mb-4 p-2 border rounded bg-white">
                <div className="font-medium text-sm text-gray-600 mb-1">
                  {item.role === "user" ? "You" : "Assistant"}
                </div>
                <div>
                  {item.text === null ? (
                    <span className="text-gray-500 italic">Listening...</span>
                  ) : (
                    item.text
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}