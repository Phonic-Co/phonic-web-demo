// This code runs on the Web Audio rendering thread (not the main thread).
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(0);
    this.appendIndex = 0; // new chunks will be placed starting at this index
    this.processIndex = 0; // process() will grab chunks starting at this index
    this.isStopped = false;
    this.allChunksAppended = false;

    this.port.onmessage = (e) => {
      if (e.data.type === "append-chunk") {
        this.appendChunk(e.data.chunk);
      } else if (e.data.type === "all-chunks-appended") {
        this.allChunksAppended = true;
      } else if (e.data.type === "stop-and-clear-buffers") {
        this.isStopped = true;
        this.buffer = new Float32Array(0);
        this.appendIndex = 0;
        this.processIndex = 0;
      } else if (e.data.type === "resume") {
        this.isStopped = false;
      } else {
        console.log(`WARNING: Ignoring message ${e.data}`)
      }
    };
  }

  // Source: https://github.com/rochars/alawmulaw/blob/master/lib/mulaw.js
  decodeMulawToPcm(mulawByte /* 0..255 */) {
    const decodeTable = [0, 132, 396, 924, 1980, 4092, 8316, 16764];

    mulawByte = ~mulawByte;
    const sign = mulawByte & 0x80;
    const exponent = (mulawByte >> 4) & 0x07;
    const mantissa = mulawByte & 0x0f;
    let sample = decodeTable[exponent] + (mantissa << (exponent + 3));

    if (sign !== 0) {
      sample = -sample;
    }

    return sample;
  }

  appendChunk(chunk /* Int16Array | Uint8Array */) {
    let float32Chunk;

    if (chunk instanceof Int16Array) {
      // Convert Int16Array to Float32Array
      float32Chunk = new Float32Array(chunk.length);
      for (let i = 0; i < chunk.length; i++) {
        float32Chunk[i] = chunk[i] / 32767;
      }
    } else if (chunk instanceof Uint8Array) {
      // Assume this is μ-law encoded audio, decode to PCM
      float32Chunk = new Float32Array(chunk.length);
      for (let i = 0; i < chunk.length; i++) {
        float32Chunk[i] = this.decodeMulawToPcm(chunk[i]) / 32767;
      }
    } else {
      throw new Error(`Unsupported chunk type: ${chunk.constructor.name}`);
    }

    const chunkSize = float32Chunk.length;
    const newBuffer = new Float32Array(this.appendIndex + chunkSize);

    newBuffer.set(this.buffer.subarray(0, this.appendIndex));
    newBuffer.set(float32Chunk, this.appendIndex);

    this.buffer = newBuffer;
    this.appendIndex += chunkSize;
  }

  /* 
    Called by the Web Audio API once per audio block.
    Audio block size is chosen by browser implementations.
    For example, if Chrome has audio block size of 128 samples, and our audio 44.1 kHz: 
      - There are 44100 samples per second
      - Therefore, 44100 / 128 = 344.53125 audio blocks per second
      - Meaning that `process()` will be called every 1/344.53125 = 0.0029024943 seconds = 2.9ms
    See: https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process
  */
  process(_inputs, outputs) {
    const channelData = outputs[0][0]; // Float32Array(128) or whatever the audio block size is
    // For stereo output, the second channel will be at outputs[0][1].
    const audioBlockSize = channelData.length;

    if (this.isStopped) {
      channelData.fill(0);
      return true;
    }

    if (this.appendIndex - this.processIndex >= audioBlockSize) {
      channelData.set(
        this.buffer.subarray(
          this.processIndex,
          this.processIndex + audioBlockSize,
        ),
      );

      this.processIndex += audioBlockSize;

      return true; // Keep the processor alive and call it in the future
    }

    if (this.allChunksAppended) {
      channelData.set(
        this.buffer.subarray(this.processIndex, this.appendIndex), // if this results in an empty array, no harm will be done to channelData
      );
      channelData.fill(0, this.appendIndex - this.processIndex);

      this.port.postMessage({ type: "finished-processing" });

      return false;
    }

    channelData.fill(0);

    return true;
  }
}

registerProcessor("audio-processor", AudioProcessor);
