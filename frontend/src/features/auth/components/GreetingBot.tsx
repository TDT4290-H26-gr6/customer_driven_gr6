import { useEffect, useRef } from "react";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { MOBILE_QUERY } from "@/shared/lib/breakpoints";
import styles from "./GreetingBot.module.css";

/**
 * The waving 3D robot beside the login card. Purely decorative: hidden from
 * screen readers, and not rendered at all on mobile, where there's no room
 * beside the card (so phones never download three.js either). The scene is
 * loaded lazily, in its own chunk, so the rest of the app doesn't pay for it;
 * if it can't load or the browser has no WebGL, the space just stays empty.
 */
export function GreetingBot() {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (isMobile || !container) return;
    let dispose: (() => void) | undefined;
    let cancelled = false;

    import("./greetingBotScene")
      .then(({ createGreetingBot }) => {
        if (cancelled) return;
        dispose = createGreetingBot(container).dispose;
      })
      .catch(() => {
        // No WebGL (or the chunk failed to load): the login works without it.
      });

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [isMobile]);

  if (isMobile) return null;
  return <div ref={containerRef} className={styles.bot} aria-hidden="true" />;
}
