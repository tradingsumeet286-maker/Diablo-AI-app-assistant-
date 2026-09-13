import React, { useState } from 'react';
import { MessageSquare, ExternalLink, Copy, Check, X, ShieldAlert, Sparkles } from 'lucide-react';
import { PreparedMessageInfo } from '../types';

interface PreparedMessageCardProps {
  info: PreparedMessageInfo;
  onDismiss: () => void;
}

export const PreparedMessageCard: React.FC<PreparedMessageCardProps> = ({ info, onDismiss }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(info.translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenApp = () => {
    if (info.composeUrl) {
      window.open(info.composeUrl, '_blank', 'noopener,noreferrer');
    } else {
      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(info.translatedText)}`;
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      id="prepared-message-card"
      className="w-full max-w-2xl mx-auto my-3 p-4 rounded-xl border border-emerald-500/40 bg-zinc-950/90 shadow-2xl backdrop-blur-md text-zinc-200 animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold tracking-wide text-emerald-400 uppercase">
                {info.appName} Message Prepared
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                COMPOSE READY
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 flex items-center space-x-1">
              <ShieldAlert className="w-3 h-3 text-amber-400 inline" />
              <span>Tier 2 Safeguard: Pre-filled in compose box. Tap Send in {info.appName} to deliver.</span>
            </div>
          </div>
        </div>
        <button
          id="btn-dismiss-prepared-message"
          onClick={onDismiss}
          className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
          title="Dismiss card"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 space-y-2.5 text-xs">
        {/* Original spoken input */}
        <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-1">
            <span>SPOKEN INPUT ({info.sourceLanguage.toUpperCase()})</span>
            <span className="text-[10px] text-zinc-500">VOICE CAPTURED</span>
          </div>
          <p className="text-zinc-300 italic text-sm leading-relaxed font-sans">
            "{info.spokenText}"
          </p>
        </div>

        {/* Casual Chat Translation */}
        <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30">
          <div className="flex items-center justify-between text-[11px] font-mono text-emerald-400 mb-1">
            <span className="flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>CASUAL {info.targetLanguage.toUpperCase()} (PRE-FILLED IN {info.appName.toUpperCase()})</span>
            </span>
            <span className="text-[10px] text-emerald-500/80">NATURAL CHAT STYLE</span>
          </div>
          <p className="text-white font-medium text-sm leading-relaxed font-sans select-all">
            {info.translatedText}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-3 flex items-center justify-end space-x-2 pt-2 border-t border-zinc-800/80">
        <button
          id="btn-copy-translated-message"
          onClick={handleCopy}
          className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center space-x-1.5 transition-colors border border-zinc-700"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy Text'}</span>
        </button>
        <button
          id="btn-open-whatsapp-prepared"
          onClick={handleOpenApp}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm shadow-emerald-900/50"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Open {info.appName} Compose</span>
        </button>
      </div>
    </div>
  );
};
