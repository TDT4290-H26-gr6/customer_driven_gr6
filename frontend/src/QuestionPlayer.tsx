import { useEffect, useRef } from "react";
import "@pie-framework/pie-fixed-player-static";

type PieContent = {
  elements: Record<string, string>;
  models: any[];
  markup: string;
};

export function QuestionPlayer({ content }: { content: PieContent }) {
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