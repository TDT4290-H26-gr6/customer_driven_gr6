import { useEffect, useRef } from "react";
import "@pie-framework/pie-fixed-player-static";
import type { PieContent } from "../types";
import styles from "./PieQuestionPlayer.module.css";

export type PieAnswer = {
  /** The widget's own response payload (opaque) — fed back in via `answer` to restore. */
  session: unknown;
  /** Whether the item counts as answered — from the widget's own isComplete(). */
  complete: boolean;
};

type Props = {
  content: PieContent;
  /** A previously-saved answer for this item, to restore on mount (e.g. navigating Back). */
  answer?: PieAnswer;
  onAnswerChange?: (answer: PieAnswer) => void;
};

/**
 * The widget's own imperative properties, set directly on the element
 * rather than passed as JSX props — untyped upstream (pie-fixed-player-static
 * ships no .d.ts), so `session`/`config` stay `unknown` rather than `any`.
 */
type PieFixedPlayerElement = HTMLElement & {
  env: { mode: string; role: string };
  config: PieContent;
  session: unknown;
};

export function PieQuestionPlayer({ content, answer, onAnswerChange }: Props) {
  const ref = useRef<PieFixedPlayerElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.env = { mode: "gather", role: "student" };
      ref.current.config = content;
      if (answer?.session) ref.current.session = answer.session;
    }
    // Only re-applied when the item itself changes — this component is
    // remounted per question (see QuestionCard's key), so this effectively
    // runs once per question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  useEffect(() => {
    if (!ref.current) return;
    // session-changed's own e.detail is just {component: tagName, complete},
    // not the response itself — the actual answer lives on the element's
    // `.session` getter, read fresh at the moment the event fires.
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ complete?: boolean }>).detail;
      onAnswerChange?.({
        session: ref.current?.session,
        complete: Boolean(detail?.complete),
      });
    };
    ref.current.addEventListener("session-changed", handler);
    return () => ref.current?.removeEventListener("session-changed", handler);
  }, [onAnswerChange]);

  return (
    <div className={styles.canvas}>
      <pie-fixed-player ref={ref}></pie-fixed-player>
    </div>
  );
}
