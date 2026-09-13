/**
 * Screen Awareness Service
 * Allows Diablo to understand the current screen context with explicit, visible user permission
 */

export class ScreenAwarenessService {
  private mediaStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private isActive: boolean = false;
  public onStateChange?: (active: boolean) => void;

  public isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getDisplayMedia === 'function'
    );
  }

  public getIsActive(): boolean {
    return this.isActive;
  }

  public async start(): Promise<boolean> {
    if (!this.isSupported()) {
      throw new Error('Screen capture is not supported on this browser or platform');
    }

    try {
      // Explicit prompt for user permission
      this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
        },
        audio: false,
      });

      // Handle user stopping screen share from browser banner
      const track = this.mediaStream.getVideoTracks()[0];
      if (track) {
        track.onended = () => {
          this.stop();
        };
      }

      // Initialize hidden video element for snapshotting frames
      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.mediaStream;
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;
      await this.videoElement.play();

      this.canvasElement = document.createElement('canvas');
      this.isActive = true;
      if (this.onStateChange) this.onStateChange(true);
      return true;
    } catch (err: any) {
      console.warn('[ScreenAwareness] Permission denied or cancelled:', err);
      this.stop();
      return false;
    }
  }

  public captureFrame(): string | null {
    if (!this.isActive || !this.videoElement || !this.canvasElement) {
      return null;
    }

    const video = this.videoElement;
    const canvas = this.canvasElement;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    // Scale down frame for fast low-latency AI processing
    const maxDim = 720;
    let width = video.videoWidth;
    let height = video.videoHeight;
    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.8);
  }

  public stop(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
    this.canvasElement = null;
    this.isActive = false;
    if (this.onStateChange) this.onStateChange(false);
  }
}

export const screenAwareness = new ScreenAwarenessService();
