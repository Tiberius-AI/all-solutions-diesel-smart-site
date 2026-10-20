import { useState } from 'react'
import {
  MapPin,
  Sparkles,
  CalendarCheck,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Camera,
  Phone,
  Mail,
  Star,
  ThumbsUp,
  AlertTriangle,
  Home,
  ZoomIn,
  BookOpen,
  ExternalLink,
  RefreshCw,
  Layers,
} from 'lucide-react'
import { usePlatform } from '../../context/usePlatform'

export default function JobSummaryCard() {
  const {
    selectedThread,
    activeTenant,
    bookInspectionSlot,
    cancelOrRescheduleBooking,
    updateOpportunityStage,
    availableSlots,
    calcomStatus,
    setCalcomEmbedOpen,
    knowledgeBaseArticles,
    triggerJobCompletedCheckIn,
    simulateCustomerReviewReply,
    setLightboxPhoto,
  } = usePlatform()

  const [selectedSlotId, setSelectedSlotId] = useState('')

  if (!selectedThread) return null

  const { jobSummary } = selectedThread
  const activeSlotObj =
    availableSlots.find((s) => s.id === selectedSlotId) || availableSlots[0]

  const currentStage =
    selectedThread.opportunityStage ||
    (jobSummary.bookedSlot ? 'appointment_booked' : 'quote_sent')

  const isVerifiedCalcom = Boolean(jobSummary.calcomBooking?.apiVerified)
  const bookingRef =
    jobSummary.calcomBooking?.bookingUid ||
    jobSummary.calcomBooking?.holdReference ||
    ''

  return (
    <aside className="pane-right-summary">
      {/* Contact Details + GHL Opportunity Pipeline Header */}
      <div className="summary-contact-card">
        <div className="summary-section-eyebrow">
          <span>CONTACT &amp; GHL OPPORTUNITY</span>
          {selectedThread.zipVerified && (
            <span className="verified-pill">
              <CheckCircle2 size={11} /> Verified Zip
            </span>
          )}
        </div>
        <h4>{selectedThread.contactName}</h4>
        <div className="contact-detail-list">
          <div className="detail-item">
            <Phone size={13} />
            <span>{selectedThread.phone}</span>
          </div>
          <div className="detail-item">
            <Mail size={13} />
            <span>{selectedThread.email}</span>
          </div>
          <div className="detail-item">
            <MapPin size={13} style={{ color: activeTenant.brandColor }} />
            <span>{selectedThread.address}</span>
          </div>
          {selectedThread.propertyType && (
            <div className="detail-item">
              <Home size={13} />
              <span>
                {selectedThread.propertyType} • Age:{' '}
                {selectedThread.roofAge || 'TBD'} • Window:{' '}
                {selectedThread.preferredWindow || 'Flexible'}
              </span>
            </div>
          )}
        </div>

        {/* GoHighLevel Opportunity Pipeline Stage Selector */}
        <div className="ghl-opportunity-box">
          <label className="ghl-stage-label">
            <Layers size={11} /> Pipeline Stage:
          </label>
          <select
            aria-label="Opportunity Pipeline Stage"
            className="ghl-stage-select"
            value={currentStage}
            onChange={(e) =>
              updateOpportunityStage(selectedThread.id, e.target.value)
            }
          >
            <option value="new_lead">1. New Lead</option>
            <option value="qualifying">2. AI Qualifying</option>
            <option value="quote_sent">3. Ballpark Quote Sent</option>
            <option value="appointment_booked">4. 📅 Cal.com Booked</option>
            <option value="job_won">5. 🏆 Job Won / Completed</option>
          </select>
        </div>
      </div>

      {/* Auto-Populated Live AI Job Summary Card */}
      <div className="llm-extraction-card">
        <div className="extraction-header">
          <Sparkles size={15} style={{ color: activeTenant.brandColor }} />
          <span>LIVE AI JOB SUMMARY CARD</span>
        </div>

        {/* 1. Service Needed & Urgency */}
        <div className="extraction-block">
          <span className="extraction-label">Service Needed &amp; Urgency</span>
          <div className="extraction-service-title">
            {jobSummary.serviceNeeded}
          </div>
          <div className="urgency-badge-row">
            <AlertCircle size={13} style={{ color: activeTenant.brandColor }} />
            <span>{jobSummary.urgency}</span>
          </div>
        </div>

        {/* 2. Estimated Job Value */}
        <div className="extraction-block value-highlight-box">
          <div>
            <span className="extraction-label">Estimated Job Value</span>
            <div
              className="est-job-value"
              style={{ color: activeTenant.brandColor }}
            >
              ${jobSummary.estimatedValue.toLocaleString()}
              <span className="est-range-sub"> ({jobSummary.estimatedRange})</span>
            </div>
          </div>
          <DollarSign
            size={24}
            className="value-watermark-icon"
            style={{ color: activeTenant.brandColor }}
          />
        </div>

        {/* 3. Photos from the Request + Vision AI Pre-Analysis Summary (Clickable for Lightbox) */}
        <div className="extraction-block">
          <div className="block-label-row">
            <span className="extraction-label">
              <Camera size={12} /> Photos from the Request
            </span>
            <span className="photo-count-tag">
              {jobSummary.photos.length} Photo
              {jobSummary.photos.length === 1 ? '' : 's'}
            </span>
          </div>

          {jobSummary.photos.length > 0 && (
            <div className="summary-photos-grid">
              {jobSummary.photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  className="summary-photo-card clickable-photo"
                  onClick={() =>
                    setLightboxPhoto({
                      url: photo.url,
                      caption: `${photo.caption} (${photo.visionTag})`,
                    })
                  }
                  title="Click to enlarge photo"
                >
                  <img src={photo.url} alt={photo.caption} />
                  <div className="summary-photo-tag">
                    <span>{photo.visionTag}</span>
                    <ZoomIn size={11} />
                  </div>
                </button>
              ))}
            </div>
          )}

          <p className="vision-summary-text">{jobSummary.visionSummary}</p>
        </div>

        {/* 4. Dual-Mode Cal.com v2 Calendar Booking */}
        <div className="extraction-block booking-block">
          <div className="block-label-row">
            <span className="extraction-label">
              <CalendarCheck size={12} /> Cal.com Crew Calendar
            </span>
            <span
              className={`calcom-status-tag ${calcomStatus.liveApiActive ? 'live' : 'embed'}`}
              title={calcomStatus.sourceLabel}
            >
              {calcomStatus.liveApiActive ? '🟢 API v2 Live' : '📅 Schedule / Embed'}
            </span>
          </div>

          {jobSummary.bookedSlot ? (
            <div className="booked-slot-confirmed">
              <CheckCircle2 size={16} className="text-emerald" />
              <div className="booked-slot-details">
                <div className="booked-title">
                  {isVerifiedCalcom
                    ? `Cal.com v2 Verified ${bookingRef ? `(${bookingRef})` : ''}`
                    : `Crew Hold Reserved ${bookingRef ? `(${bookingRef})` : ''}`}
                </div>
                <div className="booked-time">{jobSummary.bookedSlot}</div>
                <div className="booked-card-actions">
                  <button
                    type="button"
                    className="btn-cal-mini"
                    onClick={() => setCalcomEmbedOpen(true)}
                  >
                    <ExternalLink size={11} /> Open Cal.com
                  </button>
                  <button
                    type="button"
                    className="btn-cal-mini"
                    onClick={() => cancelOrRescheduleBooking(selectedThread.id)}
                  >
                    <RefreshCw size={11} /> Reschedule / Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="booking-controls">
              <select
                aria-label="Select Cal.com Inspection Slot"
                className="slot-select"
                value={activeSlotObj?.id || ''}
                onChange={(e) => setSelectedSlotId(e.target.value)}
                disabled={availableSlots.length === 0}
              >
                {availableSlots.length === 0 ? (
                  <option value="">No open live slots in next 5 days</option>
                ) : (
                  availableSlots.map((slot) => (
                    <option key={slot.id} value={slot.id}>
                      {slot.label}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                className="btn-one-click-book"
                style={{ backgroundColor: activeTenant.brandColor }}
                disabled={!activeSlotObj}
                onClick={() =>
                  bookInspectionSlot(selectedThread.id, activeSlotObj)
                }
              >
                <CalendarCheck size={14} />
                <span>
                  {calcomStatus.liveApiActive
                    ? '📅 Book on Cal.com v2 API'
                    : '📅 Reserve Slot & Text Cal.com Link'}
                </span>
              </button>
              <button
                type="button"
                className="btn-open-cal-embed"
                onClick={() => setCalcomEmbedOpen(true)}
              >
                <ExternalLink size={12} />
                <span>Open Live Cal.com Calendar Embed</span>
              </button>
            </div>
          )}
        </div>

        {/* 5. Grounded Knowledge Base Status */}
        <div className="extraction-block kb-summary-mini">
          <div className="block-label-row">
            <span className="extraction-label">
              <BookOpen size={12} /> Grounded Knowledge Base
            </span>
            <span className="photo-count-tag">
              {knowledgeBaseArticles.length} Rules Active
            </span>
          </div>
          <p className="kb-mini-note">
            Alfred cites <strong>{activeTenant.companyName}</strong> pricing,
            verified ZIPs, warranties &amp; Cal.com windows automatically.
          </p>
          {Array.isArray(jobSummary.lastKbCitations) &&
            jobSummary.lastKbCitations.length > 0 && (
              <div className="kb-mini-citations">
                {jobSummary.lastKbCitations.map((cit) => (
                  <span key={cit.id} className="kb-citation-pill">
                    📚 {cit.title}
                  </span>
                ))}
              </div>
            )}
        </div>

        {/* 6. Quick Pillar 3 TOS-Safe Review Engine Controls */}
        <div className="extraction-block review-mini-engine">
          <span className="extraction-label">
            <Star size={12} /> TOS-Safe Review Engine (Zero Star-Gating)
          </span>
          <div className="review-mini-buttons">
            <button
              type="button"
              className="btn-review-step"
              onClick={() => triggerJobCompletedCheckIn(selectedThread.id)}
            >
              1. Send Check-In + Direct Google Link
            </button>
            <div className="sentiment-sim-row">
              <button
                type="button"
                className="btn-sim-pos"
                onClick={() =>
                  simulateCustomerReviewReply(selectedThread.id, '', 'positive')
                }
                title="Simulate positive customer reply"
              >
                <ThumbsUp size={12} /> Sim Positive Reply
              </button>
              <button
                type="button"
                className="btn-sim-neg"
                onClick={() =>
                  simulateCustomerReviewReply(selectedThread.id, '', 'negative')
                }
                title="Simulate negative customer reply -> Escalates to 🚨 Needs Human"
              >
                <AlertTriangle size={12} /> Sim Issue Reply
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
