import React, { useState } from 'react';
import {
  Brain,
  Phone,
  Settings,
  Terminal,
  Volume2,
  Plus,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Radio,
  Cpu,
  AlertCircle,
  Flashlight,
  Camera,
  Music,
  Plane,
  Bluetooth,
  Wifi,
  ShoppingBag,
} from 'lucide-react';
import { Contact, DeviceActionLog, UserFact, VoiceGender } from '../types';

interface Props {
  currentVoice: VoiceGender;
  onVoiceChange: (voice: VoiceGender) => void;
  isWakeWordEnabled: boolean;
  onToggleWakeWord: (enabled: boolean) => void;
  onTestSpeaker: () => void;
  facts: UserFact[];
  onAddFact: (key: string, value: string) => void;
  onDeleteFact: (id: string) => void;
  contacts: Contact[];
  onAddContact: (name: string, phone: string, relationship?: string) => void;
  onDeleteContact: (id: string) => void;
  actionLogs: DeviceActionLog[];
  lastUserTranscript: string;
  lastModelTranscript: string;
  linkErrorMessage?: string | null;
  liveStatus?: string;
  currentUser?: { email?: string | null; displayName?: string | null; uid?: string } | null;
  onGoogleSignIn?: () => void;
  onExecuteTool?: (toolName: string, args?: any) => void;
}

type TabType = 'status' | 'memory' | 'contacts' | 'actions' | 'android';

export const HUDConsole: React.FC<Props> = ({
  currentVoice,
  onVoiceChange,
  isWakeWordEnabled,
  onToggleWakeWord,
  onTestSpeaker,
  facts,
  onAddFact,
  onDeleteFact,
  contacts,
  onAddContact,
  onDeleteContact,
  actionLogs,
  lastUserTranscript,
  lastModelTranscript,
  linkErrorMessage,
  liveStatus = 'DISCONNECTED',
  currentUser,
  onGoogleSignIn,
  onExecuteTool,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('status');

  // New fact form
  const [newFactKey, setNewFactKey] = useState('');
  const [newFactVal, setNewFactVal] = useState('');

  // New contact form
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRel, setNewContactRel] = useState('');

  const handleAddFactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFactKey.trim() || !newFactVal.trim()) return;
    onAddFact(newFactKey, newFactVal);
    setNewFactKey('');
    setNewFactVal('');
  };

  const handleAddContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactPhone.trim()) return;
    onAddContact(newContactName, newContactPhone, newContactRel);
    setNewContactName('');
    setNewContactPhone('');
    setNewContactRel('');
  };

  return (
    <div className="w-full max-w-xl mx-auto mt-4 px-4">
      {/* Collapsible HUD Toggle Bar */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-[#0a0a0a] border border-[#222222] shadow-xl text-[#e0e0e0]">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-xs font-mono text-[#FF4D00] font-semibold uppercase tracking-wider">
            <Cpu className="w-4 h-4" />
            <span>JARVIS HUD CONSOLE</span>
          </div>

          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#141414] text-[#FF4D00] border border-[#FF4D00]/30">
            Voice: {currentVoice}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            id="test-speaker-quick"
            onClick={onTestSpeaker}
            title="Play 440Hz diagnostic tone"
            className="px-2.5 py-1 text-[11px] font-mono rounded bg-[#141414] hover:bg-[#1f1f1f] text-[#FF661F] border border-[#262626] transition-colors flex items-center space-x-1"
          >
            <Volume2 className="w-3.5 h-3.5 mr-1" />
            <span>440Hz Test</span>
          </button>

          <button
            type="button"
            id="toggle-hud-drawer"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1.5 rounded-lg bg-[#141414] hover:bg-[#1f1f1f] text-[#888888] hover:text-white transition-colors"
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Console Panel */}
      {isOpen && (
        <div className="mt-2 p-4 rounded-2xl bg-[#080808] border border-[#242424] text-[#e0e0e0] shadow-2xl backdrop-blur-md">
          {/* Navigation Tabs */}
          <div className="flex space-x-1 border-b border-[#1f1f1f] pb-2 mb-4 overflow-x-auto text-xs font-mono">
            <button
              type="button"
              id="tab-status"
              onClick={() => setActiveTab('status')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 ${
                activeTab === 'status'
                  ? 'bg-[#FF4D00]/15 text-[#FF5A1F] border border-[#FF4D00]/30'
                  : 'text-[#888888] hover:text-[#e0e0e0] hover:bg-[#121212]'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Live Feed</span>
            </button>

            <button
              type="button"
              id="tab-memory"
              onClick={() => setActiveTab('memory')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 ${
                activeTab === 'memory'
                  ? 'bg-[#FF4D00]/15 text-[#FF5A1F] border border-[#FF4D00]/30'
                  : 'text-[#888888] hover:text-[#e0e0e0] hover:bg-[#121212]'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>Memory ({facts.length})</span>
            </button>

            <button
              type="button"
              id="tab-contacts"
              onClick={() => setActiveTab('contacts')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 ${
                activeTab === 'contacts'
                  ? 'bg-[#FF4D00]/15 text-[#FF5A1F] border border-[#FF4D00]/30'
                  : 'text-[#888888] hover:text-[#e0e0e0] hover:bg-[#121212]'
              }`}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Contacts ({contacts.length})</span>
            </button>

            <button
              type="button"
              id="tab-actions"
              onClick={() => setActiveTab('actions')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 ${
                activeTab === 'actions'
                  ? 'bg-[#FF4D00]/15 text-[#FF5A1F] border border-[#FF4D00]/30'
                  : 'text-[#888888] hover:text-[#e0e0e0] hover:bg-[#121212]'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Actions ({actionLogs.length})</span>
            </button>

            <button
              type="button"
              id="tab-android"
              onClick={() => setActiveTab('android')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 ${
                activeTab === 'android'
                  ? 'bg-[#FF4D00]/15 text-[#FF5A1F] border border-[#FF4D00]/30'
                  : 'text-[#888888] hover:text-[#e0e0e0] hover:bg-[#121212]'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Android Bridge</span>
            </button>
          </div>

          {/* TAB 1: LIVE FEED & QUICK CONTROLS */}
          {activeTab === 'status' && (
            <div className="space-y-4">
              {/* Voice & Wake word toggles */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#0f0f0f] border border-[#1f1f1f]">
                  <div className="text-[10px] font-mono uppercase text-[#888888] mb-1">
                    Wake Word Engine ("Diablo")
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs font-semibold text-[#e0e0e0]">
                      {isWakeWordEnabled ? 'Active (Listening)' : 'Paused'}
                    </span>
                    <button
                      type="button"
                      id="toggle-wake-word-switch"
                      onClick={() => onToggleWakeWord(!isWakeWordEnabled)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isWakeWordEnabled ? 'bg-[#FF4D00]' : 'bg-[#2a2a2a]'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          isWakeWordEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0f0f0f] border border-[#1f1f1f]">
                  <div className="text-[10px] font-mono uppercase text-[#888888] mb-1">
                    Voice Model Profile
                  </div>
                  <div className="flex items-center space-x-1 mt-1">
                    <button
                      type="button"
                      onClick={() => onVoiceChange('Male')}
                      className={`flex-1 py-1 text-xs rounded font-medium transition-colors ${
                        currentVoice === 'Male'
                          ? 'bg-[#FF4D00]/20 text-[#FF4D00] border border-[#FF4D00]/40'
                          : 'bg-[#141414] text-[#777777] hover:text-[#d0d0d0]'
                      }`}
                    >
                      Male (Fenrir)
                    </button>
                    <button
                      type="button"
                      onClick={() => onVoiceChange('Female')}
                      className={`flex-1 py-1 text-xs rounded font-medium transition-colors ${
                        currentVoice === 'Female'
                          ? 'bg-[#ff7733]/20 text-[#ff7733] border border-[#ff7733]/40'
                          : 'bg-[#141414] text-[#777777] hover:text-[#d0d0d0]'
                      }`}
                    >
                      Female (Kore)
                    </button>
                  </div>
                </div>
              </div>

              {/* Gemini Live Telemetry & Error Diagnostic */}
              <div className="p-3 rounded-xl bg-[#0d0d0d] border border-[#1f1f1f] space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-[#888888]">Gemini Live Audio Link:</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      liveStatus === 'CONNECTED'
                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                        : liveStatus === 'CONNECTING'
                        ? 'bg-amber-950/60 text-amber-300 border border-amber-800/50'
                        : liveStatus === 'ERROR'
                        ? 'bg-red-950/60 text-red-400 border border-red-800/50'
                        : 'bg-[#1a1a1a] text-[#777777] border border-[#333]'
                    }`}
                  >
                    {liveStatus}
                  </span>
                </div>

                {linkErrorMessage && (
                  <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 font-mono text-[11px] space-y-1">
                    <div className="flex items-center space-x-1.5 font-bold text-red-200">
                      <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span>DIAGNOSTIC ERROR LOG</span>
                    </div>
                    <p className="break-all text-[10px] leading-relaxed text-red-300/90">{linkErrorMessage}</p>
                  </div>
                )}
              </div>

              {/* Latest Real-Time Transcripts */}
              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-[#0d0d0d] border border-[#1f1f1f]">
                  <div className="text-[10px] font-mono uppercase text-[#888888] mb-1 flex items-center justify-between">
                    <span>Boss Input Transcript:</span>
                    <span className="text-[#555555]">Live Mic Stream</span>
                  </div>
                  <p className="text-xs text-[#d5d5d5] italic font-mono min-h-[1.5rem]">
                    {lastUserTranscript || 'Say "Diablo" or speak to begin...'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#0d0d0d] border border-[#1f1f1f]">
                  <div className="text-[10px] font-mono uppercase text-[#FF4D00] mb-1 flex items-center justify-between">
                    <span>Diablo Synthesis:</span>
                    <span className="text-[#555555]">24kHz PCM Audio</span>
                  </div>
                  <p className="text-xs text-[#FF661F] font-mono min-h-[1.5rem]">
                    {lastModelTranscript || 'Awaiting vocal directive from Boss.'}
                  </p>
                </div>
              </div>

              {/* Interruption Hint */}
              <div className="p-2.5 rounded-lg bg-[#0f0f0f] border border-[#262626] text-[11px] text-[#b0b0b0] flex items-center space-x-2 font-mono">
                <span className="w-2 h-2 rounded-full bg-[#FF4D00] animate-pulse shrink-0" />
                <span>
                  <strong>Barge-in Active:</strong> Speak at any moment while Diablo is talking to immediately halt output audio and switch to listening.
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: PERSISTENT MEMORY */}
          {activeTab === 'memory' && (
            <div className="space-y-4">
              {currentUser ? (
                <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 flex items-center justify-between text-[11px] font-mono">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>
                      <strong>PRIVATE CLOUD MEMORY ACTIVE</strong>: {currentUser.email || currentUser.displayName}
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-400/80 px-1.5 py-0.5 rounded bg-emerald-900/40">
                    Isolated per-user
                  </span>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-[#FF4D00]/10 border border-[#FF4D00]/30 text-[#e0e0e0] flex items-center justify-between text-[11px] font-mono">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-[#a0a0a0]">
                      Guest Mode: Memory is stored locally. Sign in to isolate and save to Cloud Firestore.
                    </span>
                  </div>
                  {onGoogleSignIn && (
                    <button
                      type="button"
                      id="hud-guest-signin-btn"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onGoogleSignIn();
                      }}
                      className="px-2.5 py-1 rounded bg-[#FF4D00] hover:bg-[#ff6622] text-black text-[10px] font-bold shrink-0 ml-2 transition-colors shadow-[0_0_8px_rgba(255,77,0,0.3)]"
                      title="Sign in with Google to switch to Cloud Firestore memory"
                    >
                      Sign In
                    </button>
                  )}
                </div>
              )}

              <p className="text-xs text-[#888888]">
                Facts Diablo remembers about Boss. Injected into every Gemini Live session so Diablo recalls your preferences, vehicle, and details naturally.
              </p>

              {/* Add Fact Form */}
              <form onSubmit={handleAddFactSubmit} className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Key (e.g. Favorite Band)"
                  value={newFactKey}
                  onChange={(e) => setNewFactKey(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-[#0f0f0f] border border-[#262626] text-white placeholder-[#555555] focus:outline-none focus:border-[#FF4D00]"
                />
                <input
                  type="text"
                  placeholder="Value (e.g. AC/DC)"
                  value={newFactVal}
                  onChange={(e) => setNewFactVal(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-[#0f0f0f] border border-[#262626] text-white placeholder-[#555555] focus:outline-none focus:border-[#FF4D00]"
                />
                <button
                  type="submit"
                  id="add-memory-fact-btn"
                  className="px-3 py-1.5 rounded-lg bg-[#FF4D00] hover:bg-[#ff6622] text-black text-xs font-bold transition-colors flex items-center shadow-[0_0_15px_rgba(255,77,0,0.3)]"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add
                </button>
              </form>

              {/* Facts List */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {facts.map((fact) => (
                  <div
                    key={fact.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[#0f0f0f] border border-[#1f1f1f] text-xs"
                  >
                    <div>
                      <span className="font-mono text-[#FF4D00] font-semibold mr-2">
                        {fact.key}:
                      </span>
                      <span className="text-[#d5d5d5]">{fact.value}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteFact(fact.id)}
                      className="p-1 text-[#666666] hover:text-red-400 transition-colors"
                      title="Delete fact"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: CONTACTS */}
          {activeTab === 'contacts' && (
            <div className="space-y-4">
              <p className="text-xs text-[#888888]">
                Secure contacts for phone calls and WhatsApp message actions via voice ("Call Pepper", "WhatsApp Happy Hogan").
              </p>

              {/* Add Contact Form */}
              <form onSubmit={handleAddContactSubmit} className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-[#0f0f0f] border border-[#262626] text-white placeholder-[#555555] focus:outline-none focus:border-[#FF4D00]"
                />
                <input
                  type="text"
                  placeholder="Phone (e.g. +1...)"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-[#0f0f0f] border border-[#262626] text-white placeholder-[#555555] focus:outline-none focus:border-[#FF4D00]"
                />
                <div className="flex space-x-1">
                  <input
                    type="text"
                    placeholder="Role (Optional)"
                    value={newContactRel}
                    onChange={(e) => setNewContactRel(e.target.value)}
                    className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-[#0f0f0f] border border-[#262626] text-white placeholder-[#555555] focus:outline-none focus:border-[#FF4D00]"
                  />
                  <button
                    type="submit"
                    id="add-contact-btn"
                    className="px-2.5 py-1.5 rounded-lg bg-[#FF4D00] hover:bg-[#ff6622] text-black text-xs font-bold transition-colors shadow-[0_0_15px_rgba(255,77,0,0.3)]"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </form>

              {/* Contacts List */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[#0f0f0f] border border-[#1f1f1f] text-xs"
                  >
                    <div>
                      <div className="font-semibold text-white">
                        {contact.name}
                        {contact.relationship && (
                          <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#171717] border border-[#262626] text-[#FF4D00]">
                            {contact.relationship}
                          </span>
                        )}
                      </div>
                      <div className="text-[#888888] font-mono text-[11px]">
                        {contact.phone}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteContact(contact.id)}
                      className="p-1 text-[#666666] hover:text-red-400 transition-colors"
                      title="Delete contact"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: ACTION TELEMETRY LOG & SAFE CONTROLS */}
          {activeTab === 'actions' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <p className="text-xs text-[#888888]">
                  Safe device action execution log &amp; Tier 1 direct controls.
                </p>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-full w-fit">
                  TIER 1 SAFE CAPABILITIES
                </span>
              </div>

              {/* Safe Tier 1 Quick Controls Grid */}
              <div className="p-3 rounded-xl bg-[#0c0c0c] border border-[#222222] space-y-2">
                <div className="text-[11px] font-mono text-[#a0a0a0] flex items-center justify-between">
                  <span className="font-bold text-white">Direct Execution &amp; Settings Shortcuts</span>
                  <span className="text-[10px] text-[#666] font-mono">No confirmation required</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => onExecuteTool && onExecuteTool('toggleFlashlight')}
                    className="p-2 rounded-lg bg-[#141414] hover:bg-[#1f1f1f] border border-[#2a2a2a] hover:border-amber-500/50 text-left transition-all group"
                  >
                    <div className="flex items-center space-x-1.5 text-amber-400 text-xs font-mono mb-0.5">
                      <Flashlight className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                      <span>Torch / Flash</span>
                    </div>
                    <div className="text-[10px] text-[#777] font-mono">Direct API</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onExecuteTool && onExecuteTool('takeScreenshot')}
                    className="p-2 rounded-lg bg-[#141414] hover:bg-[#1f1f1f] border border-[#2a2a2a] hover:border-cyan-500/50 text-left transition-all group"
                  >
                    <div className="flex items-center space-x-1.5 text-[#38e1ff] text-xs font-mono mb-0.5">
                      <Camera className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                      <span>Screenshot</span>
                    </div>
                    <div className="text-[10px] text-[#777] font-mono">Direct Capture</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onExecuteTool && onExecuteTool('playOfflineSong', { songName: 'Iron Man' })}
                    className="p-2 rounded-lg bg-[#141414] hover:bg-[#1f1f1f] border border-[#2a2a2a] hover:border-[#ff4d00]/50 text-left transition-all group"
                  >
                    <div className="flex items-center space-x-1.5 text-[#ff4d00] text-xs font-mono mb-0.5">
                      <Music className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                      <span>Offline Song</span>
                    </div>
                    <div className="text-[10px] text-[#777] font-mono">Local Library</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onExecuteTool && onExecuteTool('searchPlayStore', { query: 'car game' })}
                    className="p-2 rounded-lg bg-[#141414] hover:bg-[#1f1f1f] border border-[#2a2a2a] hover:border-emerald-500/50 text-left transition-all group"
                  >
                    <div className="flex items-center space-x-1.5 text-emerald-400 text-xs font-mono mb-0.5">
                      <ShoppingBag className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                      <span>Play Store</span>
                    </div>
                    <div className="text-[10px] text-[#777] font-mono">Search (Manual Tap)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onExecuteTool && onExecuteTool('toggleAirplaneMode')}
                    className="p-2 rounded-lg bg-[#141414] hover:bg-[#1f1f1f] border border-[#2a2a2a] hover:border-blue-500/50 text-left transition-all group"
                  >
                    <div className="flex items-center space-x-1.5 text-blue-400 text-xs font-mono mb-0.5">
                      <Plane className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                      <span>Airplane Mode</span>
                    </div>
                    <div className="text-[10px] text-[#777] font-mono">Settings (Android Restr.)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onExecuteTool && onExecuteTool('toggleBluetooth')}
                    className="p-2 rounded-lg bg-[#141414] hover:bg-[#1f1f1f] border border-[#2a2a2a] hover:border-indigo-500/50 text-left transition-all group"
                  >
                    <div className="flex items-center space-x-1.5 text-indigo-400 text-xs font-mono mb-0.5">
                      <Bluetooth className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                      <span>Bluetooth</span>
                    </div>
                    <div className="text-[10px] text-[#777] font-mono">Settings (Android Restr.)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onExecuteTool && onExecuteTool('toggleWifi')}
                    className="p-2 rounded-lg bg-[#141414] hover:bg-[#1f1f1f] border border-[#2a2a2a] hover:border-teal-500/50 text-left transition-all group"
                  >
                    <div className="flex items-center space-x-1.5 text-teal-400 text-xs font-mono mb-0.5">
                      <Wifi className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                      <span>Wi-Fi</span>
                    </div>
                    <div className="text-[10px] text-[#777] font-mono">Settings (Android Restr.)</div>
                  </button>
                </div>
              </div>

              {actionLogs.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#666666] font-mono border border-dashed border-[#222222] rounded-xl bg-[#0a0a0a]">
                  No device actions executed yet. Try asking Diablo:
                  <div className="mt-2 text-[#FF661F]">
                    "Diablo, open YouTube and search for AC/DC"
                  </div>
                  <div className="mt-1 text-[#FF661F]">
                    "Diablo, send a WhatsApp message to Pepper Potts saying I'm on my way"
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 font-mono text-xs">
                  {actionLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-lg bg-[#0f0f0f] border border-[#1f1f1f]"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-[#FF4D00]">
                          {log.toolName}()
                        </span>
                        <span className="text-[10px] text-[#666666]">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#b5b5b5]">
                        Args: {JSON.stringify(log.args)}
                      </div>
                      <div className="text-[11px] text-emerald-400 mt-1">
                        Result: {JSON.stringify(log.result.message || log.result)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: ANDROID BRIDGE & PACKAGING GUIDE */}
          {activeTab === 'android' && (
            <div className="space-y-3 text-xs text-[#c0c0c0]">
              <div className="p-3 rounded-xl bg-[#0f0f0f] border border-[#262626]">
                <div className="flex items-center space-x-2 text-[#FF4D00] font-bold mb-1">
                  <Radio className="w-4 h-4" />
                  <span>Native Android WebView Bridge Status</span>
                </div>
                <p className="text-[11px] text-[#888888] mb-2">
                  When wrapped into a native Android APK via WebView, Diablo exposes a direct JavaScript bridge (<code className="text-[#FF661F]">window.AndroidBridge</code>). Currently running with standard browser intent fallbacks.
                </p>
                <div className="font-mono text-[11px] p-2 rounded bg-black/70 border border-[#1f1f1f] text-[#d0d0d0]">
                  Active Bridge: {window.AndroidBridge ? 'Connected (Android Native)' : 'Web Standard Fallback Mode'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#0f0f0f] border border-[#1f1f1f]">
                <div className="font-bold text-white mb-1">
                  10. Background Operation Architecture
                </div>
                <p className="text-[11px] text-[#888888] leading-relaxed mb-2">
                  For reliable continuous background listening on Android:
                </p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-[#a0a0a0] font-mono">
                  <li>Foreground Service with persistent notification channel</li>
                  <li>WAKE_LOCK &amp; RECORD_AUDIO permissions in AndroidManifest.xml</li>
                  <li>Battery optimization disabled for Diablo in device settings</li>
                </ul>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => window.open('https://developer.android.com/develop/ui/views/layout/webapps/webview', '_blank')}
                  className="text-xs text-[#FF4D00] hover:text-[#ff7733] flex items-center font-mono transition-colors"
                >
                  <span>Android WebView Docs</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-1" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
