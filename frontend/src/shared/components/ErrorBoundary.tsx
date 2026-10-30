import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./Button";
import styles from "./ErrorBoundary.module.css";

type Props = {
  children: ReactNode;
  /** When this changes (e.g. the route), a caught error is cleared and the children render again. */
  resetKey?: unknown;
};

type State = { error: Error | null };

/**
 * Catches an error thrown while rendering its children and shows a fallback
 * instead of unmounting the whole app to a blank page. React only supports
 * this as a class component. It does not catch errors in event handlers or
 * promises, those are handled where they happen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Render error caught by ErrorBoundary:", error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className={styles.fallback} role="alert">
        <h1 className={styles.heading}>Something went wrong</h1>
        <p className={styles.text}>
          This page ran into an unexpected problem. Reloading usually fixes it.
        </p>
        <Button onClick={() => window.location.reload()}>Reload page</Button>
      </div>
    );
  }
}
