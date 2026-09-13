import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, PhoneCall, Check, X } from 'lucide-react';
import { PendingConfirmation } from '../types';

interface Props {
  confirmation: PendingConfirmation | null;
}

export const ActionConfirmationDialog: React.FC<Props> = ({ confirmation }) => {
  if (!confirmation) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md p-6 rounded-2xl bg-[#0a0a0a] border border-[#262626] text-[#e0e0e0] shadow-[0_0_40px_rgba(255,77,0,0.2)]"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#141414] border border-[#FF4D00]/40 flex items-center justify-center shrink-0">
              {confirmation.actionType === 'contact_choice' ? (
                <PhoneCall className="w-5 h-5 text-[#FF4D00]" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-[#FF4D00]" />
              )}
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#FF4D00]">
                Security Authorization Required
              </div>
              <h3 className="text-lg font-bold text-white leading-tight">
                {confirmation.title}
              </h3>
            </div>
          </div>

          <p className="text-xs text-[#a0a0a0] leading-relaxed mb-4">
            {confirmation.description}
          </p>

          {/* If there are specific options to choose from (e.g. contact choice) */}
          {confirmation.options && confirmation.options.length > 0 && (
            <div className="space-y-2 mb-6 max-h-48 overflow-y-auto pr-1">
              {confirmation.options.map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => confirmation.onConfirm(opt.value)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-[#0f0f0f] border border-[#1f1f1f] hover:border-[#FF4D00]/70 hover:bg-[#191919] text-left transition-all"
                >
                  <span className="text-xs font-medium text-white">{opt.label}</span>
                  <Check className="w-4 h-4 text-[#FF4D00] shrink-0 ml-2" />
                </button>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex space-x-3 mt-4">
            <button
              type="button"
              id="confirm-action-cancel"
              onClick={confirmation.onCancel}
              className="flex-1 py-2.5 px-4 rounded-xl border border-[#262626] bg-[#141414] hover:bg-[#1f1f1f] text-xs font-semibold text-[#888888] hover:text-white transition-colors flex items-center justify-center space-x-1"
            >
              <X className="w-4 h-4 mr-1" />
              <span>Decline</span>
            </button>

            {!confirmation.options && (
              <button
                type="button"
                id="confirm-action-proceed"
                onClick={() => confirmation.onConfirm()}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#FF4D00] hover:bg-[#ff6622] text-black font-bold text-xs transition-colors flex items-center justify-center space-x-1 shadow-[0_0_20px_rgba(255,77,0,0.35)]"
              >
                <Check className="w-4 h-4 mr-1" />
                <span>Confirm & Proceed</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
