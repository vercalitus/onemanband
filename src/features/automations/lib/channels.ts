import type { MessageChannel } from "@/types/automation"

/**
 * Channels offered in the UI.
 *
 * SMS is implemented end to end — type, planner, dispatcher, settings field and
 * migration all support it — but the clinic sends WhatsApp and email only, so
 * it is hidden rather than removed. Deleting it would mean rebuilding the lane
 * later; hiding it costs nothing and keeps existing data valid.
 *
 * To bring SMS back, add "sms" here. That is the whole change: every channel
 * picker in Settings reads this list.
 *
 * Hiding is not disabling — `ClinicNotifications.smsEnabled` still gates the
 * planner, and it defaults to false, so nothing can leave over SMS while the
 * switch is out of reach.
 */
export const VISIBLE_CHANNELS: MessageChannel[] = ["whatsapp", "email"]
