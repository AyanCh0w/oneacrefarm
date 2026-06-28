"use client";

import { useEffect } from "react";

export function ThemeSync() {
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const syncTheme = () => {
      if (mediaQuery.matches) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };

    syncTheme();
    mediaQuery.addEventListener("change", syncTheme);
    window.addEventListener("pageshow", syncTheme);
    document.addEventListener("visibilitychange", syncTheme);

    return () => {
      mediaQuery.removeEventListener("change", syncTheme);
      window.removeEventListener("pageshow", syncTheme);
      document.removeEventListener("visibilitychange", syncTheme);
    };
  }, []);

  return null;
}
