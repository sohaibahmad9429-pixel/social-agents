/**
 * PCM Player AudioWorklet Processor
 * Plays 24kHz 16-bit PCM audio received from the server.
 * Based on: https://github.com/google/adk-samples/tree/main/python/agents/bidi-demo
 */

class PCMPlayerProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.buffer = [];
        this.isPlaying = false;

        // Handle messages from main thread
        this.port.onmessage = (event) => {
            if (event.data.command === 'endOfAudio') {
                // Clear buffer on interruption
                this.buffer = [];
                this.isPlaying = false;
            } else if (event.data instanceof ArrayBuffer) {
                // Convert ArrayBuffer to Int16Array for PCM data
                const int16Data = new Int16Array(event.data);
                // Add samples to buffer
                for (let i = 0; i < int16Data.length; i++) {
                    this.buffer.push(int16Data[i] / 32768); // Convert to float [-1, 1]
                }
                this.isPlaying = true;
            }
        };
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const channel = output[0];

        if (!channel) return true;

        // Fill output with buffered samples
        for (let i = 0; i < channel.length; i++) {
            if (this.buffer.length > 0) {
                channel[i] = this.buffer.shift();
            } else {
                channel[i] = 0;
                this.isPlaying = false;
            }
        }

        return true; // Keep processor alive
    }
}

registerProcessor('pcm-player-processor', PCMPlayerProcessor);
