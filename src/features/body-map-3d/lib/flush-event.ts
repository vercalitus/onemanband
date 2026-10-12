/**
 * Asks an open skeleton to keep the mark being drawn.
 *
 * Dispatched when a session is closed, so a finding marked but not saved goes
 * into the record with the session it was made in. Its own module because the
 * skeleton is loaded lazily — importing the name from the viewer would pull
 * three.js into every patient page to read one string.
 */
export const SKELETON_FLUSH_EVENT = "ob:skeleton-flush"
