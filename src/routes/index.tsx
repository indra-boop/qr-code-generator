import { createFileRoute } from "@tanstack/react-router";
import { QrStudio } from "@/components/qr-studio";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <header className="mb-8 max-w-xl">
        <p className="text-sm font-medium text-muted">QR code Generator</p>
        <h1 className="mt-1 text-4xl font-medium leading-tight tracking-tight">Make a QR code</h1>
        <p className="mt-2 text-muted">
          Type a URL or any text. The preview updates immediately — then save a PNG.
        </p>
      </header>
      <QrStudio />
    </main>
  );
}
