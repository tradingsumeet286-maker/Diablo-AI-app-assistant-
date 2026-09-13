import { Contact, UserFact, VoiceGender } from '../types';

const STORAGE_KEYS = {
  VOICE: 'diablo_voice_gender',
  ONBOARDED: 'diablo_onboarded',
  AVATAR: 'diablo_custom_avatar',
  FACTS: 'diablo_user_facts',
  CONTACTS: 'diablo_contacts',
  WAKE_WORD_ENABLED: 'diablo_wake_word_enabled',
};

const INITIAL_FACTS: UserFact[] = [
  { id: 'fact-1', key: 'Boss Name', value: 'Tony Stark', updatedAt: Date.now() },
  { id: 'fact-2', key: 'City / Base', value: 'Malibu / Mumbai', updatedAt: Date.now() },
  { id: 'fact-3', key: 'Vehicle', value: 'Audi R8 e-tron', updatedAt: Date.now() },
  { id: 'fact-4', key: 'Languages', value: 'Hindi, English, Hinglish', updatedAt: Date.now() },
  { id: 'fact-5', key: 'Directives', value: 'Calm, sharp, loyal Jarvis style', updatedAt: Date.now() },
];

const INITIAL_CONTACTS: Contact[] = [
  { id: 'c-1', name: 'Pepper Potts', phone: '+15550199', relationship: 'Executive' },
  { id: 'c-2', name: 'Colonel Rhodes', phone: '+15550144', relationship: 'Tactical' },
  { id: 'c-3', name: 'Happy Hogan', phone: '+15550128', relationship: 'Security' },
  { id: 'c-4', name: 'Jarvis Lab', phone: '+919876543210', relationship: 'Support' },
];

export const MemoryStorage = {
  getVoice(): VoiceGender | null {
    const val = localStorage.getItem(STORAGE_KEYS.VOICE);
    if (val === 'Male' || val === 'Female') return val;
    return null;
  },

  setVoice(voice: VoiceGender) {
    localStorage.setItem(STORAGE_KEYS.VOICE, voice);
    localStorage.setItem(STORAGE_KEYS.ONBOARDED, 'true');
  },

  isOnboarded(): boolean {
    return Boolean(localStorage.getItem(STORAGE_KEYS.ONBOARDED)) && Boolean(this.getVoice());
  },

  getCustomAvatar(): string | null {
    return localStorage.getItem(STORAGE_KEYS.AVATAR);
  },

  setCustomAvatar(dataUrl: string | null) {
    if (dataUrl) {
      localStorage.setItem(STORAGE_KEYS.AVATAR, dataUrl);
    } else {
      localStorage.removeItem(STORAGE_KEYS.AVATAR);
    }
  },

  isWakeWordEnabled(): boolean {
    const val = localStorage.getItem(STORAGE_KEYS.WAKE_WORD_ENABLED);
    return val === null ? true : val === 'true';
  },

  setWakeWordEnabled(enabled: boolean) {
    localStorage.setItem(STORAGE_KEYS.WAKE_WORD_ENABLED, String(enabled));
  },

  getFactsKey(userId?: string | null): string {
    return userId ? `diablo_user_facts_${userId}` : 'diablo_user_facts_guest';
  },

  getFacts(userId?: string | null): UserFact[] {
    const key = this.getFactsKey(userId);
    try {
      const data = localStorage.getItem(key);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
      // Migration fallback: if guest and no data in guest key, check legacy STORAGE_KEYS.FACTS
      if (!userId) {
        const legacyData = localStorage.getItem(STORAGE_KEYS.FACTS);
        if (legacyData) {
          const parsed = JSON.parse(legacyData);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.saveFacts(parsed, null);
            return parsed;
          }
        }
      }
    } catch (e) {
      console.error('Error loading facts from storage:', e);
    }
    // Initialize with default facts
    this.saveFacts(INITIAL_FACTS, userId);
    return INITIAL_FACTS;
  },

  saveFacts(facts: UserFact[], userId?: string | null) {
    const key = this.getFactsKey(userId);
    try {
      localStorage.setItem(key, JSON.stringify(facts));
      if (!userId) {
        localStorage.setItem(STORAGE_KEYS.FACTS, JSON.stringify(facts));
      }
    } catch (e) {
      console.error('Error saving facts:', e);
    }
  },

  addOrUpdateFact(key: string, value: string, userId?: string | null): UserFact[] {
    const facts = this.getFacts(userId);
    const cleanKey = key.trim();
    const cleanVal = value.trim();
    const existingIndex = facts.findIndex(
      (f) => f.key.toLowerCase().trim() === cleanKey.toLowerCase()
    );

    if (existingIndex >= 0) {
      facts[existingIndex] = {
        ...facts[existingIndex],
        value: cleanVal,
        updatedAt: Date.now(),
      };
    } else {
      facts.push({
        id: 'fact-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        key: cleanKey,
        value: cleanVal,
        updatedAt: Date.now(),
      });
    }

    this.saveFacts(facts, userId);
    return facts;
  },

  deleteFact(id: string, userId?: string | null): UserFact[] {
    const facts = this.getFacts(userId).filter((f) => f.id !== id);
    this.saveFacts(facts, userId);
    return facts;
  },

  getFactsObject(userId?: string | null): Record<string, string> {
    const facts = this.getFacts(userId);
    const map: Record<string, string> = {};
    for (const f of facts) {
      if (f.key && f.value) {
        map[f.key.trim()] = f.value.trim();
      }
    }
    return map;
  },

  getContacts(): Contact[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CONTACTS);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Error loading contacts from storage:', e);
    }
    this.saveContacts(INITIAL_CONTACTS);
    return INITIAL_CONTACTS;
  },

  saveContacts(contacts: Contact[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(contacts));
    } catch (e) {
      console.error('Error saving contacts:', e);
    }
  },

  addContact(name: string, phone: string, relationship?: string): Contact[] {
    const contacts = this.getContacts();
    contacts.push({
      id: 'contact-' + Date.now(),
      name: name.trim(),
      phone: phone.trim(),
      relationship: relationship?.trim(),
    });
    this.saveContacts(contacts);
    return contacts;
  },

  deleteContact(id: string): Contact[] {
    const contacts = this.getContacts().filter((c) => c.id !== id);
    this.saveContacts(contacts);
    return contacts;
  },
};
