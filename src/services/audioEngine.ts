/**
 * Diablo Audio Engine
 * Real-time Web Audio API pipeline with barge-in interruption handling,
 * single persistent AudioContext, 24kHz PCM decode, 16kHz PCM capture,
 * and 440Hz Jarvis acoustic diagnostic.
 */

/**
 * Resamples Float32 audio to 16kHz 16-bit linear PCM (Int16 Little Endian)
 */
function downsampleFloat32To16k(inputData: Float32Array, inputSampleRate: number): Int16Array {
  if (inputSampleRate === 16000) {
    const pcm16 = new Int16Array(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
      const s = Math.max(-1, Math.min(1, inputData[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return pcm16;
  }

  const ratio = inputSampleRate / 16000;
  const newLength = Math.round(inputData.length / ratio);
  const pcm16 = new Int16Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const origIndex = Math.floor(i * ratio);
    const nextIndex = Math.min(inputData.length - 1, origIndex + 1);
    const interp = i * ratio - origIndex;
    const sample = inputData[origIndex] * (1 - interp) + inputData[nextIndex] * interp;
    const s = Math.max(-1, Math.min(1, sample));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm16;
}

export class AudioEngine {
  private outputAudioCtx: AudioContext | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private inputAnalyser: AnalyserNode | null = null;

  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micProcessor: ScriptProcessorNode | null = null;

  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private nextStartTime: number = 0;
  private isSpeakingInternal: boolean = false;
  private syntheticWaveformTimer: any = null;
  private syntheticVisualizerData: Uint8Array = new Uint8Array(64);

  public onAudioChunk?: (base64Chunk: string) => void;
  public onMicVolume?: (volume: number) => void;
  public onOutputVolume?: (volume: number) => void;
  public onBargeIn?: () => void;
  public onPlaybackStart?: () => void;
  public onPlaybackEnd?: () => void;

  private vadSpeechFrames: number = 0;

  /**
   * Initializes or resumes the AudioContexts after genuine user interaction
   */
  public async ensureContexts(): Promise<void> {
    if (!this.outputAudioCtx || this.outputAudioCtx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.outputAudioCtx = new AudioCtxClass({ sampleRate: 24000 });

      this.masterGain = this.outputAudioCtx.createGain();
      this.masterGain.gain.value = 1.0;

      this.outputAnalyser = this.outputAudioCtx.createAnalyser();
      this.outputAnalyser.fftSize = 256;

      this.masterGain.connect(this.outputAnalyser);
      this.outputAnalyser.connect(this.outputAudioCtx.destination);
    }

    if (this.outputAudioCtx.state === 'suspended') {
      await this.outputAudioCtx.resume();
    }
  }

  /**
   * Diagnostic 440Hz Jarvis tone test to verify speaker output without Gemini dependency
   */
  public async testSpeaker(): Promise<void> {
    await this.ensureContexts();
    if (!this.outputAudioCtx || !this.masterGain) return;

    const ctx = this.outputAudioCtx;
    const now = ctx.currentTime;

    // Dual-tone harmonic Jarvis acoustic chime (440Hz -> 880Hz)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(440, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.25);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, now);
    osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.25);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.55);
    osc2.stop(now + 0.55);
  }

  private chimeEnabled: boolean = true;

  public setChimeEnabled(enabled: boolean): void {
    this.chimeEnabled = enabled;
  }

  public isChimeActive(): boolean {
    return this.chimeEnabled;
  }

  /**
   * Signature Diablo sci-fi activation sound (short cybernetic arc-reactor pulse).
   * Completely replaces the generic Google Assistant two-tone chime with a sleek,
   * 100ms futuristic sub-harmonic pulse tailored to Diablo.
   */
  public async playWakeWordChime(): Promise<void> {
    if (!this.chimeEnabled) return;

    await this.ensureContexts();
    if (!this.outputAudioCtx || !this.masterGain) return;

    const ctx = this.outputAudioCtx;
    const now = ctx.currentTime;

    // Dual-stage cybernetic arc-reactor ignition pulse
    const subOsc = ctx.createOscillator();
    const snapOsc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    // High-tech bandpass shaping
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(320, now);
    filter.Q.setValueAtTime(2.5, now);

    // Deep sub-bass reactor thump (130Hz -> 65Hz)
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(130, now);
    subOsc.frequency.exponentialRampToValueAtTime(65, now + 0.1);

    // Subtle metallic tactile click (480Hz -> 180Hz)
    snapOsc.type = 'sine';
    snapOsc.frequency.setValueAtTime(480, now);
    snapOsc.frequency.exponentialRampToValueAtTime(180, now + 0.08);

    // Fast micro-envelope: 100ms total
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    subOsc.connect(filter);
    snapOsc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    subOsc.start(now);
    snapOsc.start(now);
    subOsc.stop(now + 0.12);
    snapOsc.stop(now + 0.12);
  }

  /**
   * Starts microphone capture at 16kHz with VAD barge-in detection.
   * Returns true if successfully started, or false if permission was denied or unavailable.
   */
  public async startMicrophone(): Promise<boolean> {
    await this.ensureContexts();

    if (this.micStream && this.micStream.active) {
      return true; // already active
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      console.warn('[AudioEngine] navigator.mediaDevices.getUserMedia is not available in this environment');
      return false;
    }

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.inputAudioCtx = new AudioCtxClass({ sampleRate: 16000 });

      this.micSource = this.inputAudioCtx.createMediaStreamSource(this.micStream);
      this.inputAnalyser = this.inputAudioCtx.createAnalyser();
      this.inputAnalyser.fftSize = 256;

      // ScriptProcessorNode for raw PCM chunking
      this.micProcessor = this.inputAudioCtx.createScriptProcessor(4096, 1, 1);

      this.micProcessor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);

        // Compute RMS volume for visualizer & VAD
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        const normalizedVolume = Math.min(1, rms * 5);

        if (this.onMicVolume) {
          this.onMicVolume(normalizedVolume);
        }

        // VAD / Barge-in detection while Diablo is speaking
        if (this.isSpeakingInternal) {
          if (rms > 0.04) {
            this.vadSpeechFrames++;
            if (this.vadSpeechFrames >= 2) {
              console.log('[AudioEngine] Local Barge-In triggered by user speech');
              this.vadSpeechFrames = 0;
              this.clearQueueAndStop();
              if (this.onBargeIn) {
                this.onBargeIn();
              }
            }
          } else {
            this.vadSpeechFrames = Math.max(0, this.vadSpeechFrames - 1);
          }
        } else {
          this.vadSpeechFrames = 0;
        }

        // Convert Float32 (-1.0 to 1.0) to exactly 16kHz 16-bit Linear PCM (Int16 little-endian)
        const currentRate = this.inputAudioCtx?.sampleRate || 16000;
        const pcm16 = downsampleFloat32To16k(inputData, currentRate);

        // Convert to base64
        const uint8 = new Uint8Array(pcm16.buffer);
        let binary = '';
        for (let i = 0; i < uint8.byteLength; i++) {
          binary += String.fromCharCode(uint8[i]);
        }
        const base64 = btoa(binary);

        if (this.onAudioChunk) {
          this.onAudioChunk(base64);
        }
      };

      this.micSource.connect(this.inputAnalyser);
      this.inputAnalyser.connect(this.micProcessor);
      // Processor must connect to destination to run in Chrome
      this.micProcessor.connect(this.inputAudioCtx.destination);
      return true;
    } catch (err: any) {
      const isPermissionDenied =
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        /permission denied/i.test(err?.message || '');

      if (isPermissionDenied) {
        console.warn('[AudioEngine] Microphone access not granted or denied by user:', err?.message || err);
      } else {
        console.warn('[AudioEngine] Unable to access microphone:', err?.message || err);
      }
      return false;
    }
  }

  /**
   * Check if microphone stream is currently active
   */
  public isMicrophoneActive(): boolean {
    return Boolean(this.micStream && this.micStream.active);
  }

  /**
   * Stops microphone capture
   */
  public stopMicrophone(): void {
    if (this.micProcessor) {
      this.micProcessor.disconnect();
      this.micProcessor.onaudioprocess = null;
      this.micProcessor = null;
    }
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.inputAudioCtx && this.inputAudioCtx.state !== 'closed') {
      this.inputAudioCtx.close().catch(() => {});
      this.inputAudioCtx = null;
    }
  }

  /**
   * Decodes incoming base64 PCM 24kHz chunk and schedules sequential gapless playback
   */
  public async playBase64Chunk(base64Data: string): Promise<void> {
    await this.ensureContexts();
    if (!this.outputAudioCtx || !this.masterGain) return;

    try {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert 16-bit PCM little endian into Float32
      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      const audioBuffer = this.outputAudioCtx.createBuffer(1, float32Array.length, 24000);
      audioBuffer.copyToChannel(float32Array, 0);

      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.masterGain);

      const now = this.outputAudioCtx.currentTime;
      if (this.nextStartTime < now) {
        this.nextStartTime = now;
      }

      const startTime = this.nextStartTime;
      source.start(startTime);
      this.nextStartTime += audioBuffer.duration;

      this.activeSources.add(source);
      if (!this.isSpeakingInternal) {
        this.isSpeakingInternal = true;
        if (this.onPlaybackStart) {
          this.onPlaybackStart();
        }
      }

      source.onended = () => {
        this.activeSources.delete(source);
        if (this.activeSources.size === 0) {
          this.isSpeakingInternal = false;
          if (this.onPlaybackEnd) {
            this.onPlaybackEnd();
          }
        }
      };
    } catch (e) {
      console.error('[AudioEngine] Error decoding/playing audio chunk:', e);
    }
  }

  /**
   * BARGE-IN: Instantly stop all active playback, clear queue, cancel browser speech synthesis, and reset timing
   */
  public clearQueueAndStop(): void {
    this.stopSyntheticWaveform();

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        // ignore
      }
    }

    if (this.activeSources.size > 0) {
      console.log('[AudioEngine] Clearing audio queue and stopping', this.activeSources.size, 'sources');
      for (const source of this.activeSources) {
        try {
          source.stop();
          source.disconnect();
        } catch (e) {
          // already stopped
        }
      }
      this.activeSources.clear();
    }

    if (this.outputAudioCtx) {
      this.nextStartTime = this.outputAudioCtx.currentTime;
    } else {
      this.nextStartTime = 0;
    }

    if (this.isSpeakingInternal) {
      this.isSpeakingInternal = false;
      if (this.onPlaybackEnd) {
        this.onPlaybackEnd();
      }
    }
  }

  private startSyntheticWaveform(): void {
    if (this.syntheticWaveformTimer) clearInterval(this.syntheticWaveformTimer);
    let step = 0;
    this.syntheticWaveformTimer = setInterval(() => {
      step += 0.25;
      for (let i = 0; i < 64; i++) {
        const val = Math.sin(step + i * 0.28) * 0.5 + 0.5;
        const jitter = Math.random() * 0.25;
        this.syntheticVisualizerData[i] = Math.floor((val * 0.75 + jitter) * 170 + 20);
      }
    }, 50);
  }

  private stopSyntheticWaveform(): void {
    if (this.syntheticWaveformTimer) {
      clearInterval(this.syntheticWaveformTimer);
      this.syntheticWaveformTimer = null;
    }
    this.syntheticVisualizerData.fill(0);
  }

  /**
   * Zero-quota browser SpeechSynthesis fallback with automatic Hindi/English voice routing
   * and visualizer synchronization.
   */
  public async speakTextWithFallback(text: string, voicePreference: string = 'Fenrir'): Promise<void> {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      if (this.onPlaybackEnd) this.onPlaybackEnd();
      return;
    }

    // Cancel any active speech or audio sources first
    this.clearQueueAndStop();

    const cleanText = text.replace(/[*_#`]/g, '').trim();
    if (!cleanText) {
      if (this.onPlaybackEnd) this.onPlaybackEnd();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Detect language: Devanagari script or common Hindi keywords
    const isHindi =
      /[\u0900-\u097F]/.test(cleanText) ||
      /(namaste|karo|kholo|batao|chalao|kaise|bhai|bataiye|diablo|kya|hai|mera|meri|mujhe|shuru)/i.test(cleanText);

    utterance.lang = isHindi ? 'hi-IN' : 'en-US';

    // Pick best available voice matching language and Diablo character tone
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      let chosenVoice: SpeechSynthesisVoice | null = null;
      if (isHindi) {
        chosenVoice =
          voices.find((v) => v.lang.startsWith('hi')) ||
          voices.find((v) => v.name.toLowerCase().includes('hindi')) ||
          voices.find((v) => v.lang.includes('IN')) ||
          null;
      } else {
        const wantsFemale = voicePreference === 'Female' || voicePreference === 'Kore';
        if (wantsFemale) {
          chosenVoice =
            voices.find((v) => v.lang.startsWith('en') && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('samantha'))) ||
            voices.find((v) => v.lang.startsWith('en')) ||
            null;
        } else {
          chosenVoice =
            voices.find((v) => v.lang.startsWith('en') && (v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('george') || v.name.toLowerCase().includes('david') || v.name.toLowerCase().includes('uk english male'))) ||
            voices.find((v) => v.lang.startsWith('en')) ||
            null;
        }
      }
      if (chosenVoice) {
        utterance.voice = chosenVoice;
      }
    }

    utterance.rate = 1.0;
    utterance.pitch = voicePreference === 'Female' || voicePreference === 'Kore' ? 1.05 : 0.95;

    utterance.onstart = () => {
      this.isSpeakingInternal = true;
      this.startSyntheticWaveform();
      if (this.onPlaybackStart) {
        this.onPlaybackStart();
      }
    };

    utterance.onend = () => {
      this.stopSyntheticWaveform();
      this.isSpeakingInternal = false;
      if (this.onPlaybackEnd) {
        this.onPlaybackEnd();
      }
    };

    utterance.onerror = (e) => {
      console.log('[AudioEngine] SpeechSynthesis notice:', e.error);
      this.stopSyntheticWaveform();
      this.isSpeakingInternal = false;
      if (this.onPlaybackEnd) {
        this.onPlaybackEnd();
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Get frequency data for visualizer (either output speaking or input mic)
   */
  public getVisualizerData(): Uint8Array {
    const dataArray = new Uint8Array(64);
    if (this.isSpeakingInternal) {
      if (this.outputAnalyser && this.activeSources.size > 0) {
        this.outputAnalyser.getByteFrequencyData(dataArray);
      } else {
        dataArray.set(this.syntheticVisualizerData);
      }
    } else if (this.inputAnalyser) {
      this.inputAnalyser.getByteFrequencyData(dataArray);
    }
    return dataArray;
  }

  public isSpeaking(): boolean {
    return this.isSpeakingInternal || this.activeSources.size > 0;
  }

  public cleanup(): void {
    this.clearQueueAndStop();
    this.stopMicrophone();
    if (this.outputAudioCtx && this.outputAudioCtx.state !== 'closed') {
      this.outputAudioCtx.close().catch(() => {});
      this.outputAudioCtx = null;
    }
  }
}
