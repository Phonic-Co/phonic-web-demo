"use server";

export async function createSessionToken() {
    const apiKey = process.env.PHONIC_API_KEY;
    const baseUrl = process.env.PHONIC_API_BASE_URL || "https://api.phonic.co";

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
        console.log(json);

        if (!res.ok) {
            return { data: null, error: { message: json?.error?.message ?? `Failed (${res.status})` } } as const;
        }
        return { data: { sessionToken: json.session_token as string }, error: null } as const;
    } catch (error) {
        return { data: null, error: { message: "Failed to create session token" } } as const;
    }
}


