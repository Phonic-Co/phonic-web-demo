export function resampleFloat32(input: Float32Array, inRate: number, outRate: number): Float32Array {
    if (inRate === outRate) return input.slice();
    const ratio = inRate / outRate;
    const newLen = Math.floor(input.length / ratio);
    const output = new Float32Array(newLen);
    let pos = 0;
    let idx = 0;
    while (idx < newLen) {
        const nextPos = (idx + 1) * ratio;
        let sum = 0;
        let count = 0;
        for (; pos < nextPos && pos < input.length; pos++) {
            sum += input[Math.floor(pos)];
            count++;
        }
        output[idx++] = count > 0 ? sum / count : 0;
    }
    return output;
}

export function floatToInt16(input: Float32Array): Int16Array {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        let s = input[i];
        if (s > 1) s = 1;
        else if (s < -1) s = -1;
        out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
}

export function base64ToInt16Array(base64: string): Int16Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return new Int16Array(bytes.buffer);
}

export function int16ToBase64(data: Int16Array): string {
    const buf = new Uint8Array(data.buffer);
    let binary = "";
    for (let i = 0; i < buf.byteLength; i++)
        binary += String.fromCharCode(buf[i]);
    return btoa(binary);
}
