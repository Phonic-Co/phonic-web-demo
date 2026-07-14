"use server";

import { PhonicClient, PhonicError } from "phonic";

function getClient() {
    const apiKey = process.env.PHONIC_API_KEY;
    if (!apiKey) return null;
    return new PhonicClient({
        apiKey,
        // SDK default is https://api.phonic.ai/v1; allow overriding for other environments
        ...(process.env.PHONIC_API_BASE_URL
            ? { baseUrl: `${process.env.PHONIC_API_BASE_URL}/v1` }
            : {}),
    });
}

function errorMessage(err: unknown, fallback: string): string {
    if (err instanceof PhonicError) {
        // API error bodies look like { error: { message } }
        const body = err.body as { error?: { message?: string } } | undefined;
        return body?.error?.message ?? err.message ?? fallback;
    }
    if (err instanceof Error) return err.message;
    return fallback;
}

export async function createSessionToken() {
    const client = getClient();
    if (!client) {
        return { data: null, error: { message: "PHONIC_API_KEY is not set" } } as const;
    }

    try {
        const res = await client.auth.createSessionToken({ ttl_seconds: 300 });
        return { data: { sessionToken: res.session_token }, error: null } as const;
    } catch (err) {
        return { data: null, error: { message: errorMessage(err, "Failed to create session token") } } as const;
    }
}

export async function ensureOrbAgent() {
    const client = getClient();
    if (!client) {
        return { data: null, error: { message: "PHONIC_API_KEY is not set" } } as const;
    }

    const toolName = "set_orb_color";
    const agentName = "orb-color-agent";

    try {
        // Ensure the tool exists (404 -> create; other errors surface below)
        const existingTool = await client.tools.get(toolName).catch((err) => {
            if (err instanceof PhonicError && err.statusCode === 404) return null;
            throw err;
        });

        if (!existingTool) {
            await client.tools.create({
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
                        is_required: true,
                    },
                ],
            });
        }

        // Upsert (create-or-update by name) so prompt/config changes in this
        // file propagate to workspaces where the agent already exists
        await client.agents.upsert({
            name: agentName,
            voice_id: "sabrina",
            system_prompt:
                "You are a magical orb assistant! You love talking about colors and have the power to change the color of your orb. You can use the set_orb_color tool with any hex color code (like #ff0000 for red, #00ff00 for green, #0000ff for blue). The orb shows exactly one color at a time - no gradients or combinations - so only ever suggest a single color. If someone asks for multiple colors or a gradient, cheerfully explain you can show one color at a time and offer to cycle through their colors one by one. Be enthusiastic about colors. Keep responses conversational and fun!",
            tools: [toolName],
            welcome_message:
                "Hello! I'm your magical orb assistant. I can change my color - what color would you like to see?",
        });

        return { data: { ready: true }, error: null } as const;
    } catch (err) {
        return { data: null, error: { message: errorMessage(err, "Failed to ensure orb agent") } } as const;
    }
}
