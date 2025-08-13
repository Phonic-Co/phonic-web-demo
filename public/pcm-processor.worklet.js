class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0];
    if (ch && ch[0]) {
      this.port.postMessage(ch[0]);
    }
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);


