import { useEffect, useRef } from "react";
import "@pie-framework/pie-fixed-player-static";
import type { PieContent } from "../types";

export function PieQuestionPlayer({ content }: { content: PieContent }) {
  const ref = useRef<any>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.env = { mode: "gather", role: "student" };
      ref.current.config = content;
    }
  }, [content]);

  useEffect(() => {
    if (!ref.current) return;
    const handler = (e: any) => {
      console.log("session-changed:", e.detail);
    };
    ref.current.addEventListener("session-changed", handler);
    return () => ref.current?.removeEventListener("session-changed", handler);
  }, []);

  return <pie-fixed-player ref={ref}></pie-fixed-player>;
}
