import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, Shield, Check, Sparkles } from 'lucide-react';
import { VoiceGender } from '../types';

interface Props {
  isOpen: boolean;
  onSelectVoice: (gender: VoiceGender) => void;
  onPlaySampleTone: () => void;
}

export const VoiceSelectionModal: React.FC<Props> = ({
  isOpen,
  onSelectVoice,
  onPlaySampleTone,
}) => {
  const [selected, setSelected] = useState<VoiceGender>('Male');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative w-full max-w-md p-6 overflow-hidden rounded-2xl bg-[#0a0a0a] border border-[#262626] shadow-[0_0_50px_rgba(255,77,0,0.15)] text-[#e0e0e0]"
        >
          {/* Subtle Arc Reactor Background Accent */}
          <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-[#FF4D00]/10 blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 w-48 h-48 rounded-full bg-[#FF3300]/5 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-14 h-14 mb-4 rounded-full bg-[#141414] border border-[#FF4D00]/40 flex items-center justify-center shadow-[0_0_20px_rgba(255,77,0,0.3)]">
              <Shield className="w-7 h-7 text-[#FF4D00]" />
            </div>

            <div className="text-xs uppercase tracking-[0.25em] text-[#FF4D00] font-mono font-semibold mb-1">
              Initialization Protocol
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
              Choose Diablo's Voice
            </h2>
            <p className="text-sm text-[#888888] max-w-xs mb-6">
              Select your preferred vocal synthesis profile. Your choice persists across sessions.
            </p>

            <div className="grid grid-cols-2 gap-3 w-full mb-6">
              {/* Male Profile */}
              <button
                type="button"
                id="voice-select-male"
                onClick={() => setSelected('Male')}
                className={`relative flex flex-col items-start p-4 rounded-xl border text-left transition-all duration-200 ${
                  selected === 'Male'
                    ? 'border-[#FF4D00] bg-[#141414] shadow-[0_0_20px_rgba(255,77,0,0.25)]'
                    : 'border-[#1f1f1f] bg-[#0d0d0d] hover:border-[#333333]'
                }`}
              >
                {selected === 'Male' && (
                  <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[#FF4D00] flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                  </span>
                )}
                <span className="text-xs font-mono uppercase text-[#FF4D00]/80 mb-1">
                  Profile A
                </span>
                <span className="text-lg font-bold text-white mb-1">Male</span>
                <span className="text-xs text-[#a0a0a0] leading-relaxed mb-2">
                  Deep, calm, Jarvis-style resonance (Fenrir)
                </span>
                <div className="mt-auto inline-flex items-center text-[10px] text-[#FF4D00] font-mono tracking-wider uppercase">
                  <Sparkles className="w-3 h-3 mr-1" /> Jarvis Tone
                </div>
              </button>

              {/* Female Profile */}
              <button
                type="button"
                id="voice-select-female"
                onClick={() => setSelected('Female')}
                className={`relative flex flex-col items-start p-4 rounded-xl border text-left transition-all duration-200 ${
                  selected === 'Female'
                    ? 'border-[#ff7733] bg-[#141414] shadow-[0_0_20px_rgba(255,119,51,0.25)]'
                    : 'border-[#1f1f1f] bg-[#0d0d0d] hover:border-[#333333]'
                }`}
              >
                {selected === 'Female' && (
                  <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[#ff7733] flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                  </span>
                )}
                <span className="text-xs font-mono uppercase text-[#ff7733]/80 mb-1">
                  Profile B
                </span>
                <span className="text-lg font-bold text-white mb-1">Female</span>
                <span className="text-xs text-[#a0a0a0] leading-relaxed mb-2">
                  Warm, clear, tactical clarity (Kore)
                </span>
                <div className="mt-auto inline-flex items-center text-[10px] text-[#ff7733] font-mono tracking-wider uppercase">
                  <Sparkles className="w-3 h-3 mr-1" /> Warm Clarity
                </div>
              </button>
            </div>

            {/* Test Acoustic Chime */}
            <div className="w-full flex items-center justify-between p-3 rounded-lg bg-[#0f0f0f] border border-[#1f1f1f] mb-6">
              <div className="flex items-center text-xs text-[#b0b0b0]">
                <Volume2 className="w-4 h-4 text-[#FF4D00] mr-2 shrink-0" />
                <span>Test Audio Pipeline (440Hz)</span>
              </div>
              <button
                type="button"
                id="test-speaker-onboarding"
                onClick={onPlaySampleTone}
                className="px-3 py-1.5 text-xs font-semibold rounded-md bg-[#141414] hover:bg-[#1f1f1f] text-[#FF4D00] border border-[#262626] transition-colors"
              >
                Play Tone
              </button>
            </div>

            {/* Confirmation CTA */}
            <button
              type="button"
              id="confirm-voice-choice"
              onClick={() => onSelectVoice(selected)}
              className="w-full py-3.5 px-6 rounded-xl font-bold text-sm tracking-wide uppercase bg-[#FF4D00] hover:bg-[#ff6622] text-black transition-all shadow-[0_0_25px_rgba(255,77,0,0.4)]"
            >
              Initialize Diablo Protocol
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
