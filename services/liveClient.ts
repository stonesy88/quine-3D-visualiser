import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from "@google/genai";
import { ControlState } from "../types";

// Helper to encode audio data
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export class LiveClient {
  private activeSession: any = null;
  private onControlUpdate: (state: ControlState) => void;
  private stream: MediaStream | null = null;
  private videoInterval: number | undefined;
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private isConnected: boolean = false;

  constructor(onControlUpdate: (state: ControlState) => void) {
    this.onControlUpdate = onControlUpdate;
  }

  async connect(videoElement: HTMLVideoElement) {
    if (!process.env.API_KEY) {
      console.warn("No API Key provided for Live Client");
      return;
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Define the tool for the model to call
    const updateControlTool: FunctionDeclaration = {
      name: 'updateGraphControl',
      parameters: {
        type: Type.OBJECT,
        description: 'Update the graph visualization based on hand gestures.',
        properties: {
          expansion: {
            type: Type.NUMBER,
            description: 'Distance between hands (0.0 to 1.0). 0 is touching, 1 is wide apart.',
          },
          tension: {
            type: Type.NUMBER,
            description: 'Hand tension (0.0 to 1.0). 0 is open palm, 1 is closed fist.',
          },
        },
        required: ['expansion', 'tension'],
      },
    };

    try {
      // Request audio and video to satisfy Live API requirements
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      videoElement.srcObject = this.stream;
      await videoElement.play();

      // Initialize Audio Context for streaming
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });

      // Create session
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Session Opened");
            this.isConnected = true;
          },
          onmessage: (message: LiveServerMessage) => {
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'updateGraphControl') {
                  const args = fc.args as any;
                  this.onControlUpdate({
                    expansion: Number(args.expansion || 0),
                    tension: Number(args.tension || 0),
                  });
                  
                  // Acknowledge the tool call
                  if (this.activeSession) {
                    try {
                      this.activeSession.sendToolResponse({
                        functionResponses: {
                          id: fc.id,
                          name: fc.name,
                          response: { result: "ok" }
                        }
                      });
                    } catch (e) {
                      console.error("Failed to send tool response", e);
                    }
                  }
                }
              }
            }
          },
          onclose: () => {
             console.log("Gemini Live Session Closed");
             this.isConnected = false;
             this.activeSession = null;
          },
          onerror: (e) => {
             console.error("Gemini Live Error", e);
             this.isConnected = false;
             this.activeSession = null;
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: [updateControlTool] }],
          systemInstruction: `You are a gesture controller for a 3D graph. 
          Continuously analyze the video feed.
          - If hands move apart, increase 'expansion' (0 to 1).
          - If fists clench, increase 'tension' (0 to 1).
          - If hands are close/relaxed, lower values.
          Call 'updateGraphControl' frequently (e.g., 2-5 times per second) to update state.
          Do not speak. Only use the tool.`,
        },
      });

      this.activeSession = await sessionPromise;
      
      // Start streaming only after session is fully established
      this.startVideoStreaming(videoElement);
      this.startAudioStreaming();

    } catch (err) {
      console.error("Failed to connect to Live API", err);
      this.isConnected = false;
      this.activeSession = null;
      throw err; 
    }
  }

  private startVideoStreaming(videoEl: HTMLVideoElement) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const FRAME_RATE = 2; // Limit frame rate

    this.videoInterval = window.setInterval(() => {
      if (!this.isConnected || !this.activeSession || !ctx || !videoEl.videoWidth) return;

      try {
        canvas.width = videoEl.videoWidth * 0.5; 
        canvas.height = videoEl.videoHeight * 0.5;
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

        const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
        
        this.activeSession.sendRealtimeInput({
          media: {
            mimeType: 'image/jpeg',
            data: base64
          }
        });
      } catch (e) {
        console.debug("Video stream error (ignored):", e);
      }
    }, 1000 / FRAME_RATE);
  }

  private startAudioStreaming() {
    if (!this.audioContext || !this.stream) return;

    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.isConnected || !this.activeSession) return;
      
      try {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16
        const l = inputData.length;
        const int16 = new Int16Array(l);
        for (let i = 0; i < l; i++) {
          int16[i] = inputData[i] * 32768;
        }
        
        const base64Audio = encode(new Uint8Array(int16.buffer));

        this.activeSession.sendRealtimeInput({
          media: {
            mimeType: 'audio/pcm;rate=16000',
            data: base64Audio
          }
        });
      } catch (err) {
        console.debug("Audio stream error (ignored):", err);
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  disconnect() {
    this.isConnected = false;
    if (this.videoInterval) clearInterval(this.videoInterval);
    if (this.source) {
      try { this.source.disconnect(); } catch (e) {}
    } 
    if (this.processor) {
      try { this.processor.disconnect(); } catch (e) {}
    }
    if (this.audioContext) {
      try { this.audioContext.close(); } catch (e) {}
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    
    // Attempt to close session if it exists
    if (this.activeSession) {
      try { 
          // Check if close method exists on the session or client
          if (typeof this.activeSession.close === 'function') {
              this.activeSession.close();
          }
      } catch(e) { /* ignore */ }
    }
    this.activeSession = null;
  }
}