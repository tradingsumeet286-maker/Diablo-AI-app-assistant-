import React, { useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Mic, MicOff, Volume2, Camera, AlertCircle, RefreshCw, Activity } from 'lucide-react';
import { AssistantState } from '../types';

interface Props {
  state: AssistantState;
  isWakeWordActive: boolean;
  micVolume: number;
  customAvatar: string | null;
  errorMessage?: string;
  onAvatarUpload: (file: File) => void;
  onAvatarReset: () => void;
  onCoreClick: () => void;
  visualizerData: Uint8Array;
}

export const DiabloReactorCore: React.FC<Props> = ({
  state,
  isWakeWordActive,
  micVolume,
  customAvatar,
  errorMessage,
  onAvatarUpload,
  onAvatarReset,
  onCoreClick,
  visualizerData,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Render circular audio visualizer ring around the core
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = 104; // Outer radius of the visualizer circle

      ctx.clearRect(0, 0, width, height);

      const bars = 36;
      const angleStep = (Math.PI * 2) / bars;

      for (let i = 0; i < bars; i++) {
        const dataIndex = Math.floor((i / bars) * visualizerData.length);
        const rawValue = visualizerData[dataIndex] || 0;
        let barHeight = (rawValue / 255) * 28;

        if (state === 'LISTENING') {
          barHeight = Math.max(3, barHeight + micVolume * 22);
        } else if (state === 'SPEAKING') {
          barHeight = Math.max(6, barHeight * 1.3);
        } else if (isWakeWordActive) {
          barHeight = 2 + Math.sin(Date.now() * 0.003 + i * 0.2) * 2;
        } else {
          barHeight = 1;
        }

        const angle = i * angleStep;
        const x1 = centerX + Math.cos(angle) * radius;
        const y1 = centerY + Math.sin(angle) * radius;
        const x2 = centerX + Math.cos(angle) * (radius + barHeight);
        const y2 = centerY + Math.sin(angle) * (radius + barHeight);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';

        if (state === 'SPEAKING') {
          ctx.strokeStyle = `rgba(255, 77, 0, ${0.45 + (barHeight / 30) * 0.55})`;
        } else if (state === 'LISTENING') {
          // Electric cyan pulse visualizer when listening to user
          ctx.strokeStyle = `rgba(0, 210, 255, ${0.45 + (barHeight / 30) * 0.55})`;
        } else if (state === 'ERROR') {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
        } else if (isWakeWordActive) {
          ctx.strokeStyle = 'rgba(255, 77, 0, 0.4)';
        } else {
          ctx.strokeStyle = 'rgba(60, 60, 60, 0.2)';
        }

        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [state, isWakeWordActive, micVolume, visualizerData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAvatarUpload(file);
    }
  };

  // Avatar resolution:
  // IDLE & SPEAKING: full pose with Diablo name
  // LISTENING: thinking pose (hand near chin)
  const idleSpeakingAvatar = customAvatar || '/assets/diablo_idle.jpg';
  const listeningAvatar = customAvatar || '/assets/diablo_listening.jpg';
  const currentAvatarSrc = state === 'LISTENING' ? listeningAvatar : idleSpeakingAvatar;

  // State text and styling
  const getStateInfo = () => {
    switch (state) {
      case 'SPEAKING':
        return {
          label: 'DIABLO SPEAKING',
          badgeColor: 'bg-[#FF4D00]/15 text-[#FF5A1F] border-[#FF4D00]/40',
          glow: 'shadow-[0_0_60px_rgba(255,77,0,0.65),0_0_20px_rgba(255,77,0,0.45)]',
          ringColor: 'border-[#FF4D00]/50',
          coreBorder: 'border-2 border-[#FF4D00]',
          icon: <Volume2 className="w-4 h-4 text-[#FF4D00] animate-pulse" />,
        };
      case 'LISTENING':
        return {
          label: 'LISTENING TO BOSS',
          // Cyan colored pulse when listening to contrast with orange speaking glow
          badgeColor: 'bg-[#00d2ff]/15 text-[#38e1ff] border-[#00d2ff]/40',
          glow: 'shadow-[0_0_60px_rgba(0,210,255,0.7),0_0_25px_rgba(0,210,255,0.45)]',
          ringColor: 'border-[#00d2ff]/50',
          coreBorder: 'border-2 border-[#00d2ff]',
          icon: <Mic className="w-4 h-4 text-[#00d2ff] animate-bounce" />,
        };
      case 'CONNECTING':
        return {
          label: 'STANDBY',
          badgeColor: 'bg-[#FF4D00]/10 text-[#a0a0a0] border-[#FF4D00]/20',
          glow: 'shadow-[0_0_30px_rgba(255,77,0,0.15)]',
          ringColor: 'border-[#FF4D00]/20',
          coreBorder: 'border-2 border-[#FF4D00]/30',
          icon: <Activity className="w-3.5 h-3.5 text-[#FF4D00] animate-pulse" />,
        };
      case 'ERROR':
        return {
          label: 'LINK ERROR',
          badgeColor: 'bg-red-500/20 text-red-300 border-red-500/40',
          glow: 'shadow-[0_0_40px_rgba(239,68,68,0.35)]',
          ringColor: 'border-red-500/40',
          coreBorder: 'border-2 border-red-500',
          icon: <AlertCircle className="w-4 h-4 text-red-400" />,
        };
      case 'IDLE':
      default:
        if (isWakeWordActive) {
          return {
            label: 'LISTENING FOR "DIABLO"',
            badgeColor: 'bg-[#0f0f0f] text-[#d0d0d0] border-[#292929]',
            glow: 'shadow-[0_0_30px_rgba(255,77,0,0.2)]',
            ringColor: 'border-[#FF4D00]/25',
            coreBorder: 'border-2 border-[#262626] hover:border-[#FF4D00]/60',
            icon: <Mic className="w-4 h-4 text-[#FF4D00]" />,
          };
        }
        return {
          label: 'STANDBY (TAP TO WAKE)',
          badgeColor: 'bg-[#0a0a0a] text-[#777777] border-[#1e1e1e]',
          glow: 'shadow-none',
          ringColor: 'border-[#262626]/20',
          coreBorder: 'border-2 border-[#1e1e1e]',
          icon: <MicOff className="w-4 h-4 text-[#666666]" />,
        };
    }
  };

  const stateInfo = getStateInfo();

  return (
    <div className="relative flex flex-col items-center justify-center select-none py-6">
      {/* Hidden file input for custom avatar upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Main Core Container */}
      <div className="relative flex items-center justify-center w-64 h-64">
        {/* Canvas Visualizer Frequency Ring */}
        <canvas
          ref={canvasRef}
          width={256}
          height={256}
          className="absolute inset-0 pointer-events-none z-10"
        />

        {/* Outer Rotating Segmented Tech Ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          className={`absolute inset-2 rounded-full border border-dashed transition-colors duration-300 pointer-events-none ${stateInfo.ringColor}`}
        />

        {/* Secondary Counter-rotating Tech Ring */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 45, repeat: Infinity, ease: 'linear' }}
          className={`absolute inset-6 rounded-full border border-dotted transition-colors duration-300 pointer-events-none ${stateInfo.ringColor}`}
        />

        {/* Central Clickable Core Sphere with Avatar Switching */}
        <button
          type="button"
          id="diablo-core-button"
          onClick={onCoreClick}
          aria-label="Diablo Core Assistant"
          className={`relative z-20 w-44 h-44 rounded-full overflow-hidden flex items-center justify-center transition-all duration-300 transform active:scale-95 focus:outline-none ${stateInfo.glow} ${stateInfo.coreBorder} bg-[#050505]`}
        >
          {/* Circular Diablo Avatar - switches between Idle/Speaking (Full pose) and Listening (Thinking pose) */}
          <div className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center">
            <motion.img
              key={state === 'LISTENING' ? 'avatar-listening' : 'avatar-idle-speaking'}
              src={currentAvatarSrc}
              alt={`Diablo ${state === 'LISTENING' ? 'Thinking Pose (Listening)' : 'Full Pose (Idle/Speaking)'}`}
              referrerPolicy="no-referrer"
              initial={{ opacity: 0.85, scale: 0.98 }}
              animate={{
                opacity: 1,
                scale: state === 'SPEAKING' ? [1, 1.04, 1] : 1,
              }}
              transition={{
                duration: state === 'SPEAKING' ? 1.2 : 0.25,
                repeat: state === 'SPEAKING' ? Infinity : 0,
                ease: 'easeInOut',
              }}
              className="w-full h-full object-cover rounded-full filter contrast-105"
              onError={(e) => {
                // Fallback to idle avatar if custom avatar or specific pose fails
                if (currentAvatarSrc !== '/assets/diablo_idle.jpg') {
                  (e.target as HTMLImageElement).src = '/assets/diablo_idle.jpg';
                }
              }}
            />

            {/* Circular state pulse / glow overlay */}
            <div
              className={`absolute inset-0 rounded-full pointer-events-none transition-all duration-300 ${
                state === 'SPEAKING'
                  ? 'bg-radial from-transparent via-[#FF4D00]/10 to-black/60 shadow-[inset_0_0_20px_rgba(255,77,0,0.5)]'
                  : state === 'LISTENING'
                  ? 'bg-radial from-transparent via-[#00d2ff]/10 to-black/60 shadow-[inset_0_0_20px_rgba(0,210,255,0.5)]'
                  : 'bg-radial from-transparent via-transparent to-black/60'
              }`}
            />

            {/* Diablo Brand Monogram in core */}
            <div className="absolute bottom-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[8px] font-mono tracking-[0.25em] text-white/90 uppercase border border-white/10">
              {state === 'LISTENING' ? 'LISTENING' : 'DIABLO'}
            </div>
          </div>

          {/* Interactive Core Ripple on Hover / Click */}
          <div className="absolute inset-0 rounded-full hover:bg-white/5 transition-colors" />
        </button>

        {/* Small Avatar Customization Button at top-right of core */}
        <div className="absolute top-1 right-2 z-30 flex space-x-1">
          <button
            type="button"
            id="upload-diablo-avatar"
            title="Upload custom avatar image for Diablo"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="p-1.5 rounded-full bg-[#0f0f0f] border border-[#292929] text-[#FF4D00] hover:text-white hover:bg-[#1a1a1a] transition-all shadow-md"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
          {customAvatar && (
            <button
              type="button"
              id="reset-diablo-avatar"
              title="Reset to default Diablo Character poses"
              onClick={(e) => {
                e.stopPropagation();
                onAvatarReset();
              }}
              className="p-1.5 rounded-full bg-[#0f0f0f] border border-[#292929] text-[#888888] hover:text-red-400 hover:bg-[#1a1a1a] transition-all shadow-md"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* State Status Pill */}
      <div className="mt-4 flex flex-col items-center max-w-md w-full px-2">
        <div
          className={`inline-flex items-center px-4 py-1.5 rounded-full border text-xs font-mono tracking-wider uppercase transition-all duration-300 ${stateInfo.badgeColor}`}
        >
          <span className="mr-2">{stateInfo.icon}</span>
          <span>{stateInfo.label}</span>
        </div>

        {/* Subtitle helper */}
        <div className="mt-2 text-[11px] text-[#888888] text-center font-mono w-full">
          {state === 'IDLE' && isWakeWordActive && (
            <p>Say <strong className="text-[#FF4D00]">"Diablo"</strong> or tap the core to speak</p>
          )}
          {state === 'LISTENING' && (
            <p className="text-[#FFA066]">Speak naturally in English, Hindi, or Hinglish</p>
          )}
          {state === 'SPEAKING' && (
            <p className="text-[#FF7733]">Speak anytime to interrupt Diablo instantly</p>
          )}
          {state === 'CONNECTING' && (
            <p>Say <strong className="text-[#FF4D00]">"Diablo"</strong> or tap the core to speak</p>
          )}
          {state === 'ERROR' && (
            <div className="mt-1 flex flex-col items-center space-y-1.5">
              <p className="text-red-400 font-mono text-[11px] px-3 py-1.5 bg-red-950/50 border border-red-800/60 rounded max-w-sm break-words">
                <strong>Reason:</strong> {errorMessage || 'Gemini Live WebSocket session disconnected'}
              </p>
              <button
                type="button"
                onClick={onCoreClick}
                className="inline-flex items-center text-[10px] text-red-300 hover:text-white uppercase tracking-wider underline hover:no-underline pt-0.5"
              >
                Tap to reconnect link
              </button>
            </div>
          )}
          {state === 'IDLE' && !isWakeWordActive && (
            <p>Wake word paused — tap core to activate</p>
          )}
        </div>
      </div>
    </div>
  );
};
