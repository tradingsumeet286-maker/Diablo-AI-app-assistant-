# Diablo AI Voice Assistant - Free Deployment Guide

This guide explains how to deploy the Diablo AI Voice Assistant outside Google AI Studio **without paid billing**, while retaining:
- Real-time Gemini Live bidirectional voice streaming over WebSockets (`/live`)
- Wake word detection ("Hey Diablo")
- Device actions & tools (WhatsApp, YouTube, Maps, Flashlight, Location, Screenshots, etc.)
- Server-side Gemini API key security (`GEMINI_API_KEY` is never exposed to the client)

---

## Why Netlify Returns 404 for `/live` and `/api/diablo/conversation`

1. **Netlify is a static Jamstack & serverless platform (AWS Lambda)**:
   - When Netlify runs `npm run build`, it only deploys the static client assets in `dist/` to its CDN edge servers.
   - Netlify does **NOT** run persistent Node.js servers (`node dist/server.cjs` or `npm start`). Therefore, `server.ts` never executes on Netlify.
2. **WebSockets are not supported on Serverless Functions**:
   - Gemini Live API requires a long-lived, persistent, full-duplex TCP/WebSocket connection (`/live`) to stream raw PCM audio and events. Serverless functions are ephemeral, event-driven HTTP request handlers with short timeouts and cannot maintain active bidirectional WebSocket streams.
3. **Endpoint mismatch**:
   - The original code exposed `/api/diablo/converse` and `/api/diablo/fallback`. We have now added `/api/diablo/conversation` as an explicit alias so both route names work identically.

---

## Architecture Overview

```
                          ┌────────────────────────────────────────────────────────┐
                          │         Unified Full-Stack Architecture                │
                          │   (Render Free Tier, Koyeb Free Tier, or Docker)       │
                          │                                                        │
Browser Client ──────────┼──► HTTP /api/health, /api/diablo/conversation, etc.   │
(Voice UI, HUD, Wake)    │    (Express Server)                                    │
                         │                                                        │
                         ├──► WebSocket /live ──► Google GenAI Live API (WSS)     │
                         │    (Full-duplex PCM)   (gemini-3.1-flash-live-preview) │
                         │                                                        │
                         └──► Static SPA Frontend Assets (dist/index.html)        │
                              (Served by Express)                                 │
                          └────────────────────────────────────────────────────────┘
```

---

## Recommended Free Deployment Methods (No Paid Billing)

### Option 1: Render.com (100% Free Tier - 1-Click Blueprint)

Render's free tier provides a persistent Node.js web service that supports HTTP + WebSockets on the exact same domain and port, with free automatic HTTPS.

1. Push this repository to **GitHub** or **GitLab**.
2. Go to [dashboard.render.com](https://dashboard.render.com/) and click **New > Blueprint** (or **New > Web Service**).
3. Connect your repository. Render will automatically read `render.yaml`.
4. In the Environment Variables section, add:
   - `GEMINI_API_KEY`: Your Google Gemini API key from [Google AI Studio](https://aistudio.google.com/).
5. Click **Apply / Deploy**.
6. Your assistant will be live at `https://<your-service>.onrender.com` with both frontend, REST APIs, and Gemini Live WebSockets working out of the box!

---

### Option 2: Koyeb (100% Free Tier - Native WebSockets)

Koyeb offers a free Eco tier with 512MB RAM, global edge network, and native persistent WebSocket support:

1. Push your repository to **GitHub**.
2. Log in to [koyeb.com](https://www.koyeb.com/) and create an **App**.
3. Choose **GitHub** as the deployment method.
4. Select your repository. Koyeb detects either the `Dockerfile` or Node build pack.
5. Set the Port to `3000`.
6. Add Environment Variable:
   - `GEMINI_API_KEY`: `your_gemini_api_key`
7. Click **Deploy**.

---

### Option 3: Docker (Run Anywhere for Free)

A production multi-stage `Dockerfile` is included in this repository.

1. **Build the container**:
   ```bash
   docker build -t diablo-assistant .
   ```
2. **Run the container**:
   ```bash
   docker run -p 3000:3000 -e GEMINI_API_KEY="your-gemini-api-key" diablo-assistant
   ```
3. Open `http://localhost:3000` in your browser.

---

### Option 4: Split Hosting (Frontend on Netlify + Backend on Render/Koyeb)

If you prefer to keep your frontend assets on Netlify:

1. Deploy the backend on Render (Option 1) or Koyeb (Option 2) to get a backend URL (e.g. `https://diablo-backend.onrender.com`).
2. In your Netlify Site Settings (`Site configuration > Environment variables`), add:
   - `VITE_BACKEND_URL`: `https://diablo-backend.onrender.com`
3. Trigger a redeploy on Netlify.
4. The Netlify frontend will automatically route all REST calls (`/api/diablo/...`) and the Gemini Live WebSocket (`wss://diablo-backend.onrender.com/live`) to your free backend, with CORS and WebSocket streaming fully operational!
