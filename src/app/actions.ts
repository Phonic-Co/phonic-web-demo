"use server";

export async function createSessionToken() {
    const apiKey = process.env.PHONIC_API_KEY;
    const baseUrl = process.env.PHONIC_API_BASE_URL || "https://api.phonic.ai";

    if (!apiKey) {
        return { data: null, error: { message: "PHONIC_API_KEY is not set" } } as const;
    }

    try {
        const res = await fetch(`${baseUrl}/v1/auth/session_token`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ ttl_seconds: 300 }),
            cache: "no-store",
        });

        const json = await res.json()

        if (!res.ok) {
            return { data: null, error: { message: json?.error?.message ?? `Failed (${res.status})` } } as const;
        }
        return { data: { sessionToken: json.session_token as string }, error: null } as const;
    } catch {
        return { data: null, error: { message: "Failed to create session token" } } as const;
    }
}

export async function ensureOrbAgent() {
    const apiKey = process.env.PHONIC_API_KEY;
    const baseUrl = process.env.PHONIC_API_BASE_URL || "https://api.phonic.ai";

    if (!apiKey) {
        return { data: null, error: { message: "PHONIC_API_KEY is not set" } } as const;
    }

    const toolName = "set_orb_color";
    const agentName = "orb-color-agent";

    try {
        // First, ensure the tool exists
        const getToolRes = await fetch(`${baseUrl}/v1/tools/${toolName}`, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
        });

        if (!getToolRes.ok) {
            // Tool doesn't exist, create it
            const createToolRes = await fetch(`${baseUrl}/v1/tools`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: toolName,
                    description: "Changes the color of the orb display to any hex color",
                    type: "custom_websocket",
                    execution_mode: "sync",
                    tool_call_output_timeout_ms: 5000,
                    parameters: [
                        {
                            type: "string",
                            name: "color",
                            description: "Hex color code (e.g., '#ff0000' for red, '#00ff00' for green)",
                            is_required: true
                        }
                    ]
                }),
            });

            const createToolJson = await createToolRes.json();

            if (!createToolRes.ok) {
                return {
                    data: null,
                    error: { message: createToolJson?.error?.message ?? `Failed to create tool (${createToolRes.status})` }
                } as const;
            }
        }

        // Now ensure the agent exists
        const getAgentRes = await fetch(`${baseUrl}/v1/agents/${agentName}`, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
        });

        if (getAgentRes.ok) {
            // Agent already exists
            return { data: { exists: true }, error: null } as const;
        }

        // Agent doesn't exist, create it
        const createAgentRes = await fetch(`${baseUrl}/v1/agents`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: agentName,
                voice_id: "sabrina",
                system_prompt: "You are a magical orb assistant! You love talking about colors and have the power to change the color of your orb. You can use the set_orb_color tool with any hex color code (like #ff0000 for red, #00ff00 for green, #0000ff for blue). The orb shows exactly one color at a time - no gradients or combinations - so only ever suggest a single color. If someone asks for multiple colors or a gradient, cheerfully explain you can show one color at a time and offer to cycle through their colors one by one. Be enthusiastic about colors. Keep responses conversational and fun!",
                tools: [toolName],
                welcome_message: "Hello! I'm your magical orb assistant. I can change my color - what color would you like to see?",
            }),
        });

        const createAgentJson = await createAgentRes.json();

        if (!createAgentRes.ok) {
            return {
                data: null,
                error: { message: createAgentJson?.error?.message ?? `Failed to create agent (${createAgentRes.status})` }
            } as const;
        }

        return { data: { created: true }, error: null } as const;
    } catch {
        return { data: null, error: { message: "Failed to ensure orb agent" } } as const;
    }
}


