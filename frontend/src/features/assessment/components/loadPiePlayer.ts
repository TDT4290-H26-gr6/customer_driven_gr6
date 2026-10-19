let loading: Promise<void> | undefined;

/**
 * Loads the PIE player (~1.6 MB with its question types and math rendering)
 * on first use instead of with the app, so pages without questions — the
 * login page included — don't download it. Resolves once <pie-fixed-player>
 * is defined: properties set on the element before that would be lost.
 * Loaded once; a failed load is retried on the next call.
 */
export function loadPiePlayer(): Promise<void> {
  loading ??= import("@pie-framework/pie-fixed-player-static")
    .then(() => customElements.whenDefined("pie-fixed-player"))
    .then(
      () => undefined,
      (error: unknown) => {
        loading = undefined;
        throw error;
      },
    );
  return loading;
}
