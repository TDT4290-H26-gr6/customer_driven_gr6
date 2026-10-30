// JSX typing for the <pie-fixed-player> custom element from
// @pie-framework/pie-fixed-player-static.
//
// The element also carries dynamic, non-attribute properties (env, config,
// session) that PieQuestionPlayer sets imperatively via its ref rather than
// as JSX props, those are declared on `PieFixedPlayerElement` in
// PieQuestionPlayer.tsx instead of here, since JSX.IntrinsicElements only
// needs to describe what's valid to pass as JSX attributes.
declare namespace JSX {
  interface IntrinsicElements {
    "pie-fixed-player": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    // @pie-element/placement-ordering's delivery element, registered under
    // this tag by loadNativeElement.ts, see PieQuestionPlayer.tsx.
    "aios-placement-ordering": React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement>,
      HTMLElement
    >;
  }
}
