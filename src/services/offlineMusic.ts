/**
 * Offline Music Service
 * Manages device local/offline music library and offline audio playback
 */
import { OfflineSong } from '../types';

export const DEFAULT_OFFLINE_SONGS: OfflineSong[] = [
  {
    id: 'off-1',
    title: 'Iron Man Theme - Back in Black',
    artist: 'AC/DC (Instrumental)',
    genre: 'Rock / Classic',
    duration: '3:45',
  },
  {
    id: 'off-2',
    title: 'Diablo Dark Synth Wave',
    artist: 'Jarvis Protocol',
    genre: 'Synthwave',
    duration: '2:50',
  },
  {
    id: 'off-3',
    title: 'KGF Action Theme',
    artist: 'Ravi Basrur',
    genre: 'Cinematic Action',
    duration: '3:12',
  },
  {
    id: 'off-4',
    title: 'Believer Acoustic',
    artist: 'Imagine Dragons',
    genre: 'Alternative',
    duration: '3:24',
  },
  {
    id: 'off-5',
    title: 'Kesariya Offline Unplugged',
    artist: 'Arijit Singh',
    genre: 'Bollywood Melodic',
    duration: '4:28',
  },
];

class OfflineMusicService {
  private songs: OfflineSong[] = [...DEFAULT_OFFLINE_SONGS];
  private currentPlayingSong: OfflineSong | null = null;
  private isPlaying: boolean = false;
  private audioContext: AudioContext | null = null;
  private synthInterval: any = null;
  public onStateChange?: (song: OfflineSong | null, isPlaying: boolean) => void;

  constructor() {
    this.loadCustomSongs();
  }

  private loadCustomSongs() {
    try {
      const stored = localStorage.getItem('diablo_offline_custom_songs');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.songs = [...DEFAULT_OFFLINE_SONGS, ...parsed];
        }
      }
    } catch {
      // Ignored
    }
  }

  public getSongs(): OfflineSong[] {
    return this.songs;
  }

  public getCurrentSong(): OfflineSong | null {
    return this.currentPlayingSong;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public searchSong(query: string): OfflineSong | null {
    if (!query || !query.trim()) return null;
    const clean = query.toLowerCase().trim();

    // Exact or contains match on title or artist
    const found = this.songs.find(
      (s) =>
        s.title.toLowerCase().includes(clean) ||
        clean.includes(s.title.toLowerCase()) ||
        s.artist.toLowerCase().includes(clean)
    );

    if (found) return found;

    // Word token overlap match
    const tokens = clean.split(/\s+/).filter((t) => t.length > 2);
    if (tokens.length > 0) {
      for (const song of this.songs) {
        const target = (song.title + ' ' + song.artist + ' ' + song.genre).toLowerCase();
        const matches = tokens.filter((t) => target.includes(t));
        if (matches.length >= Math.ceil(tokens.length / 2)) {
          return song;
        }
      }
    }

    return null;
  }

  public playSong(song: OfflineSong) {
    this.stopPlayback();
    this.currentPlayingSong = song;
    this.isPlaying = true;
    this.startSynthMelody(song);

    if (this.onStateChange) {
      this.onStateChange(this.currentPlayingSong, true);
    }
  }

  public stopPlayback() {
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.suspend();
      } catch {
        // Ignored
      }
    }
    this.isPlaying = false;
    this.currentPlayingSong = null;

    if (this.onStateChange) {
      this.onStateChange(null, false);
    }
  }

  public pausePlayback() {
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
    if (this.audioContext && this.audioContext.state === 'running') {
      this.audioContext.suspend();
    }
    this.isPlaying = false;
    if (this.onStateChange) {
      this.onStateChange(this.currentPlayingSong, false);
    }
  }

  /**
   * Generates a pleasant melodic synth loop using Web Audio so true audio plays without internet
   */
  private startSynthMelody(song: OfflineSong) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new AudioCtx();
      }
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      // Notes frequencies (C4, D4, E4, G4, A4, B4, C5)
      const pentatonic = [261.63, 293.66, 329.63, 392.0, 440.0, 493.88, 523.25, 587.33];
      const rockRiff = [110.0, 130.81, 146.83, 164.81, 196.0, 220.0];
      const scale = song.genre.includes('Rock') || song.genre.includes('Action') ? rockRiff : pentatonic;

      let step = 0;
      this.synthInterval = setInterval(() => {
        if (!this.audioContext || this.audioContext.state !== 'running') return;
        const now = this.audioContext.currentTime;

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        // Synth note selection
        const freq = scale[step % scale.length];
        osc.type = song.genre.includes('Synth') ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.08, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        osc.start(now);
        osc.stop(now + 0.5);

        step++;
      }, 350);
    } catch (e) {
      console.warn('[OfflineMusic] Audio play warning:', e);
    }
  }
}

export const offlineMusic = new OfflineMusicService();
