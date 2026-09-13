/**
 * API & WebSocket Endpoint Configuration
 *
 * Supports:
 * 1. Single-origin / unified deployments (AI Studio preview, Docker, Render, Koyeb):
 *    Uses relative paths (/api/...) and the current origin for WebSockets (wss://host/live).
 * 2. Split deployments (e.g. Netlify/Vercel static frontend + free Render/Koyeb backend):
 *    Reads VITE_BACKEND_URL (e.g. https://my-diablo-backend.onrender.com) or VITE_WS_BACKEND_URL.
 */

export function getBackendBaseUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) {
    return (import.meta.env.VITE_BACKEND_URL as string).trim().replace(/\/+$/, '');
  }
  return '';
}

export function getBackendWsUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_BACKEND_URL) {
    const customWs = (import.meta.env.VITE_WS_BACKEND_URL as string).trim().replace(/\/+$/, '');
    return customWs.endsWith('/live') ? customWs : `${customWs}/live`;
  }

  const backendBase = getBackendBaseUrl();
  if (backendBase) {
    const wsProtocol = backendBase.startsWith('https://') ? 'wss://' : 'ws://';
    const hostAndPath = backendBase.replace(/^https?:\/\//, '');
    return `${wsProtocol}${hostAndPath}/live`;
  }

  if (typeof window !== 'undefined' && window.location) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/live`;
  }

  return 'ws://localhost:3000/live';
}

export function getApiUrl(endpoint: string): string {
  const base = getBackendBaseUrl();
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return base ? `${base}${path}` : path;
}
