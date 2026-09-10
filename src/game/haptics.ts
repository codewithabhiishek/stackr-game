/* Tactile Mobile Haptic Feedback Engine for Stacker */

class HapticEngine {
  private supported = typeof navigator !== "undefined" && "vibrate" in navigator;

  private trigger(pattern: number | number[]) {
    if (!this.supported) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration errors on restricted devices
    }
  }

  /** Quick crisp click on normal block drop & slice */
  slice() {
    this.trigger(12);
  }

  /** Sharp double pulse on perfect drop */
  perfect(combo = 1) {
    if (combo >= 5) {
      this.trigger([18, 25, 22, 25, 25]);
    } else {
      this.trigger([14, 30, 16]);
    }
  }

  /** Altitude milestone reached (every 10 blocks) */
  milestone() {
    this.trigger([20, 30, 25, 30, 35]);
  }

  /** Tower collapse / Game Over */
  fumble() {
    this.trigger([50, 40, 75]);
  }
}

export const haptics = new HapticEngine();
