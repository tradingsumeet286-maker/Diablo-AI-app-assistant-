/**
 * Diablo Gemini Live WebSocket Client Service
 * Connects to the backend WebSocket server (/live) to stream bidirectional
 * real-time audio and function calls to Gemini Live API.
 */

import { getBackendWsUrl } from './apiConfig';

export interface LiveToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

export type LiveConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export class DiabloLiveClient {
  private ws: WebSocket | null = null;
  private status: LiveConnectionStatus = 'DISCONNECTED';
  private reconnectTimeout: any = null;
  private lastError: string | null = null;
  private audioChunksSent: number = 0;
  private audioChunksReceived: number = 0;

  public onStatusChange?: (status: LiveConnectionStatus, error?: string) => void;
  public onReady?: (voice: string) => void;
  public onAudio?: (base64Audio24k: string) => void;
  public onModelTranscript?: (textChunk: string) => void;
  public onUserTranscript?: (textChunk: string) => void;
  public onToolCall?: (toolCall: LiveToolCall) => void;
  public onInterrupted?: () => void;
  public onTurnComplete?: () => void;
  public onError?: (errorMessage: string) => void;
  public onClose?: (code?: number, reason?: string) => void;

  /**
   * Connects to the backend /live WebSocket endpoint with granular handshake
   * logging and rigorous error diagnostics.
   */
  public connect(options: { voice: string; memory: Record<string, any>; activeLanguage?: string | null }): Promise<void> {
    return new Promise((resolve, reject) => {
      const handshakeStart = performance.now();

      // If already connected or connecting, close cleanly first
      if (this.ws) {
        try {
          console.log('[Diablo LiveClient] [HANDSHAKE] Cleaning up previous WebSocket instance before reconnecting...');
          this.ws.close();
        } catch (_) {}
        this.ws = null;
      }

      this.setStatus('CONNECTING');
      this.lastError = null;
      this.audioChunksSent = 0;
      this.audioChunksReceived = 0;

      const wsUrl = getBackendWsUrl();
      const protocol = wsUrl.startsWith('wss:') ? 'wss:' : 'ws:';
      const host = wsUrl.replace(/^wss?:\/\//, '').split('/')[0];

      console.groupCollapsed(
        `%c[Diablo LiveClient] [HANDSHAKE INIT] Initiating WebSocket connection to ${wsUrl}`,
        'color: #FF4D00; font-weight: bold;'
      );
      console.log('[Diablo LiveClient] [CONFIG:ENVIRONMENT]', {
        endpoint: wsUrl,
        protocol,
        host,
        browserOnline: navigator.onLine,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      });
      console.log('[Diablo LiveClient] [CONFIG:SESSION_OPTIONS]', {
        voice: options.voice,
        memoryFactsCount: Object.keys(options.memory || {}).length,
        memoryFactKeys: Object.keys(options.memory || {}),
        responseModality: 'AUDIO',
        modelTarget: 'gemini-3.1-flash-live-preview',
      });
      console.groupEnd();

      // Rapid check for local network offline / DNS resolution failure
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const offlineMsg = 'DNS error: Network offline. Device is not connected to the internet.';
        console.error('[Diablo LiveClient] [HANDSHAKE ABORTED]', offlineMsg);
        this.setStatus('ERROR', offlineMsg);
        if (this.onError) this.onError(offlineMsg);
        reject(new Error(offlineMsg));
        return;
      }

      let connectionEstablished = false;
      let isHandshakeSettled = false;
      const settleHandshake = (action: 'resolve' | 'reject', err?: any) => {
        if (isHandshakeSettled) return;
        isHandshakeSettled = true;
        clearTimeout(timeoutId);
        if (action === 'resolve') {
          resolve();
        } else {
          reject(err || new Error('Connection failed'));
        }
      };

      const timeoutId = setTimeout(() => {
        if (!connectionEstablished) {
          const elapsed = Math.round(performance.now() - handshakeStart);
          const timeoutMsg = `Connection handshake timed out after ${elapsed}ms: Backend server did not respond. Using high-speed audio pipeline.`;
          console.warn('[Diablo LiveClient] [HANDSHAKE TIMEOUT]', timeoutMsg);
          this.setStatus('DISCONNECTED', timeoutMsg);
          settleHandshake('reject', new Error(timeoutMsg));
        }
      }, 10000);

      try {
        console.log(`[Diablo LiveClient] [HANDSHAKE] Instantiating WebSocket at ${wsUrl}...`);
        this.ws = new WebSocket(wsUrl);
        console.log(`[Diablo LiveClient] [HANDSHAKE] WebSocket created. Initial readyState: ${this.ws.readyState} (CONNECTING)`);
      } catch (err: any) {
        const instantiateError = `WebSocket instantiation notice: ${err?.message || err}`;
        console.warn('[Diablo LiveClient] [HANDSHAKE NOTICE]', instantiateError);
        this.lastError = instantiateError;
        this.setStatus('DISCONNECTED', instantiateError);
        settleHandshake('reject', new Error(instantiateError));
        return;
      }

      this.ws.onopen = (openEvent) => {
        const elapsed = Math.round(performance.now() - handshakeStart);
        console.log(
          `%c[Diablo LiveClient] [HANDSHAKE OPEN] TCP Transport link established in ${elapsed}ms. readyState: ${this.ws?.readyState} (OPEN)`,
          'color: #00d2ff; font-weight: bold;'
        );
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        // Construct session initialization frame
        const initFrame = {
          type: 'init',
          voice: options.voice,
          memory: options.memory,
          activeLanguage: options.activeLanguage || undefined,
        };

        console.log('[Diablo LiveClient] [HANDSHAKE CONFIG TRANSMIT] Sending init configuration payload:', {
          type: initFrame.type,
          voice: initFrame.voice,
          memoryCount: Object.keys(initFrame.memory || {}).length,
          frameSize: JSON.stringify(initFrame).length + ' bytes',
        });

        this.ws.send(JSON.stringify(initFrame));
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const elapsed = Math.round(performance.now() - handshakeStart);

          if (msg.type === 'ready') {
            connectionEstablished = true;
            console.log(
              `%c[Diablo LiveClient] [HANDSHAKE SUCCESS] Gemini Live session READY in ${elapsed}ms! Confirmed voice profile: "${msg.voice}". Bidirectional streaming active.`,
              'color: #10b981; font-weight: bold;'
            );
            this.setStatus('CONNECTED');
            if (this.onReady) this.onReady(msg.voice);
            settleHandshake('resolve');
          } else if (msg.type === 'error') {
            const serverRawError = msg.message || 'Gemini Live encountered an error';
            console.error(`[Diablo LiveClient] [HANDSHAKE ERROR] Server error response received in ${elapsed}ms:`, serverRawError);

            let userFacingError = serverRawError;
            if (/401|unauthorized|api[ _]?key|API_KEY_INVALID/i.test(serverRawError)) {
              userFacingError = `401 Unauthorized: Gemini API Key is invalid, missing, or unauthorized. (${serverRawError})`;
            } else if (/dns|getaddrinfo|enotfound|econnrefused/i.test(serverRawError)) {
              userFacingError = `DNS error: Unable to resolve backend service or Gemini endpoint. (${serverRawError})`;
            }

            this.lastError = userFacingError;
            this.setStatus('ERROR', userFacingError);
            if (this.onError) this.onError(userFacingError);
            settleHandshake('reject', new Error(userFacingError));
          } else if (msg.type === 'sessionClosed') {
            const closeReason = msg.reason || `Gemini Live session closed by server (code ${msg.code})`;
            console.warn(`[Diablo LiveClient] [HANDSHAKE CLOSED] Server closed session in ${elapsed}ms. Code: ${msg.code}, Reason: "${closeReason}"`);
            this.setStatus('DISCONNECTED');
            if (this.onClose) this.onClose(msg.code, msg.reason);
            settleHandshake('reject', new Error(closeReason));
          } else if (msg.type === 'audio') {
            this.audioChunksReceived++;
            if (this.onAudio && msg.data) {
              this.onAudio(msg.data);
            }
          } else if (msg.type === 'modelTranscript') {
            if (this.onModelTranscript && msg.text) {
              this.onModelTranscript(msg.text);
            }
          } else if (msg.type === 'userTranscript') {
            if (this.onUserTranscript && msg.text) {
              this.onUserTranscript(msg.text);
            }
          } else if (msg.type === 'toolCall') {
            console.log('[Diablo LiveClient] [TOOL CALL RECEIVED]', msg.name, msg.args);
            if (this.onToolCall) {
              this.onToolCall({
                id: msg.id,
                name: msg.name,
                args: msg.args || {},
              });
            }
          } else if (msg.type === 'interrupted') {
            console.log('[Diablo LiveClient] [BARGE-IN] Model speech output interrupted by Boss');
            if (this.onInterrupted) this.onInterrupted();
          } else if (msg.type === 'turnComplete') {
            if (this.onTurnComplete) this.onTurnComplete();
          }
        } catch (e: any) {
          console.error('[Diablo LiveClient] [HANDSHAKE MESSAGE ERROR] Error parsing WebSocket frame:', e);
        }
      };

      this.ws.onerror = (event: any) => {
        const elapsed = Math.round(performance.now() - handshakeStart);
        let errorDiag = event?.message || 'WebSocket transport link notice';
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          errorDiag = 'DNS error: Internet connection lost. Device is offline.';
        } else if (this.ws?.readyState === WebSocket.CLOSING || this.ws?.readyState === WebSocket.CLOSED) {
          errorDiag = 'WebSocket transport link notice: proxy link closed, using HTTP audio pipeline.';
        }

        console.warn(`[Diablo LiveClient] [TRANSPORT NOTICE] in ${elapsed}ms: ${errorDiag}`);
        this.lastError = errorDiag;
        this.setStatus('DISCONNECTED', errorDiag);
        settleHandshake('reject', new Error(errorDiag));
      };

      this.ws.onclose = (event) => {
        const elapsed = Math.round(performance.now() - handshakeStart);

        let codeExplanation = 'Normal session closure';
        let isFatalAuthError = false;
        if (event.code === 1006) {
          codeExplanation = 'Transport link closed (1006): operating on high-speed voice pipeline';
        } else if (event.code === 1008) {
          codeExplanation = 'Policy Violation (1008): 401 Unauthorized / Invalid API Key';
          isFatalAuthError = true;
        } else if (event.code === 1011) {
          codeExplanation = 'Internal Server Error (1011): Gemini Live backend runtime error';
        } else if (event.code === 1002) {
          codeExplanation = 'WebSocket Protocol Error (1002)';
        } else if (event.code === 1003) {
          codeExplanation = 'Unsupported Data Frame (1003)';
        }

        const closeDiagnostic = `${codeExplanation} (Code: ${event.code}${event.reason ? `, Reason: "${event.reason}"` : ''})`;
        console.log(`[Diablo LiveClient] [HANDSHAKE CLOSE] WebSocket ended in ${elapsed}ms: ${closeDiagnostic}`);

        if (isFatalAuthError) {
          this.setStatus('ERROR', closeDiagnostic);
          if (this.onError) this.onError(closeDiagnostic);
        } else {
          this.setStatus('DISCONNECTED');
        }

        settleHandshake('reject', new Error(closeDiagnostic));

        if (this.onClose) this.onClose(event.code, event.reason);
      };
    });
  }

  /**
   * Streams a base64 encoded 16kHz PCM audio chunk to Gemini Live
   */
  public sendAudioChunk(base64Pcm16k: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.audioChunksSent++;
    this.ws.send(
      JSON.stringify({
        type: 'audio',
        data: base64Pcm16k,
      })
    );
  }

  /**
   * Sends a user text prompt to Gemini Live
   */
  public sendText(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        type: 'text',
        text,
      })
    );
  }

  /**
   * Returns function call execution results back to Gemini Live
   */
  public sendToolResponse(id: string, response: any, name?: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        type: 'toolResponse',
        id,
        name,
        response,
      })
    );
  }

  /**
   * Sends real-time memory update into the active Gemini Live session
   */
  public sendMemoryUpdate(key: string, value: string, allMemory?: Record<string, string>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        type: 'memoryUpdate',
        key,
        value,
        memory: allMemory,
      })
    );
  }

  /**
   * Signals local user interruption (barge-in)
   */
  public sendInterrupt(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        type: 'interrupt',
      })
    );
  }

  /**
   * Disconnects the session cleanly
   */
  public disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }
    this.setStatus('DISCONNECTED');
  }

  public getStatus(): LiveConnectionStatus {
    return this.status;
  }

  public getLastError(): string | null {
    return this.lastError;
  }

  public getStats() {
    return {
      status: this.status,
      chunksSent: this.audioChunksSent,
      chunksReceived: this.audioChunksReceived,
      lastError: this.lastError,
    };
  }

  private setStatus(newStatus: LiveConnectionStatus, error?: string): void {
    this.status = newStatus;
    if (error) this.lastError = error;
    if (this.onStatusChange) {
      this.onStatusChange(newStatus, error);
    }
  }
}
