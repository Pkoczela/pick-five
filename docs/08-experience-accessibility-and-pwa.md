# Plan 8 — Experience, Accessibility, and PWA

## Outcome

Polish the complete application into a coherent, accessible, mobile-first experience that players can add to a phone home screen and commissioners can operate confidently on phone or desktop.

This plan refines feature screens built in earlier plans; it does not postpone basic usability until the end.

## Experience principles

- The current-week home immediately answers: which week, how large is the jackpot, and have I submitted?
- Status is communicated with text and iconography, never color alone.
- Destructive or fairness-sensitive actions clearly state their effect before confirmation.
- Player flows prioritize one-handed phone use; commissioner tables progressively enhance for desktop.
- Dates always include meaningful local timezone context.
- Submitted, saved, locked, final, overridden, and stale states are never visually ambiguous.

## Work packages

### 8.1 Design foundation

- Define color, typography, spacing, radius, elevation, and status tokens.
- Build accessible primitives for buttons, fields, cards, alerts, dialogs, tables, tabs, skeletons, and toasts.
- Use consistent semantic status variants for pending/correct/incorrect/push/void and draft/open/locked/final.
- Maintain visible focus styles and keyboard navigation.

### 8.2 Mobile player flow review

Verify end-to-end at representative phone widths:

- sign in and access errors;
- current-week status;
- select, replace, and remove picks;
- sixth-pick message;
- sticky pick counter and safe-area inset;
- tiebreaker and submission review;
- post-submit/edit state;
- post-lock pool board;
- results, standings, and history.

No core player route may require horizontal scrolling or hover.

### 8.3 Commissioner responsiveness

- Use stacked cards or responsive row details on narrow screens.
- Retain efficient tables and optional workbook-like grid on larger screens.
- Keep high-risk actions visually distinct but not easy to trigger accidentally.
- Present setup completeness and result readiness as actionable checklists.

### 8.4 Accessibility

- Aim for WCAG 2.2 AA color contrast and interaction behavior.
- Minimum approximately 44 px touch targets for primary interactive rows.
- Use native labels, field descriptions, error association, headings, landmarks, and live regions where appropriate.
- Ensure dialogs trap/restore focus and confirmation is keyboard operable.
- Give status icons accessible names; avoid emoji-only meaning in controls.
- Test zoom/reflow and reduced motion.

### 8.5 Time and money presentation

- Store timestamps in UTC and render with the league timezone by default.
- Where useful, mention that the displayed deadline is Eastern/league time and optionally show the user-local equivalent.
- Use one tested money formatter from integer cents.
- Avoid ambiguous dates such as `10/11` without weekday/year context where needed.

### 8.6 PWA/installability

- Add a web app manifest, application name, theme/background colors, icons, and standalone metadata.
- Add iOS-compatible home-screen metadata.
- Verify icons and launch behavior on iOS Safari and Android Chrome where devices are available.
- Do not add offline data mutation or service-worker complexity in V1 unless required for installability.

### 8.7 Resilience states

Every data screen needs intentional:

- loading/skeleton state;
- empty state with next action;
- permission/access state;
- provider error and retry state;
- stale-data indicator when relevant;
- success confirmation;
- recoverable validation errors that preserve user input.

## Verification

- Automated accessibility checks on key pages plus keyboard/manual review.
- Visual viewport checks at 320, 375/390, 768, and desktop widths.
- Safari iOS-oriented review for sticky footer, safe-area, numeric input, magic links, and date display.
- Slow-network review for duplicate submission prevention and clear progress.
- PWA manifest/icon validation.

## Exit criteria

- A player can complete all weekly tasks comfortably from an iPhone browser.
- Core content remains readable and operable with keyboard, zoom, and assistive semantics.
- Commissioner workflows are usable at phone width and efficient on desktop.
- The app can be added to a phone home screen without pretending to support offline play.
