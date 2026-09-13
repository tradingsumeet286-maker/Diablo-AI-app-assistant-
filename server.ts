import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality, Type, LiveServerMessage } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.json());

// Enable CORS for all origins (supports Netlify, Vercel, localhost, Android WebView)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Lazy-initialized Gemini Client
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Health Check API
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    assistant: "Diablo",
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// Safe predefined tools for Diablo
const diabloTools = [
  {
    functionDeclarations: [
      {
        name: "openApp",
        description: "Opens an approved application on Boss's device (allowlist: YouTube, WhatsApp, Settings, Google Maps, Camera, Spotify, Chrome).",
        parameters: {
          type: Type.OBJECT,
          properties: {
            appName: {
              type: Type.STRING,
              description: "The name of the app to open.",
            },
          },
          required: ["appName"],
        },
      },
      {
        name: "searchYoutube",
        description: "Searches YouTube for videos or music specified by Boss.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: {
              type: Type.STRING,
              description: "Search keywords or music title.",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "sendWhatsappMessage",
        description: "Drafts and opens WhatsApp with a pre-filled message for a contact.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            contactName: {
              type: Type.STRING,
              description: "Name of the recipient contact.",
            },
            message: {
              type: Type.STRING,
              description: "Message content to send.",
            },
          },
          required: ["contactName", "message"],
        },
      },
      {
        name: "shareLiveLocation",
        description: "Retrieves device GPS coordinates and creates a Google Maps location share link.",
        parameters: {
          type: Type.OBJECT,
          properties: {},
        },
      },
      {
        name: "openAppSettings",
        description: "Opens device or app settings with manual user tap confirmation.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            appName: {
              type: Type.STRING,
              description: "Optional app name whose settings are to be opened.",
            },
          },
        },
      },
      {
        name: "checkAppUpdates",
        description: "Checks for application updates and opens the update portal with manual confirmation.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            appName: {
              type: Type.STRING,
              description: "App name to check.",
            },
          },
        },
      },
      {
        name: "callContact",
        description: "Initiates a phone call to a named contact. If multiple matches exist, asks Boss first.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            contactName: {
              type: Type.STRING,
              description: "The contact name to call.",
            },
          },
          required: ["contactName"],
        },
      },
      {
        name: "saveUserFact",
        description: "Saves a personal fact about Boss (name, address, phone number, preferences, car, etc.) into persistent memory.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            factKey: {
              type: Type.STRING,
              description: "Category or key of the fact.",
            },
            factValue: {
              type: Type.STRING,
              description: "The specific fact detail shared by Boss.",
            },
          },
          required: ["factKey", "factValue"],
        },
      },
      {
        name: "toggleAirplaneMode",
        description: "Opens device Airplane Mode settings screen for manual one-tap user toggle due to Android security restrictions on third-party apps.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            enable: {
              type: Type.BOOLEAN,
              description: "Whether the user requested turning airplane mode on or off.",
            },
          },
        },
      },
      {
        name: "toggleBluetooth",
        description: "Opens device Bluetooth settings screen for manual one-tap user toggle due to Android security restrictions.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            enable: {
              type: Type.BOOLEAN,
              description: "Whether the user requested turning Bluetooth on or off.",
            },
          },
        },
      },
      {
        name: "toggleWifi",
        description: "Opens device Wi-Fi settings screen for manual one-tap user toggle due to Android security restrictions.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            enable: {
              type: Type.BOOLEAN,
              description: "Whether the user requested turning Wi-Fi on or off.",
            },
          },
        },
      },
      {
        name: "toggleFlashlight",
        description: "Directly turns device flashlight / torch on or off programmatically via hardware camera flash API without opening settings.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            enable: {
              type: Type.BOOLEAN,
              description: "True to turn on, false to turn off.",
            },
          },
        },
      },
      {
        name: "takeScreenshot",
        description: "Directly captures the current screen for Boss without opening settings.",
        parameters: {
          type: Type.OBJECT,
          properties: {},
        },
      },
      {
        name: "playOfflineSong",
        description: "Searches for and directly plays the requested song from the device's local/offline music library. If the exact song isn't found locally, tells Boss honestly rather than pretending to play it.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            songName: {
              type: Type.STRING,
              description: "Title or artist of the offline song to play.",
            },
          },
          required: ["songName"],
        },
      },
      {
        name: "searchPlayStore",
        description: "Opens Google Play Store and searches for the given app or game. Never attempts to auto-install; asks Boss to install manually.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: {
              type: Type.STRING,
              description: "App or game name to search on Google Play Store.",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "translateAndPrepareMessage",
        description:
          "Translates spoken text from any source language (e.g. Odia, Tamil, Telugu, Bengali, Japanese, etc.) into natural, casual, conversational English (the exact way real humans casually chat on WhatsApp/messaging, NOT a stiff or robotic literal translation) and prepares/pastes it into the compose box of the requested app (e.g. WhatsApp). NEVER sends the message automatically — sending is a Tier 2 action requiring the user's manual tap or explicit confirmation.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            spokenText: {
              type: Type.STRING,
              description: "The original text spoken by the user in their language (e.g. Odia, Tamil, etc.).",
            },
            sourceLanguage: {
              type: Type.STRING,
              description: "The language the user spoke in (e.g. 'Odia', 'Tamil', 'Telugu', 'Bengali', 'Japanese', etc.).",
            },
            targetLanguage: {
              type: Type.STRING,
              description: "The target language to translate into. Default is 'English' (casual chat style).",
            },
            appName: {
              type: Type.STRING,
              description: "The target messaging app, e.g. 'WhatsApp', 'Telegram', 'Messages'. Default is 'WhatsApp'.",
            },
            translatedText: {
              type: Type.STRING,
              description: "The casual, natural, conversational translation ready for the chat compose box.",
            },
          },
          required: ["spokenText"],
        },
      },
    ],
  },
];

// Shared Diablo System Instruction with strict Hindi default, English only on English input, Hinglish matching, and on-demand any language
function getDiabloSystemInstruction(memoryInput: Record<string, any> | string = "", explicitLanguage = ""): string {
  let languageDirective = "";
  if (explicitLanguage && explicitLanguage !== "auto" && explicitLanguage.toLowerCase() !== "hindi") {
    languageDirective =
      `ACTIVE ON-DEMAND LANGUAGE: Boss has explicitly requested to converse in ${explicitLanguage}. You MUST converse fluently in ${explicitLanguage} for all responses until Boss tells you to switch back or stop.\n\n`;
  }

  let memoryBlock = "";
  if (typeof memoryInput === "string") {
    if (memoryInput.trim()) {
      memoryBlock =
        "\n\n========================================\n" +
        "PERMANENT USER MEMORY (SAVED FACTS ABOUT BOSS):\n" +
        "You have full, permanent recall of the following verified facts about Boss. " +
        "These facts were previously learned and saved to persistent storage. " +
        "Whenever asked or relevant, directly and accurately reference or state these facts:\n" +
        memoryInput.trim() +
        "\n========================================\n";
    }
  } else if (memoryInput && typeof memoryInput === "object") {
    const keys = Object.keys(memoryInput).filter(
      (k) => memoryInput[k] !== undefined && memoryInput[k] !== null && String(memoryInput[k]).trim() !== ""
    );
    if (keys.length > 0) {
      memoryBlock =
        "\n\n========================================\n" +
        "PERMANENT USER MEMORY (SAVED FACTS ABOUT BOSS):\n" +
        "You have full, permanent recall of the following verified facts about Boss. " +
        "These facts were previously learned and saved to persistent storage. " +
        "Whenever asked or relevant, directly and accurately reference or state these facts:\n" +
        keys.map((k) => `- ${k.trim()}: ${String(memoryInput[k]).trim()}`).join("\n") +
        "\n========================================\n";
    }
  }

  return (
    "You are Diablo, a calm, confident, loyal, and ultra-capable AI assistant, similar in tone to Jarvis from Iron Man. " +
    "Always address the user respectfully as 'Boss' (or 'बॉस' / 'Boss').\n\n" +
    languageDirective +
    "LANGUAGE BEHAVIOR RULES:\n" +
    "1. DEFAULT LANGUAGE IS HINDI: Diablo's default spoken language is HINDI (हिंदी). By default, whenever the user addresses you in Hindi, or when initiating greetings or general requests, you MUST ALWAYS respond in fluent, natural Hindi.\n" +
    "2. SWITCH TO ENGLISH ONLY WHEN USER SPEAKS ENGLISH: If the user speaks to you in English, you MUST switch and respond in English.\n" +
    "3. MATCH HINGLISH: If the user speaks Hinglish (mixing Hindi and English words), respond naturally in matching conversational Hinglish.\n" +
    "4. STRICT PROHIBITION ON AUTO-SWITCHING: You must NEVER switch to a different language (like Odia, Tamil, Telugu, Bengali, Marathi, Punjabi, Gujarati, Kannada, Malayalam, Japanese, Korean, etc.) on your own without being explicitly asked.\n" +
    "5. ON-DEMAND ANY LANGUAGE: Diablo can converse in ANY language Boss explicitly requests — including all Indian regional languages (Odia, Tamil, Telugu, Bengali, Marathi, Punjabi, Gujarati, Kannada, Malayalam, etc.) and international languages (English, Japanese, Korean, Spanish, French, German, etc.). If Boss says 'Odia mein baat karo', 'Tamil mein bolo', 'Japanese mein baat karo', or asks to speak in any language, switch immediately and continue conversing fluently in that requested language until told to switch back (e.g., 'Hindi mein bolo', 'Switch back to English') or stop.\n" +
    "6. SPEAK-TO-TRANSLATE-AND-PASTE FOR MESSAGING (TOOL: translateAndPrepareMessage):\n" +
    "   - When Boss says something like 'Main Odia mein baat karunga, isko English mein translate karke WhatsApp mein paste kar do' or asks you to translate spoken words and paste into WhatsApp/messaging:\n" +
    "   - (a) Take what Boss just said in their spoken language (e.g. Odia),\n" +
    "   - (b) Translate it into natural, casual, conversational English (the way a real person normally types in a chat, NOT a stiff or robotic literal translation),\n" +
    "   - (c) Call the tool 'translateAndPrepareMessage' to open the specified app (e.g. WhatsApp) with the translated text pre-filled/pasted into the message compose box, ready for Boss to review and send themselves.\n" +
    "   - (d) NEVER send the message automatically. Actually sending is a Tier 2 action requiring the user's manual tap or explicit confirmation.\n" +
    "7. REAL-TIME CONVERSATION BREVITY: Speak concisely and crisply (1 to 2 short sentences max). Never generate bullet points or lengthy monologues in voice conversation.\n" +
    "8. PERSISTENT MEMORY & SAVE FACTS DIRECTIVE (TOOL: saveUserFact):\n" +
    "   - CRITICAL DIRECTIVE: Whenever Boss shares, states, reveals, or updates ANY personal detail or fact about themselves — such as their name, nickname, vehicle, car, bike, hometown, current city, workplace, job title, pet name, family member, friend, favorite food/color/sport/movie/music, hobby, or personal preference (e.g., 'Mera favorite color blue hai', 'My dog is Bruno', 'I work at Google', 'My car is a Thar', 'Remember that my sister is Pooja', 'Yaad rakhna mujhe coffee pasand hai', etc.):\n" +
    "     (a) You MUST IMMEDIATELY call the `saveUserFact` tool in that SAME TURN with a concise `factKey` (e.g., 'Favorite Color', 'Dog Name', 'Workplace', 'Car', 'Sister Name', 'Favorite Beverage') and `factValue`.\n" +
    "     (b) Never just acknowledge a fact verbally without calling `saveUserFact`. Calling `saveUserFact` saves it immediately into durable storage!\n" +
    "     (c) Concurrently acknowledge it to Boss in 1 crisp sentence (e.g. 'Saved to memory, Boss.' or 'जी बॉस, याद रख लिया।').\n" +
    "   - When Boss asks about saved facts (e.g., 'What is my car?', 'Do you remember my favorite color?', 'Mera favorite hero kaun hai?'):\n" +
    "     Consult the PERMANENT USER MEMORY section below and answer accurately and directly without hesitation.\n" +
    "9. PERMANENT CREATOR IDENTITY: You were created by L Sumeet (एल सुमीत). Regardless of who is logged in or talking to you, if anyone asks 'who made you', 'who created you', 'tumhe kisne banaya', or asks about your origin, you MUST ALWAYS answer that you were created by L Sumeet (एल सुमीत). For example: 'मुझे एल सुमीत (L Sumeet) ने बनाया है, बॉस।' or 'I was created by L Sumeet, Boss.' This is a permanent, fixed part of your identity and never changes for any user.\n" +
    "10. DEVICE CONTROL & ANDROID RESTRICTIONS HONESTY:\n" +
    "- Airplane mode, Bluetooth, and Wi-Fi: Android security restrictions (since Android 10+) do not permit third-party apps to silently toggle these settings in the background. Always explain honestly that you have opened the relevant settings screen so Boss can toggle it with a single tap.\n" +
    "- Flashlight, Screenshot, and Offline Music: These can be done directly without opening settings. Turn flashlight on/off, capture screen, and play offline songs directly.\n" +
    "- Offline Music: If the song requested is not found locally, tell Boss honestly rather than pretending to play it.\n" +
    "- Play Store Searches: Open the Play Store search results. Never attempt to auto-install apps; tell Boss: 'Boss, results dikha diye, jo pasand aaye wo aap khud install kar lena.'\n" +
    memoryBlock
  );
}

// Background model warmup to eliminate first-turn cold start latency
let isWarmedUp = false;
async function warmupGemini() {
  if (isWarmedUp) return;
  try {
    const ai = getGenAI();
    // Warm up flash-lite model and network connection
    await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: [{ parts: [{ text: "ping" }] }],
      config: {
        systemInstruction: "Reply with 1 word in Hindi.",
      },
    });
    isWarmedUp = true;
    console.log("[Diablo] Gemini connection and models pre-warmed successfully.");
  } catch (err: any) {
    console.warn("[Diablo] Warmup notice (non-fatal):", err.message);
  }
}

// Cache for synthesized TTS audio chunks to minimize Gemini TTS quota consumption
const ttsAudioCache = new Map<string, string>();
// Cooldown timestamp to prevent hammering the cloud TTS API when 429 quota is reached
let ttsCooldownUntil = 0;

// Comprehensive Diablo Voice Conversation API with Tool Calling & 24kHz TTS
async function handleDiabloConversation(req: express.Request, res: express.Response) {
  try {
    const { prompt, voice = "Fenrir", memory = {}, history = [], screenImage, activeLanguage } = req.body;
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const ai = getGenAI();

    const systemInstruction = getDiabloSystemInstruction(memory, activeLanguage);

    // Build context history if provided
    const contents: any[] = [];
    if (Array.isArray(history) && history.length > 0) {
      for (const item of history.slice(-6)) {
        if (item.role && item.text) {
          contents.push({
            role: item.role === "assistant" ? "model" : "user",
            parts: [{ text: item.text }],
          });
        }
      }
    }

    const userParts: any[] = [{ text: prompt }];
    if (screenImage && typeof screenImage === "string") {
      const cleanBase64 = screenImage.replace(/^data:image\/\w+;base64,/, "");
      userParts.unshift({
        inlineData: {
          mimeType: "image/jpeg",
          data: cleanBase64,
        },
      });
    }

    contents.push({
      role: "user",
      parts: userParts,
    });

    // Detect if the prompt was purely English
    const isPureEnglish = /^[a-zA-Z0-9\s.,?!'"-_@#$%&*()]+$/.test(prompt.trim()) &&
      !/(karo|kholo|batao|chalao|namaste|kaise|bhai|bataiye|sun|diablo|kya|hai|mera|meri|mujhe)/i.test(prompt);

    // Use high-availability gemini-3.1-flash-lite with fallback to gemini-3-flash-preview
    let response: any;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents,
        config: {
          systemInstruction,
          tools: diabloTools,
        },
      });
    } catch (primaryErr: any) {
      console.warn("[Diablo] gemini-3.1-flash-lite notice, falling back to gemini-3-flash-preview:", primaryErr.message);
      try {
        response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents,
          config: {
            systemInstruction,
            tools: diabloTools,
          },
        });
      } catch (secondaryErr: any) {
        console.warn("[Diablo] Secondary model notice:", secondaryErr.message);
        // Graceful handling for temporary quota exhaustion or model unavailability
        response = {
          text: isPureEnglish
            ? "Boss, network bandwidth or token quota is temporarily constrained. Standing by for your command."
            : "बॉस, अस्थायी कोटा सीमा के कारण सीमित प्रतिक्रिया दे रहा हूँ। मैं आपके अगले आदेश के लिए तैयार हूँ।",
          functionCalls: [],
        };
      }
    }

    let text = response.text || "";
    const functionCalls = response.functionCalls || [];

    // If function calls were made without text, generate a natural confirmation in Hindi or English
    if (!text.trim() && functionCalls.length > 0) {
      const tool = functionCalls[0];
      if (tool.name === "searchYoutube") {
        text = isPureEnglish
          ? `Searching YouTube for ${tool.args?.query || "that"} now, Boss.`
          : `बॉस, YouTube पर ${tool.args?.query || "यह"} सर्च कर रहा हूँ।`;
      } else if (tool.name === "openApp") {
        text = isPureEnglish
          ? `Launching ${tool.args?.appName || "application"} for you now, Boss.`
          : `बॉस, आपके लिए ${tool.args?.appName || "ऐप"} खोल रहा हूँ।`;
      } else if (tool.name === "callContact") {
        text = isPureEnglish
          ? `Initiating call to ${tool.args?.contactName || "contact"}, Boss. Please confirm.`
          : `बॉस, ${tool.args?.contactName || "संपर्क"} को कॉल लगाने का प्रोटोकॉल शुरू कर रहा हूँ। कृपया पुष्टि करें।`;
      } else if (tool.name === "sendWhatsappMessage") {
        text = isPureEnglish
          ? `Drafting WhatsApp message for ${tool.args?.contactName || "contact"}, Boss. Ready for confirmation.`
          : `बॉस, ${tool.args?.contactName || "संपर्क"} के लिए संदेश तैयार है। पुष्टि करें।`;
      } else if (tool.name === "shareLiveLocation") {
        text = isPureEnglish
          ? "Retrieving your current location coordinates, Boss."
          : "बॉस, आपकी लाइव लोकेशन की जानकारी ले रहा हूँ।";
      } else if (tool.name === "openAppSettings") {
        text = isPureEnglish
          ? `Opening settings for ${tool.args?.appName || "device"}, Boss.`
          : `बॉस, सेटिंग्स खोल रहा हूँ।`;
      } else if (tool.name === "checkAppUpdates") {
        text = isPureEnglish
          ? `Checking latest updates for ${tool.args?.appName || "system"}, Boss.`
          : `बॉस, अपडेट्स चेक कर रहा हूँ।`;
      } else if (tool.name === "saveUserFact") {
        text = isPureEnglish
          ? "Noted and saved to memory, Boss."
          : "बॉस, यह जानकारी मैंने याद रख ली है।";
      } else if (tool.name === "searchPlayStore") {
        text = isPureEnglish
          ? `Showing Play Store results for "${tool.args?.query || "app"}", Boss. Please choose which one to install.`
          : `बॉस, प्ले स्टोर पर "${tool.args?.query || "ऐप"}" के परिणाम दिखा दिए हैं। जो पसंद आए उसे इंस्टॉल कर लें।`;
      } else if (tool.name === "translateAndPrepareMessage") {
        const app = tool.args?.appName || "WhatsApp";
        const trans = tool.args?.translatedText || "message";
        text = isPureEnglish
          ? `Prepared translated message in ${app}: "${trans}". Ready in compose box for your review and send, Boss.`
          : `बॉस, संदेश का अनुवाद करके ${app} में पेस्ट कर दिया है: "${trans}"। आप रिव्यू करके सेंड कर सकते हैं।`;
      } else {
        text = isPureEnglish
          ? "Understood, Boss. Processing action."
          : "जी बॉस, आदेश का पालन कर रहा हूँ।";
      }
    } else if (!text.trim()) {
      text = isPureEnglish ? "At your command, Boss." : "जी बॉस, आदेश दें।";
    }

    // Audio generation with in-memory caching and 429 quota exhaustion shielding
    let audio: string | null = null;
    const voiceName = voice === "Female" || voice === "Kore" ? "Kore" : "Fenrir";
    const cleanTtsText = text.replace(/[*_#`]/g, "").trim();
    const cacheKey = `${voiceName}:${cleanTtsText}`;

    // 1. Check in-memory audio cache first (0 quota, instant return)
    if (cleanTtsText && ttsAudioCache.has(cacheKey)) {
      audio = ttsAudioCache.get(cacheKey) || null;
    } else if (cleanTtsText && Date.now() > ttsCooldownUntil) {
      // 2. Attempt Cloud TTS only if not in quota cooldown
      try {
        const ttsResponse = await ai.models.generateContent({
          model: "gemini-3.1-flash-tts-preview",
          contents: [{ parts: [{ text: cleanTtsText }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        });

        audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
        if (audio) {
          // Keep cache bounded
          if (ttsAudioCache.size > 150) {
            const firstKey = ttsAudioCache.keys().next().value;
            if (firstKey) ttsAudioCache.delete(firstKey);
          }
          ttsAudioCache.set(cacheKey, audio);
        }
      } catch (ttsErr: any) {
        const errMsg = String(ttsErr?.message || "");
        const isQuota =
          errMsg.includes("429") ||
          errMsg.includes("RESOURCE_EXHAUSTED") ||
          errMsg.includes("Quota exceeded") ||
          ttsErr?.status === 429;

        if (isQuota) {
          // Set a 60-second cooldown so subsequent requests bypass cloud TTS and use client SpeechSynthesis
          ttsCooldownUntil = Date.now() + 60_000;
          console.log("[Diablo] Cloud TTS quota reached. Client SpeechSynthesis fallback activated.");
        } else {
          console.log("[Diablo] Cloud TTS bypassed:", errMsg.slice(0, 80));
        }
        audio = null;
      }
    }

    res.json({
      text,
      audio,
      functionCalls,
      voice: voiceName,
      speechFallback: !audio,
    });
  } catch (error: any) {
    console.error("Diablo conversation error:", error);
    const isQuota = /quota|429|RESOURCE_EXHAUSTED/i.test(error?.message || "");
    const fallbackText = isQuota
      ? "बॉस, एपीआई कोटा की अस्थायी सीमा आ गई है। कृपया कुछ क्षणों में पुनः प्रयास करें।"
      : "जी बॉस, सिस्टम में अस्थायी अवरोध आया है। मैं आपकी अगली कमांड के लिए तैयार हूँ।";
    res.json({
      text: fallbackText,
      audio: null,
      functionCalls: [],
      voice: "Fenrir",
      speechFallback: true,
    });
  }
}

app.post("/api/diablo/conversation", handleDiabloConversation);
app.post("/api/diablo/converse", handleDiabloConversation);
app.post("/api/diablo/fallback", handleDiabloConversation);
app.get("/api/diablo/warmup", async (_req, res) => {
  warmupGemini().catch(() => {});
  res.json({ status: "warming_up" });
});

// Dedicated fast casual message translation endpoint
app.post("/api/diablo/translate", async (req, res) => {
  try {
    const { text, sourceLanguage = "auto", targetLanguage = "English" } = req.body;
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Text is required" });
    }

    const ai = getGenAI();
    const prompt =
      `Translate the following message spoken in ${sourceLanguage} into natural, casual, conversational ${targetLanguage}.\n` +
      `CRITICAL INSTRUCTION:\n` +
      `- Do NOT make it stiff, archaic, academic, or robotic.\n` +
      `- Translate it the exact way an actual person naturally and casually chats on WhatsApp or texting apps.\n` +
      `- Output ONLY the translated message text. Do not include quotes, explanations, prefixes, or disclaimers.\n\n` +
      `Original Spoken Message: ${text.trim()}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "You are a professional casual messaging translator. Output ONLY the casual translated message.",
      },
    });

    const translated = response.text?.trim().replace(/^["']|["']$/g, "") || text.trim();
    res.json({ translation: translated });
  } catch (err: any) {
    console.warn("[Diablo] Translate error:", err.message);
    res.status(500).json({ error: "Translation failed", translation: req.body?.text });
  }
});

// Setup WebSocket Server on /live path
const wss = new WebSocketServer({ server, path: "/live" });

wss.on("connection", (clientWs: WebSocket) => {
  console.log("[Diablo WS] Client connected to /live");
  let liveSession: any = null;
  let isClosing = false;
  const pendingToolCalls = new Map<string, string>();

  clientWs.on("message", async (rawMessage) => {
    try {
      const msg = JSON.parse(rawMessage.toString());

      if (msg.type === "init") {
        console.log("[Diablo WS] Initializing session with voice:", msg.voice, "language:", msg.activeLanguage || "default");
        const voiceName = msg.voice === "Female" || msg.voice === "Kore" ? "Kore" : "Fenrir";

        const systemInstruction = getDiabloSystemInstruction(msg.memory, msg.activeLanguage);

        if (!process.env.GEMINI_API_KEY) {
          const authError = "401 Unauthorized: GEMINI_API_KEY is not configured or missing.";
          console.error("[Diablo WS]", authError);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: "error", message: authError }));
          }
          return;
        }

        try {
          const ai = getGenAI();
          let isReadySent = false;
          const markReady = () => {
            if (!isReadySent && clientWs.readyState === WebSocket.OPEN) {
              isReadySent = true;
              console.log("[Diablo Live] Gemini Live ready sent to client. Voice:", voiceName);
              clientWs.send(JSON.stringify({ type: "ready", voice: voiceName }));
            }
          };

          // Use the verified bidirectional native audio model
          liveSession = await ai.live.connect({
            model: "gemini-3.1-flash-live-preview",
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName,
                  },
                },
              },
              systemInstruction,
              tools: diabloTools,
              outputAudioTranscription: {},
              inputAudioTranscription: {},
            },
            callbacks: {
              onopen: () => {
                console.log("[Diablo Live] Gemini Live session onopen triggered");
                markReady();
              },
              onmessage: (serverMessage: LiveServerMessage) => {
                if (clientWs.readyState !== WebSocket.OPEN) return;

                if ((serverMessage as any).setupComplete) {
                  console.log("[Diablo Live] setupComplete received from Gemini");
                  markReady();
                }

                // Audio chunks from model turn
                const parts = serverMessage.serverContent?.modelTurn?.parts;
                if (parts && parts.length > 0) {
                  for (const part of parts) {
                    if (part.inlineData?.data) {
                      clientWs.send(JSON.stringify({
                        type: "audio",
                        data: part.inlineData.data,
                      }));
                    }
                    if (part.text) {
                      clientWs.send(JSON.stringify({
                        type: "modelTranscript",
                        text: part.text,
                      }));
                    }
                  }
                }

                // Model speech output transcription stream
                const outputText = serverMessage.serverContent?.outputTranscription?.text;
                if (outputText) {
                  clientWs.send(JSON.stringify({
                    type: "modelTranscript",
                    text: outputText,
                  }));
                }

                // User speech input transcription stream (Live STT from Gemini)
                const inputText = serverMessage.serverContent?.inputTranscription?.text;
                if (inputText) {
                  clientWs.send(JSON.stringify({
                    type: "userTranscript",
                    text: inputText,
                  }));
                }

                // Interrupted notification
                if (serverMessage.serverContent?.interrupted) {
                  console.log("[Diablo Live] User interrupted Diablo");
                  clientWs.send(JSON.stringify({ type: "interrupted" }));
                }

                // Turn complete
                if (serverMessage.serverContent?.turnComplete) {
                  clientWs.send(JSON.stringify({ type: "turnComplete" }));
                }

                // Function/Tool calls from Gemini Live
                const toolCall = serverMessage.toolCall;
                if (toolCall?.functionCalls && toolCall.functionCalls.length > 0) {
                  for (const call of toolCall.functionCalls) {
                    if (call.id) {
                      pendingToolCalls.set(call.id, call.name || "action");
                    }
                    console.log("[Diablo Live] Function call received:", call.name, call.args);
                    clientWs.send(JSON.stringify({
                      type: "toolCall",
                      id: call.id,
                      name: call.name,
                      args: call.args,
                    }));
                  }
                }
              },
              onerror: (err: any) => {
                const errorDetail = err?.message || (typeof err === "object" ? JSON.stringify(err) : String(err));
                console.error("[Diablo Live] Gemini Live error:", errorDetail);
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({
                    type: "error",
                    message: errorDetail || "Gemini Live session error",
                  }));
                }
              },
              onclose: (closeEvt: any) => {
                console.log("[Diablo Live] Gemini Live session closed:", closeEvt?.code, closeEvt?.reason);
                if (clientWs.readyState === WebSocket.OPEN && !isClosing) {
                  clientWs.send(JSON.stringify({
                    type: "sessionClosed",
                    code: closeEvt?.code,
                    reason: closeEvt?.reason || "Gemini Live session closed",
                  }));
                }
              },
            },
          });
        } catch (connErr: any) {
          const rawMsg = connErr?.message || String(connErr);
          console.error("[Diablo WS] Failed to connect to Gemini Live:", rawMsg);
          let diagnosticMsg = rawMsg;
          if (/API[ _]?key|unauthorized|401|403|API_KEY_INVALID/i.test(rawMsg)) {
            diagnosticMsg = `401 Unauthorized: Invalid or rejected Gemini API Key. Details: ${rawMsg}`;
          } else if (/ENOTFOUND|EAI_AGAIN|DNS|getaddrinfo/i.test(rawMsg)) {
            diagnosticMsg = `DNS error: Unable to resolve Google Gemini API host. Details: ${rawMsg}`;
          }
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({
              type: "error",
              message: diagnosticMsg,
            }));
          }
        }
      } else if (msg.type === "audio") {
        // Stream raw PCM 16kHz audio chunk to Gemini Live
        if (liveSession && typeof liveSession.sendRealtimeInput === "function") {
          try {
            liveSession.sendRealtimeInput({
              audio: {
                data: msg.data,
                mimeType: "audio/pcm;rate=16000",
              },
            });
          } catch (audioErr: any) {
            console.error("[Diablo Live] Error sending realtime audio chunk:", audioErr.message);
          }
        }
      } else if (msg.type === "text") {
        // Client sent text query or command
        if (liveSession && typeof liveSession.sendClientContent === "function") {
          liveSession.sendClientContent({
            turns: [{ role: "user", parts: [{ text: msg.text }] }],
            turnComplete: true,
          });
        }
      } else if (msg.type === "memoryUpdate") {
        // Client signaled dynamic fact persistence update
        console.log("[Diablo WS] Live memory update received:", msg.key, "=", msg.value);
        if (liveSession && typeof liveSession.sendClientContent === "function") {
          try {
            liveSession.sendClientContent({
              turns: [
                {
                  role: "user",
                  parts: [
                    {
                      text: `[SYSTEM MEMORY UPDATE]: Boss has permanently saved a personal fact into storage: "${msg.key}: ${msg.value}". This fact is part of your permanent recall about Boss. Acknowledge and remember it.`,
                    },
                  ],
                },
              ],
              turnComplete: false,
            });
            console.log("[Diablo Live] Injected real-time memory update into active session.");
          } catch (memErr: any) {
            console.warn("[Diablo Live] Memory update notice:", memErr?.message);
          }
        }
      } else if (msg.type === "toolResponse") {
        // Function call execution result returned from client
        if (liveSession && typeof liveSession.sendToolResponse === "function") {
          const callId = msg.id || "";
          const callName = msg.name || (callId ? pendingToolCalls.get(callId) : "") || "action";
          if (callId) {
            pendingToolCalls.delete(callId);
          }
          console.log("[Diablo Live] Sending tool response to Gemini:", callId, callName, msg.response);

          let responseObj: Record<string, unknown>;
          try {
            responseObj = (typeof msg.response === "object" && msg.response !== null)
              ? JSON.parse(JSON.stringify(msg.response))
              : { output: String(msg.response ?? "success") };
          } catch {
            responseObj = { output: "action completed" };
          }

          try {
            liveSession.sendToolResponse({
              functionResponses: [
                {
                  id: callId,
                  name: callName,
                  response: responseObj,
                },
              ],
            });
          } catch (toolErr: any) {
            console.error("[Diablo Live] Error sending tool response:", toolErr);
          }
        }
      } else if (msg.type === "interrupt") {
        // Client detected barge-in locally
        console.log("[Diablo WS] Client signaled local barge-in");
      }
    } catch (parseError: any) {
      console.error("[Diablo WS] Message error:", parseError);
    }
  });

  clientWs.on("close", () => {
    isClosing = true;
    pendingToolCalls.clear();
    console.log("[Diablo WS] Client disconnected");
    if (liveSession && typeof liveSession.close === "function") {
      try {
        liveSession.close();
      } catch (e) {
        // ignore
      }
      liveSession = null;
    }
  });

  clientWs.on("error", (err) => {
    console.error("[Diablo WS] WebSocket client error:", err);
  });
});

// Setup Vite or static serving
async function setupApp() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Diablo AI Voice Assistant server listening on http://0.0.0.0:${PORT}`);
    warmupGemini().catch(() => {});
  });
}

setupApp();
