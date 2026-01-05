/**
 * PCM Recorder AudioWorklet Processor
 * Records 16kHz audio from microphone and sends to main thread.
 * Based on: https://github.com/google/adk-samples/tree/main/python/agents/bidi-demo
 */

class PCMRecorderProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 4096; // Samples per chunk (~256ms at 16kHz)
        this.buffer = [];
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];

        if (input.length > 0) {
            const channelData = input[0];

            // Accumulate samples
            for (let i = 0; i < channelData.length; i++) {
                this.buffer.push(channelData[i]);
            }

            // Send when buffer is full
            if (this.buffer.length >= this.bufferSize) {
                // Send Float32 array to main thread for conversion
                const float32Array = new Float32Array(this.buffer.splice(0, this.bufferSize));
                this.port.postMessage(float32Array);
            }
        }

        return true; // Keep processor alive
    }
}

registerProcessor('pcm-recorder-processor', PCMRecorderProcessor);
