export type AssistantState =
  | 'IDLE'
  | 'CONNECTING'
  | 'LISTENING'
  | 'SPEAKING'
  | 'ERROR';

export type VoiceGender = 'Male' | 'Female';

export interface UserFact {
  id: string;
  key: string;
  value: string;
  updatedAt: number | string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  relationship?: string;
}

export interface DeviceActionLog {
  id: string;
  toolName: string;
  args: Record<string, any>;
  result: Record<string, any>;
  timestamp: number;
  status: 'success' | 'failed' | 'requires_tap';
}

export interface PendingConfirmation {
  id: string;
  title: string;
  description: string;
  actionType: 'open_settings' | 'check_updates' | 'contact_choice';
  payload: any;
  options?: { label: string; value: any }[];
  onConfirm: (choice?: any) => void;
  onCancel: () => void;
}

export interface AndroidBridgeInterface {
  openApp?: (appName: string) => boolean;
  searchYoutube?: (query: string) => boolean;
  sendWhatsappMessage?: (phone: string, message: string) => boolean;
  makeCall?: (phone: string) => boolean;
  getLiveLocation?: () => string;
  openSettings?: (appName?: string) => boolean;
  openAirplaneModeSettings?: () => boolean;
  openBluetoothSettings?: () => boolean;
  openWifiSettings?: () => boolean;
  toggleFlashlight?: (enable?: boolean) => boolean;
  takeScreenshot?: () => string | boolean;
  playOfflineSong?: (songName: string) => boolean;
  searchPlayStore?: (query: string) => boolean;
  prepareMessage?: (appName: string, text: string) => boolean;
  isAndroidBridgeAvailable?: () => boolean;
}

export interface PreparedMessageInfo {
  spokenText: string;
  sourceLanguage: string;
  targetLanguage: string;
  appName: string;
  translatedText: string;
  composeUrl?: string;
  timestamp: number;
}

export interface OfflineSong {
  id: string;
  title: string;
  artist: string;
  genre: string;
  duration: string;
  url?: string;
  isCustom?: boolean;
}

declare global {
  interface Window {
    AndroidBridge?: AndroidBridgeInterface;
    Android?: AndroidBridgeInterface;
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}
