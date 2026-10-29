/** Short vibration tick where supported (not iOS Safari — fails silently). */
export function haptic(ms = 10) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}
