/** True when a key press landed somewhere the user is typing, so single-key shortcuts stay out. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (target as HTMLInputElement).type;
    return !["checkbox", "radio", "button", "submit", "reset"].includes(type);
  }
  return false;
}

/** Plain key with no modifier held (Shift allowed for capitals). */
export function isPlainKey(event: KeyboardEvent, key: string): boolean {
  return (
    event.key.toLowerCase() === key &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.isComposing
  );
}
