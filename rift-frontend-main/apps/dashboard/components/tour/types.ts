/**
 * The guided tour's vocabulary.
 *
 * Steps are data, not components, so a page contributes to the tour by naming
 * an element rather than by rendering anything. That keeps the explanation out
 * of the screens it explains — twenty-eight pages carrying tour markup would
 * mean twenty-eight places for it to rot.
 */

export interface TourStep {
  /**
   * The `data-tour` value of the element this step is about.
   *
   * Omitted for a step that introduces the page as a whole, which renders
   * centred with no spotlight.
   *
   * A step whose anchor is not on the page is skipped rather than shown
   * pointing at nothing. That is not an edge case here: half these screens
   * render an empty state before the first scan, so "the findings table" is
   * genuinely absent on a new account and the tour has to cope with it.
   */
  anchor?: string;

  title: string;

  /**
   * One or two sentences. The tour explains what a thing is for and what it
   * will not do — it is not documentation, and a bubble somebody has to read
   * twice has failed at the only job it has.
   */
  body: string;

  /** Preferred side. The engine flips it when there is no room. */
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export interface TourDefinition {
  /**
   * Stable id, used as the localStorage key.
   *
   * Versioned by the store, not here, so rewriting a tour's steps can re-show
   * it to people who have already seen the old one.
   */
  id: string;
  /** Shown in the bubble's header so somebody knows what is being explained. */
  label: string;
  steps: TourStep[];
}
