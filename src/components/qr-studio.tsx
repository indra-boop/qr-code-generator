import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  buildSymbol,
  clampSize,
  DEFAULT_BG,
  DEFAULT_FG,
  DEFAULT_LOGO_SCALE,
  ECC_LEVELS,
  loadLogo,
  logoGeometry,
  MAX_LOGO_SCALE,
  MAX_PX,
  MIN_LOGO_SCALE,
  MIN_PX,
  modulesToPath,
  normalizeHex,
  payloadHint,
  pngFileName,
  QUIET_ZONE,
  scanWarning,
  symbolToPng,
  type EccLevel,
} from "@/lib/qr";
import { cn } from "@/lib/utils";

const SAMPLE = "https://example.com";

export function QrStudio() {
  const [text, setText] = useState(SAMPLE);
  const [fg, setFg] = useState(DEFAULT_FG);
  const [bg, setBg] = useState(DEFAULT_BG);
  const [size, setSize] = useState(320);
  const [sizeDraft, setSizeDraft] = useState("320");
  const [ecc, setEcc] = useState<EccLevel>("M");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPercent, setLogoPercent] = useState(Math.round(DEFAULT_LOGO_SCALE * 100));
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoUrlRef = useRef<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const value = text.trim();
  const built = useMemo(() => {
    if (!value) return { symbol: null, error: null as string | null };
    try {
      return { symbol: buildSymbol(value, ecc), error: null };
    } catch (error) {
      return {
        symbol: null,
        error: error instanceof Error ? error.message : "Could not build this code.",
      };
    }
  }, [value, ecc]);

  const warning = built.symbol ? scanWarning(fg, bg) : null;
  const logoNote =
    built.symbol && logoUrl && ecc !== "H"
      ? "The logo covers the center. High error correction scans more reliably."
      : null;
  const alert = built.error ?? exportError;
  const level = ECC_LEVELS.find((item) => item.id === ecc) ?? ECC_LEVELS[1];
  const modules = built.symbol?.modules.size ?? null;
  const statusText =
    alert ??
    warning ??
    logoNote ??
    (built.symbol ? "QR code ready." : "Enter a URL or some text.");

  useEffect(() => {
    setSizeDraft(String(size));
  }, [size]);

  useEffect(() => {
    setExportError(null);
  }, [value, fg, bg, size, ecc, logoUrl, logoPercent]);

  useEffect(() => {
    return () => {
      if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current);
    };
  }, []);

  function chooseLogo(file: File | null) {
    setLogoError(null);
    if (logoUrlRef.current) {
      URL.revokeObjectURL(logoUrlRef.current);
      logoUrlRef.current = null;
    }
    if (!file) {
      setLogoUrl(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setLogoUrl(null);
      setLogoError("Choose an image file.");
      return;
    }
    const url = URL.createObjectURL(file);
    logoUrlRef.current = url;
    setLogoUrl(url);
  }

  async function onDownload() {
    if (!built.symbol) return;
    setSaving(true);
    setExportError(null);
    try {
      const logo = logoUrl ? await loadLogo(logoUrl) : null;
      const blob = await symbolToPng(built.symbol.modules, {
        size,
        fg,
        bg,
        logo,
        logoScale: logoPercent / 100,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = pngFileName(value);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Could not create the PNG.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,22rem)]"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="contents lg:grid lg:gap-6">
        <section className="order-1 min-w-0 rounded-xl border border-border bg-surface p-5 lg:order-none">
        <div className="grid gap-2">
          <Label htmlFor="payload">URL or text</Label>
          <Textarea
            id="payload"
            name="payload"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={4}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="https://example.com"
            aria-describedby="payload-hint"
          />
          <p id="payload-hint" className="text-sm text-muted">
            {payloadHint(text)}
          </p>
        </div>
      </section>

      <section className="order-3 min-w-0 rounded-xl border border-border bg-surface p-5 lg:order-none">
        <div className="grid gap-6">
          <fieldset className="grid gap-3">
            <legend className="text-sm font-medium text-fg">Colors</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField id="foreground" label="Foreground" value={fg} onChange={setFg} />
              <ColorField id="background" label="Background" value={bg} onChange={setBg} />
            </div>
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => {
                setFg(bg);
                setBg(fg);
              }}
            >
              <ArrowLeftRight aria-hidden="true" className="size-4" />
              Swap colors
            </Button>
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="text-sm font-medium text-fg">Center logo</legend>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  className="size-11 rounded-md border border-border bg-bg object-contain"
                />
              ) : null}
              <Input
                id="logo-file"
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                aria-label="Center logo"
                aria-describedby="logo-hint"
                className="min-w-0 flex-1 file:me-3 file:h-9 file:rounded-md file:border file:border-border file:bg-bg file:px-3 file:text-sm file:font-medium file:text-fg"
                onChange={(event) => {
                  chooseLogo(event.target.files?.[0] ?? null);
                }}
              />
            </div>
            {logoUrl ? (
              <>
                <div className="flex items-end justify-between gap-3">
                  <Label id="logo-size-label">Logo size</Label>
                  <span className="text-sm text-muted tabular-nums">{logoPercent}%</span>
                </div>
                <Slider
                  aria-labelledby="logo-size-label"
                  aria-label="Center logo size"
                  min={Math.round(MIN_LOGO_SCALE * 100)}
                  max={Math.round(MAX_LOGO_SCALE * 100)}
                  step={1}
                  value={[logoPercent]}
                  onValueChange={(next) => {
                    const percent = next[0];
                    if (percent != null) setLogoPercent(percent);
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    chooseLogo(null);
                    if (logoInputRef.current) logoInputRef.current.value = "";
                  }}
                >
                  Remove logo
                </Button>
              </>
            ) : null}
            <p id="logo-hint" className="text-sm text-muted">
              Placed in the middle, on a pad the same color as the background.
            </p>
            {logoError ? (
              <p className="text-sm text-danger" role="alert">
                {logoError}
              </p>
            ) : null}
          </fieldset>

          <div className="grid gap-2">
            <div className="flex items-end justify-between gap-3">
              <Label htmlFor="qr-size">Size</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="qr-size"
                  className="w-24 text-right tabular-nums"
                  type="number"
                  inputMode="numeric"
                  min={MIN_PX}
                  max={MAX_PX}
                  step={1}
                  value={sizeDraft}
                  aria-describedby="size-hint"
                  onChange={(event) => {
                    const nextRaw = event.target.value;
                    setSizeDraft(nextRaw);
                    const next = Number(nextRaw);
                    if (Number.isFinite(next) && next >= MIN_PX && next <= MAX_PX) {
                      setSize(Math.round(next));
                    }
                  }}
                  onBlur={() => {
                    const next = clampSize(Number(sizeDraft));
                    setSize(next);
                    setSizeDraft(String(next));
                  }}
                />
                <span className="text-sm text-muted">px</span>
              </div>
            </div>
            <Slider
              aria-label="QR code size in pixels"
              min={MIN_PX}
              max={MAX_PX}
              step={8}
              value={[size]}
              onValueChange={(next) => {
                const valuePx = next[0];
                if (valuePx != null) setSize(clampSize(valuePx));
              }}
            />
            <p id="size-hint" className="text-sm text-muted">
              From {MIN_PX} to {MAX_PX} pixels. The on-screen mark scales down to fit.
            </p>
          </div>

          <fieldset className="grid gap-3">
            <legend className="text-sm font-medium text-fg">Error correction</legend>
            <p id="ecc-hint" className="text-sm text-muted">
              Higher levels survive scratches and logos, but hold less text.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="presentation">
              {ECC_LEVELS.map((item) => {
                const selected = ecc === item.id;
                return (
                  <label
                    key={item.id}
                    className={cn(
                      "relative flex min-h-11 cursor-pointer flex-col justify-center rounded-md border px-3 py-2 transition-colors duration-200",
                      selected
                        ? "border-primary bg-primary text-primary-fg"
                        : "border-border bg-surface text-fg hover:bg-bg",
                    )}
                  >
                    <input
                      type="radio"
                      name="error-correction"
                      value={item.id}
                      checked={selected}
                      onChange={() => setEcc(item.id)}
                      className="absolute inset-0 cursor-pointer opacity-0"
                      aria-describedby="ecc-hint"
                    />
                    <span className="text-sm font-medium">{item.name}</span>
                    <span className={cn("text-xs", selected ? "text-primary-fg" : "text-muted")}>
                      {item.detail}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>
      </section>
      </div>

      <aside className="order-2 min-w-0 self-start rounded-xl border border-border bg-surface p-5 shadow-panel lg:sticky lg:top-6 lg:order-none">
        <h2 className="sr-only">Preview</h2>
        <div className="flex min-h-48 items-center justify-center">
          {built.symbol ? (
            <QrMark
              path={modulesToPath(built.symbol.modules)}
              modules={built.symbol.modules.size}
              size={size}
              fg={fg}
              bg={bg}
              logoUrl={logoUrl}
              logoScale={logoPercent / 100}
              label={
                logoUrl
                  ? `QR code for ${value.slice(0, 100)} with a center logo`
                  : `QR code for ${value.slice(0, 120)}`
              }
            />
          ) : (
            <p className="max-w-xs text-center text-sm text-muted">
              {built.error ?? "Enter a URL or some text to see the code."}
            </p>
          )}
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4 text-sm">
          <Stat label="Size" value={`${size} px`} />
          <Stat label="Grid" value={modules ? `${modules} × ${modules}` : "—"} />
          <Stat label="Level" value={level.name} />
        </dl>

        <p
          id="qr-status"
          role="status"
          aria-live="polite"
          className={cn(
            alert
              ? "mt-3 text-sm text-danger"
              : warning || logoNote
                ? "mt-3 text-sm text-fg"
                : "sr-only",
          )}
        >
          {statusText}
        </p>

        <Button
          type="button"
          className="mt-4 w-full"
          disabled={!built.symbol || saving}
          onClick={() => void onDownload()}
        >
          <Download aria-hidden="true" className="size-4" />
          {saving ? "Preparing PNG…" : "Download PNG"}
        </Button>
        <p className="mt-2 text-center text-sm text-muted">
          Square PNG, {size} × {size} pixels, with a quiet zone.
        </p>
      </aside>
    </form>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function QrMark({
  path,
  modules,
  size,
  fg,
  bg,
  logoUrl,
  logoScale,
  label,
}: {
  path: string;
  modules: number;
  size: number;
  fg: string;
  bg: string;
  logoUrl: string | null;
  logoScale: number;
  label: string;
}) {
  const clipId = useId().replace(/:/g, "");
  const total = modules + QUIET_ZONE * 2;
  const box = logoUrl ? logoGeometry(total, modules, logoScale) : null;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${total} ${total}`}
      width={size}
      height={size}
      role="img"
      aria-label={label}
      className="h-auto max-w-full"
    >
      <rect width={total} height={total} fill={bg} />
      <path d={path} fill={fg} shapeRendering="crispEdges" />
      {box && logoUrl ? (
        <>
          <rect
            x={box.padX}
            y={box.padY}
            width={box.pad}
            height={box.pad}
            rx={box.padRadius}
            fill={bg}
          />
          <defs>
            <clipPath id={clipId}>
              <rect
                x={box.markX}
                y={box.markY}
                width={box.mark}
                height={box.mark}
                rx={box.markRadius}
              />
            </clipPath>
          </defs>
          <image
            href={logoUrl}
            x={box.markX}
            y={box.markY}
            width={box.mark}
            height={box.mark}
            preserveAspectRatio="xMidYMid meet"
            clipPath={`url(#${clipId})`}
          />
        </>
      ) : null}
    </svg>
  );
}

function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const invalid = normalizeHex(draft) == null;
  const errorId = `${id}-error`;

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <input
          type="color"
          value={value}
          aria-label={`${label} picker`}
          onChange={(event) => {
            const next = event.target.value.toLowerCase();
            setDraft(next);
            onChange(next);
          }}
          className="size-11 shrink-0 cursor-pointer rounded-md border border-border bg-surface"
        />
        <Input
          id={id}
          value={draft}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          maxLength={7}
          aria-invalid={invalid}
          aria-describedby={errorId}
          className="font-mono uppercase tracking-wide"
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            const hex = normalizeHex(next);
            if (hex) onChange(hex);
          }}
          onBlur={() => setDraft(value)}
        />
      </div>
      <p id={errorId} className={cn("text-sm text-danger", !invalid && "sr-only")}>
        {invalid ? "Enter a hex color like #1a1a18." : ""}
      </p>
    </div>
  );
}
