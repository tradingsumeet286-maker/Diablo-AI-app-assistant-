import React from 'react';
import { Globe, Check, X, RotateCcw } from 'lucide-react';

export interface LanguageOption {
  id: string;
  name: string;
  nativeName: string;
  category: 'Indian' | 'International';
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  // Default
  { id: 'hindi', name: 'Hindi', nativeName: 'हिंदी', category: 'Indian' },
  // Indian Regional
  { id: 'odia', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', category: 'Indian' },
  { id: 'tamil', name: 'Tamil', nativeName: 'தமிழ்', category: 'Indian' },
  { id: 'telugu', name: 'Telugu', nativeName: 'తెలుగు', category: 'Indian' },
  { id: 'bengali', name: 'Bengali', nativeName: 'বাংলা', category: 'Indian' },
  { id: 'marathi', name: 'Marathi', nativeName: 'मराठी', category: 'Indian' },
  { id: 'punjabi', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', category: 'Indian' },
  { id: 'gujarati', name: 'Gujarati', nativeName: 'ગુજરાતી', category: 'Indian' },
  { id: 'kannada', name: 'Kannada', nativeName: 'ಕನ್ನಡ', category: 'Indian' },
  { id: 'malayalam', name: 'Malayalam', nativeName: 'മലയാളം', category: 'Indian' },
  // International
  { id: 'english', name: 'English', nativeName: 'English', category: 'International' },
  { id: 'japanese', name: 'Japanese', nativeName: '日本語', category: 'International' },
  { id: 'korean', name: 'Korean', nativeName: '한국어', category: 'International' },
  { id: 'french', name: 'French', nativeName: 'Français', category: 'International' },
  { id: 'german', name: 'German', nativeName: 'Deutsch', category: 'International' },
  { id: 'spanish', name: 'Spanish', nativeName: 'Español', category: 'International' },
];

interface LanguageSelectorModalProps {
  isOpen: boolean;
  activeLanguage: string | null;
  onSelectLanguage: (lang: string | null) => void;
  onClose: () => void;
}

export const LanguageSelectorModal: React.FC<LanguageSelectorModalProps> = ({
  isOpen,
  activeLanguage,
  onSelectLanguage,
  onClose,
}) => {
  if (!isOpen) return null;

  const currentKey = (activeLanguage || 'hindi').toLowerCase();

  return (
    <div
      id="modal-language-selector"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg rounded-2xl border border-zinc-700/60 bg-zinc-950 p-6 shadow-2xl text-zinc-100">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-wide">
                Diablo Language Protocol
              </h2>
              <p className="text-xs text-zinc-400">
                Default: Hindi / English / Hinglish. On-demand: any language.
              </p>
            </div>
          </div>
          <button
            id="btn-close-lang-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Quick reset to default */}
          <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-zinc-200">Default Protocol</span>
              <p className="text-[11px] text-zinc-400">
                Hindi (default), switches to English or Hinglish automatically based on your speech.
              </p>
            </div>
            <button
              id="btn-reset-default-language"
              onClick={() => {
                onSelectLanguage(null);
                onClose();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors ${
                !activeLanguage
                  ? 'bg-orange-500 text-black font-semibold'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{!activeLanguage ? 'Active (Default)' : 'Reset to Hindi'}</span>
            </button>
          </div>

          {/* Indian Regional Languages */}
          <div>
            <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-2">
              Indian Regional Languages (On-Demand)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SUPPORTED_LANGUAGES.filter((l) => l.category === 'Indian' && l.id !== 'hindi').map((lang) => {
                const isSelected = currentKey === lang.id;
                return (
                  <button
                    key={lang.id}
                    id={`btn-lang-${lang.id}`}
                    onClick={() => {
                      onSelectLanguage(lang.name);
                      onClose();
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-orange-500/20 border-orange-500 text-orange-300 shadow-md shadow-orange-950/40'
                        : 'bg-zinc-900/50 border-zinc-800/80 hover:bg-zinc-800/60 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold">{lang.name}</div>
                      <div className="text-[10px] text-zinc-400">{lang.nativeName}</div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-orange-400 shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* International Languages */}
          <div>
            <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-2">
              International Languages (On-Demand)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SUPPORTED_LANGUAGES.filter((l) => l.category === 'International').map((lang) => {
                const isSelected = currentKey === lang.id;
                return (
                  <button
                    key={lang.id}
                    id={`btn-lang-${lang.id}`}
                    onClick={() => {
                      onSelectLanguage(lang.name);
                      onClose();
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-orange-500/20 border-orange-500 text-orange-300 shadow-md shadow-orange-950/40'
                        : 'bg-zinc-900/50 border-zinc-800/80 hover:bg-zinc-800/60 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold">{lang.name}</div>
                      <div className="text-[10px] text-zinc-400">{lang.nativeName}</div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-orange-400 shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-zinc-800/80 text-[11px] text-zinc-400 flex items-center justify-between">
          <span>Voice command tip: Say "Odia mein baat karo" or "Japanese mein bolo" anytime.</span>
        </div>
      </div>
    </div>
  );
};
