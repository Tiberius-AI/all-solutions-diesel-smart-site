import { useRef, useState } from 'react'
import {
  Camera,
  Send,
  Phone,
  Sparkles,
  CheckCircle2,
  Image as ImageIcon,
  X,
  ArrowUpRight,
  MapPin,
  FileText,
} from 'lucide-react'
import { usePlatform } from '../../context/usePlatform'
import { optimizeUploadedPhotos } from '../../utils/photoOptimizer'

export default function ContextualAIDock() {
  const {
    activeTenant,
    submitHeroLead,
    samplePhotos,
    setActiveView,
    openHelperModal,
    activeLeadRoute,
  } = usePlatform()

  const [question, setQuestion] = useState('')
  const [phone, setPhone] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [selectedService, setSelectedService] = useState('')
  const [selectedPhotos, setSelectedPhotos] = useState([])
  const [uploadError, setUploadError] = useState('')
  const [showSamplePicker, setShowSamplePicker] = useState(false)
  const [handshakeSuccess, setHandshakeSuccess] = useState(false)

  const fileInputRef = useRef(null)
  const uploadSeqRef = useRef(1)

  const handleFileUpload = async (e) => {
    const files = e.target.files
    if (!files?.length) return
    setUploadError('')
    try {
      const optimized = await optimizeUploadedPhotos(files, 3)
      if (!optimized.length) return
      const primarySvc =
        activeTenant.pricingRules.services.find(
          (s) => s.name === selectedService
        ) || activeTenant.pricingRules.services[0]
      const mapped = optimized.map((item) => {
        const seq = uploadSeqRef.current++
        return {
          id: `upload-${seq}`,
          name: item.name,
          label: `${item.name} (${item.width}×${item.height} JPEG)`,
          serviceMatch: primarySvc.name,
          estimatedRange: primarySvc.range,
          estimatedValue: primarySvc.avgValue,
          urgency: primarySvc.urgency,
          visionSummary: `Vision AI analyzed "${item.name}" (resized via createImageBitmap to ${item.width}×${item.height}): matched ${primarySvc.name} (${primarySvc.range} in ${activeTenant.city}).`,
          url: item.dataUrl,
          dataUrl: item.dataUrl,
        }
      })
      setSelectedPhotos(mapped)
      setShowSamplePicker(false)
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Please choose a JPG, PNG, or WebP photo under 8 MB.'
      )
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const primaryPhoto = selectedPhotos[0] || null
    submitHeroLead({
      question,
      photo: primaryPhoto,
      photos: selectedPhotos,
      phone: phone || activeTenant.phoneDisplay || '(830) 388-1458',
      customerName: 'Alex Mercer',
      zipCode:
        zipCode ||
        (activeTenant.id === 'all-solutions-diesel' ? '78070' : '03106'),
      serviceName:
        selectedService ||
        primaryPhoto?.serviceMatch ||
        activeTenant.pricingRules.services[0]?.name,
      urgency: primaryPhoto?.urgency,
      sourceLabel: 'Embedded Hero AI Dock',
    })
    setHandshakeSuccess(true)
  }

  const quickPrompts = activeTenant.pricingRules.services
    .slice(0, 3)
    .map((s) => {
      const words = s.name.replace(/\s*\([^)]*\)/g, '').split(' ')
      let shortLabel = words.slice(0, 3).join(' ')
      if (shortLabel.endsWith('&') || shortLabel.toLowerCase().endsWith('and')) {
        shortLabel = words.slice(0, 4).join(' ')
      }
      return {
        serviceName: s.name,
        label: shortLabel,
        prompt: `Need a ballpark quote for ${s.name.toLowerCase()} in ${activeTenant.city}.`,
      }
    })

  const primaryPhoto = selectedPhotos[0] || null

  return (
    <div className="contextual-ai-dock-wrapper">
      {/* Sample Photo & Vision AI Preview Popover */}
      {(showSamplePicker || primaryPhoto || uploadError) && (
        <div className="dock-popover">
          {uploadError && (
            <div className="dock-upload-error" role="alert">
              <span>{uploadError}</span>
              <button
                type="button"
                className="icon-close-btn"
                onClick={() => setUploadError('')}
                aria-label="Dismiss error"
              >
                <X size={14} />
              </button>
            </div>
          )}
          {primaryPhoto ? (
            <div className="selected-photo-preview">
              <div className="dock-thumb-stack">
                {selectedPhotos.map((p) => (
                  <img
                    key={p.id}
                    src={p.url}
                    alt={p.label}
                    className="dock-thumb"
                  />
                ))}
              </div>
              <div className="dock-photo-meta">
                <div className="dock-photo-badge">
                  <Sparkles size={12} />
                  <span>
                    VISION AI PRE-SCAN READY ({selectedPhotos.length} PHOTO
                    {selectedPhotos.length === 1 ? '' : 'S'})
                  </span>
                </div>
                <div className="dock-photo-title">{primaryPhoto.label}</div>
                <div className="dock-photo-sub">
                  Est. Local Range:{' '}
                  <strong>{primaryPhoto.estimatedRange}</strong> •{' '}
                  {primaryPhoto.urgency}
                </div>
              </div>
              <button
                type="button"
                className="dock-photo-remove"
                onClick={() => setSelectedPhotos([])}
                title="Remove photo(s)"
                aria-label="Remove attached photos"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            showSamplePicker && (
              <div className="sample-picker-body">
                <div className="sample-picker-header">
                  <span>
                    <Camera size={14} /> Upload up to 3 photos (auto-resized via{' '}
                    <code>createImageBitmap</code>) or select a sample inspection
                    frame:
                  </span>
                  <button
                    type="button"
                    className="icon-close-btn"
                    onClick={() => setShowSamplePicker(false)}
                    aria-label="Close photo picker"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="sample-picker-grid">
                  <button
                    type="button"
                    className="sample-upload-device-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon size={16} />
                    <span>Choose Up to 3 Photos...</span>
                  </button>
                  {samplePhotos.map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      className="sample-photo-chip"
                      onClick={() => {
                        setSelectedPhotos([sample])
                        setSelectedService(sample.serviceMatch || '')
                        setShowSamplePicker(false)
                      }}
                    >
                      <img src={sample.url} alt={sample.label} />
                      <div>
                        <div className="chip-title">{sample.label}</div>
                        <div className="chip-range">{sample.estimatedRange}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Embedded Contextual AI Dock — Aligned with Codex Editorial Design Tokens */}
      <form className="contextual-ai-dock" onSubmit={handleSubmit}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />

        <div className="dock-top-strip">
          <div className="dock-status-indicator">
            <span className="pulse-dot" />
            <span>
              <strong>Alfred AI · {activeTenant.companyName}</strong> — Instant{' '}
              {activeTenant.city} Price &amp; Vision Scope
            </span>
          </div>

          <div className="dock-quick-chips">
            {quickPrompts.map((qp, idx) => (
              <button
                key={idx}
                type="button"
                className="dock-chip"
                onClick={() => {
                  setQuestion(qp.prompt)
                  setSelectedService(qp.serviceName)
                }}
              >
                {qp.label}
              </button>
            ))}
            <button
              type="button"
              className="dock-chip dock-chip-wizard"
              onClick={() => openHelperModal('quote', selectedService)}
              title="Open 3-Step Guided Quote Request Wizard"
            >
              <FileText size={11} /> 3-Step Wizard ↗
            </button>
          </div>
        </div>

        <div className="dock-main-controls">
          {/* 1. Project Question Input */}
          <div className="dock-input-group question-group">
            <Sparkles size={15} className="dock-field-icon" />
            <input
              type="text"
              className="dock-text-input"
              aria-label="Ask a project question or describe damage"
              placeholder={
                activeTenant.id === 'all-solutions-diesel'
                  ? 'Ask a diesel, 6.0 Powerstroke, fleet, or auto repair question...'
                  : `Ask a ${activeTenant.niche.split(',')[0].toLowerCase()} question or describe damage...`
              }
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </div>

          {/* 2. Snap / Upload Photo Button */}
          <button
            type="button"
            className={`dock-photo-btn ${primaryPhoto ? 'has-photo' : ''}`}
            onClick={() => setShowSamplePicker((prev) => !prev)}
          >
            <Camera size={15} />
            <span>
              {primaryPhoto
                ? `📷 ${selectedPhotos.length} Photo${selectedPhotos.length === 1 ? '' : 's'} Attached`
                : '📷 Snap / Upload Photo'}
            </span>
          </button>

          {/* Optional Zip Input */}
          <div className="dock-input-group zip-group">
            <MapPin size={14} className="dock-field-icon" />
            <input
              type="text"
              className="dock-text-input"
              aria-label="ZIP code"
              placeholder={
                activeTenant.id === 'all-solutions-diesel'
                  ? 'ZIP (78070)'
                  : 'ZIP (03106)'
              }
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              maxLength={10}
            />
          </div>

          {/* 3. Mobile Number Input for Instant SMS Handshake */}
          <div className="dock-input-group phone-group">
            <Phone size={14} className="dock-field-icon" />
            <input
              type="tel"
              className="dock-text-input"
              aria-label="Mobile number for instant SMS quote"
              placeholder="Mobile # for instant SMS quote"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {/* Submit Handshake CTA */}
          <button type="submit" className="dock-submit-btn">
            <Send size={14} />
            <span>Instant SMS Quote</span>
          </button>
        </div>

        {handshakeSuccess && (
          <div className="dock-Confirmation-bar">
            <div className="dock-confirm-left">
              <CheckCircle2 size={15} className="dock-confirm-icon" />
              <span>
                <strong>SMS Handshake Sent!</strong> Vision AI pre-analysis &amp;
                quote thread routed to{' '}
                <strong>
                  {activeLeadRoute?.destinationInbox || 'Back-Office Inbox'}
                </strong>
                .
              </span>
            </div>
            <button
              type="button"
              className="dock-jump-btn"
              onClick={() => setActiveView('backoffice')}
            >
              <span>Open Live Thread in 3-Pane Room</span>
              <ArrowUpRight size={14} />
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
