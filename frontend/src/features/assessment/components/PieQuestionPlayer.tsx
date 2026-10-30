import { createElement, useEffect, useRef } from "react";
import type { NativeElementContent, PieContent } from "../types";
import { clearOthersIfIdk, IDK_VALUE } from "./idkSession";
import { loadPlacementOrdering } from "./loadNativeElement";
import { loadPiePlayer } from "./loadPiePlayer";
import styles from "./PieQuestionPlayer.module.css";

export type PieAnswer = {
  /** The widget's own response payload (opaque), fed back in via `answer` to restore. */
  session: unknown;
  /** Whether the item counts as answered, from the widget's own isComplete(). */
  complete: boolean;
};

type Props = {
  content: PieContent | NativeElementContent;
  /** A previously-saved answer for this item, to restore on mount (e.g. navigating Back). */
  answer?: PieAnswer;
  onAnswerChange?: (answer: PieAnswer) => void;
};

/**
 * The widget's own imperative properties, set directly on the element
 * rather than passed as JSX props, untyped upstream (pie-fixed-player-static
 * ships no .d.ts), so `session`/`config` stay `unknown` rather than `any`.
 */
type PieFixedPlayerElement = HTMLElement & {
  env: { mode: string; role: string };
  config: PieContent;
  session: unknown;
};

/**
 * A standalone PIE element's own imperative properties (no published
 * pie-fixed-player-static bundle includes placement-ordering, match or
 * match-list, so these are loaded and registered on their own, see
 * loadNativeElement.ts). `.model` takes that element's own content directly,
 * not a <pie-fixed-player>-style item config.
 */
type NativeQuestionElement = HTMLElement & {
  model: Record<string, unknown>;
  session: unknown;
};

/** One entry per native element this player can mount, see loadNativeElement.ts. */
const NATIVE_LOADERS: Record<string, () => Promise<void>> = {
  "aios-placement-ordering": loadPlacementOrdering,
};

function isNativeElementContent(
  content: PieContent | NativeElementContent,
): content is NativeElementContent {
  return "element" in content;
}

export function PieQuestionPlayer({ content, answer, onAnswerChange }: Props) {
  const ref = useRef<PieFixedPlayerElement | NativeQuestionElement>(null);
  const native = isNativeElementContent(content);

  useEffect(() => {
    // The player is loaded on first use (see loadPiePlayer/loadNativeElement);
    // the item is handed over once it's ready, since the element ignores it
    // before that.
    let cancelled = false;
    const nativeTag = native ? content.element : null;
    const load = native ? NATIVE_LOADERS[content.element] : loadPiePlayer;
    if (!load) {
      console.error(`PieQuestionPlayer: no loader registered for element "${nativeTag}"`);
      return;
    }
    load()
      .then(() => {
        if (cancelled || !ref.current) return;
        if (native) {
          (ref.current as NativeQuestionElement).model = content.model;
        } else {
          const element = ref.current as PieFixedPlayerElement;
          element.env = { mode: "gather", role: "student" };
          element.config = content;
        }
        if (answer?.session) ref.current.session = answer.session;
      })
      .catch(() => {
        // Left empty: the question can't be shown, and the learner can still
        // leave with Save & exit and come back.
      });
    return () => {
      cancelled = true;
    };
    // Only re-applied when the item itself changes, this component is
    // remounted per question (see QuestionCard's key), so this effectively
    // runs once per question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  useEffect(() => {
    if (!ref.current) return;
    // session-changed's own e.detail is just {component: tagName, complete},
    // not the response itself, the actual answer lives on the element's
    // `.session` getter, read fresh at the moment the event fires.
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ complete?: boolean }>).detail;
      const current = ref.current?.session;
      // "I don't know" excludes every other choice: untick them. Assigning
      // .session re-renders the widget; that may fire another session-changed,
      // which then finds nothing to clear.
      const session = clearOthersIfIdk(current);
      if (session !== current && ref.current) ref.current.session = session;
      onAnswerChange?.({ session, complete: Boolean(detail?.complete) });
    };
    ref.current.addEventListener("session-changed", handler);
    return () => ref.current?.removeEventListener("session-changed", handler);
  }, [onAnswerChange]);

  // While "I don't know" is ticked, other checkboxes can't be ticked (the CSS
  // greys them out; this stops the click itself).
  const blockOthersWhileIdk = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const input = target.closest("label, .choice-input")?.querySelector("input");
    if (!input || input.type !== "checkbox" || input.value === IDK_VALUE) return;
    const idk = e.currentTarget.querySelector<HTMLInputElement>(`input[value="${IDK_VALUE}"]`);
    if (idk?.checked) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <div className={styles.canvas} onClickCapture={blockOthersWhileIdk}>
      {native ? (
        // Dynamic, not JSX's <aios-placement-ordering> literal, so an
        // element with no entry in NATIVE_LOADERS still renders under its
        // own (empty) tag rather than silently masquerading as a
        // different one.
        createElement(content.element, { ref: ref as React.RefObject<NativeQuestionElement> })
      ) : (
        <pie-fixed-player ref={ref as React.RefObject<PieFixedPlayerElement>}></pie-fixed-player>
      )}
    </div>
  );
}
