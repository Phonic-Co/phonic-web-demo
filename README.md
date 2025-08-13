# Phonic Web Starter

A complete React/Next.js starter template for building real-time AI voice conversation apps with Phonic's Speech-to-Speech API.

## ✨ What You Get

- **Complete voice conversation UI** with animated orb visualization
- **WebSocket tool integration** with live color-changing demo
- **Secure authentication** using session tokens

## 🚀 Quick Start

### 1. Clone and Install
```bash
git clone <your-repo>
cd phonic-web-demo
npm install
```

### 2. Set Up Environment
Create `.env.local` file:
```env
PHONIC_API_KEY=ph_your_api_key_here
```

### 3. Run the App
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) and start talking to your AI! 

The demo includes a magical orb that changes color based on voice commands - try saying "Make the orb red" or "Change it to blue"!

## 🏗️ Project Structure

```
src/
├── app/
│   ├── actions.ts              # Server actions (session tokens, agent setup)
│   ├── hooks/
│   │   ├── useConversation.ts  # Main conversation hook
│   │   └── useMicPermission.ts # Microphone permission management
│   └── page.tsx                # Main demo page
├── components/
│   └── AnimatedOrb.tsx         # Animated orb with color transitions
├── lib/
│   ├── phonic/                 # Phonic WebSocket client
│   ├── audio/                  # Audio capture and processing
│   └── types.ts                # Shared TypeScript types
└── public/
    └── pcm-processor.worklet.js # Audio worklet for microphone
```

## 🎯 Core Features

### Voice Conversation
```typescript
import { useConversation } from "./hooks/useConversation";

const {
  status,                    // Connection status
  conversationItems,         // Chat history
  isMicrophoneEnabled,      // Mic state
  isMuted,                  // Mute state
  startConversation,        // Start function
  stopConversation,         // Stop function
  toggleMute,               // Mute/unmute
} = useConversation({
  wsBaseUrl: process.env.NEXT_PUBLIC_STS_WS_URL,
  onToolCall: (toolCall) => {
    // Handle tool calls from AI
    console.log("Tool call:", toolCall.tool_name);
  }
});
```

### Tool Integration
The demo includes a complete WebSocket tool example that lets Phonic change the orb color using websocket tools:

```typescript
// Tool call handler
onToolCall: (toolCall) => {
  if (toolCall.tool_name === "set_orb_color") {
    const color = toolCall.parameters.color;
    setOrbColor(color); // Update UI
    
    sendToolCallOutput({
      tool_call_id: toolCall.tool_call_id,
      output: { success: true, color: color }
    });
  }
}
```

### Microphone Permissions
Simple hook for managing microphone access:

```typescript
import { useMicPermission } from "./hooks/useMicPermission";

const { hasPermission, requestPermission } = useMicPermission();
```
