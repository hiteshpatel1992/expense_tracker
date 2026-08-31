"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function readDisplayMode() {
  if (typeof window === "undefined") {
    return { standalone: false, iosHint: false };
  }
  const media = window.matchMedia("(display-mode: standalone)");
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const standalone = media.matches || Boolean(nav.standalone);
  const isIos =
    /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
    (window.navigator.platform === "MacIntel" &&
      window.navigator.maxTouchPoints > 1);
  return { standalone, iosHint: isIos && !standalone };
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [mode, setMode] = useState({ standalone: false, iosHint: false });

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMode(readDisplayMode()));

    function onPrompt(event: Event) {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  if (mode.standalone) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  if (deferred) {
    return (
      <button type="button" className="btn ghost compact" onClick={install}>
        Add to home screen
      </button>
    );
  }

  if (mode.iosHint) {
    return (
      <p className="ios-hint">
        On iPhone: tap Share, then <strong>Add to Home Screen</strong>
      </p>
    );
  }

  return null;
}

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* ignore — install still works via manifest */
    });
  }, []);
  return null;
}
