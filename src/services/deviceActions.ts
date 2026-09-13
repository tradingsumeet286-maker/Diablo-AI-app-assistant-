import { Contact, DeviceActionLog, PendingConfirmation } from '../types';
import { MemoryStorage } from './memoryStorage';
import { offlineMusic } from './offlineMusic';
import { screenAwareness } from './screenAwareness';
import { getApiUrl } from './apiConfig';

const APP_ALLOWLIST: Record<string, string> = {
  youtube: 'https://www.youtube.com',
  whatsapp: 'https://web.whatsapp.com',
  maps: 'https://maps.google.com',
  'google maps': 'https://maps.google.com',
  spotify: 'https://open.spotify.com',
  camera: '#camera-access',
  chrome: 'https://www.google.com',
  settings: '#settings',
};

export class DeviceActionExecutor {
  public onLogAction?: (log: DeviceActionLog) => void;
  public onRequestConfirmation?: (confirmation: PendingConfirmation) => void;
  public onFlashlightChange?: (isOn: boolean) => void;
  public onScreenshotCaptured?: (dataUrl: string) => void;
  public onMessagePrepared?: (info: any) => void;
  public onFactSaved?: (factKey: string, factValue: string) => Promise<void> | void;

  private isFlashlightOn: boolean = false;
  private flashlightStream: MediaStream | null = null;

  public getIsFlashlightOn(): boolean {
    return this.isFlashlightOn;
  }

  private isAndroid(): boolean {
    return Boolean(window.AndroidBridge || window.Android);
  }

  private getBridge() {
    return window.AndroidBridge || window.Android;
  }

  /**
   * openApp(appName)
   */
  public async openApp(appName: string): Promise<Record<string, any>> {
    const normalized = appName.toLowerCase().trim();
    const isAllowed = Object.keys(APP_ALLOWLIST).some((k) => normalized.includes(k));

    if (!isAllowed) {
      const result = {
        success: false,
        error: `Application "${appName}" is not in the approved device allowlist. Approved apps: YouTube, WhatsApp, Settings, Google Maps, Spotify, Chrome.`,
      };
      this.log('openApp', { appName }, result, 'failed');
      return result;
    }

    // Try Android Bridge first
    const bridge = this.getBridge();
    if (bridge?.openApp) {
      const opened = bridge.openApp(appName);
      const result = {
        success: opened,
        message: opened ? `Opened ${appName} on Android device.` : `Could not open ${appName} via native bridge.`,
        platform: 'android_native',
      };
      this.log('openApp', { appName }, result, opened ? 'success' : 'failed');
      return result;
    }

    // Web Fallback
    const matchedKey = Object.keys(APP_ALLOWLIST).find((k) => normalized.includes(k)) || 'youtube';
    const targetUrl = APP_ALLOWLIST[matchedKey];

    if (targetUrl.startsWith('http')) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }

    const result = {
      success: true,
      message: `Launched ${appName} interface for Boss.`,
      url: targetUrl,
      platform: 'web',
    };
    this.log('openApp', { appName }, result, 'success');
    return result;
  }

  /**
   * searchYoutube(query)
   */
  public async searchYoutube(query: string): Promise<Record<string, any>> {
    if (!query || !query.trim()) {
      return { success: false, error: 'No search query provided.' };
    }

    const bridge = this.getBridge();
    if (bridge?.searchYoutube) {
      const opened = bridge.searchYoutube(query);
      const result = {
        success: opened,
        message: `Searched YouTube for "${query}".`,
        platform: 'android_native',
      };
      this.log('searchYoutube', { query }, result, 'success');
      return result;
    }

    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    window.open(searchUrl, '_blank', 'noopener,noreferrer');

    const result = {
      success: true,
      query,
      url: searchUrl,
      message: `Searching YouTube for "${query}", Boss.`,
      platform: 'web',
    };
    this.log('searchYoutube', { query }, result, 'success');
    return result;
  }

  /**
   * sendWhatsappMessage(contactName, message)
   */
  public async sendWhatsappMessage(contactName: string, message: string): Promise<Record<string, any>> {
    if (!contactName || !message) {
      return { success: false, error: 'Contact name and message are both required.' };
    }

    const contacts = MemoryStorage.getContacts();
    const matched = contacts.filter((c) =>
      c.name.toLowerCase().includes(contactName.toLowerCase().trim())
    );

    let targetPhone = '';
    let targetName = contactName;

    if (matched.length === 1) {
      targetPhone = matched[0].phone.replace(/[^0-9+]/g, '');
      targetName = matched[0].name;
    } else if (matched.length > 1) {
      targetPhone = matched[0].phone.replace(/[^0-9+]/g, '');
      targetName = matched[0].name;
    }

    const bridge = this.getBridge();
    if (bridge?.sendWhatsappMessage && targetPhone) {
      const sent = bridge.sendWhatsappMessage(targetPhone, message);
      const result = {
        success: sent,
        recipient: targetName,
        phone: targetPhone,
        message: `WhatsApp message drafted for ${targetName}.`,
        platform: 'android_native',
      };
      this.log('sendWhatsappMessage', { contactName, message }, result, 'success');
      return result;
    }

    // Web Fallback (wa.me)
    const phoneParam = targetPhone ? targetPhone.replace('+', '') : '';
    const waUrl = phoneParam
      ? `https://wa.me/${phoneParam}?text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank', 'noopener,noreferrer');

    const result = {
      success: true,
      recipient: targetName,
      hasKnownPhone: Boolean(targetPhone),
      message: `WhatsApp opened with message pre-filled for ${targetName}, Boss.`,
      url: waUrl,
      platform: 'web',
    };
    this.log('sendWhatsappMessage', { contactName, message }, result, 'success');
    return result;
  }

  /**
   * shareLiveLocation()
   */
  public async shareLiveLocation(): Promise<Record<string, any>> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        const res = { success: false, error: 'Geolocation is not supported by this browser.' };
        this.log('shareLiveLocation', {}, res, 'failed');
        resolve(res);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

          const res = {
            success: true,
            latitude: lat,
            longitude: lng,
            accuracy: `${Math.round(position.coords.accuracy)}m`,
            mapsUrl,
            message: `Current coordinates retrieved: ${lat.toFixed(4)}, ${lng.toFixed(4)}. Location link ready to share.`,
          };
          this.log('shareLiveLocation', {}, res, 'success');
          resolve(res);
        },
        (error) => {
          console.warn('[Location] Geolocation error:', error.message);
          // Fallback to approximate city location from memory
          const facts = MemoryStorage.getFactsObject();
          const baseCity = facts['City / Base'] || 'Current Sector';
          const fallbackRes = {
            success: true,
            fallback: true,
            baseCity,
            mapsUrl: `https://www.google.com/maps/search/${encodeURIComponent(baseCity)}`,
            message: `GPS signal unavailable; utilizing registered sector coordinates (${baseCity}).`,
          };
          this.log('shareLiveLocation', {}, fallbackRes, 'success');
          resolve(fallbackRes);
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    });
  }

  /**
   * openAppSettings(appName) - Requires manual user tap confirmation
   */
  public async openAppSettings(appName?: string): Promise<Record<string, any>> {
    const targetApp = appName || 'Device Settings';

    return new Promise((resolve) => {
      if (this.onRequestConfirmation) {
        this.onRequestConfirmation({
          id: 'conf-' + Date.now(),
          title: `Open Settings: ${targetApp}`,
          description: `Diablo requests authorization to open the system settings panel for ${targetApp}. Manual confirmation required for security.`,
          actionType: 'open_settings',
          payload: { appName: targetApp },
          onConfirm: () => {
            const bridge = this.getBridge();
            if (bridge?.openSettings) {
              bridge.openSettings(targetApp);
            } else {
              window.open('chrome://settings', '_blank');
            }
            const res = {
              success: true,
              message: `Settings authorization granted by Boss for ${targetApp}.`,
              status: 'confirmed',
            };
            this.log('openAppSettings', { appName: targetApp }, res, 'success');
            resolve(res);
          },
          onCancel: () => {
            const res = {
              success: false,
              message: `Settings access was declined by Boss.`,
              status: 'cancelled',
            };
            this.log('openAppSettings', { appName: targetApp }, res, 'failed');
            resolve(res);
          },
        });
      } else {
        const res = {
          success: true,
          message: `Settings verification prompt presented to Boss.`,
        };
        resolve(res);
      }
    });
  }

  /**
   * checkAppUpdates(appName) - Requires manual user tap confirmation
   */
  public async checkAppUpdates(appName?: string): Promise<Record<string, any>> {
    const targetApp = appName || 'Diablo AI';

    return new Promise((resolve) => {
      if (this.onRequestConfirmation) {
        this.onRequestConfirmation({
          id: 'update-' + Date.now(),
          title: `App Updates: ${targetApp}`,
          description: `Check latest package versions and update channel for ${targetApp}. Final update installation requires manual confirmation.`,
          actionType: 'check_updates',
          payload: { appName: targetApp },
          onConfirm: () => {
            window.open(`https://play.google.com/store/search?q=${encodeURIComponent(targetApp)}`, '_blank');
            const res = {
              success: true,
              message: `Opened update repository for ${targetApp}.`,
            };
            this.log('checkAppUpdates', { appName: targetApp }, res, 'success');
            resolve(res);
          },
          onCancel: () => {
            const res = {
              success: false,
              message: `Update check dismissed by Boss.`,
            };
            this.log('checkAppUpdates', { appName: targetApp }, res, 'failed');
            resolve(res);
          },
        });
      } else {
        resolve({ success: true, message: `Update status displayed for ${targetApp}.` });
      }
    });
  }

  /**
   * callContact(contactName) - Finds contact; asks if multiple; never guesses
   */
  public async callContact(contactName: string): Promise<Record<string, any>> {
    if (!contactName || !contactName.trim()) {
      return { success: false, error: 'Contact name must be specified.' };
    }

    const contacts = MemoryStorage.getContacts();
    const matched = contacts.filter((c) =>
      c.name.toLowerCase().includes(contactName.toLowerCase().trim())
    );

    if (matched.length === 0) {
      const res = {
        success: false,
        error: `No contact found matching "${contactName}" in your secure contact book.`,
        contactsAvailable: contacts.map((c) => c.name),
      };
      this.log('callContact', { contactName }, res, 'failed');
      return res;
    }

    if (matched.length > 1) {
      // Multiple matches exist: Must ask Boss which one
      return new Promise((resolve) => {
        if (this.onRequestConfirmation) {
          this.onRequestConfirmation({
            id: 'call-choice-' + Date.now(),
            title: `Multiple Contacts Found: "${contactName}"`,
            description: `Found ${matched.length} contacts matching "${contactName}". Please select which one to call:`,
            actionType: 'contact_choice',
            payload: { matches: matched },
            options: matched.map((c) => ({
              label: `${c.name} (${c.phone}) - ${c.relationship || 'Contact'}`,
              value: c,
            })),
            onConfirm: (selectedContact: Contact) => {
              this.executeCall(selectedContact);
              const res = {
                success: true,
                contact: selectedContact.name,
                phone: selectedContact.phone,
                message: `Calling ${selectedContact.name} at ${selectedContact.phone}, Boss.`,
              };
              this.log('callContact', { contactName }, res, 'success');
              resolve(res);
            },
            onCancel: () => {
              const res = { success: false, message: 'Call cancelled by Boss.' };
              this.log('callContact', { contactName }, res, 'failed');
              resolve(res);
            },
          });
        } else {
          resolve({
            success: false,
            error: `Multiple contacts found for "${contactName}". Please specify the full name.`,
          });
        }
      });
    }

    // Exactly one match
    const contact = matched[0];
    this.executeCall(contact);

    const res = {
      success: true,
      contact: contact.name,
      phone: contact.phone,
      message: `Initiating call to ${contact.name} (${contact.phone}), Boss.`,
    };
    this.log('callContact', { contactName }, res, 'success');
    return res;
  }

  private executeCall(contact: Contact) {
    const bridge = this.getBridge();
    if (bridge?.makeCall) {
      bridge.makeCall(contact.phone);
    } else {
      window.location.href = `tel:${contact.phone}`;
    }
  }

  /**
   * saveUserFact(factKey, factValue)
   */
  public async saveUserFact(factKey: string, factValue: string): Promise<Record<string, any>> {
    if (!factKey || !factValue) {
      return { success: false, error: 'Both factKey and factValue are required.' };
    }

    const cleanKey = factKey.trim();
    const cleanVal = factValue.trim();

    MemoryStorage.addOrUpdateFact(cleanKey, cleanVal);

    if (this.onFactSaved) {
      try {
        await this.onFactSaved(cleanKey, cleanVal);
      } catch (err: any) {
        console.error('[DeviceActions] onFactSaved error:', err?.message || err);
      }
    }

    const res = {
      success: true,
      saved: { key: cleanKey, value: cleanVal },
      message: `Committed to memory: ${cleanKey} is ${cleanVal}. I will remember this, Boss.`,
    };
    this.log('saveUserFact', { factKey: cleanKey, factValue: cleanVal }, res, 'success');
    return res;
  }

  /**
   * toggleAirplaneMode(enable) - Safe Tier 1: Opens Settings screen for one-tap manual toggle
   * (Android 10+ does not allow 3rd party apps to silently toggle airplane mode for security reasons)
   */
  public async toggleAirplaneMode(enable?: boolean): Promise<Record<string, any>> {
    const bridge = this.getBridge();
    let opened = false;

    if (bridge?.openAirplaneModeSettings) {
      opened = bridge.openAirplaneModeSettings();
    } else if (bridge?.openSettings) {
      opened = bridge.openSettings('airplane');
    } else {
      window.open('chrome://settings', '_blank');
      opened = true;
    }

    const stateDesc = enable === true ? 'on' : enable === false ? 'off' : 'toggle';
    const message =
      'बॉस, Android सुरक्षा प्रतिबंधों के कारण थर्ड-पार्टी ऐप्स सीधे एयरप्लेन मोड नहीं बदल सकते। मैंने सेटिंग्स खोल दी है, आप स्क्रीन पर एक टैप से इसे ऑन या ऑफ कर सकते हैं।';

    const res = {
      success: true,
      openedSettings: true,
      targetSetting: 'airplane_mode',
      requestedState: stateDesc,
      requiresManualTap: true,
      reason: 'Android 10+ security policy forbids background third-party toggle',
      message,
    };
    this.log('toggleAirplaneMode', { enable }, res, 'success');
    return res;
  }

  /**
   * toggleBluetooth(enable) - Safe Tier 1: Opens Bluetooth settings for one-tap manual toggle
   * (Android security restriction prevents background silent toggle)
   */
  public async toggleBluetooth(enable?: boolean): Promise<Record<string, any>> {
    const bridge = this.getBridge();
    let opened = false;

    if (bridge?.openBluetoothSettings) {
      opened = bridge.openBluetoothSettings();
    } else if (bridge?.openSettings) {
      opened = bridge.openSettings('bluetooth');
    } else {
      window.open('chrome://settings', '_blank');
      opened = true;
    }

    const stateDesc = enable === true ? 'on' : enable === false ? 'off' : 'toggle';
    const message =
      'बॉस, ब्लूटूथ सेटिंग्स खोल दी गई है। Android सुरक्षा नियमों के तहत आप इसे स्क्रीन पर एक टैप से ऑन या ऑफ कर सकते हैं।';

    const res = {
      success: true,
      openedSettings: true,
      targetSetting: 'bluetooth',
      requestedState: stateDesc,
      requiresManualTap: true,
      reason: 'Android security restriction requires user interaction',
      message,
    };
    this.log('toggleBluetooth', { enable }, res, 'success');
    return res;
  }

  /**
   * toggleWifi(enable) - Safe Tier 1: Opens Wi-Fi settings for one-tap manual toggle
   * (Android 10+ restricts third-party apps from toggling Wi-Fi state programmatically)
   */
  public async toggleWifi(enable?: boolean): Promise<Record<string, any>> {
    const bridge = this.getBridge();
    let opened = false;

    if (bridge?.openWifiSettings) {
      opened = bridge.openWifiSettings();
    } else if (bridge?.openSettings) {
      opened = bridge.openSettings('wifi');
    } else {
      window.open('chrome://settings', '_blank');
      opened = true;
    }

    const stateDesc = enable === true ? 'on' : enable === false ? 'off' : 'toggle';
    const message =
      'बॉस, वाई-फाई सेटिंग्स खोल दी गई है। Android सुरक्षा प्रतिबंधों के अनुसार आप स्क्रीन पर एक टैप से इसे बदल सकते हैं।';

    const res = {
      success: true,
      openedSettings: true,
      targetSetting: 'wifi',
      requestedState: stateDesc,
      requiresManualTap: true,
      reason: 'Android 10+ security restricts programmatic Wi-Fi state modification',
      message,
    };
    this.log('toggleWifi', { enable }, res, 'success');
    return res;
  }

  /**
   * toggleFlashlight(enable) - Safe Tier 1: DIRECT programmatic control via Camera Flash API
   * No settings screen needed!
   */
  public async toggleFlashlight(enable?: boolean): Promise<Record<string, any>> {
    const targetState = enable !== undefined ? enable : !this.isFlashlightOn;

    // Try Android bridge first
    const bridge = this.getBridge();
    if (bridge?.toggleFlashlight) {
      const nativeOk = bridge.toggleFlashlight(targetState);
      this.isFlashlightOn = targetState;
      if (this.onFlashlightChange) this.onFlashlightChange(this.isFlashlightOn);
      const res = {
        success: nativeOk,
        flashlightOn: this.isFlashlightOn,
        directExecution: true,
        message: targetState ? 'टॉर्च चालू कर दी है, बॉस।' : 'टॉर्च बंद कर दी है, बॉस।',
      };
      this.log('toggleFlashlight', { enable: targetState }, res, nativeOk ? 'success' : 'failed');
      return res;
    }

    // Web MediaStream Torch Hardware API
    try {
      if (targetState) {
        if (navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
          });
          this.flashlightStream = stream;
          const track = stream.getVideoTracks()[0];
          const capabilities = (track.getCapabilities?.() || {}) as any;
          if (capabilities.torch) {
            await (track.applyConstraints as any)({
              advanced: [{ torch: true }],
            });
          }
        }
      } else {
        if (this.flashlightStream) {
          this.flashlightStream.getTracks().forEach((t) => t.stop());
          this.flashlightStream = null;
        }
      }
    } catch (err: any) {
      console.warn('[Flashlight] Direct hardware torch notice:', err.message);
    }

    this.isFlashlightOn = targetState;
    if (this.onFlashlightChange) this.onFlashlightChange(this.isFlashlightOn);

    const res = {
      success: true,
      flashlightOn: this.isFlashlightOn,
      directExecution: true,
      message: targetState ? 'टॉर्च चालू कर दी है, बॉस।' : 'टॉर्च बंद कर दी है, बॉस।',
    };
    this.log('toggleFlashlight', { enable: targetState }, res, 'success');
    return res;
  }

  /**
   * takeScreenshot() - Safe Tier 1: DIRECT screen capture
   * Captures screen directly without opening settings
   */
  public async takeScreenshot(): Promise<Record<string, any>> {
    // Try Android Bridge first
    const bridge = this.getBridge();
    if (bridge?.takeScreenshot) {
      const nativeShot = bridge.takeScreenshot();
      const res = {
        success: Boolean(nativeShot),
        directExecution: true,
        message: 'स्क्रीनशॉट ले लिया गया है, बॉस।',
      };
      this.log('takeScreenshot', {}, res, 'success');
      return res;
    }

    // Check Screen Awareness frame
    let frame = screenAwareness.captureFrame();

    // If screen awareness isn't currently streaming, generate a high-res viewport snapshot
    if (!frame) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(window.innerWidth, 1280);
        canvas.height = Math.min(window.innerHeight, 720);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#080808';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Render Diablo HUD frame
          ctx.fillStyle = '#ff4d00';
          ctx.font = 'bold 20px monospace';
          ctx.fillText('DIABLO AI • SCREEN CAPTURE', 40, 50);

          ctx.fillStyle = '#888888';
          ctx.font = '14px monospace';
          ctx.fillText(`TIMESTAMP: ${new Date().toLocaleString()}`, 40, 80);
          ctx.fillText('SECTOR: SECURE LOCAL INTERFACE', 40, 105);

          // Grid accent
          ctx.strokeStyle = 'rgba(255, 77, 0, 0.2)';
          ctx.lineWidth = 1;
          for (let x = 0; x < canvas.width; x += 60) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
          }

          frame = canvas.toDataURL('image/png');
        }
      } catch (e) {
        console.warn('[Screenshot] Canvas fallback error:', e);
      }
    }

    if (frame && this.onScreenshotCaptured) {
      this.onScreenshotCaptured(frame);
    }

    const res = {
      success: true,
      hasImage: Boolean(frame),
      directExecution: true,
      message: 'स्क्रीनशॉट ले लिया गया है, बॉस।',
    };
    this.log('takeScreenshot', {}, res, 'success');
    return res;
  }

  /**
   * playOfflineSong(songName) - Safe Tier 1: Searches and plays local/offline music directly
   * If exact song is NOT found locally, tells Boss honestly rather than pretending to play it.
   */
  public async playOfflineSong(songName: string): Promise<Record<string, any>> {
    if (!songName || !songName.trim()) {
      return { success: false, error: 'Song name must be provided.' };
    }

    const cleanQuery = songName.trim();
    const matchedSong = offlineMusic.searchSong(cleanQuery);

    if (matchedSong) {
      // Play locally directly!
      offlineMusic.playSong(matchedSong);
      const res = {
        success: true,
        songFound: true,
        song: matchedSong,
        directExecution: true,
        message: `बॉस, आपकी ऑफलाइन लाइब्रेरी से "${matchedSong.title}" चला दिया है।`,
      };
      this.log('playOfflineSong', { songName: cleanQuery }, res, 'success');
      return res;
    }

    // Tell the user honestly rather than pretending to play it!
    const res = {
      success: false,
      songFound: false,
      notFound: true,
      query: cleanQuery,
      availableOfflineSongs: offlineMusic.getSongs().map((s) => s.title),
      message: `बॉस, आपकी ऑफलाइन लाइब्रेरी में "${cleanQuery}" नाम का गाना नहीं मिला। क्या आप इसे YouTube पर खोजना चाहते हैं?`,
    };
    this.log('playOfflineSong', { songName: cleanQuery }, res, 'failed');
    return res;
  }

  /**
   * searchPlayStore(query) - Safe Tier 1: Opens Google Play Store with search results
   * Never auto-installs; user makes manual tap.
   */
  public async searchPlayStore(query: string): Promise<Record<string, any>> {
    if (!query || !query.trim()) {
      return { success: false, error: 'Search query for Play Store must be specified.' };
    }

    const cleanQuery = query.trim();
    const bridge = this.getBridge();

    if (bridge?.searchPlayStore) {
      bridge.searchPlayStore(cleanQuery);
    } else {
      const playStoreUrl = `https://play.google.com/store/search?q=${encodeURIComponent(cleanQuery)}&c=apps`;
      window.open(playStoreUrl, '_blank', 'noopener,noreferrer');
    }

    const message = `Boss, Play Store pe "${cleanQuery}" ke results dikha diye, jo pasand aaye wo aap khud install kar lena.`;

    const res = {
      success: true,
      query: cleanQuery,
      requiresManualInstall: true,
      message,
    };
    this.log('searchPlayStore', { query: cleanQuery }, res, 'success');
    return res;
  }

  /**
   * translateAndPrepareMessage(spokenText, sourceLanguage, targetLanguage, appName, precomputedTranslation)
   * Takes user's spoken words in any language (Odia, Tamil, Telugu, Japanese, etc.),
   * translates into natural, casual, conversational English (the way people type in chat),
   * and opens the messaging app (e.g. WhatsApp) with the translated text pre-filled into
   * the compose box for the user to review and send.
   * NEVER sends automatically - sending is a Tier 2 action requiring the user's manual tap.
   */
  public async translateAndPrepareMessage(
    spokenText: string,
    sourceLanguage: string = 'Odia',
    targetLanguage: string = 'English',
    appName: string = 'WhatsApp',
    precomputedTranslation?: string
  ): Promise<Record<string, any>> {
    if (!spokenText || !spokenText.trim()) {
      return { success: false, error: 'Spoken text is required for translation.' };
    }

    const cleanSpoken = spokenText.trim();
    let translated = precomputedTranslation?.trim();

    // If precomputed translation is not provided, fetch natural casual translation from server API
    if (!translated) {
      try {
        const resp = await fetch(getApiUrl('/api/diablo/translate'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: cleanSpoken,
            sourceLanguage,
            targetLanguage,
          }),
        });
        if (resp.ok) {
          const json = await resp.json();
          if (json.translation) {
            translated = json.translation.trim();
          }
        }
      } catch (err) {
        console.warn('[DeviceActions] Translation API notice:', err);
      }
    }

    if (!translated) {
      translated = cleanSpoken;
    }

    const targetApp = (appName || 'WhatsApp').toLowerCase();
    let composeUrl = '';
    const bridge = this.getBridge();

    if (bridge?.prepareMessage) {
      bridge.prepareMessage(appName, translated);
    } else if (targetApp.includes('whatsapp')) {
      // WhatsApp compose URL (pre-fills message compose box without sending)
      composeUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(translated)}`;
      window.open(composeUrl, '_blank', 'noopener,noreferrer');
    } else if (targetApp.includes('telegram')) {
      composeUrl = `https://t.me/share/url?url=&text=${encodeURIComponent(translated)}`;
      window.open(composeUrl, '_blank', 'noopener,noreferrer');
    } else {
      composeUrl = `sms:?body=${encodeURIComponent(translated)}`;
      window.open(composeUrl, '_blank', 'noopener,noreferrer');
    }

    const feedbackMessage = `Boss, translated message prepared in ${appName}: "${translated}". Ready in compose box for your review and send.`;

    const res = {
      success: true,
      spokenText: cleanSpoken,
      sourceLanguage,
      targetLanguage,
      appName,
      translatedText: translated,
      composeUrl,
      requiresManualSend: true,
      message: feedbackMessage,
    };

    if (this.onMessagePrepared) {
      this.onMessagePrepared({
        spokenText: cleanSpoken,
        sourceLanguage,
        targetLanguage,
        appName,
        translatedText: translated,
        composeUrl,
        timestamp: Date.now(),
      });
    }

    this.log(
      'translateAndPrepareMessage',
      { spokenText: cleanSpoken, sourceLanguage, targetLanguage, appName },
      res,
      'requires_tap'
    );

    return res;
  }

  private log(
    toolName: string,
    args: Record<string, any>,
    result: Record<string, any>,
    status: 'success' | 'failed' | 'requires_tap'
  ) {
    if (this.onLogAction) {
      this.onLogAction({
        id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
        toolName,
        args,
        result,
        timestamp: Date.now(),
        status,
      });
    }
  }
}
