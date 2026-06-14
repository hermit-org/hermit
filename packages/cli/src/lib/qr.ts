import QRCode from "qrcode";

export interface ConnectionPayload {
  url: string;
  sendUrl: string;
  token: string;
}

export function encodeConnectionPayload(payload: ConnectionPayload): string {
  return JSON.stringify(payload);
}

export function decodeConnectionPayload(input: string): ConnectionPayload {
  const trimmed = input.trim();
  // Accept either raw JSON or a hermit://connect?payload=... deep link.
  const deepLinkMatch = trimmed.match(/^hermit:\/\/connect\?payload=(.+)$/);
  const json = deepLinkMatch ? decodeURIComponent(deepLinkMatch[1]) : trimmed;
  return JSON.parse(json) as ConnectionPayload;
}

export async function generateQrTerminal(payload: ConnectionPayload): Promise<string> {
  return QRCode.toString(encodeConnectionPayload(payload), {
    type: "terminal",
    errorCorrectionLevel: "M",
    margin: 1,
  });
}

export async function generateQrDataUrl(payload: ConnectionPayload): Promise<string> {
  return QRCode.toDataURL(encodeConnectionPayload(payload), {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 400,
  });
}

export async function generateQrBuffer(payload: ConnectionPayload): Promise<Buffer> {
  return QRCode.toBuffer(encodeConnectionPayload(payload), {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 400,
    type: "png",
  });
}
