import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Power,
  Shield,
  Sparkles,
  Send,
  Mic,
  MicOff,
  Battery,
  BatteryCharging,
  BatteryLow,
  BatteryMedium,
  Eye,
  EyeOff,
  Radio,
  LogIn,
  LogOut,
  User as UserIcon,
  AlertCircle,
  Flashlight,
  Camera,
  Music,
  Download,
  X,
  Play,
  Pause,
  Square,
  Globe,
  ExternalLink,
} from 'lucide-react';
import {
  AssistantState,
  Contact,
  DeviceActionLog,
  OfflineSong,
  PendingConfirmation,
  PreparedMessageInfo,
  UserFact,
  VoiceGender,
} from './types';
import { MemoryStorage } from './services/memoryStorage';
import { AudioEngine } from './services/audioEngine';
import { WakeWordDetector } from './services/wakeWord';
import { DeviceActionExecutor } from './services/deviceActions';
import { offlineMusic } from './services/offlineMusic';
import { VoiceSelectionModal } from './components/VoiceSelectionModal';
import { DiabloReactorCore } from './components/DiabloReactorCore';
import { ActionConfirmationDialog } from './components/ActionConfirmationDialog';
import { HUDConsole } from './components/HUDConsole';
import { PreparedMessageCard } from './components/PreparedMessageCard';
import { LanguageSelectorModal } from './components/LanguageSelectorModal';
import { DiabloLiveClient } from './services/liveClient';
import { getApiUrl } from './services/apiConfig';
import { useBatteryStatus } from './services/batteryStatus';
import { screenAwareness } from './services/screenAwareness';
import {
  signInWithGoogle,
  logOut,
  onAuthUserChanged,
  saveUserFactToFirestore,
  loadUserFactsFromFirestore,
  deleteUserFactFromFirestore,
  saveConversationTurnToFirestore,
  loadConversationHistoryFromFirestore,
  isRunningInIframe,
} from './services/firebase';
import type { User } from 'firebase/auth';

export default function App() {
  // Assistant States
  const [state, setState] = useState<AssistantState>('IDLE');
  const [isPowerOn, setIsPowerOn] = useState<boolean>(true);
  const [isWakeWordActive, setIsWakeWordActive] = useState<boolean>(true);
  const [currentVoice, setCurrentVoice] = useState<VoiceGender>('Male');
  const [showVoiceModal, setShowVoiceModal] = useState<boolean>(false);
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);

  // Battery Status API Hook
  const battery = useBatteryStatus();

  // Screen Awareness Mode State
  const [isScreenAwarenessOn, setIsScreenAwarenessOn] = useState<boolean>(false);

  // Safe Tier 1 Device Controls State
  const [isFlashlightActive, setIsFlashlightActive] = useState<boolean>(false);
  const [activeOfflineSong, setActiveOfflineSong] = useState<OfflineSong | null>(null);
  const [isOfflinePlaying, setIsOfflinePlaying] = useState<boolean>(false);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [micPermissionDenied, setMicPermissionDenied] = useState<boolean>(false);

  // Language & Translation State
  const [activeLanguage, setActiveLanguage] = useState<string | null>(null);
  const [showLangModal, setShowLangModal] = useState<boolean>(false);
  const [preparedMessage, setPreparedMessage] = useState<PreparedMessageInfo | null>(null);
  const [translationPrepMode, setTranslationPrepMode] = useState<{
    active: boolean;
    sourceLanguage: string;
    targetLanguage: string;
    appName: string;
  } | null>(null);

  // Audio & Visualizer Telemetry
  const [micVolume, setMicVolume] = useState<number>(0);
  const [visualizerData, setVisualizerData] = useState<Uint8Array>(new Uint8Array(64));

  // Transcripts & Feed
  const [lastUserTranscript, setLastUserTranscript] = useState<string>('');
  const [lastModelTranscript, setLastModelTranscript] = useState<string>('');
  const [quickInput, setQuickInput] = useState<string>('');

  // Live WebSocket Link Telemetry & Error
  const [linkErrorMessage, setLinkErrorMessage] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<string>('DISCONNECTED');

  // Firebase User Authentication & Per-User Memory
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Persistent Memory & Contacts
  const [facts, setFacts] = useState<UserFact[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [actionLogs, setActionLogs] = useState<DeviceActionLog[]>([]);

  // Action Confirmation Modal
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);

  // Service Singletons stored in Refs
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const wakeWordRef = useRef<WakeWordDetector | null>(null);
  const deviceExecutorRef = useRef<DeviceActionExecutor | null>(null);
  const liveClientRef = useRef<DiabloLiveClient | null>(null);
  const visualizerIntervalRef = useRef<any>(null);
  const historyRef = useRef<{ role: string; text: string }[]>([]);

  // Ground truth references for zero-stale memory access
  const currentUserRef = useRef<User | null>(null);
  const factsRef = useRef<UserFact[]>([]);
  const persistFactRef = useRef<(key: string, value: string) => Promise<UserFact[]>>(async () => []);

  currentUserRef.current = currentUser;
  factsRef.current = facts;

  // Immediate Unified Fact Persistence Engine (Firestore for signed-in, LocalStorage for guests)
  const persistFact = useCallback(async (factKey: string, factValue: string): Promise<UserFact[]> => {
    if (!factKey || !factValue) return factsRef.current;
    const cleanKey = factKey.trim();
    const cleanVal = factValue.trim();
    if (!cleanKey || !cleanVal) return factsRef.current;

    const user = currentUserRef.current;
    const uid = user ? user.uid : null;

    console.log(`[Diablo Memory] Persisting fact immediately (${user ? `Firestore for ${user.email}` : 'LocalStorage for Guest'}): "${cleanKey}" = "${cleanVal}"`);

    // 1. Immediately persist to Local Storage (synchronous & reliable)
    const updated = MemoryStorage.addOrUpdateFact(cleanKey, cleanVal, uid);
    setFacts([...updated]);
    factsRef.current = [...updated];

    // 2. If signed in, immediately persist to Firestore cloud database
    if (user) {
      try {
        await saveUserFactToFirestore(user.uid, cleanKey, cleanVal);
        console.log(`[Diablo Memory] Fact successfully saved to Firestore: "${cleanKey}" = "${cleanVal}"`);
      } catch (err: any) {
        console.error('[Diablo Memory] Error saving fact to Firestore:', err?.message || err);
      }
    }

    // 3. Real-time broadcast into live Gemini session if active
    const live = liveClientRef.current;
    if (live && live.getStatus() === 'CONNECTED') {
      const allMem = {
        ...MemoryStorage.getFactsObject(uid),
        [cleanKey]: cleanVal,
      };
      live.sendMemoryUpdate(cleanKey, cleanVal, allMem);
    }

    return updated;
  }, []);

  persistFactRef.current = persistFact;

  // Returns all saved facts merged reliably across storage and memory
  const getAllFactsObject = useCallback((): Record<string, string> => {
    const user = currentUserRef.current;
    const uid = user ? user.uid : null;
    const storageMap = MemoryStorage.getFactsObject(uid);
    const refMap: Record<string, string> = {};
    for (const f of factsRef.current) {
      if (f.key && f.value) {
        refMap[f.key.trim()] = f.value.trim();
      }
    }
    return { ...storageMap, ...refMap };
  }, []);

  // Proactive heuristic fact detection from user speech or text as an immediate safety guard
  const detectAndSaveUserFact = useCallback(
    (input: string) => {
      if (!input) return;
      const lower = input.trim();
      // Match English: "remember (that) (my) [key] is [value]"
      const engMatch = lower.match(
        /^(?:diablo\s*,?\s*)?(?:please\s+)?(?:remember(?:\s+that)?|save(?:\s+fact)?)\s+(?:my\s+)?([a-z0-9\s]+?)\s+(?:is|are|=|:)\s+(.+)$/i
      );
      if (engMatch && engMatch[1] && engMatch[2]) {
        const key = engMatch[1].trim().replace(/^(the|a|an)\s+/i, '');
        const val = engMatch[2].trim().replace(/[.!?]+$/, '');
        if (key.length > 1 && val.length > 0) {
          persistFact(key, val);
          return;
        }
      }

      // Match Hindi/Hinglish: "yaad rakhna/rakho (ki) mera/meri/mere [key] [value] hai"
      const hinMatch = lower.match(
        /^(?:diablo\s*,?\s*)?(?:yaad\s+(?:rakhna|rakho))\s*(?:ki)?\s*(?:mera|meri|mere)?\s*([a-z0-9\u0900-\u097F\s]+?)\s+(?:hai\s+)?([a-z0-9\u0900-\u097F\s]+?)\s+hai$/i
      );
      if (hinMatch && hinMatch[1] && hinMatch[2]) {
        const key = hinMatch[1].trim();
        const val = hinMatch[2].trim().replace(/[.!?]+$/, '');
        if (key.length > 1 && val.length > 0) {
          persistFact(key, val);
          return;
        }
      }
    },
    [persistFact]
  );

  // 1. Initialize Services and Persistent Storage on mount
  useEffect(() => {
    // Check onboarding
    const savedVoice = MemoryStorage.getVoice();
    if (!savedVoice) {
      setShowVoiceModal(true);
    } else {
      setCurrentVoice(savedVoice);
    }

    const lastUid = localStorage.getItem('diablo_last_auth_uid');
    const initialFacts = MemoryStorage.getFacts(lastUid);
    setFacts(initialFacts);
    factsRef.current = initialFacts;
    setContacts(MemoryStorage.getContacts());
    setCustomAvatar(MemoryStorage.getCustomAvatar());
    setIsWakeWordActive(MemoryStorage.isWakeWordEnabled());

    // Initialize Audio Engine
    const audio = new AudioEngine();
    audioEngineRef.current = audio;

    // Initialize Device Executor
    const executor = new DeviceActionExecutor();
    deviceExecutorRef.current = executor;

    executor.onFactSaved = async (k, v) => {
      await persistFactRef.current(k, v);
    };

    executor.onLogAction = (log) => {
      setActionLogs((prev) => [log, ...prev].slice(0, 50));
    };

    executor.onRequestConfirmation = (confirmation) => {
      setPendingConfirmation(confirmation);
    };

    executor.onFlashlightChange = (isOn) => {
      setIsFlashlightActive(isOn);
    };

    executor.onScreenshotCaptured = (dataUrl) => {
      setScreenshotPreview(dataUrl);
    };

    executor.onMessagePrepared = (info) => {
      setPreparedMessage(info);
    };

    offlineMusic.onStateChange = (song, isPlaying) => {
      setActiveOfflineSong(song);
      setIsOfflinePlaying(isPlaying);
    };

    // Initialize Wake Word Detector
    const detector = new WakeWordDetector();
    wakeWordRef.current = detector;

    // Initialize Diablo Live Client for real-time bidirectional streaming
    const live = new DiabloLiveClient();
    liveClientRef.current = live;

    live.onStatusChange = (newStatus, err) => {
      setLiveStatus(newStatus);
      if (err) setLinkErrorMessage(err);
    };

    live.onReady = (voice) => {
      console.log('[Diablo App] Gemini Live link established and ready with voice:', voice);
      setLinkErrorMessage(null);
      setState('LISTENING');
      setLastUserTranscript('Listening to Boss...');
    };

    live.onAudio = (base64Audio24k) => {
      if (audioEngineRef.current) {
        audioEngineRef.current.playBase64Chunk(base64Audio24k);
      }
    };

    live.onModelTranscript = (textChunk) => {
      setLastModelTranscript((prev) => prev + textChunk);
    };

    live.onUserTranscript = (textChunk) => {
      setLastUserTranscript((prev) => {
        if (
          !prev ||
          prev === 'Listening to Boss...' ||
          prev.startsWith('Connecting') ||
          prev.startsWith('User tapped')
        ) {
          return textChunk;
        }
        return prev + textChunk;
      });
    };

    live.onToolCall = async (toolCall) => {
      console.log('[Diablo App] Live function call:', toolCall.name, toolCall.args);
      const ex = deviceExecutorRef.current;
      let result: any = { status: 'ok' };
      if (ex) {
        try {
          if (toolCall.name === 'openApp') result = await ex.openApp(toolCall.args?.appName);
          else if (toolCall.name === 'searchYoutube') result = await ex.searchYoutube(toolCall.args?.query);
          else if (toolCall.name === 'sendWhatsappMessage') result = await ex.sendWhatsappMessage(toolCall.args?.contactName, toolCall.args?.message);
          else if (toolCall.name === 'shareLiveLocation') result = await ex.shareLiveLocation();
          else if (toolCall.name === 'openAppSettings') result = await ex.openAppSettings(toolCall.args?.appName);
          else if (toolCall.name === 'checkAppUpdates') result = await ex.checkAppUpdates(toolCall.args?.appName);
          else if (toolCall.name === 'callContact') result = await ex.callContact(toolCall.args?.contactName);
          else if (toolCall.name === 'toggleAirplaneMode') result = await ex.toggleAirplaneMode(toolCall.args?.enable);
          else if (toolCall.name === 'toggleBluetooth') result = await ex.toggleBluetooth(toolCall.args?.enable);
          else if (toolCall.name === 'toggleWifi') result = await ex.toggleWifi(toolCall.args?.enable);
          else if (toolCall.name === 'toggleFlashlight') result = await ex.toggleFlashlight(toolCall.args?.enable);
          else if (toolCall.name === 'takeScreenshot') result = await ex.takeScreenshot();
          else if (toolCall.name === 'playOfflineSong') result = await ex.playOfflineSong(toolCall.args?.songName);
          else if (toolCall.name === 'searchPlayStore') result = await ex.searchPlayStore(toolCall.args?.query);
          else if (toolCall.name === 'translateAndPrepareMessage') {
            result = await ex.translateAndPrepareMessage(
              toolCall.args?.spokenText,
              toolCall.args?.sourceLanguage,
              toolCall.args?.targetLanguage,
              toolCall.args?.appName,
              toolCall.args?.translatedText
            );
            if (result?.success) {
              setPreparedMessage({
                spokenText: toolCall.args?.spokenText,
                sourceLanguage: toolCall.args?.sourceLanguage || 'Odia',
                targetLanguage: toolCall.args?.targetLanguage || 'English',
                appName: toolCall.args?.appName || 'WhatsApp',
                translatedText: result.translatedText,
                composeUrl: result.composeUrl,
                timestamp: Date.now(),
              });
            }
          }
          else if (toolCall.name === 'saveUserFact') {
            const k = toolCall.args?.factKey || '';
            const v = toolCall.args?.factValue || '';
            await persistFactRef.current(k, v);
            result = {
              success: true,
              saved: { key: k, value: v },
              storage: currentUserRef.current ? 'Firestore Cloud Storage' : 'Persistent Local Storage',
              message: `Fact permanently saved immediately: ${k} is ${v}. I will always remember this, Boss.`,
            };
          }
        } catch (e: any) {
          result = { error: e.message || 'Tool execution error' };
        }
      }
      live.sendToolResponse(toolCall.id, result, toolCall.name);
    };

    live.onInterrupted = () => {
      console.log('[Diablo App] Gemini Live model interrupted by Boss');
      if (audioEngineRef.current) {
        audioEngineRef.current.clearQueueAndStop();
      }
      setState('LISTENING');
    };

    live.onTurnComplete = () => {
      setState((prev) => (prev === 'SPEAKING' ? 'LISTENING' : prev));
    };

    live.onError = (errMsg) => {
      // Only set fatal ERROR state if it's an authorization/API key issue
      if (/401|unauthorized|api[ _]?key|API_KEY_INVALID/i.test(errMsg)) {
        console.error('[Diablo App] Gemini Live authorization error:', errMsg);
        setLinkErrorMessage(errMsg);
        setState('ERROR');
      } else {
        console.warn('[Diablo App] Gemini Live notice:', errMsg);
      }
    };

    live.onClose = (code, reason) => {
      console.log('[Diablo App] Live session closed:', code, reason);
    };

    // Pipe microphone chunks directly into the Live Client
    audio.onAudioChunk = (base64Chunk) => {
      if (liveClientRef.current && liveClientRef.current.getStatus() === 'CONNECTED') {
        liveClientRef.current.sendAudioChunk(base64Chunk);
      }
    };

    // Pre-warm backend Gemini session
    fetch(getApiUrl('/api/diablo/warmup')).catch(() => {});

    // Visualizer loop
    visualizerIntervalRef.current = setInterval(() => {
      if (audioEngineRef.current) {
        setVisualizerData(audioEngineRef.current.getVisualizerData());
      }
    }, 50);

    return () => {
      if (visualizerIntervalRef.current) {
        clearInterval(visualizerIntervalRef.current);
      }
      live.disconnect();
      audio.cleanup();
      detector.stop();
    };
  }, []);

  // Firebase Authentication & Isolated User Memory Lifecycle
  useEffect(() => {
    const unsubscribe = onAuthUserChanged(async (user) => {
      setCurrentUser(user);
      currentUserRef.current = user;

      if (user) {
        console.log('[Diablo App] User authenticated:', user.email, user.uid);
        localStorage.setItem('diablo_last_auth_uid', user.uid);

        // 1. Immediately load synchronous local cache for this user (0ms latency)
        const cached = MemoryStorage.getFacts(user.uid);
        if (cached.length > 0) {
          setFacts(cached);
          factsRef.current = cached;
        }

        // 2. Fetch ground truth from Firestore
        try {
          const userFacts = await loadUserFactsFromFirestore(user.uid);
          if (userFacts && userFacts.length > 0) {
            setFacts(userFacts);
            factsRef.current = userFacts;
            MemoryStorage.saveFacts(userFacts, user.uid);
          } else {
            // First time login: seed default or cached facts into Firestore
            const toSeed = cached.length > 0 ? cached : MemoryStorage.getFacts(null);
            for (const f of toSeed) {
              await saveUserFactToFirestore(user.uid, f.key, f.value);
            }
            const seeded = await loadUserFactsFromFirestore(user.uid);
            const finalFacts = seeded.length > 0 ? seeded : toSeed;
            setFacts(finalFacts);
            factsRef.current = finalFacts;
            MemoryStorage.saveFacts(finalFacts, user.uid);
          }

          const userHistory = await loadConversationHistoryFromFirestore(user.uid);
          historyRef.current = userHistory;
        } catch (err: any) {
          console.warn('[Diablo App] Could not load cloud memory:', err.message);
        }
      } else {
        // Guest mode (not signed in)
        console.log('[Diablo App] Guest mode active - loading persistent local facts');
        localStorage.removeItem('diablo_last_auth_uid');
        const guestFacts = MemoryStorage.getFacts(null);
        setFacts(guestFacts);
        factsRef.current = guestFacts;
        historyRef.current = [];
      }
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setAuthError(null);
    setIsSigningIn(true);

    try {
      console.log('[Diablo App] Initiating Google Sign-In popup flow...');
      const user = await signInWithGoogle();
      if (user) {
        console.log('[Diablo App] Successfully signed in user:', user.email);
        setAuthError(null);
      }
    } catch (err: any) {
      console.error('[Diablo App] Google Sign-in error:', err);
      const code = err?.code || '';
      const msg = err?.message || String(err);

      if (code === 'auth/popup-blocked') {
        setAuthError(
          'Google Sign-in popup was blocked by the browser. Please allow popups for this page or open the application in a new tab.'
        );
      } else if (code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in cancelled: The Google popup was closed before completion. Tap Sign In to try again.');
      } else if (code === 'auth/cancelled-popup-request') {
        setAuthError('Another authentication attempt is already in progress.');
      } else if (code === 'auth/unauthorized-domain') {
        setAuthError(
          `Domain (${window.location.hostname}) is not in Firebase Auth authorized domains list. Please check Firebase Console > Authentication > Settings.`
        );
      } else {
        setAuthError(msg || 'Sign-in failed. Please try again.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      setAuthError(null);
      await logOut();
      currentUserRef.current = null;
      localStorage.removeItem('diablo_last_auth_uid');
      const guestFacts = MemoryStorage.getFacts(null);
      setFacts(guestFacts);
      factsRef.current = guestFacts;
      historyRef.current = [];
    } catch (err: any) {
      console.error('[Diablo App] Sign out error:', err);
    }
  };

  const handleAddFact = async (key: string, value: string) => {
    await persistFactRef.current(key, value);
  };

  const handleDeleteFact = async (id: string) => {
    const user = currentUserRef.current;
    const uid = user ? user.uid : null;
    const target = factsRef.current.find((f) => f.id === id);

    const updated = MemoryStorage.deleteFact(id, uid);
    setFacts([...updated]);
    factsRef.current = [...updated];

    if (user && target) {
      await deleteUserFactFromFirestore(user.uid, target.key);
    }

    const live = liveClientRef.current;
    if (live && live.getStatus() === 'CONNECTED') {
      live.sendMemoryUpdate(target?.key || id, '[DELETED]', MemoryStorage.getFactsObject(uid));
    }
  };

  // Screen Awareness Toggle Function
  const toggleScreenAwareness = useCallback(async (explicitState?: boolean) => {
    const shouldEnable = explicitState !== undefined ? explicitState : !isScreenAwarenessOn;
    if (shouldEnable) {
      const success = await screenAwareness.start();
      setIsScreenAwarenessOn(success);
      if (success) {
        const msg = "Screen awareness mode active, Boss. I can now see your active screen display.";
        setLastModelTranscript(msg);
        if (audioEngineRef.current) {
          audioEngineRef.current.speakTextWithFallback(msg, currentVoice);
        }
      }
    } else {
      screenAwareness.stop();
      setIsScreenAwarenessOn(false);
      const msg = "Screen awareness deactivated, Boss.";
      setLastModelTranscript(msg);
      if (audioEngineRef.current) {
        audioEngineRef.current.speakTextWithFallback(msg, currentVoice);
      }
    }
  }, [isScreenAwarenessOn, currentVoice]);

  // 2. Voice Conversation Query Execution (High-performance Gemini Voice HTTP Pipeline)
  const executeVoiceQuery = useCallback(
    async (userQuery: string) => {
      if (!isPowerOn || !userQuery || !userQuery.trim()) return;
      const trimmed = userQuery.trim();

      // A. If Diablo is awaiting the user's spoken sentence to translate and paste into WhatsApp
      if (translationPrepMode?.active) {
        setLastUserTranscript(trimmed);
        const { sourceLanguage, targetLanguage, appName } = translationPrepMode;
        setTranslationPrepMode(null);
        setState('THINKING');

        const prepRes = await deviceExecutorRef.current?.translateAndPrepareMessage(
          trimmed,
          sourceLanguage,
          targetLanguage,
          appName
        );

        const translatedText = prepRes?.translatedText || trimmed;
        if (prepRes?.success) {
          setPreparedMessage({
            spokenText: trimmed,
            sourceLanguage,
            targetLanguage,
            appName,
            translatedText,
            composeUrl: prepRes.composeUrl,
            timestamp: Date.now(),
          });
        }

        const reply = `बॉस, आपका ${sourceLanguage} संदेश इंग्लिश में ट्रांसलेट करके ${appName} में पेस्ट कर दिया है: "${translatedText}"। आप रिव्यू करके सेंड कर सकते हैं।`;
        setLastModelTranscript(reply);
        historyRef.current.push({ role: 'user', text: trimmed });
        historyRef.current.push({ role: 'assistant', text: reply });
        if (currentUser) {
          saveConversationTurnToFirestore(currentUser.uid, 'user', trimmed);
          saveConversationTurnToFirestore(currentUser.uid, 'assistant', reply);
        }
        if (audioEngineRef.current) {
          setState('SPEAKING');
          await audioEngineRef.current.speakTextWithFallback(reply, currentVoice);
        }
        return;
      }

      // B. Voice command: Reset language to Default (Hindi / English / Hinglish)
      if (
        /(hindi mein baat karo|hindi me bolo|hindi mein bolo|switch to hindi|hindi mein aao|speak in hindi|wapas hindi|normal bhasha|default language|pehle jaise bolo)/i.test(
          trimmed
        )
      ) {
        setActiveLanguage(null);
        wakeWordRef.current?.setLanguage(null);
        const reply = 'जी बॉस, अब से वापस हिंदी में बात करेंगे। बताइए क्या हुक्म है।';
        setLastUserTranscript(trimmed);
        setLastModelTranscript(reply);
        historyRef.current.push({ role: 'user', text: trimmed });
        historyRef.current.push({ role: 'assistant', text: reply });
        if (currentUser) {
          saveConversationTurnToFirestore(currentUser.uid, 'user', trimmed);
          saveConversationTurnToFirestore(currentUser.uid, 'assistant', reply);
        }
        if (audioEngineRef.current) {
          setState('SPEAKING');
          await audioEngineRef.current.speakTextWithFallback(reply, currentVoice);
        }
        return;
      }

      // C. Voice command: On-demand switch to ANY requested language
      const onDemandLangAcks: Record<string, { name: string; reply: string }> = {
        odia: { name: 'Odia', reply: "ଠିକ୍ ଅଛି ବସ୍, ମୁଁ ଏବେ ଓଡ଼ିଆରେ କଥା ହେବି। ଆପଣଙ୍କ ଆଦେଶ କ'ଣ?" },
        oriya: { name: 'Odia', reply: "ଠିକ୍ ଅଛି ବସ୍, ମୁଁ ଏବେ ଓଡ଼ିଆରେ କଥା ହେବି। ଆପଣଙ୍କ ଆଦେଶ କ'ଣ?" },
        tamil: { name: 'Tamil', reply: 'சரி பாஸ், நான் இப்போது தமிழில் பேசுகிறேன். உங்கள் கட்டளை என்ன?' },
        telugu: { name: 'Telugu', reply: 'సరే బాస్, నేను ఇప్పుడు తెలుగులో మాట్లాడతాను. మీ ఆదేశం ఏమిటి?' },
        bengali: { name: 'Bengali', reply: 'ঠিক আছে বস, আমি এখন বাংলায় কথা বলব। আপনার নির্দেশ কী?' },
        bangla: { name: 'Bengali', reply: 'ঠিক আছে বস, আমি এখন বাংলায় কথা বলব। আপনার নির্দেশ কী?' },
        marathi: { name: 'Marathi', reply: 'होय बॉस, मी आता मराठीत बोलेन. काय आज्ञा आहे?' },
        punjabi: { name: 'Punjabi', reply: 'ਹਾਂਜੀ ਬੌਸ, ਹੁਣ ਪੰਜਾਬੀ ਵਿੱਚ ਗੱਲ ਕਰਾਂਗੇ। ਕੀ ਹੁਕਮ ਹੈ?' },
        gujarati: { name: 'Gujarati', reply: 'હા બોસ, હું હવે ગુજરાતીમાં વાત કરીશ. શું આદેશ છે?' },
        kannada: { name: 'Kannada', reply: 'ಸರಿ ಬಾಸ್, ನಾನು ಈಗ ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡುತ್ತೇನೆ. ನಿಮ್ಮ ಆದೇಶವೇನು?' },
        malayalam: { name: 'Malayalam', reply: 'ശരി ബോസ്, ഞാൻ ഇനി മലയാളത്തിൽ സംസാരിക്കാം. എന്താണ് ആജ്ഞ?' },
        japanese: { name: 'Japanese', reply: '承知いたしました、ボス。日本語でお話しします。何なりとお申し付けください。' },
        korean: { name: 'Korean', reply: '알겠습니다, 보스. 한국어로 말씀드리겠습니다. 명령을 내려주십시오.' },
        french: { name: 'French', reply: 'Bien reçu, Boss. Je vais parler en français désormais.' },
        german: { name: 'German', reply: 'Verstanden, Boss. Ich werde ab jetzt auf Deutsch sprechen.' },
        spanish: { name: 'Spanish', reply: 'Entendido, Jefe. Hablaré en español a partir de ahora.' },
        english: { name: 'English', reply: 'Understood, Boss. Switching to English. What is your command?' },
      };

      const langSwitchMatch =
        trimmed.match(/(?:speak in|talk in|switch to)\s+([a-zA-Z]+)/i) ||
        trimmed.match(/([a-zA-Z\u0900-\u097F]+)\s*(?:mein|me)\s*(?:baat karo|bolo|kaho)/i);

      if (langSwitchMatch) {
        const langKey = langSwitchMatch[1].toLowerCase().trim();
        const found = onDemandLangAcks[langKey];
        if (found) {
          setActiveLanguage(found.name);
          wakeWordRef.current?.setLanguage(found.name);
          setLastUserTranscript(trimmed);
          setLastModelTranscript(found.reply);
          historyRef.current.push({ role: 'user', text: trimmed });
          historyRef.current.push({ role: 'assistant', text: found.reply });
          if (currentUser) {
            saveConversationTurnToFirestore(currentUser.uid, 'user', trimmed);
            saveConversationTurnToFirestore(currentUser.uid, 'assistant', found.reply);
          }
          if (audioEngineRef.current) {
            setState('SPEAKING');
            await audioEngineRef.current.speakTextWithFallback(found.reply, currentVoice);
          }
          return;
        }
      }

      // D. Voice command: Speak-to-translate-and-paste for messaging
      // Example: "Main Odia mein baat karunga, isko English mein translate karke WhatsApp mein paste kar do"
      const translateIntentRegex =
        /(?:main|mai|hum)?\s*([a-zA-Z\u0900-\u097F]+)?\s*(?:mein|me)?\s*(?:baat karunga|bolunga|kahoonga|bolta hoon|bol raha hoon)?.*(?:translate|translation|anuvad).*(?:whatsapp|telegram|messages?|chat).*(?:paste|daal|likh|bhej|draft|prepare)/i;

      if (translateIntentRegex.test(trimmed)) {
        setLastUserTranscript(trimmed);
        let detectedSrc = 'Odia';
        const langMatches = trimmed.match(
          /(odia|oriya|tamil|telugu|bengali|bangla|marathi|punjabi|gujarati|kannada|malayalam|japanese|korean|french|german|spanish|hindi)/i
        );
        if (langMatches) {
          detectedSrc = langMatches[1].charAt(0).toUpperCase() + langMatches[1].slice(1).toLowerCase();
          if (detectedSrc.toLowerCase() === 'oriya') detectedSrc = 'Odia';
          if (detectedSrc.toLowerCase() === 'bangla') detectedSrc = 'Bengali';
        } else if (activeLanguage) {
          detectedSrc = activeLanguage;
        }

        const appMatch = trimmed.match(/(whatsapp|telegram|messages?)/i);
        const appName = appMatch
          ? appMatch[1].toLowerCase().includes('tele')
            ? 'Telegram'
            : 'WhatsApp'
          : 'WhatsApp';

        // Check if user already gave the text in the same prompt
        const contentAfterColon = trimmed.split(/[:：]/)[1]?.trim();
        const contentAfterPaste = trimmed
          .match(/(?:paste kar do|paste karo|paste kar dena|daal do)\s+(.+)/i)?.[1]
          ?.trim();
        const attachedText =
          contentAfterColon ||
          (contentAfterPaste && !/(whatsapp|telegram|english)/i.test(contentAfterPaste)
            ? contentAfterPaste
            : null);

        if (attachedText && attachedText.length > 2) {
          setState('THINKING');
          const prepRes = await deviceExecutorRef.current?.translateAndPrepareMessage(
            attachedText,
            detectedSrc,
            'English',
            appName
          );
          const translatedText = prepRes?.translatedText || attachedText;
          if (prepRes?.success) {
            setPreparedMessage({
              spokenText: attachedText,
              sourceLanguage: detectedSrc,
              targetLanguage: 'English',
              appName,
              translatedText,
              composeUrl: prepRes.composeUrl,
              timestamp: Date.now(),
            });
          }
          const reply = `बॉस, आपका ${detectedSrc} संदेश इंग्लिश में ट्रांसलेट करके ${appName} में पेस्ट कर दिया है: "${translatedText}"। आप चेक करके सेंड कर सकते हैं।`;
          setLastModelTranscript(reply);
          if (audioEngineRef.current) {
            setState('SPEAKING');
            await audioEngineRef.current.speakTextWithFallback(reply, currentVoice);
          }
          return;
        } else {
          // Listen for the upcoming sentence in that language
          setTranslationPrepMode({
            active: true,
            sourceLanguage: detectedSrc,
            targetLanguage: 'English',
            appName,
          });

          wakeWordRef.current?.setLanguage(detectedSrc);

          const promptReply = `जी बॉस, आप ${detectedSrc} में बोलिए। मैं उसे नैचुरल इंग्लिश में ट्रांसलेट करके ${appName} में पेस्ट कर दूंगा।`;
          setLastModelTranscript(promptReply);
          if (audioEngineRef.current) {
            setState('SPEAKING');
            await audioEngineRef.current.speakTextWithFallback(promptReply, currentVoice);
          }
          setTimeout(() => {
            setState('LISTENING');
            wakeWordRef.current?.startCommandListening();
          }, 1200);
          return;
        }
      }

      // 0. Hardcoded Diablo Creator identity check (always "L Sumeet" for every user)
      if (
        /(who (made|created|built|designed|invented|coded) you|tumhe kisne banaya|kisne banaya hai tumhe|who is your creator|who created diablo|creator of diablo)/i.test(
          trimmed
        )
      ) {
        const creatorReply =
          'मुझे एल सुमीत (L Sumeet) ने बनाया है, बॉस। I was created by L Sumeet.';
        setLastUserTranscript(trimmed);
        setLastModelTranscript(creatorReply);
        historyRef.current.push({ role: 'user', text: trimmed });
        historyRef.current.push({ role: 'assistant', text: creatorReply });
        if (currentUser) {
          saveConversationTurnToFirestore(currentUser.uid, 'user', trimmed);
          saveConversationTurnToFirestore(currentUser.uid, 'assistant', creatorReply);
        }
        if (audioEngineRef.current) {
          setState('SPEAKING');
          await audioEngineRef.current.speakTextWithFallback(creatorReply, currentVoice);
        }
        return;
      }

      // 1. Voice command for "Stop Diablo"
      if (/^(stop diablo|diablo stop|shut down|stand down|turn off diablo|डियाब्लो बंद)/i.test(trimmed)) {
        setIsWakeWordActive(false);
        if (wakeWordRef.current) wakeWordRef.current.stop();
        setState('IDLE');
        const reply = "Standing down, Boss. Background listening stopped.";
        setLastUserTranscript(trimmed);
        setLastModelTranscript(reply);
        if (audioEngineRef.current) {
          audioEngineRef.current.speakTextWithFallback(reply, currentVoice);
        }
        return;
      }

      // 2. Voice command for Screen Awareness
      if (/(turn on screen awareness|enable screen awareness|start screen awareness|स्क्रीन अवेयरनेस चालू)/i.test(trimmed)) {
        setLastUserTranscript(trimmed);
        await toggleScreenAwareness(true);
        return;
      }
      if (/(turn off screen awareness|disable screen awareness|stop screen awareness|स्क्रीन अवेयरनेस बंद)/i.test(trimmed)) {
        setLastUserTranscript(trimmed);
        await toggleScreenAwareness(false);
        return;
      }

      // 3. Voice command for Airplane Mode (Safe Tier 1 - Opens Settings for one tap)
      if (/(airplane mode|flight mode|एयरप्लेन मोड)/i.test(trimmed)) {
        const isOff = /(off|band|बंद)/i.test(trimmed);
        setLastUserTranscript(trimmed);
        const res = await deviceExecutorRef.current?.toggleAirplaneMode(!isOff);
        const reply = res?.message || 'बॉस, एयरप्लेन मोड सेटिंग्स खोल दी गई है, आप इसे एक टैप से टॉगल कर सकते हैं।';
        setLastModelTranscript(reply);
        if (audioEngineRef.current) {
          setState('SPEAKING');
          await audioEngineRef.current.speakTextWithFallback(reply, currentVoice);
        }
        return;
      }

      // 4. Voice command for Bluetooth (Safe Tier 1 - Opens Settings for one tap)
      if (/(bluetooth|ब्लूटूथ)/i.test(trimmed) && /(on|off|chalu|band|karo|चालू|बंद)/i.test(trimmed)) {
        const isOff = /(off|band|बंद)/i.test(trimmed);
        setLastUserTranscript(trimmed);
        const res = await deviceExecutorRef.current?.toggleBluetooth(!isOff);
        const reply = res?.message || 'बॉस, ब्लूटूथ सेटिंग्स खोल दी गई है, आप इसे एक टैप से ऑन या ऑफ कर सकते हैं।';
        setLastModelTranscript(reply);
        if (audioEngineRef.current) {
          setState('SPEAKING');
          await audioEngineRef.current.speakTextWithFallback(reply, currentVoice);
        }
        return;
      }

      // 5. Voice command for Wi-Fi (Safe Tier 1 - Opens Settings for one tap)
      if (/(wi-?fi|wifi|वाई-?फाई)/i.test(trimmed) && /(on|off|chalu|band|karo|चालू|बंद)/i.test(trimmed)) {
        const isOff = /(off|band|बंद)/i.test(trimmed);
        setLastUserTranscript(trimmed);
        const res = await deviceExecutorRef.current?.toggleWifi(!isOff);
        const reply = res?.message || 'बॉस, वाई-फाई सेटिंग्स खोल दी गई है, आप इसे एक टैप से बदल सकते हैं।';
        setLastModelTranscript(reply);
        if (audioEngineRef.current) {
          setState('SPEAKING');
          await audioEngineRef.current.speakTextWithFallback(reply, currentVoice);
        }
        return;
      }

      // 6. Voice command for Flashlight / Torch (Safe Tier 1 - Direct programmatic toggle)
      if (/(torch|flashlight|टॉर्च)/i.test(trimmed) && /(on|off|chalu|band|karo|jalana|bujhana|चालू|बंद)/i.test(trimmed)) {
        const isOff = /(off|band|बंद|bujhana)/i.test(trimmed);
        setLastUserTranscript(trimmed);
        const res = await deviceExecutorRef.current?.toggleFlashlight(!isOff);
        const reply = res?.message || (!isOff ? 'टॉर्च चालू कर दी है, बॉस।' : 'टॉर्च बंद कर दी है, बॉस।');
        setLastModelTranscript(reply);
        if (audioEngineRef.current) {
          setState('SPEAKING');
          await audioEngineRef.current.speakTextWithFallback(reply, currentVoice);
        }
        return;
      }

      // 7. Voice command for Screenshot (Safe Tier 1 - Direct screen capture)
      if (/(screenshot|स्क्रीनशॉट) (le lo|kheecho|kheench|capture|take|nikalo)/i.test(trimmed) || /^(screenshot|स्क्रीनशॉट)$/i.test(trimmed)) {
        setLastUserTranscript(trimmed);
        const res = await deviceExecutorRef.current?.takeScreenshot();
        const reply = res?.message || 'स्क्रीनशॉट ले लिया गया है, बॉस।';
        setLastModelTranscript(reply);
        if (audioEngineRef.current) {
          setState('SPEAKING');
          await audioEngineRef.current.speakTextWithFallback(reply, currentVoice);
        }
        return;
      }

      // 8. Voice command for Offline Song (Safe Tier 1 - Local Library Playback with honest not-found)
      if (/(gaana lagao|gaana bajao|song lagao|song bajao|offline wala song|offline song|offline gaana)/i.test(trimmed)) {
        setLastUserTranscript(trimmed);
        const songQuery = trimmed
          .replace(/(gaana lagao|gaana bajao|song lagao|song bajao|offline wala song|offline song|offline gaana|wala|sunao|chalao|karo|baja)/gi, '')
          .trim() || 'Iron Man';
        const res = await deviceExecutorRef.current?.playOfflineSong(songQuery);
        const reply = res?.message || `बॉस, ऑफलाइन गाना चला दिया है।`;
        setLastModelTranscript(reply);
        if (audioEngineRef.current) {
          setState('SPEAKING');
          await audioEngineRef.current.speakTextWithFallback(reply, currentVoice);
        }
        return;
      }

      // 9. Voice command for Play Store Search (Safe Tier 1 - Results displayed, manual install)
      const playStoreRegex = /play store (?:pe|par)? (.+) (?:search karo|dhundo|kholo|dikhao)/i;
      const playStoreMatch = trimmed.match(playStoreRegex) || trimmed.match(/search (.+) on play store/i);
      if (playStoreMatch) {
        const query = playStoreMatch[1].trim();
        setLastUserTranscript(trimmed);
        const res = await deviceExecutorRef.current?.searchPlayStore(query);
        const reply = res?.message || `Boss, Play Store pe "${query}" ke results dikha diye, jo pasand aaye wo aap khud install kar lena.`;
        setLastModelTranscript(reply);
        if (audioEngineRef.current) {
          setState('SPEAKING');
          await audioEngineRef.current.speakTextWithFallback(reply, currentVoice);
        }
        return;
      }

      try {
        setState('THINKING');
        setLastUserTranscript(trimmed);

        // Pause wake-word while processing
        if (wakeWordRef.current) {
          wakeWordRef.current.pause();
          wakeWordRef.current.stopCommandListening();
        }

        // Capture screen frame if Screen Awareness is enabled
        let screenImage: string | null = null;
        if (isScreenAwarenessOn) {
          screenImage = screenAwareness.captureFrame();
        }

        detectAndSaveUserFact(trimmed);
        const memoryObj = getAllFactsObject();

        const response = await fetch(getApiUrl('/api/diablo/converse'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: trimmed,
            voice: currentVoice,
            memory: memoryObj,
            history: historyRef.current.slice(-6),
            screenImage: screenImage || undefined,
            activeLanguage: activeLanguage || undefined,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP Error ${response.status}`);
        }

        const data = await response.json();

        // 1. Execute any function calls safely
        if (Array.isArray(data.functionCalls) && data.functionCalls.length > 0) {
          const executor = deviceExecutorRef.current;
          if (executor) {
            for (const call of data.functionCalls) {
              if (call.name === 'openApp') await executor.openApp(call.args?.appName);
              else if (call.name === 'searchYoutube') await executor.searchYoutube(call.args?.query);
              else if (call.name === 'sendWhatsappMessage') await executor.sendWhatsappMessage(call.args?.contactName, call.args?.message);
              else if (call.name === 'shareLiveLocation') await executor.shareLiveLocation();
              else if (call.name === 'openAppSettings') await executor.openAppSettings(call.args?.appName);
              else if (call.name === 'checkAppUpdates') await executor.checkAppUpdates(call.args?.appName);
              else if (call.name === 'callContact') await executor.callContact(call.args?.contactName);
              else if (call.name === 'toggleAirplaneMode') await executor.toggleAirplaneMode(call.args?.enable);
              else if (call.name === 'toggleBluetooth') await executor.toggleBluetooth(call.args?.enable);
              else if (call.name === 'toggleWifi') await executor.toggleWifi(call.args?.enable);
              else if (call.name === 'toggleFlashlight') await executor.toggleFlashlight(call.args?.enable);
              else if (call.name === 'takeScreenshot') await executor.takeScreenshot();
              else if (call.name === 'playOfflineSong') await executor.playOfflineSong(call.args?.songName);
              else if (call.name === 'searchPlayStore') await executor.searchPlayStore(call.args?.query);
              else if (call.name === 'translateAndPrepareMessage') {
                const prep = await executor.translateAndPrepareMessage(
                  call.args?.spokenText,
                  call.args?.sourceLanguage,
                  call.args?.targetLanguage,
                  call.args?.appName,
                  call.args?.translatedText
                );
                if (prep?.success) {
                  setPreparedMessage({
                    spokenText: call.args?.spokenText,
                    sourceLanguage: call.args?.sourceLanguage || 'Odia',
                    targetLanguage: call.args?.targetLanguage || 'English',
                    appName: call.args?.appName || 'WhatsApp',
                    translatedText: prep.translatedText,
                    composeUrl: prep.composeUrl,
                    timestamp: Date.now(),
                  });
                }
              }
              else if (call.name === 'saveUserFact') {
                await persistFactRef.current(call.args?.factKey, call.args?.factValue);
              }
            }
          }
        }

        // 2. Set transcripts & memory history
        const replyText = data.text || 'At your command, Boss.';
        setLastModelTranscript(replyText);
        historyRef.current.push({ role: 'user', text: trimmed });
        historyRef.current.push({ role: 'assistant', text: replyText });

        if (currentUser) {
          saveConversationTurnToFirestore(currentUser.uid, 'user', trimmed);
          saveConversationTurnToFirestore(currentUser.uid, 'assistant', replyText);
        }

        // 3. Play generated 24kHz audio via AudioEngine or fallback to Web Speech Synthesis
        if (data.audio && audioEngineRef.current) {
          setState('SPEAKING');
          await audioEngineRef.current.playBase64Chunk(data.audio);
        } else if (audioEngineRef.current && replyText) {
          setState('SPEAKING');
          await audioEngineRef.current.speakTextWithFallback(replyText, currentVoice);
        } else {
          // Reset to IDLE if audio wasn't generated and speech synthesis unavailable
          setTimeout(() => {
            setState('IDLE');
            if (isWakeWordActive && wakeWordRef.current) {
              wakeWordRef.current.start();
            }
          }, 1500);
        }
      } catch (err: any) {
        console.error('[Diablo App] Voice query error:', err.message || err);
        setLastModelTranscript('Communication channel momentarily disrupted, Boss.');
        setState('IDLE');
        if (isWakeWordActive && wakeWordRef.current) {
          wakeWordRef.current.start();
        }
      }
    },
    [isPowerOn, currentVoice, isWakeWordActive, activeLanguage, translationPrepMode]
  );

  // 3. Audio Engine Callbacks setup
  useEffect(() => {
    const audio = audioEngineRef.current;
    if (!audio) return;

    audio.onMicVolume = (vol) => {
      setMicVolume(vol);
    };

    audio.onPlaybackStart = () => {
      setState('SPEAKING');
    };

    audio.onPlaybackEnd = () => {
      setState((prevState) => (prevState === 'SPEAKING' ? 'IDLE' : prevState));
      if (isWakeWordActive && wakeWordRef.current) {
        wakeWordRef.current.start();
      }
    };

    // BARGE-IN INTERRUPTION HANDLER
    audio.onBargeIn = () => {
      console.log('[Diablo App] BARGE-IN detected! Stopping Diablo speech immediately');
      setState('LISTENING');
      setLastUserTranscript('Listening to Boss...');
      if (wakeWordRef.current) {
        wakeWordRef.current.startCommandListening();
      }
    };
  }, [isWakeWordActive]);

  // 4. Start active conversation session (Wake Word or manual Tap)
  const activateDiablo = useCallback(
    async (phrase?: string, directCommand?: string) => {
      if (!isPowerOn) return;

      try {
        setLinkErrorMessage(null);
        setState('LISTENING');
        setLastUserTranscript(phrase || 'Listening to Boss...');
        setLastModelTranscript('');

        // 1. Ensure AudioContext is initialized/unlocked
        if (audioEngineRef.current) {
          await audioEngineRef.current.ensureContexts();
          await audioEngineRef.current.playWakeWordChime();
        }

        // 2. Start microphone capture (gracefully handles permission denial)
        let micSuccess = false;
        if (audioEngineRef.current) {
          micSuccess = await audioEngineRef.current.startMicrophone();
        }
        if (!micSuccess) {
          setMicPermissionDenied(true);
        } else {
          setMicPermissionDenied(false);
        }

        // 3. Connect Gemini Live WebSocket session with try-catch
        const live = liveClientRef.current;
        if (live && live.getStatus() !== 'CONNECTED') {
          console.log('[Diablo App] Initiating live.connect() sequence...');
          setState('CONNECTING');
          setLinkErrorMessage(null);

          const memoryObj = getAllFactsObject();
          console.log('[Diablo App] Connecting Gemini Live with full persistent memory:', Object.keys(memoryObj).length, 'facts');

          try {
            await live.connect({
              voice: currentVoice,
              memory: memoryObj,
              activeLanguage: activeLanguage || undefined,
            });
            console.log('[Diablo App] live.connect() sequence completed successfully.');
            setLinkErrorMessage(null);
            setState('LISTENING');
          } catch (connectErr: any) {
            const exactMsg = connectErr?.message || String(connectErr);
            if (/401|unauthorized|api[ _]?key|API_KEY_INVALID/i.test(exactMsg)) {
              console.error('[Diablo App] live.connect() authentication failure:', exactMsg);
              setLinkErrorMessage(exactMsg);
              setState('ERROR');
              setLastModelTranscript(`Link Diagnostic: ${exactMsg}`);
              return;
            } else {
              console.log('[Diablo App] Live WebSocket link bypassed; running on high-speed audio pipeline.');
              setLinkErrorMessage(null);
              setState('LISTENING');
            }
          }
        } else {
          setState('LISTENING');
        }

        // 4. If an immediate command was uttered (e.g. "Diablo open YouTube")
        if (directCommand && directCommand.trim()) {
          if (live && live.getStatus() === 'CONNECTED') {
            setLastUserTranscript(directCommand);
            live.sendText(directCommand);
          } else {
            await executeVoiceQuery(directCommand);
          }
        }
      } catch (err: any) {
        const errMsg = err?.message || 'Failed to initialize microphone or link';
        const isPermissionIssue = /permission|notallowed|denied/i.test(errMsg);
        if (isPermissionIssue) {
          console.warn('[Diablo App] Activation notice (microphone permission not granted):', errMsg);
          setMicPermissionDenied(true);
        } else {
          console.warn('[Diablo App] Activation notice:', errMsg);
          setLinkErrorMessage(errMsg);
        }
        setState('IDLE');
      }
    },
    [isPowerOn, currentVoice, currentUser, facts, executeVoiceQuery, activeLanguage]
  );

  // 5. Wake Word & Active Command Setup
  useEffect(() => {
    const detector = wakeWordRef.current;
    if (!detector) return;

    detector.onWakeWord = (_matched, fullTranscript, commandPart) => {
      console.log('[Diablo App] Wake word fired:', fullTranscript, commandPart);
      activateDiablo(undefined, commandPart);
    };

    detector.onInterimCommand = (transcript) => {
      setLastUserTranscript(transcript);
    };

    detector.onFinalCommand = (command) => {
      executeVoiceQuery(command);
    };

    detector.onError = (err) => {
      if (err?.error === 'not-allowed') {
        setMicPermissionDenied(true);
      }
    };

    if (isPowerOn && isWakeWordActive && state === 'IDLE') {
      detector.start();
    } else if (!isPowerOn || !isWakeWordActive) {
      detector.stop();
    }
  }, [isPowerOn, isWakeWordActive, state, activateDiablo, executeVoiceQuery]);

  // 6. Handle Core Click (User taps the central Diablo icon)
  const handleCoreClick = async () => {
    if (!isPowerOn) {
      setIsPowerOn(true);
    }

    if (state === 'ERROR') {
      // User tapped core in error state -> reconnect cleanly
      setLinkErrorMessage(null);
      await activateDiablo('Reconnecting to Diablo...');
      return;
    }

    if (state === 'SPEAKING') {
      // User tapped while Diablo is speaking -> Barge-in cancel!
      if (liveClientRef.current && liveClientRef.current.getStatus() === 'CONNECTED') {
        liveClientRef.current.sendInterrupt();
      }
      if (audioEngineRef.current) {
        audioEngineRef.current.clearQueueAndStop();
      }
      setState('LISTENING');
      setLastUserTranscript('Listening to Boss...');
      if (wakeWordRef.current) {
        wakeWordRef.current.startCommandListening();
      }
      return;
    }

    if (state === 'LISTENING') {
      // Tapping while listening returns to idle
      if (audioEngineRef.current) {
        audioEngineRef.current.stopMicrophone();
      }
      if (wakeWordRef.current) {
        wakeWordRef.current.stopCommandListening();
      }
      setState('IDLE');
      if (isWakeWordActive && wakeWordRef.current) {
        wakeWordRef.current.start();
      }
      return;
    }

    // Activate Diablo immediately
    await activateDiablo('User tapped Diablo core');
  };

  // 7. Master Power Toggle
  const handlePowerToggle = () => {
    if (isPowerOn) {
      setIsPowerOn(false);
      setState('IDLE');
      setLinkErrorMessage(null);
      if (liveClientRef.current) {
        liveClientRef.current.disconnect();
      }
      if (audioEngineRef.current) {
        audioEngineRef.current.clearQueueAndStop();
        audioEngineRef.current.stopMicrophone();
      }
      if (wakeWordRef.current) {
        wakeWordRef.current.stop();
      }
    } else {
      setIsPowerOn(true);
      if (audioEngineRef.current) {
        audioEngineRef.current.ensureContexts();
      }
      if (isWakeWordActive && wakeWordRef.current) {
        wakeWordRef.current.start();
      }
    }
  };

  // 9. Custom Avatar Handlers
  const handleAvatarUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        MemoryStorage.setCustomAvatar(dataUrl);
        setCustomAvatar(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarReset = () => {
    MemoryStorage.setCustomAvatar(null);
    setCustomAvatar(null);
  };

  // 10. Voice Selection Handler
  const handleSelectVoice = (gender: VoiceGender) => {
    MemoryStorage.setVoice(gender);
    setCurrentVoice(gender);
    setShowVoiceModal(false);
    if (audioEngineRef.current) {
      audioEngineRef.current.ensureContexts();
    }
  };

  // Language Protocol Handler
  const handleSelectLanguage = (langName: string | null) => {
    setActiveLanguage(langName);
    if (wakeWordRef.current) {
      wakeWordRef.current.setLanguage(langName);
    }
  };

  // 11. Test Speaker diagnostic
  const handleTestSpeaker = async () => {
    if (audioEngineRef.current) {
      await audioEngineRef.current.testSpeaker();
    }
  };

  // 12. Quick Query Submit
  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;
    const q = quickInput.trim();
    setQuickInput('');

    detectAndSaveUserFact(q);

    if (liveClientRef.current && liveClientRef.current.getStatus() === 'CONNECTED') {
      setLastUserTranscript(q);
      setLastModelTranscript('');
      liveClientRef.current.sendText(q);
    } else {
      executeVoiceQuery(q);
    }
  };

  const SUGGESTED_COMMANDS = [
    'टॉर्च ऑन करो',
    'screenshot ले लो',
    'ऑफलाइन गाना लगाओ',
    'airplane mode ऑन करो',
    'Play Store पे car game सर्च करो',
    'Who created you?',
    'मेरी कार Audi R8 है',
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] flex flex-col justify-between selection:bg-[#FF4D00] selection:text-black relative overflow-x-hidden font-sans">
      {/* Background Holographic Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[540px] rounded-full bg-[#FF4D00]/8 blur-[140px]" />
        <div className="absolute bottom-10 right-1/4 w-[380px] h-[380px] rounded-full bg-[#ff7733]/5 blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_75%,transparent_100%)]" />
      </div>

      {/* TOP HEADER BAR */}
      <header className="relative z-20 w-full max-w-2xl mx-auto px-4 pt-6 pb-2 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#0f0f0f] border border-[#262626] flex items-center justify-center shadow-[0_0_15px_rgba(255,77,0,0.15)]">
            <Shield className="w-4 h-4 text-[#FF4D00]" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-widest uppercase text-white flex items-center space-x-2">
              <span>DIABLO</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FF4D00]/15 text-[#FF4D00] font-mono font-normal border border-[#FF4D00]/30">
                LIVE
              </span>
            </h1>
            <div className="text-[10px] font-mono text-[#888888]">
              JARVIS-STYLE REAL-TIME VOICE PROTOCOL
            </div>
          </div>
        </div>

        {/* Master Power Switch, Voice Badge, Battery Status, and Screen Awareness */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          {/* Connecting or Link Failure Indicator */}
          {(state === 'CONNECTING' || liveStatus === 'CONNECTING') && !linkErrorMessage && (
            <div
              id="live-connecting-indicator"
              className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-[#FF4D00]/10 border border-[#FF4D00]/30 text-[#FF4D00] text-[10px] font-mono animate-pulse"
              title="Establishing secure link with Gemini Live..."
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF4D00] animate-ping" />
              <span>Connecting...</span>
            </div>
          )}

          {linkErrorMessage && (state === 'ERROR' || liveStatus === 'ERROR') && (
            <button
              type="button"
              id="live-error-indicator"
              onClick={() => activateDiablo('Reconnecting Diablo link')}
              className="flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-red-950/80 border border-red-500/60 text-red-300 text-[10px] font-mono hover:border-red-400 max-w-[190px] sm:max-w-xs transition-colors truncate"
              title={`Connection Failure: ${linkErrorMessage}. Click to retry.`}
            >
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span className="truncate">{linkErrorMessage}</span>
            </button>
          )}

          {/* Language Protocol Badge */}
          <button
            type="button"
            id="language-protocol-badge"
            onClick={() => setShowLangModal(true)}
            className={`text-[11px] font-mono px-2 py-1 rounded-lg border transition-colors flex items-center space-x-1 ${
              activeLanguage
                ? 'bg-orange-500/20 border-orange-500/60 text-orange-300 shadow-[0_0_10px_rgba(255,77,0,0.25)]'
                : 'bg-[#0f0f0f] border-[#222222] text-[#d0d0d0] hover:text-white hover:border-[#FF4D00]/40'
            }`}
            title={`Active Language Protocol: ${activeLanguage || 'Hindi (Default)'}. Tap to change or reset.`}
          >
            <Globe className={`w-3 h-3 ${activeLanguage ? 'text-orange-400' : 'text-zinc-400'}`} />
            <span className="max-w-[70px] truncate">{activeLanguage || 'Hindi'}</span>
          </button>

          {/* Voice Profile Badge */}
          <button
            type="button"
            id="voice-profile-badge"
            onClick={() => setShowVoiceModal(true)}
            className="text-[11px] font-mono px-2 py-1 rounded-lg bg-[#0f0f0f] border border-[#222222] text-[#d0d0d0] hover:text-white hover:border-[#FF4D00]/40 transition-colors flex items-center space-x-1"
            title="Change voice profile"
          >
            <Sparkles className="w-3 h-3 text-[#FF4D00] mr-0.5" />
            <span>{currentVoice}</span>
          </button>

          {/* Battery Status API Badge */}
          <div
            id="device-battery-badge"
            className="text-[11px] font-mono px-2 py-1 rounded-lg bg-[#0f0f0f] border border-[#222222] text-[#d0d0d0] flex items-center space-x-1 shadow-sm"
            title={battery.charging ? 'Device Charging' : `Device Battery: ${battery.level}%`}
          >
            {battery.charging ? (
              <BatteryCharging className="w-3.5 h-3.5 text-green-400 animate-pulse" />
            ) : battery.level <= 20 ? (
              <BatteryLow className="w-3.5 h-3.5 text-red-400" />
            ) : battery.level <= 50 ? (
              <BatteryMedium className="w-3.5 h-3.5 text-yellow-400" />
            ) : (
              <Battery className="w-3.5 h-3.5 text-[#FF4D00]" />
            )}
            <span>{battery.level}%</span>
          </div>

          {/* Firebase Google Auth Profile / Sign-In Button */}
          {currentUser ? (
            <button
              type="button"
              id="firebase-user-profile-btn"
              onClick={handleSignOut}
              className="text-[11px] font-mono px-2 py-1 rounded-lg bg-[#0f0f0f] border border-emerald-500/40 text-emerald-300 hover:border-red-500/40 hover:text-red-300 transition-colors flex items-center space-x-1.5 shadow-sm"
              title={`Logged in as ${currentUser.email || currentUser.displayName} (Private Cloud Memory Active). Tap to sign out.`}
            >
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt="User Avatar"
                  className="w-3.5 h-3.5 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span className="max-w-[65px] truncate hidden sm:inline">
                {currentUser.displayName?.split(' ')[0] || currentUser.email?.split('@')[0]}
              </span>
              <LogOut className="w-3 h-3 opacity-60 ml-0.5" />
            </button>
          ) : (
            <button
              type="button"
              id="firebase-google-signin-btn"
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              className="text-[11px] font-mono px-2 py-1 rounded-lg bg-[#FF4D00]/15 border border-[#FF4D00]/40 text-[#FF4D00] hover:bg-[#FF4D00]/25 transition-colors flex items-center space-x-1 shadow-[0_0_10px_rgba(255,77,0,0.2)]"
              title="Sign in with Google to enable isolated Cloud Firestore memory"
            >
              <LogIn className="w-3.5 h-3.5 text-[#FF4D00]" />
              <span className="hidden sm:inline">{isSigningIn ? 'Connecting...' : 'Sign In'}</span>
            </button>
          )}

          {/* Screen Awareness Mode Toggle */}
          <button
            type="button"
            id="screen-awareness-toggle"
            onClick={() => toggleScreenAwareness()}
            className={`text-[11px] font-mono px-2 py-1 rounded-lg border transition-colors flex items-center space-x-1 ${
              isScreenAwarenessOn
                ? 'bg-[#00d2ff]/15 border-[#00d2ff]/60 text-[#38e1ff] shadow-[0_0_12px_rgba(0,210,255,0.35)]'
                : 'bg-[#0f0f0f] border-[#222222] text-[#777777] hover:text-[#d0d0d0] hover:border-[#444]'
            }`}
            title="Screen Awareness Mode (Requires explicit system permission)"
          >
            {isScreenAwarenessOn ? (
              <Eye className="w-3.5 h-3.5 text-[#00d2ff]" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Screen</span>
          </button>

          <button
            type="button"
            id="master-power-toggle"
            onClick={handlePowerToggle}
            className={`p-2 rounded-xl border transition-all duration-300 flex items-center justify-center ${
              isPowerOn
                ? 'bg-[#FF4D00]/15 border-[#FF4D00]/70 text-[#FF4D00] shadow-[0_0_15px_rgba(255,77,0,0.25)]'
                : 'bg-[#0f0f0f] border-[#222222] text-[#666666] hover:text-[#aaaaaa]'
            }`}
            title={isPowerOn ? 'Turn Diablo Off' : 'Turn Diablo On'}
          >
            <Power className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Simulated Android Background Persistent Notification & Screen Awareness Status Bar */}
      <div className="relative z-20 w-full max-w-2xl mx-auto px-4 pb-2 flex flex-wrap items-center justify-between gap-2">
        {isPowerOn && isWakeWordActive && (
          <div
            id="android-background-service-notification"
            className="flex items-center space-x-2 text-[10px] font-mono text-[#aaaaaa] bg-[#0c0c0c]/90 border border-[#222222] px-3 py-1 rounded-full shadow-inner"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>BACKGROUND SERVICE ACTIVE • SAY "DIABLO" OR "STOP DIABLO"</span>
          </div>
        )}
        {micPermissionDenied && (
          <div
            id="mic-permission-badge"
            className="flex items-center space-x-2 text-[10px] font-mono text-amber-300 bg-amber-950/80 border border-amber-500/50 px-3 py-1 rounded-full shadow-[0_0_12px_rgba(251,191,36,0.25)]"
          >
            <MicOff className="w-3 h-3 text-amber-400 shrink-0" />
            <span>MIC ACCESS NEEDED</span>
            <button
              type="button"
              onClick={async () => {
                if (audioEngineRef.current) {
                  const granted = await audioEngineRef.current.startMicrophone();
                  if (granted) {
                    setMicPermissionDenied(false);
                    activateDiablo('Microphone access enabled');
                  }
                }
              }}
              className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold text-[9px] transition-colors"
            >
              ENABLE
            </button>
            <button
              type="button"
              onClick={() => setMicPermissionDenied(false)}
              className="ml-1 text-amber-400/80 hover:text-white"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        )}
        {isScreenAwarenessOn && (
          <div
            id="screen-awareness-persistent-badge"
            className="flex items-center space-x-1.5 text-[10px] font-mono text-[#38e1ff] bg-cyan-950/70 border border-cyan-500/50 px-3 py-1 rounded-full shadow-[0_0_10px_rgba(0,210,255,0.25)]"
          >
            <Eye className="w-3 h-3 text-[#00d2ff]" />
            <span>SCREEN AWARENESS ACTIVE</span>
            <button
              type="button"
              onClick={() => toggleScreenAwareness(false)}
              className="ml-1 text-cyan-400 hover:text-white"
              title="Stop screen awareness"
            >
              ✕
            </button>
          </div>
        )}
        {isFlashlightActive && (
          <div
            id="flashlight-persistent-badge"
            className="flex items-center space-x-1.5 text-[10px] font-mono text-amber-300 bg-amber-950/70 border border-amber-500/50 px-3 py-1 rounded-full shadow-[0_0_12px_rgba(251,191,36,0.3)] animate-pulse"
          >
            <Flashlight className="w-3 h-3 text-amber-400" />
            <span>FLASHLIGHT ACTIVE</span>
            <button
              type="button"
              onClick={() => deviceExecutorRef.current?.toggleFlashlight(false)}
              className="ml-1 text-amber-400 hover:text-white"
              title="Turn off flashlight"
            >
              ✕
            </button>
          </div>
        )}
        {activeOfflineSong && (
          <div
            id="offline-music-player-bar"
            className="flex items-center space-x-2 text-[10px] font-mono text-orange-200 bg-[#160c04] border border-[#ff4d00]/40 px-3 py-1.5 rounded-full shadow-[0_0_10px_rgba(255,77,0,0.2)]"
          >
            <Music className="w-3 h-3 text-[#ff4d00] animate-pulse" />
            <span className="font-semibold text-white truncate max-w-[130px] sm:max-w-[180px]">
              {activeOfflineSong.title}
            </span>
            <button
              type="button"
              onClick={() => {
                if (isOfflinePlaying) offlineMusic.pausePlayback();
                else offlineMusic.playSong(activeOfflineSong);
              }}
              className="p-1 text-white hover:text-[#ff4d00]"
              title={isOfflinePlaying ? 'Pause' : 'Play'}
            >
              {isOfflinePlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </button>
            <button
              type="button"
              onClick={() => offlineMusic.stopPlayback()}
              className="p-1 text-[#888888] hover:text-red-400"
              title="Stop playback"
            >
              <Square className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Screenshot Preview Modal */}
      {screenshotPreview && (
        <div
          id="screenshot-preview-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div className="relative max-w-lg w-full bg-[#0d0d0d] border border-[#ff4d00]/60 rounded-2xl p-4 shadow-[0_0_30px_rgba(255,77,0,0.3)]">
            <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
              <div className="flex items-center space-x-2 text-[#ff4d00] font-mono text-xs font-bold">
                <Camera className="w-4 h-4" />
                <span>SCREENSHOT CAPTURED • DIRECT LOCAL CAPTURE</span>
              </div>
              <button
                type="button"
                onClick={() => setScreenshotPreview(null)}
                className="text-[#888888] hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="my-3 overflow-hidden rounded-lg border border-[#262626] bg-black">
              <img
                src={screenshotPreview}
                alt="Screenshot Preview"
                className="w-full max-h-64 object-contain"
              />
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#888888] text-[11px]">Direct capture completed</span>
              <div className="flex space-x-2">
                <a
                  href={screenshotPreview}
                  download={`diablo-screenshot-${Date.now()}.png`}
                  className="px-3 py-1.5 rounded-lg bg-[#ff4d00] text-black font-bold flex items-center space-x-1 hover:bg-[#ff661f] transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setScreenshotPreview(null)}
                  className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] text-[#cccccc] hover:bg-[#252525] transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN VIEW: CIRCULAR ICON INTERFACE */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4">
        {/* Connection Failure Diagnostic Banner */}
        {linkErrorMessage && (state === 'ERROR' || liveStatus === 'ERROR') && (
          <div
            id="connection-error-banner"
            className="w-full max-w-md mb-4 p-3.5 rounded-xl bg-red-950/80 border border-red-500/60 backdrop-blur-md text-red-200 text-xs font-mono shadow-2xl flex items-start space-x-3"
          >
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-red-300 uppercase tracking-wider text-[10px] mb-1 flex items-center justify-between">
                <span>Link Connection Diagnostic</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-900/60 text-red-300 border border-red-500/30">ERROR</span>
              </div>
              <p className="text-red-100 leading-relaxed break-words text-[11px] mb-2 font-mono">
                {linkErrorMessage}
              </p>
              <button
                type="button"
                id="retry-connect-btn"
                onClick={() => activateDiablo('Reconnecting Diablo link')}
                className="inline-flex items-center px-3 py-1 rounded-md bg-red-900/80 hover:bg-red-800 text-white text-[10px] font-mono uppercase tracking-wider border border-red-500/50 transition-colors shadow"
              >
                Retry Link Connection
              </button>
            </div>
          </div>
        )}

        <DiabloReactorCore
          state={!isPowerOn ? 'IDLE' : state}
          isWakeWordActive={isPowerOn && isWakeWordActive}
          micVolume={micVolume}
          customAvatar={customAvatar}
          errorMessage={linkErrorMessage || undefined}
          onAvatarUpload={handleAvatarUpload}
          onAvatarReset={handleAvatarReset}
          onCoreClick={handleCoreClick}
          visualizerData={visualizerData}
        />

        {/* Active Speak-To-Translate Listening Indicator */}
        {translationPrepMode?.active && (
          <div
            id="translation-prep-banner"
            className="w-full max-w-md my-2 p-3 rounded-xl bg-orange-950/40 border border-orange-500/50 text-orange-200 text-xs font-mono shadow-lg flex items-center justify-between animate-pulse"
          >
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping" />
              <span>
                LISTENING IN <strong>{translationPrepMode.sourceLanguage.toUpperCase()}</strong> → PRE-FILL {translationPrepMode.appName.toUpperCase()}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setTranslationPrepMode(null)}
              className="text-orange-400 hover:text-white text-[11px]"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Prepared Message Card (WhatsApp / Messaging) */}
        {preparedMessage && (
          <PreparedMessageCard
            info={preparedMessage}
            onDismiss={() => setPreparedMessage(null)}
          />
        )}

        {/* Real-time speech response preview bubble */}
        {(lastModelTranscript || lastUserTranscript) && (
          <div className="w-full max-w-md mt-3 px-4 text-center">
            <div className="p-3 rounded-2xl bg-[#0d0d0d]/90 border border-[#262626] backdrop-blur-md text-xs font-mono shadow-xl">
              {lastUserTranscript && (
                <div className="text-[#888888] mb-1 line-clamp-1">
                  Boss: <span className="text-[#d5d5d5]">"{lastUserTranscript}"</span>
                </div>
              )}
              {lastModelTranscript && (
                <div className="text-[#FF661F] font-semibold line-clamp-2">
                  Diablo: "{lastModelTranscript}"
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Voice / Text Command Bar */}
        <div className="w-full max-w-md mt-4 px-4">
          <form onSubmit={handleQuickSubmit} className="relative flex items-center">
            <input
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder="बोलें 'डियाब्लो' या टाइप करें (e.g. 'YouTube खोलो' or 'Who are you?')..."
              className="w-full bg-[#0a0a0a]/90 border border-[#262626] focus:border-[#FF4D00] focus:ring-1 focus:ring-[#FF4D00]/50 rounded-xl px-4 py-2.5 text-xs text-[#e0e0e0] placeholder-[#555] font-mono outline-none transition-all pr-10"
            />
            <button
              type="submit"
              aria-label="Send command"
              className="absolute right-2 p-1.5 rounded-lg bg-[#141414] hover:bg-[#FF4D00] text-[#888] hover:text-black transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Prompt chips */}
          <div className="flex flex-wrap gap-1.5 justify-center mt-2">
            {SUGGESTED_COMMANDS.map((cmd) => (
              <button
                key={cmd}
                type="button"
                onClick={() => executeVoiceQuery(cmd)}
                className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-[#0d0d0d] hover:bg-[#181818] border border-[#222] hover:border-[#FF4D00]/50 text-[#888] hover:text-[#FF4D00] transition-colors"
              >
                {cmd}
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* BOTTOM HUD CONSOLE DRAWER */}
      <footer className="relative z-20 pb-6">
        <HUDConsole
          currentVoice={currentVoice}
          onVoiceChange={(v) => {
            MemoryStorage.setVoice(v);
            setCurrentVoice(v);
          }}
          isWakeWordEnabled={isWakeWordActive}
          onToggleWakeWord={(enabled) => {
            MemoryStorage.setWakeWordEnabled(enabled);
            setIsWakeWordActive(enabled);
          }}
          onTestSpeaker={handleTestSpeaker}
          facts={facts}
          onAddFact={handleAddFact}
          onDeleteFact={handleDeleteFact}
          contacts={contacts}
          onAddContact={(n, p, r) => setContacts(MemoryStorage.addContact(n, p, r))}
          onDeleteContact={(id) => setContacts(MemoryStorage.deleteContact(id))}
          actionLogs={actionLogs}
          lastUserTranscript={lastUserTranscript}
          lastModelTranscript={lastModelTranscript}
          linkErrorMessage={linkErrorMessage}
          liveStatus={liveStatus}
          currentUser={currentUser}
          onGoogleSignIn={handleGoogleSignIn}
          onExecuteTool={async (toolName, args) => {
            const ex = deviceExecutorRef.current;
            if (!ex) return;
            let res: any;
            if (toolName === 'toggleAirplaneMode') res = await ex.toggleAirplaneMode(args?.enable);
            else if (toolName === 'toggleBluetooth') res = await ex.toggleBluetooth(args?.enable);
            else if (toolName === 'toggleWifi') res = await ex.toggleWifi(args?.enable);
            else if (toolName === 'toggleFlashlight') res = await ex.toggleFlashlight(args?.enable);
            else if (toolName === 'takeScreenshot') res = await ex.takeScreenshot();
            else if (toolName === 'playOfflineSong') res = await ex.playOfflineSong(args?.songName);
            else if (toolName === 'searchPlayStore') res = await ex.searchPlayStore(args?.query);
            if (res?.message) {
              setLastModelTranscript(res.message);
              if (audioEngineRef.current) {
                audioEngineRef.current.speakTextWithFallback(res.message, currentVoice);
              }
            }
          }}
        />
      </footer>

      {/* Action Confirmation Modal (for manual user tap security rule) */}
      <ActionConfirmationDialog confirmation={pendingConfirmation} />

      {/* Voice Selection Onboarding Modal */}
      <VoiceSelectionModal
        isOpen={showVoiceModal}
        onSelectVoice={handleSelectVoice}
        onPlaySampleTone={handleTestSpeaker}
      />

      {/* Language Protocol Selector Modal */}
      <LanguageSelectorModal
        isOpen={showLangModal}
        activeLanguage={activeLanguage}
        onSelectLanguage={handleSelectLanguage}
        onClose={() => setShowLangModal(false)}
      />
    </div>
  );
}
