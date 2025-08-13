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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Phonic Web Demo</h1>
          <p className="text-gray-600">Real-time AI conversation</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-4">Status: {status}</p>
            
            <button
              onClick={toggleConversation}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                isActive 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {isActive ? '🛑 End Conversation' : '🎤 Start Conversation'}
            </button>
            
            {isCapturing && (
              <p className="mt-4 text-red-600 font-medium">🎤 Recording...</p>
            )}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-800">Conversation</h2>
          </div>
          
          <div className="p-4 h-80 overflow-y-auto">
            {conversationItems.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                {isActive ? "Say something to start..." : "No conversation yet"}
              </p>
            ) : (
              <div className="space-y-4">
                {conversationItems.map((item) => (
                  <div key={item.itemIdx} className="flex gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm ${
                      item.role === "user" ? "bg-blue-500" : "bg-green-500"
                    }`}>
                      {item.role === "user" ? "U" : "A"}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-medium text-gray-500 mb-1">
                        {item.role === "user" ? "You" : "Assistant"}
                      </div>
                      <div className="text-gray-800">
                        {item.text === null ? (
                          <span className="text-gray-500 italic">Listening...</span>
                        ) : (
                          item.text
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}