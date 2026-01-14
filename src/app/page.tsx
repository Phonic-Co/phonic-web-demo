"use client";

import { useState, useEffect } from "react";
import { type ConfigMessage } from "../lib/phonic";
import { useConversation } from "./hooks/useConversation";
import { useMicPermission } from "./hooks/useMicPermission";
import { createSessionToken, ensureOrbAgent } from "./actions";
import { AnimatedOrb } from "../components/AnimatedOrb";

const DEFAULT_ORB_COLOR = "#808080";

export default function Home() {
  const [orbColor, setOrbColor] = useState(DEFAULT_ORB_COLOR);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { hasPermission, requestPermission } = useMicPermission();
  
  const {
    status,
    conversationItems,
    isMicrophoneEnabled,
    isMuted,
    startConversation,
    stopConversation,
    sendToolCallOutput,
    toggleMute,
  } = useConversation({
    onToolCall: (toolCall) => {
      console.log("Tool call received:", toolCall);
      
      // Example tool: set_orb_color
      // Replace this with your own tool handling logic
      if (toolCall.tool_name === "set_orb_color") {
        const color = toolCall.parameters.color as string;
        console.log("Setting orb color to:", color);
        
        // Validate hex color format
        const hexRegex = /^#[0-9A-F]{6}$/i;
        if (hexRegex.test(color)) {
          setOrbColor(color);
          sendToolCallOutput({
            tool_call_id: toolCall.tool_call_id,
            output: { success: true, color: color, message: `Orb color changed to ${color}` },
          });
        } else {
          sendToolCallOutput({
            tool_call_id: toolCall.tool_call_id,
            output: { success: false, error: "Invalid hex color format. Use #RRGGBB format." },
          });
        }
      }
    },
  });

  // Reset orb color when conversation ends (any reason)
  useEffect(() => {
    if (status === "disconnected" || status === "error" || status === "idle") {
      setOrbColor(DEFAULT_ORB_COLOR);
    }
  }, [status]);

  const toggleConversation = async () => {
    const isConversationActive = status === "ready" && isMicrophoneEnabled;
    if (isConversationActive) {
      await stopConversation();
      setOrbColor(DEFAULT_ORB_COLOR); // Reset orb color to default
    } else {
      try {
        setErrorMessage(null); 
        
        // Ensure the orb agent exists before starting conversation
        // Remove when you have created your own agent
        const agentResponse = await ensureOrbAgent();
        if (agentResponse.error) {
          setErrorMessage(`Failed to setup orb agent: ${agentResponse.error.message}`);
          return;
        }

        const config: ConfigMessage = {
          type: "config",
          agent: "orb-color-agent", // Replace with your own agent name
        };

        const tokenResponse = await createSessionToken();
        if (tokenResponse.error || !tokenResponse.data) {
          throw new Error(tokenResponse.error?.message ?? "Failed to create session token");
        }

        await startConversation(config, tokenResponse.data.sessionToken);
      } catch (error) {
        console.error("Failed to start conversation:", error);
        setErrorMessage(`Failed to start conversation: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }
  };

  return (
    <div className="h-screen bg-stone-50 p-8 flex">
      <div className="max-w-2xl mx-auto flex-1 flex flex-col">
        <div className="bg-white border border-stone-200 rounded-2xl text-sm flex flex-col h-full">
          <div className="p-4 border-b border-stone-100 flex-shrink-0">
            <h1 className="text-xl font-semibold">Phonic Web Demo</h1>
            <p className="text-xs text-stone-500 mt-1">Status: {status}</p>
            
            {hasPermission === false && (
              <div className="mt-2">
                <span className="text-xs text-red-600">Microphone access needed. </span>
                <button
                  onClick={requestPermission}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  Allow access
                </button>
              </div>
            )}

            {errorMessage && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="text-red-600 text-sm">
                  <strong>Error:</strong> {errorMessage}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex-1 px-4 pb-4 overflow-hidden flex flex-col">
            <div className="flex-shrink-0 flex justify-center py-6">
              <AnimatedOrb 
                color={orbColor} 
                isActive={status === "ready" && isMicrophoneEnabled && !isMuted} 
              />
            </div>

            {/* Conversation messages */}
            {conversationItems.length === 0 ? (
              <div className="flex-1 grid place-items-center text-stone-500">
                <div className="text-center">
                  <div className="font-medium text-stone-700 mb-1">Meet your magical orb!</div>
                  <div className="text-sm">Start a conversation to change its color</div>
                </div>
              </div>
            ) : (
              <div className="flex-1 space-y-3 overflow-y-auto">
                {conversationItems.map((item) => (
                  <div key={item.itemIdx} className="space-y-1">
                    <div className="text-xs font-medium text-stone-500">
                      {item.role === "user" ? "You" : "Assistant"}
                    </div>
                    <div className="text-stone-900">
                      {item.text === null ? (
                        <span className="text-stone-500 italic">Listening...</span>
                      ) : (
                        item.text
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-4 flex justify-center gap-4 flex-shrink-0">
            {!(status === "ready" && isMicrophoneEnabled) ? (
              <button
                onClick={toggleConversation}
                className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-md font-medium hover:bg-stone-800 transition-colors"
              >
                Start conversation
              </button>
            ) : (
              <div className="flex items-center gap-4">
                <button
                  onClick={toggleConversation}
                  className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-md font-medium hover:bg-red-700 transition-colors"
                >
                  End conversation
                </button>
                
                <button
                  onClick={toggleMute}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
                    isMuted 
                      ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200" 
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  {isMuted ? "Unmute" : "Mute"}
                </button>
              </div>
            )}
            
            {isMicrophoneEnabled && !isMuted && (
              <div className="flex items-center gap-2 text-stone-600">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm">Recording</span>
              </div>
            )}
            
            {isMicrophoneEnabled && isMuted && (
              <div className="flex items-center gap-2 text-stone-600">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-sm">Muted</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}