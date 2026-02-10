import { Monitor } from 'lucide-react';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <header className="border-b border-surface-border">
        <div className="max-w-2xl mx-auto px-6 py-6 flex items-center gap-3">
          <Monitor className="w-7 h-7 text-brand-green" />
          <h1 className="font-display text-3xl text-brand-green tracking-wide">
            SlideForge
          </h1>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
        {children}
      </main>

      <footer className="border-t border-surface-border">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <p className="text-text-secondary text-xs text-center">
            SlideForge — HTML Slide to PNG Renderer — Built for Reset
          </p>
        </div>
      </footer>
    </div>
  );
}
