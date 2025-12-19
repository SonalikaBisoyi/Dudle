
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { DoodleStyle } from "../types";

const API_KEY = process.env.API_KEY || "";

/**
 * Encodes Uint8Array to Base64 string.
 */
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes Base64 string to Uint8Array.
 */
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  /**
   * Connects to the Live API for real-time voice journaling.
   */
  async connectVoice(callbacks: {
    onTranscription: (text: string) => void;
    onError: (err: any) => void;
    onClose: () => void;
  }) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    
    let currentTranscription = "";

    const sessionPromise = this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
          const source = inputAudioContext.createMediaStreamSource(stream);
          const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
          scriptProcessor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const l = inputData.length;
            const int16 = new Int16Array(l);
            for (let i = 0; i < l; i++) {
              int16[i] = inputData[i] * 32768;
            }
            const pcmBlob = {
              data: encode(new Uint8Array(int16.buffer)),
              mimeType: 'audio/pcm;rate=16000',
            };
            sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
          };
          source.connect(scriptProcessor);
          scriptProcessor.connect(inputAudioContext.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          if (message.serverContent?.inputTranscription) {
            const text = message.serverContent.inputTranscription.text;
            currentTranscription += text;
            callbacks.onTranscription(currentTranscription);
          }
        },
        onerror: (e) => callbacks.onError(e),
        onclose: () => callbacks.onClose(),
      },
      config: {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        systemInstruction: "You are a warm, listening ear for a daily journal. Listen to the user's day. Occasionally acknowledge with short, gentle verbal cues to keep the flow. Your main goal is to capture the details of their day.",
      },
    });

    return {
      stop: async () => {
        const session = await sessionPromise;
        session.close();
        stream.getTracks().forEach(track => track.stop());
        inputAudioContext.close();
        return currentTranscription;
      }
    };
  }

  /**
   * Analyzes the day's transcript to generate a visual prompt for the doodle with customization.
   */
  async generateVisualPrompt(transcript: string, style: DoodleStyle): Promise<string> {
    const thicknessDesc = style.thickness === 'Fine' ? 'ultra-thin delicate' : style.thickness === 'Bold' ? 'thick chunky' : 'medium';
    
    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Transform this daily journal entry into a single, cohesive prompt for an image generator. 
      The style must be: ${style.artStyle}. 
      Technical details: ${thicknessDesc} lines, color palette using ${style.color}, clean white background.
      The doodle should capture the emotional essence and 2-3 key events mentioned.
      Journal entry: "${transcript}"
      
      Output only the final prompt. Do not add explanations. 
      Format: "A ${style.artStyle} hand-drawn doodle of [content], ${thicknessDesc} ${style.color} lines, white background."`,
    });
    return response.text || "A simple doodle of a peaceful day.";
  }

  /**
   * Generates the actual doodle image.
   */
  async generateDoodle(visualPrompt: string): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [{ text: visualPrompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    let imageUrl = "";
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        imageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }
    return imageUrl;
  }
}

export const gemini = new GeminiService();
