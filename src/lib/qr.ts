import QRCode, { type BitMatrix, type QRCode as QrSymbol } from "qrcode";

export type EccLevel = "L" | "M" | "Q" | "H";

export const ECC_LEVELS: { id: EccLevel; name: string; detail: string }[] = [
  { id: "L", name: "Low", detail: "7% recovery" },
  { id: "M", name: "Medium", detail: "15% recovery" },
  { id: "Q", name: "Quartile", detail: "25% recovery" },
  { id: "H", name: "High", detail: "30% recovery" },
];

export const DEFAULT_FG = "#1a1a18";
export const DEFAULT_BG = "#ffffff";
export const MIN_PX = 128;
export const MAX_PX = 1024;
export const QUIET_ZONE = 4;
export const MIN_LOGO_SCALE = 0.14;
export const MAX_LOGO_SCALE = 0.28;
export const DEFAULT_LOGO_SCALE = 0.22;

export type LogoBox = {
  padX: number;
  padY: number;
  pad: number;
  padRadius: number;
  markX: number;
  markY: number;
  mark: number;
  markRadius: number;
};

export function logoGeometry(total: number, dataSpan: number, scale: number): LogoBox {
  const clamped = Math.min(MAX_LOGO_SCALE, Math.max(MIN_LOGO_SCALE, scale));
  let mark = total * clamped;
  const maxMark = dataSpan * 0.32;
  if (mark > maxMark) mark = maxMark;
  let pad = mark * 1.14;
  const maxPad = dataSpan * 0.38;
  if (pad > maxPad) pad = maxPad;
  if (pad < mark) pad = mark;
  return {
    padX: (total - pad) / 2,
    padY: (total - pad) / 2,
    pad,
    padRadius: pad * 0.14,
    markX: (total - mark) / 2,
    markY: (total - mark) / 2,
    mark,
    markRadius: mark * 0.16,
  };
}

export function loadLogo(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read that logo."));
    image.src = url;
  });
}

type Rgb = [number, number, number];

export function clampSize(value: number): number {
  if (!Number.isFinite(value)) return 320;
  return Math.min(MAX_PX, Math.max(MIN_PX, Math.round(value)));
}

export function normalizeHex(value: string): string | null {
  const raw = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const expanded = raw
      .split("")
      .map((char) => char + char)
      .join("");
    return `#${expanded.toLowerCase()}`;
  }
  return null;
}

function hexToRgb(hex: string): Rgb | null {
  const normal = normalizeHex(hex);
  if (!normal) return null;
  const n = Number.parseInt(normal.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

export function contrastRatio(fg: string, bg: string): number | null {
  const a = luminance(fg);
  const b = luminance(bg);
  if (a == null || b == null) return null;
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export function scanWarning(fg: string, bg: string): string | null {
  const ratio = contrastRatio(fg, bg);
  const fgL = luminance(fg);
  const bgL = luminance(bg);
  if (ratio == null || fgL == null || bgL == null) return null;
  if (ratio < 3) {
    return "These colors are too close together. Scanners may not read the code.";
  }
  if (fgL > bgL) {
    return "The foreground is lighter than the background. Many cameras expect a dark mark on a light field.";
  }
  return null;
}

export function payloadHint(text: string): string {
  const value = text.trim();
  if (!value) return "A link needs http:// or https://. Anything else is stored as plain text.";
  if (/^https?:\/\//i.test(value)) return "Scanners will open this as a link.";
  if (/^[\w.-]+\.[a-z]{2,}([/?#]\S*)?$/i.test(value)) {
    return "This looks like a web address without https://. Scanners will treat it as plain text.";
  }
  return "Scanners will read this as plain text.";
}

export function pngFileName(text: string): string {
  const slug = text
    .trim()
    .replace(/^https?:\/\//i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${slug || "qr-code"}.png`;
}

export function buildSymbol(text: string, ecc: EccLevel): QrSymbol {
  try {
    return QRCode.create(text, { errorCorrectionLevel: ecc });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    if (/too big|too long|maximum/i.test(raw)) {
      throw new Error(
        "This text is too long for a QR code at this correction level. Shorten it, or choose Low.",
      );
    }
    throw new Error("This text can’t be encoded as a QR code.");
  }
}

export function modulesToPath(modules: BitMatrix, quiet = QUIET_ZONE): string {
  let path = "";
  for (let row = 0; row < modules.size; row += 1) {
    for (let col = 0; col < modules.size; col += 1) {
      if (modules.get(row, col)) {
        path += `M${col + quiet} ${row + quiet}h1v1h-1z`;
      }
    }
  }
  return path;
}

export function symbolToPng(
  modules: BitMatrix,
  opts: { size: number; fg: string; bg: string; logo?: HTMLImageElement | null; logoScale?: number },
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = opts.size;
  canvas.height = opts.size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Could not prepare the image."));

  const total = modules.size + QUIET_ZONE * 2;
  const cell = opts.size / total;
  ctx.fillStyle = opts.bg;
  ctx.fillRect(0, 0, opts.size, opts.size);
  ctx.fillStyle = opts.fg;

  for (let row = 0; row < modules.size; row += 1) {
    for (let col = 0; col < modules.size; col += 1) {
      if (!modules.get(row, col)) continue;
      const x0 = Math.round((col + QUIET_ZONE) * cell);
      const y0 = Math.round((row + QUIET_ZONE) * cell);
      const x1 = Math.round((col + QUIET_ZONE + 1) * cell);
      const y1 = Math.round((row + QUIET_ZONE + 1) * cell);
      ctx.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
    }
  }

  if (opts.logo) {
    const dataSpan = (modules.size / total) * opts.size;
    const box = logoGeometry(opts.size, dataSpan, opts.logoScale ?? DEFAULT_LOGO_SCALE);
    ctx.save();
    traceRoundRect(ctx, box.padX, box.padY, box.pad, box.pad, box.padRadius);
    ctx.fillStyle = opts.bg;
    ctx.fill();
    ctx.beginPath();
    traceRoundRect(ctx, box.markX, box.markY, box.mark, box.mark, box.markRadius);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    drawContained(ctx, opts.logo, box.markX, box.markY, box.mark);
    ctx.restore();
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not create the PNG."));
    }, "image/png");
  });
}

function traceRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawContained(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  size: number,
) {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (!iw || !ih) {
    ctx.drawImage(image, x, y, size, size);
    return;
  }
  const fit = Math.min(size / iw, size / ih);
  const w = iw * fit;
  const h = ih * fit;
  ctx.drawImage(image, x + (size - w) / 2, y + (size - h) / 2, w, h);
}
