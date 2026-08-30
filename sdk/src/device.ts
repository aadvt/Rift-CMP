export type DeviceInfo = {
  type: "desktop" | "mobile" | "tablet";
  browser: string;
  os: string;
};

export function getDeviceInfo(): DeviceInfo {
  const userAgent = navigator.userAgent;

  const type: DeviceInfo["type"] = /iPad|Tablet|PlayBook|Silk/i.test(userAgent)
    ? "tablet"
    : /Mobi|Android|iPhone|iPod|Mobile/i.test(userAgent)
      ? "mobile"
      : "desktop";

  const browser = /EdgA?|EdgiOS|Edg/i.test(userAgent)
    ? "Edge"
    : /OPR|Opera/i.test(userAgent)
      ? "Opera"
      : /Chrome|CriOS/i.test(userAgent)
        ? "Chrome"
        : /Firefox|FxiOS/i.test(userAgent)
          ? "Firefox"
          : /Safari/i.test(userAgent)
            ? "Safari"
            : "Unknown";

  const os = /Windows NT/i.test(userAgent)
    ? "Windows"
    : /Mac OS X/i.test(userAgent)
      ? "macOS"
      : /Android/i.test(userAgent)
        ? "Android"
        : /iPhone|iPad|iPod/i.test(userAgent)
          ? "iOS"
          : /Linux/i.test(userAgent)
            ? "Linux"
            : "Unknown";

  return { type, browser, os };
}
