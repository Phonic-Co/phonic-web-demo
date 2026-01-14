// This code runs on the Web Audio rendering thread (not the main thread).
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 1024;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    this.isMuted = false;

    this.port.onmessage = (e) => {
      if (e.data.type === "mute") {
        this.isMuted = true;
      } else if (e.data.type === "unmute") {
        this.isMuted = false;
      }
    };
  }

  averageInputChannels(inputChannels) {
    const channelsCount = inputChannels.length;

    if (channelsCount === 0) {
      throw new Error("No input channels in audio recording");
    }

    if (channelsCount === 1) {
      return inputChannels[0];
    }

    const channelSize = inputChannels[0].length;
    const result = new Float32Array(channelSize);

    for (let i = 0; i < channelSize; i++) {
      let sum = 0;

      for (let chIdx = 0; chIdx < channelsCount; chIdx++) {
        sum += inputChannels[chIdx][i];
      }

      result[i] = sum / channelsCount;
    }

    return result;
  }

  // `inputs[0]` is an array of channels,
  // where each channel is a Float32Array with values in range [-1..1].
  // See: https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process#inputs
  process(inputs) {
    const channels = inputs[0];
    if (!channels || channels.length === 0) {
      return true;
    }

    const monoInput = this.averageInputChannels(
      this.isMuted
        ? [new Float32Array(channels[0].length)] // will be filled with zeros, length should be 128
        : channels
    );

    for (let i = 0, len = monoInput.length; i < len; i++) {
      this.buffer[this.bufferIndex++] = monoInput[i];

      if (this.bufferIndex >= this.bufferSize) {
        this.port.postMessage({
          type: "audio-recording-chunk",
          buffer: this.buffer.slice(), // Copy the buffer to avoid race conditions
        });
        this.bufferIndex = 0;
      }
    }
    
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);


