/**
 * Asks an open body map to keep the mark being drawn.
 *
 * Dispatched when a session is closed, so a finding marked but not saved goes
 * into the record with the session it was made in. Its own module so the page
 * can name the event without importing the viewer, which loads only when the
 * map is opened.
 */
export const BODY_MAP_FLUSH_EVENT = "ob:body-map-flush"
