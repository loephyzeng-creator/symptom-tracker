import { useState, useEffect } from "react";
import { X, Share, PlusSquare, Smartphone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Detect if the app is running in standalone mode (installed as PWA)
 */
function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

/**
 * Detect iOS Safari
 */
function isIOSSafari(): boolean {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  return isIOS && isSafari;
}

/**
 * Detect Android Chrome
 */
function isAndroidChrome(): boolean {
  const ua = navigator.userAgent;
  return /Android/.test(ua) && /Chrome/.test(ua);
}

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export default function PWAInstallPrompt() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const platform = isIOSSafari() ? "ios" : isAndroidChrome() ? "android" : "other";

  useEffect(() => {
    // Don't show if already installed
    if (isStandalone()) return;

    // Check if user dismissed recently
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      if (Date.now() - dismissedAt < DISMISS_DURATION) return;
    }

    // Listen for beforeinstallprompt (Chrome/Android)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // For iOS, show after a short delay
    if (platform === "ios") {
      const timer = setTimeout(() => setShow(true), 2000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", handler);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [platform]);

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === "accepted") {
        setShow(false);
      }
      setDeferredPrompt(null);
    }
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed bottom-20 left-4 right-4 z-[100] max-w-lg mx-auto"
      >
        <div className="bg-card rounded-2xl shadow-lg border border-border/50 p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-5 h-5 text-terracotta" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-foreground mb-1">
                添加到主屏幕
              </h3>
              {platform === "ios" ? (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  点击底部 <Share className="w-3.5 h-3.5 inline-block mx-0.5 -mt-0.5 text-blue-500" /> 分享按钮，然后选择
                  「<PlusSquare className="w-3.5 h-3.5 inline-block mx-0.5 -mt-0.5" /> 添加到主屏幕」，即可像 APP 一样使用
                </p>
              ) : deferredPrompt ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    安装到主屏幕，像原生 APP 一样使用
                  </p>
                  <button
                    onClick={handleInstall}
                    className="text-xs bg-terracotta text-white px-4 py-1.5 rounded-lg hover:bg-terracotta/90 transition-colors"
                  >
                    立即安装
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  使用浏览器菜单中的「添加到主屏幕」，即可像 APP 一样使用
                </p>
              )}
            </div>
            <button
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
