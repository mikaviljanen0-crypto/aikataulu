/**
 * Both schedule panes scroll vertically together while retaining
 * independent horizontal scrolling for the table and the Gantt.
 * Avoids feedback loops by only applying actual differences.
 */
export function syncScheduleVerticalScroll(
  source: HTMLElement,
  targetSelector: ".task-pane" | ".gantt-pane",
): void {
  const other = source.parentElement?.querySelector<HTMLElement>(targetSelector);
  if (!other) return;
  if (Math.abs(other.scrollTop - source.scrollTop) > 1) {
    other.scrollTop = source.scrollTop;
  }
}
