"use client"

import { useState, useEffect } from "react"
import { useApp } from "@/context/app-context"
import { Button } from "@/components/ui/button"
import { X, Download, Smartphone } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function InstallPWAPrompt() {
  const { t } = useApp()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check if already installed
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true

    setIsStandalone(isStandaloneMode)

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent)
    setIsIOS(isIOSDevice)

    // Check if dismissed recently
    const dismissed = localStorage.getItem("pwa-prompt-dismissed")
    if (dismissed) {
      const dismissedTime = Number.parseInt(dismissed)
      const hoursSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60)
      if (hoursSinceDismissed < 24) {
        return
      }
    }

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Show after 30 seconds on page
      setTimeout(() => setShowPrompt(true), 30000)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall)

    // For iOS, show after delay since there's no beforeinstallprompt
    if (isIOSDevice && !isStandaloneMode) {
      setTimeout(() => setShowPrompt(true), 30000)
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall)
    }
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === "accepted") {
        setShowPrompt(false)
        setDeferredPrompt(null)
      }
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem("pwa-prompt-dismissed", Date.now().toString())
  }

  if (isStandalone || !showPrompt) return null

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 lg:left-auto lg:right-6 lg:bottom-6 lg:w-80 animate-fade-in-up">
      <div className="glass-card p-4 border-kev-primary/30">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground rounded-md"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-kev-primary/20 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-6 h-6 text-kev-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">{t.pwa.installApp}</h3>
            <p className="text-xs text-muted-foreground mt-1">{isIOS ? t.pwa.iosTapShare : t.pwa.addToHomeScreen}</p>

            {!isIOS && deferredPrompt && (
              <Button
                size="sm"
                onClick={handleInstall}
                className="mt-3 gap-2 bg-kev-primary hover:bg-kev-primary-light"
              >
                <Download className="w-3.5 h-3.5" />
                {t.pwa.install}
              </Button>
            )}

            {isIOS && (
              <div className="mt-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  {t.pwa.tapThen}{" "}
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L12 14M12 2L8 6M12 2L16 6" stroke="currentColor" strokeWidth="2" fill="none" />
                    <path d="M4 14V20H20V14" stroke="currentColor" strokeWidth="2" fill="none" />
                  </svg>{" "}
                  {t.pwa.thenAddToHome}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
