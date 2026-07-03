const normalizedBackendUrl = import.meta.env.VITE_BACKEND_URL?.trim().replace(
  /\/$/,
  "",
);
const normalizedSocketUrl = import.meta.env.VITE_SOCKET_URL?.trim().replace(
  /\/$/,
  "",
);

export function getBackendBaseUrl() {
  if (normalizedBackendUrl) {
    return normalizedBackendUrl;
  }

  if (import.meta.env.DEV) {
    return "";
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "";
}

export function buildApiUrl(path = "/api") {
  const backendBaseUrl = getBackendBaseUrl();

  if (!backendBaseUrl) {
    return path;
  }

  return `${backendBaseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function getSocketUrl() {
  if (normalizedSocketUrl) {
    return normalizedSocketUrl;
  }

  const backendBaseUrl = getBackendBaseUrl();
  if (backendBaseUrl) {
    return backendBaseUrl;
  }

  return import.meta.env.DEV ? "http://localhost:3000" : "";
}
