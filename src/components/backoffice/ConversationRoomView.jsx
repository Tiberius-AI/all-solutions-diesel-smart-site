import { useEffect } from 'react'
import { X, Sparkles, CalendarCheck, ExternalLink, CheckCircle2 } from 'lucide-react'
import { usePlatform } from '../../context/usePlatform'
import ThreadQueue from './ThreadQueue'
import UnifiedTimeline from './UnifiedTimeline'
import JobSummaryCard from './JobSummaryCard'

export default function ConversationRoomView() {
  const {
    lightboxPhoto,
    setLightboxPhoto,
    activeTenant,
    selectedThread,
    calcomConfig,
    calcomStatus,
    availableSlots,
    bookInspectionSlot,
    confirmEmbedBooking,
    calcomEmbedOpen,
    setCalcomEmbedOpen,
  } = usePlatform()

  const cleanHandle = (calcomConfig?.handle || 'tiberius')
    .replace(/^@/, '')
    .trim()
  const cleanSlug = (calcomConfig?.eventSlug || 'contractor')
    .replace(/^\//, '')
    .trim()
  const embedParams = new URLSearchParams({
    embed: 'true',
    name: selectedThread?.contactName || 'Homeowner',
    email: selectedThread?.email || 'homeowner@example.com',
    notes: `${selectedThread?.jobSummary?.serviceNeeded || 'Inspection'} — ${
      selectedThread?.address || ''
    }`,
  })
  const calEmbedUrl = `https://cal.com/${cleanHandle}/${cleanSlug}?${embedParams.toString()}`
  const calPublicUrl = `https://cal.com/${cleanHandle}/${cleanSlug}`

  // Listen for Cal.com iframe postMessage booking completion events
  useEffect(() => {
    if (!calcomEmbedOpen) return

    const handleCalMessage = (event) => {
      if (
        typeof event.origin === 'string' &&
        !event.origin.includes('cal.com')
      ) {
        return
      }
      const data = event.data
      if (!data || typeof data !== 'object') return

      const type = String(data.type || data.action || '')
      if (
        type.includes('bookingSuccessful') ||
        data.fullType?.includes('bookingSuccessful')
      ) {
        const payload = data.data || data.payload || {}
        const uid = payload.uid || payload.bookingUid || `cal-embed-${Date.now().toString(36)}`
        const startTime = payload.startTime || payload.date
        const formattedSlot = startTime
          ? new Date(startTime).toLocaleString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })
          : availableSlots[0]?.label || 'Cal.com Embed Slot'

        confirmEmbedBooking(selectedThread?.id, {
          slotLabel: formattedSlot,
          bookingUid: String(uid),
          startIso: startTime || new Date().toISOString(),
          verifiedEvent: true,
        })
      }
    }

    window.addEventListener('message', handleCalMessage)
    return () => window.removeEventListener('message', handleCalMessage)
  }, [calcomEmbedOpen, availableSlots, confirmEmbedBooking, selectedThread?.id])

  return (
    <section
      className="conversation-room-3pane"
      aria-label="3-Pane Unified Conversation Room"
    >
      {/* Left Pane (25%): Thread Queue */}
      <ThreadQueue />

      {/* Center Pane (50%): Unified Timeline */}
      <UnifiedTimeline />

      {/* Right Pane (25%): Live AI Job Summary Card */}
      <JobSummaryCard />

      {/* Tiberius Enlargeable Conversation Photo Lightbox (from conversation-photos.mjs) */}
      {lightboxPhoto && (
        <div
          className="tiberius-lightbox-backdrop"
          onClick={() => setLightboxPhoto(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged customer photo"
        >
          <div
            className="tiberius-lightbox-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lightbox-header">
              <div className="lightbox-title">
                <Sparkles size={15} style={{ color: activeTenant.brandColor }} />
                <strong>{lightboxPhoto.caption}</strong>
              </div>
              <button
                type="button"
                className="helper-close-btn"
                onClick={() => setLightboxPhoto(null)}
                aria-label="Close photo viewer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="lightbox-img-wrap">
              <img src={lightboxPhoto.url} alt={lightboxPhoto.caption} />
            </div>
          </div>
        </div>
      )}

      {/* Dual-Mode Cal.com Live Calendar Modal (Instant Slot Sync + Live Cal.com Embed) */}
      {calcomEmbedOpen && (
        <div
          className="tiberius-lightbox-backdrop"
          onClick={() => setCalcomEmbedOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Cal.com Live Calendar Booking"
        >
          <div
            className="tiberius-lightbox-modal calcom-embed-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lightbox-header">
              <div className="lightbox-title">
                <CalendarCheck
                  size={16}
                  style={{ color: activeTenant.brandColor }}
                />
                <strong>
                  Cal.com Live Schedule — {activeTenant.companyName} (
                  {calcomStatus.sourceLabel})
                </strong>
              </div>
              <div className="calcom-modal-actions">
                <button
                  type="button"
                  className="btn-xs-outline"
                  onClick={() =>
                    confirmEmbedBooking(selectedThread?.id, {
                      slotLabel:
                        availableSlots[0]?.label || 'Cal.com Embed Appointment',
                      verifiedEvent: false,
                    })
                  }
                  title="Record an appointment completed inside the Cal.com embed onto this conversation thread"
                >
                  <CheckCircle2 size={12} /> Sync Embed Booking to Thread
                </button>
                <a
                  href={calPublicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-xs-outline"
                >
                  <ExternalLink size={12} /> Open {calPublicUrl}
                </a>
                <button
                  type="button"
                  className="helper-close-btn"
                  onClick={() => setCalcomEmbedOpen(false)}
                  aria-label="Close Cal.com modal"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="calcom-modal-body">
              <div className="calcom-quick-dispatch-strip">
                <div className="calcom-strip-info">
                  <strong>
                    Instant GHL + Cal.com Dispatch for{' '}
                    {selectedThread?.contactName} ({selectedThread?.phone})
                  </strong>
                  <span>
                    Click any available window below to book immediately or use
                    the live Cal.com embed underneath:
                  </span>
                </div>
                <div className="calcom-strip-buttons">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      className="btn-strip-slot"
                      onClick={() => {
                        bookInspectionSlot(selectedThread.id, slot)
                        setCalcomEmbedOpen(false)
                      }}
                    >
                      <CalendarCheck size={12} />
                      <span>{slot.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="calcom-iframe-container">
                <iframe
                  title={`Cal.com Calendar (${cleanHandle}/${cleanSlug})`}
                  src={calEmbedUrl}
                  className="calcom-live-iframe"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
