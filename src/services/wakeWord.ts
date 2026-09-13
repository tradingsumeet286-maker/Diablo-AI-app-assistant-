/**
 * Diablo Wake Word Detection & Speech Recognition Service
 * Listens continuously for "Diablo" / "Hey Diablo" using Web Speech API,
 * triggers acknowledgment, and transitions assistant to active command listening.
 */

export class WakeWordDetector {
  private recognition: any = null;
  private commandRecognition: any = null;
  private isListening: boolean = false;
  private isCommandListening: boolean = false;
  private shouldRestart: boolean = false;
  private isSupported: boolean = false;
  private debounceTimer: any = null;
  private silenceTimer: any = null;

  public onWakeWord?: (matchedWord: string, fullTranscript: string, commandPart?: string) => void;
  public onInterimCommand?: (transcript: string) => void;
  public onFinalCommand?: (command: string) => void;
  public onError?: (error: any) => void;
  public onStateChange?: (listening: boolean) => void;

  constructor() {
    const SpeechRec = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.isSupported = Boolean(SpeechRec);

    if (this.isSupported) {
      try {
        // 1. Continuous Background Wake Word Listener
        this.recognition = new SpeechRec();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 3;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event: any) => {
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const rawTranscript = event.results[i][0].transcript;
            const transcript = rawTranscript.toLowerCase().trim();
            const words = transcript.split(/\s+/);

            const isDiabloDetected =
              transcript.includes('diablo') ||
              transcript.includes('deablo') ||
              transcript.includes('diabolo') ||
              transcript.includes('deeablo') ||
              words.some((w: string) => ['diablo', 'deablo', 'diablo!'].includes(w));

            if (isDiabloDetected) {
              if (this.debounceTimer) return;
              this.debounceTimer = setTimeout(() => {
                this.debounceTimer = null;
              }, 1500);

              // Extract any following words as an immediate command (e.g. "Diablo open YouTube")
              let commandPart = '';
              const match = /(?:hey\s+|ok\s+|hi\s+)?diablo[\s,!:.]*(.*)/i.exec(rawTranscript);
              if (match && match[1] && match[1].trim()) {
                commandPart = match[1].trim();
              }

              console.log('[WakeWord] "Diablo" detected:', transcript, commandPart ? `(Command: "${commandPart}")` : '');
              if (this.onWakeWord) {
                this.onWakeWord('Diablo', transcript, commandPart);
              }
              break;
            }
          }
        };

        this.recognition.onerror = (e: any) => {
          if (e.error === 'not-allowed') {
            this.shouldRestart = false;
            this.isListening = false;
            console.warn('[WakeWord] Microphone access not allowed for background wake word listener.');
            if (this.onError) this.onError(e);
            return;
          }
          // 'no-speech' or 'aborted' are benign in background listening
          if (e.error !== 'no-speech' && e.error !== 'aborted') {
            console.warn('[WakeWord] Background listener error:', e.error);
            if (this.onError) this.onError(e);
          }
        };

        this.recognition.onend = () => {
          this.isListening = false;
          if (this.onStateChange) this.onStateChange(false);

          if (this.shouldRestart && !this.isCommandListening) {
            setTimeout(() => {
              if (this.shouldRestart && !this.isListening && !this.isCommandListening) {
                try {
                  this.recognition.start();
                  this.isListening = true;
                  if (this.onStateChange) this.onStateChange(true);
                } catch (e) {
                  // ignore
                }
              }
            }, 300);
          }
        };

        // 2. Active Command Recognizer (runs when Diablo is in LISTENING state)
        this.commandRecognition = new SpeechRec();
        this.commandRecognition.continuous = true;
        this.commandRecognition.interimResults = true;
        // hi-IN natively transcribes Hindi, Hinglish, and English with optimal Indian multilingual recognition
        this.commandRecognition.lang = 'hi-IN';

        let accumulatedTranscript = '';

        this.commandRecognition.onresult = (event: any) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const piece = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              accumulatedTranscript += ' ' + piece;
            } else {
              interim += piece;
            }
          }

          const currentFull = (accumulatedTranscript + ' ' + interim).trim();
          if (this.onInterimCommand && currentFull) {
            this.onInterimCommand(currentFull);
          }

          // Reset silence timer on any speech - reduced to 650ms for snappy voice turnaround
          if (this.silenceTimer) clearTimeout(this.silenceTimer);
          this.silenceTimer = setTimeout(() => {
            const finalCmd = (accumulatedTranscript + ' ' + interim).trim();
            if (finalCmd && this.isCommandListening) {
              console.log('[WakeWord] User speech ended, executing active command:', finalCmd);
              this.stopCommandListening();
              if (this.onFinalCommand) {
                this.onFinalCommand(finalCmd);
              }
            }
          }, 650);
        };

        this.commandRecognition.onerror = (e: any) => {
          if (e.error === 'not-allowed') {
            this.isCommandListening = false;
            console.warn('[WakeWord] Microphone access not allowed for command recognition.');
            return;
          }
          if (e.error !== 'no-speech' && e.error !== 'aborted') {
            console.warn('[WakeWord] Command recognition error:', e.error);
          }
        };

        this.commandRecognition.onend = () => {
          this.isCommandListening = false;
        };

      } catch (err) {
        console.warn('[WakeWord] SpeechRecognition not supported or initialization failed:', err);
        this.isSupported = false;
      }
    }
  }

  public getSupported(): boolean {
    return this.isSupported;
  }

  public start(): boolean {
    if (!this.isSupported || !this.recognition) return false;
    this.shouldRestart = true;
    if (this.isCommandListening) {
      this.stopCommandListening();
    }
    if (!this.isListening) {
      try {
        this.recognition.start();
        this.isListening = true;
        if (this.onStateChange) this.onStateChange(true);
        return true;
      } catch (e) {
        // ignore
      }
    }
    return false;
  }

  public pause(): void {
    this.shouldRestart = false;
    if (this.isListening && this.recognition) {
      try {
        this.recognition.abort();
      } catch (e) {
        // ignore
      }
      this.isListening = false;
      if (this.onStateChange) this.onStateChange(false);
    }
  }

  public stop(): void {
    this.pause();
    this.stopCommandListening();
  }

  public resume(): void {
    this.start();
  }

  /**
   * Starts active command listening when Diablo is awakened
   */
  public startCommandListening(): void {
    this.pause(); // pause wake-word listener
    if (!this.isSupported || !this.commandRecognition) return;

    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    try {
      this.isCommandListening = true;
      this.commandRecognition.start();
    } catch (e) {
      // already started or aborted
    }
  }

  /**
   * Stops active command listening
   */
  public stopCommandListening(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    this.isCommandListening = false;
    if (this.commandRecognition) {
      try {
        this.commandRecognition.abort();
      } catch (e) {
        // ignore
      }
    }
  }

  /**
   * Sets the active language for command recognition (e.g. Odia, Tamil, Japanese, English, Hindi)
   */
  public setLanguage(lang: string | null): void {
    if (!this.commandRecognition) return;
    if (!lang || lang === 'auto' || lang.toLowerCase() === 'hindi') {
      this.commandRecognition.lang = 'hi-IN';
      return;
    }

    const map: Record<string, string> = {
      odia: 'or-IN',
      oriya: 'or-IN',
      tamil: 'ta-IN',
      telugu: 'te-IN',
      bengali: 'bn-IN',
      bangla: 'bn-IN',
      marathi: 'mr-IN',
      punjabi: 'pa-IN',
      gujarati: 'gu-IN',
      kannada: 'kn-IN',
      malayalam: 'ml-IN',
      english: 'en-IN',
      japanese: 'ja-JP',
      korean: 'ko-KR',
      french: 'fr-FR',
      german: 'de-DE',
      spanish: 'es-ES',
      hindi: 'hi-IN',
    };

    const target = map[lang.toLowerCase().trim()] || 'hi-IN';
    this.commandRecognition.lang = target;
    console.log(`[WakeWord] Command recognition language updated to: ${lang} (${target})`);
  }
}
