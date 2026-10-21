import { useRef, useState } from 'react'
import {
  Send,
  Phone,
  Sparkles,
  CheckCircle2,
  X,
  ArrowUpRight,
} from 'lucide-react'
import { usePlatform } from '../../context/usePlatform'
import { optimizeUploadedPhotos } from '../../utils/photoOptimizer'

export default function ContextualAIDock() {
  const {
    activeTenant,
    submitHeroLead,
    setActiveView,
    activeLeadRoute,
  } = usePlatform()

  const [question, setQuestion] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedService, setSelectedService] = useState('')
  const [selectedPhotos, setSelectedPhotos] = useState([])
  const [uploadError, setUploadError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [handshakeSuccess, setHandshakeSuccess] = useState(false)

  const fileInputRef = useRef(null)
  const questionInputRef = useRef(null)
  const uploadSeqRef = useRef(1)

  const processFiles = async (files) => {
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
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Please choose up to 3 JPG, PNG, or WebP photos under 8 MB.'
      )
    }
  }

  const handleFileUpload = async (e) => {
    await processFiles(e.target.files)
    e.target.value = ''
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer?.files?.length) {
      await processFiles(e.dataTransfer.files)
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
      zipCode: activeTenant.id === 'all-solutions-diesel' ? '78070' : '03106',
      serviceName:
        selectedService ||
        primaryPhoto?.serviceMatch ||
        activeTenant.pricingRules.services[0]?.name,
      urgency: primaryPhoto?.urgency,
      sourceLabel: 'Embedded Hero AI Dock',
    })
    setHandshakeSuccess(true)
  }

  const quickPrompts =
    activeTenant.id === 'all-solutions-diesel'
      ? [
          {
            serviceName: 'Electrical Diagnosis & Check-Engine Troubleshooting',
            label: 'Electrical Diagnosis & Check-Engine',
            prompt:
              'Need electrical diagnosis or check-engine troubleshooting in Spring Branch.',
          },
          {
            serviceName: 'Heavy-Duty Diesel & 6.0 Powerstroke Repair',
            label: 'Heavy-Duty Diesel & 6.0',
            prompt:
              'Need a ballpark quote for heavy-duty diesel or 6.0 Powerstroke repair.',
          },
          {
            serviceName: 'Engine Repair & Full Engine Replacement',
            label: 'Engine Repair & Full Service',
            prompt:
              'Need a ballpark quote for engine repair or full service maintenance.',
          },
        ]
      : activeTenant.pricingRules.services.slice(0, 3).map((s) => {
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
      {/* Single Unified Conversion Card */}
      <form className="contextual-ai-dock" onSubmit={handleSubmit}>
        <input
          ref={fileInputRef}
          type="file"
          aria-label="Upload vehicle or project photos"
          accept="image/jpeg,image/png,image/webp"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />

        <div className="dock-top-strip">
          <div className="dock-header-block">
            <div className="dock-status-indicator">
              <span className="pulse-dot" />
              <strong>Get an Instant Ballpark Quote or Diagnostic</strong>
            </div>
            <p className="dock-subhead">
              Snap a photo of a leak, damaged part, or dash code—or describe what
              your vehicle is doing—for an instant ballpark range.
            </p>
          </div>

          <div className="dock-quick-chips" role="group" aria-label="Quick symptom categories">
            {quickPrompts.map((qp, idx) => (
              <button
                key={idx}
                type="button"
                className={`dock-chip ${selectedService === qp.serviceName ? 'is-selected' : ''}`}
                onClick={() => {
                  setQuestion(qp.prompt)
                  setSelectedService(qp.serviceName)
                  questionInputRef.current?.focus()
                }}
              >
                {qp.label}
              </button>
            ))}
          </div>
        </div>

        <div className="dock-main-controls">
          {/* 1. Single prominent photo upload button/dropzone */}
          <button
            type="button"
            className={`dock-photo-btn ${primaryPhoto ? 'has-photo' : ''} ${isDragging ? 'is-dragging' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {selectedPhotos.length > 0 && (
              <span className="dock-btn-thumbs">
                {selectedPhotos.map((p) => (
                  <img
                    key={p.id}
                    src={p.url}
                    alt={p.name}
                    className="dock-btn-mini-thumb"
                  />
                ))}
              </span>
            )}
            <span>📷 Snap / Upload Photo (Up to 3)</span>
          </button>

          {/* 2. Text input */}
          <div className="dock-input-group question-group">
            <Sparkles size={15} className="dock-field-icon" />
            <input
              ref={questionInputRef}
              type="text"
              className="dock-text-input"
              aria-label="Describe the issue, leak, or question"
              placeholder="Describe the issue, leak, or question..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </div>

          {/* 3. Phone input */}
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

          {/* 4. Primary red submit button */}
          <button type="submit" className="dock-submit-btn">
            <Send size={14} />
            <span>Instant SMS Quote</span>
          </button>
        </div>

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

        {primaryPhoto && (
          <div className="selected-photo-preview dock-inline-photo-strip">
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
        )}

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
