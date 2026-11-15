/**
 * Server-side live-cycle flag (P3).
 * Default is OFF. Operators must set ATLAS_LIVE_CYCLE_ENABLED=1 (or true)
 * in the Sites / Worker environment to advertise that the live improvement
 * cycle is intentionally enabled. This module never starts jobs itself.
 */

export function readLiveCycleFlag(source?: Record<string, unknown> | null): boolean {
  const raw =
    source && typeof source.ATLAS_LIVE_CYCLE_ENABLED !== 'undefined'
      ? source.ATLAS_LIVE_CYCLE_ENABLED
      : typeof process !== 'undefined' && process.env
        ? process.env.ATLAS_LIVE_CYCLE_ENABLED
        : undefined;
  if (raw === true || raw === 1) return true;
  if (typeof raw === 'string') {
    const value = raw.trim().toLowerCase();
    return value === '1' || value === 'true' || value === 'yes' || value === 'on';
  }
  return false;
}

export function liveCycleNote(enabled: boolean): string {
  return enabled
    ? 'Ciclo en vivo habilitado en servidor. El PC aún debe aplicar su propia puerta (session-live-work-gate).'
    : 'Ciclo en vivo desactivado en servidor (ATLAS_LIVE_CYCLE_ENABLED no está en 1/true). Los latidos no autorizan trabajo autónomo.';
}
