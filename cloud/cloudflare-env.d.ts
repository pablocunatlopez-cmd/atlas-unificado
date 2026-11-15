declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    /** When "1" or "true", advertise liveCycleEnabled on session-heartbeat. Default off. */
    ATLAS_LIVE_CYCLE_ENABLED?: string;
  }
}
