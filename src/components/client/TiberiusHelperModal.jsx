import { useRef, useState } from 'react'
import { usePlatform } from '../../context/usePlatform'
import { optimizeUploadedPhotos } from '../../utils/photoOptimizer'
import { queryKnowledgeBase } from '../../utils/knowledgeBaseEngine'

const DEFAULT_CHIPS = [
  '6.0 Powerstroke or diesel diagnostic',
  'Check-engine or electrical issue',
  'Fleet maintenance packages',
  'Do you offer Synchrony financing?',
]

export default function TiberiusHelperModal() {
  const {
    activeTenant,
    activeLeadRoute,
    helperModal,
    closeHelperModal,
    openHelperModal,
    submitHeroLead,
    bookInspectionSlot,
    availableSlots,
    customKbEntries,
    calcomConfig,
    setActiveView,
  } = usePlatform()

  const helperAvatarSrc =
    activeTenant.media?.helperAvatar || '/assets/diesel/photos/logo_rjpic.jpg'

  const msgSeqRef = useRef(1)
  const [chatLog, setChatLog] = useState([
    {
      id: 'welcome-msg',
      sender: 'AI',
      author: 'Alfred · AI Shop Assistant',
      content:
        'Hi! I’m your All Solutions Diesel & Auto assistant. Have a question about a diesel pickup, check-engine light, fleet service, or Synchrony Car Care financing? Tell me your vehicle year, make, model, and symptoms.',
      status: `Active Route: ${activeLeadRoute?.accountLabel || 'Michael’s Tiberius Accounts'}`,
    },
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatPhotos, setChatPhotos] = useState([])
  const [helperStatus, setHelperStatus] = useState('')
  const [activeChips, setActiveChips] = useState(DEFAULT_CHIPS)

  // 3-Step Quote Wizard State
  const [step, setStep] = useState(0) // 0 | 1 | 2
  const [reviewState, setReviewState] = useState('form') // 'form' | 'review' | 'saved'
  const [savedRef, setSavedRef] = useState('')
  const [helperError, setHelperError] = useState('')

  const tenantServices = activeTenant.pricingRules?.services || []
  const defaultServiceOption =
    helperModal.preselectedService ||
    tenantServices[0]?.name ||
    'Diesel Engine Diagnostics & Repair'

  const [service, setService] = useState(defaultServiceOption)
  const [lastPreselected, setLastPreselected] = useState(helperModal.preselectedService)
  const [lastTenantId, setLastTenantId] = useState(activeTenant.id)
  const [description, setDescription] = useState('')
  const [urgency, setUrgency] = useState('Routine')
  const [zip, setZip] = useState('78070')
  const [address, setAddress] = useState('')
  const [propertyType, setPropertyType] = useState('Diesel Pickup (Powerstroke / Duramax / Cummins)')
  const [roofAge, setRoofAge] = useState('In-Shop Appointment (113 Remington Rd)')
  const [quotePhotos, setQuotePhotos] = useState([])
  const [name, setName] = useState('')
  const [contactMethod, setContactMethod] = useState('phone')
  const [contactValue, setContactValue] = useState('')
  const [intent, setIntent] = useState('Schedule a diagnostic / estimate')
  const [contactWindow, setContactWindow] = useState('Flexible')
  const [consent, setConsent] = useState(false)

  const [calVisible, setCalVisible] = useState(false)

  if (activeTenant.id !== lastTenantId) {
    setLastTenantId(activeTenant.id)
    setService(
      helperModal.preselectedService ||
        activeTenant.pricingRules?.services?.[0]?.name ||
        'Diesel Engine Diagnostics & Repair'
    )
    setReviewState('form')
    setStep(0)
  }

  if (helperModal.preselectedService !== lastPreselected) {
    setLastPreselected(helperModal.preselectedService)
    if (helperModal.preselectedService) {
      setService(helperModal.preselectedService)
    }
    if (reviewState === 'saved') {
      setReviewState('form')
    }
  }

  if (!helperModal.open) return null

  const currentMode = helperModal.mode || 'chat'
  const rawPhoneHref = `tel:${(activeTenant.phoneDisplay || '8303881458').replace(/[^0-9+]/g, '')}`

  const goMode = (mode, nextService) => {
    setHelperStatus('')
    setHelperError('')
    const chosenService = nextService || service
    if (nextService) setService(nextService)
    if (mode === 'quote' && reviewState === 'saved') {
      setReviewState('form')
      setStep(0)
    }
    openHelperModal(mode, chosenService)
  }

  const handleChatPhotoInput = async (e) => {
    const rawFiles = Array.from(e.target.files || [])
    e.target.value = ''
    if (!rawFiles.length) return
    if (
      rawFiles.length + chatPhotos.length > 3 ||
      rawFiles.some(
        (f) =>
          !['image/jpeg', 'image/png', 'image/webp'].includes(f.type) ||
          f.size > 5 * 1024 * 1024
      )
    ) {
      setHelperStatus(
        'Choose up to three JPG, PNG or WebP photos, up to 5 MB each.'
      )
      return
    }
    try {
      const optimized = await optimizeUploadedPhotos(rawFiles, 3 - chatPhotos.length)
      const seq = msgSeqRef.current++
      const mapped = optimized.map((item, idx) => ({
        id: `chat-photo-${seq}-${idx}`,
        name: item.name,
        url: item.dataUrl,
        label: item.name,
        estimatedRange:
          activeTenant.pricingRules.services[0]?.range || '$165 – $2,400+',
      }))
      setChatPhotos((prev) => [...prev, ...mapped].slice(0, 3))
      setHelperStatus('')
    } catch (err) {
      setHelperStatus(err.message || 'Could not prepare photos.')
    }
  }

  const sendChatReply = (rawText) => {
    const text = String(rawText ?? chatInput).trim()
    if (!text && chatPhotos.length === 0) return
    if (text.length > 1000) {
      setHelperStatus('Please keep the message under 1,000 characters.')
      return
    }

    if (text === 'Schedule an appointment') {
      goMode('booking')
      return
    }

    const seq = msgSeqRef.current++

    const visitorMsg = {
      id: `v-${seq}`,
      sender: 'Visitor',
      author: 'You',
      content: text || 'Sharing vehicle photos…',
      photos: chatPhotos,
      status: 'Just now · Delivered',
    }

    const kbResult = queryKnowledgeBase({
      query: text || service,
      tenant: activeTenant,
      thread: {
        contactName: name || 'there',
        address: address || activeTenant.city,
        jobSummary: { serviceNeeded: service },
      },
      availableSlots,
      customEntries: customKbEntries,
    })

    const primarySvcName =
      tenantServices[0]?.name || 'Diesel Engine Diagnostics & Repair'
    const matchedSvc = kbResult.matchedService?.name || service || primarySvcName
    setService(matchedSvc)
    if (/tow|breakdown|stranded|no-start|no start|overheat|urgent/i.test(text)) {
      setUrgency('Urgent')
      if (!description) setDescription(text)
    }

    const aiReplyText = kbResult.replyText.replace(/\*\*/g, '')

    const aiMsg = {
      id: `ai-${seq}`,
      sender: 'AI',
      author: 'Alfred · AI Shop Assistant',
      content: aiReplyText,
      status: `Just now · Grounded in ${kbResult.citations.length} Knowledge Base rule(s)`,
    }

    setChatLog((prev) => [...prev, visitorMsg, aiMsg])
    const createdThreadId = submitHeroLead({
      question: text || `Uploaded ${chatPhotos.length} vehicle photo(s)`,
      phone:
        contactMethod === 'phone' && contactValue
          ? contactValue
          : activeTenant.phoneDisplay || '(830) 388-1458',
      email: contactMethod === 'email' && contactValue ? contactValue : undefined,
      customerName: name || 'Vehicle Owner',
      photo: chatPhotos[0] || null,
      photos: chatPhotos,
      zipCode: zip || '78070',
      address: address || activeTenant.city,
      serviceName: matchedSvc,
      urgency,
      propertyType,
      roofAge,
      preferredWindow: contactWindow,
      sourceLabel: 'Alfred Diesel & Auto Assistant Chat',
    })

    if (kbResult.bookingIntent.wantsToBook && kbResult.bookingIntent.matchedSlot) {
      bookInspectionSlot(createdThreadId, kbResult.bookingIntent.matchedSlot, {
        name: name || 'Vehicle Owner',
        email:
          contactMethod === 'email' && contactValue
            ? contactValue
            : 'customer@example.com',
        phone:
          contactMethod === 'phone' && contactValue
            ? contactValue
            : activeTenant.phoneDisplay || '(830) 388-1458',
        address: address || activeTenant.city,
        serviceNeeded: matchedSvc,
      })
    }

    setChatInput('')
    setChatPhotos([])
    setHelperStatus(
      `Saved to ${activeLeadRoute?.accountLabel || 'Michael’s Tiberius Accounts'} (Conversation Room).`
    )
    setActiveChips(['Add my vehicle details', 'Schedule an appointment'])
  }

  const handleChipClick = (chipLabel) => {
    if (chipLabel === 'Add my vehicle details') {
      goMode('quote')
      return
    }
    if (chipLabel === 'Schedule an appointment') {
      goMode('booking')
      return
    }
    sendChatReply(chipLabel)
  }

  const handleQuotePhotoInput = async (e) => {
    const rawFiles = Array.from(e.target.files || [])
    if (!rawFiles.length) return
    if (
      rawFiles.length > 3 ||
      rawFiles.some(
        (f) =>
          !['image/jpeg', 'image/png', 'image/webp'].includes(f.type) ||
          f.size > 5 * 1024 * 1024
      )
    ) {
      setHelperError(
        'Choose up to three JPG, PNG or WebP photos, up to 5 MB each.'
      )
      e.target.value = ''
      return
    }
    try {
      setHelperError('')
      const optimized = await optimizeUploadedPhotos(rawFiles, 3)
      const seq = msgSeqRef.current++
      setQuotePhotos(
        optimized.map((item, idx) => ({
          id: `q-photo-${seq}-${idx}`,
          name: item.name,
          url: item.dataUrl,
          label: item.name,
        }))
      )
    } catch (err) {
      setHelperError(err.message || 'Could not process selected photos.')
    }
  }

  const handleQuoteFormSubmit = (e) => {
    e.preventDefault()
    setHelperError('')

    if (step === 0) {
      if (description.trim().length < 3) {
        setHelperError('Please tell us briefly what symptoms or service you need (at least 3 characters).')
        return
      }
      setStep(1)
      return
    }

    if (step === 1) {
      if (!/^[0-9]{5}$/.test(zip.trim())) {
        setHelperError('Please enter a valid 5-digit ZIP code (e.g., 78070).')
        return
      }
      setStep(2)
      return
    }

    if (step === 2) {
      if (!name.trim()) {
        setHelperError('Please enter your name.')
        return
      }
      if (!contactValue.trim()) {
        setHelperError(
          `Please enter your ${contactMethod === 'phone' ? 'phone number' : 'email address'}.`
        )
        return
      }
      if (!consent) {
        setHelperError('Please confirm follow-up permission for this inquiry.')
        return
      }
      setReviewState('review')
    }
  }

  const handleSaveLead = () => {
    const seq = msgSeqRef.current++
    const refCode = `ASD-${zip || '78070'}-${String(seq).padStart(3, '0')}`
    setSavedRef(refCode)
    submitHeroLead({
      question: `[${service}] ${description} (Vehicle/Unit: ${address || propertyType} · Next step: ${intent})`,
      phone:
        contactMethod === 'phone'
          ? contactValue
          : activeTenant.phoneDisplay || '(830) 388-1458',
      email:
        contactMethod === 'email'
          ? contactValue
          : `${name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@customer.io`,
      customerName: name,
      photo: quotePhotos[0] || null,
      photos: quotePhotos,
      zipCode: zip,
      address: address ? `${address} (ZIP ${zip})` : `Spring Branch, TX (${zip})`,
      serviceName: service,
      urgency,
      propertyType,
      roofAge,
      preferredWindow: contactWindow,
      sourceLabel: '3-Step Diagnostic & Quote Request',
    })
    setReviewState('saved')
  }

  function handleCloseModal() {
    if (reviewState === 'saved') {
      setReviewState('form')
      setStep(0)
    }
    closeHelperModal()
  }

  return (
    <div
      className="codex-dialog-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCloseModal()
      }}
    >
      <dialog
        className={`helper-dialog ${currentMode === 'booking' ? 'is-booking' : ''}`}
        id="roof-helper"
        open
        aria-labelledby="helper-title"
        aria-describedby="helper-disclosure"
      >
        <header className="helper-header">
          <img
            src={helperAvatarSrc}
            width="50"
            height="50"
            alt=""
            style={{ borderRadius: '10px', objectFit: 'cover' }}
          />
          <div>
            <h2 id="helper-title" tabIndex={-1}>
              Your diesel &amp; auto assistant
            </h2>
            <p>
              {activeTenant.companyName} · {activeTenant.phoneDisplay}
            </p>
          </div>
          <button
            className="helper-close"
            type="button"
            aria-label="Close assistant"
            onClick={handleCloseModal}
          >
            ×
          </button>
        </header>

        <p className="helper-disclosure" id="helper-disclosure">
          {activeLeadRoute?.badgeLabel || 'AI Leads → Michael’s Tiberius Accounts'} · Direct Shop Phone:{' '}
          <a href={rawPhoneHref} style={{ fontWeight: 700, color: 'inherit' }}>
            {activeTenant.phoneDisplay}
          </a>
        </p>

        <nav className="helper-modes" aria-label="Choose how to get help">
          <button
            type="button"
            data-mode="chat"
            aria-pressed={currentMode === 'chat'}
            onClick={() => goMode('chat')}
          >
            Ask a question
          </button>
          <button
            type="button"
            data-mode="quote"
            aria-pressed={currentMode === 'quote'}
            onClick={() => goMode('quote')}
          >
            Get a quote
          </button>
          <button
            type="button"
            data-mode="booking"
            aria-pressed={currentMode === 'booking'}
            onClick={() => goMode('booking')}
          >
            Schedule
          </button>
        </nav>

        <div className="helper-scroll">
          {/* PANEL 1: CHAT */}
          <section
            data-panel="chat"
            hidden={currentMode !== 'chat'}
            aria-label="Diesel and auto repair conversation"
          >
            <p className="helper-hint" id="helper-chat-mode">
              AI mode · Alfred answers diesel, auto, fleet &amp; financing questions.
            </p>

            <div
              className="helper-log"
              id="helper-log"
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              aria-label="Shop assistant conversation"
            >
              {chatLog.map((m) => (
                <div
                  key={m.id}
                  className={`helper-bubble${
                    m.sender === 'Visitor'
                      ? ' from-visitor'
                      : m.sender === 'Owner'
                        ? ' from-owner'
                        : ''
                  }`}
                >
                  <span className="message-author">{m.author}</span>
                  <p className="message-content">{m.content}</p>
                  {m.photos?.length > 0 && (
                    <div className="conversation-photos">
                      {m.photos.map((p) => (
                        <div key={p.id} className="conversation-photo">
                          <img src={p.url} alt={p.name} />
                          <span>{p.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <small className="message-meta">{m.status}</small>
                </div>
              ))}
            </div>

            <div className="helper-chips" id="helper-chips">
              {activeChips.map((chipLabel) => (
                <button
                  key={chipLabel}
                  type="button"
                  onClick={() => handleChipClick(chipLabel)}
                >
                  {chipLabel}
                </button>
              ))}
            </div>

            <div className="chat-photo-toolbar">
              <label className="chat-add-photos" htmlFor="chat-photos">
                ＋ Add photos
                <input
                  id="chat-photos"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleChatPhotoInput}
                />
              </label>
              <span>Up to 3 photos · Engine bay, dash codes, or leak photos</span>
            </div>

            <div
              id="chat-photo-previews"
              className="chat-photo-previews"
              aria-label="Photos ready to send"
            >
              {chatPhotos.map((file, index) => (
                <div key={file.id} className="chat-photo-selection">
                  <img src={file.url} alt={`Ready to send: ${file.name}`} />
                  <button
                    type="button"
                    onClick={() =>
                      setChatPhotos((prev) => prev.filter((_, i) => i !== index))
                    }
                  >
                    Remove {file.name}
                  </button>
                </div>
              ))}
            </div>

            <form
              id="helper-chat-form"
              className="helper-chat-form"
              onSubmit={(e) => {
                e.preventDefault()
                sendChatReply(chatInput)
              }}
            >
              <label className="visually-hidden" htmlFor="helper-message">
                Your diesel or auto repair question
              </label>
              <textarea
                id="helper-message"
                name="message"
                placeholder="Tell us your vehicle year/make/model and symptoms, or add a photo…"
                maxLength={1000}
                rows={3}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <button type="submit" aria-label="Send question">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </button>
            </form>

            <p className="helper-hint" id="helper-connection" role="status">
              Routed to: {activeLeadRoute?.accountLabel || 'Michael’s Tiberius Accounts'}
            </p>

            <button
              className="helper-plain"
              type="button"
              data-mode="quote"
              onClick={() => goMode('quote')}
            >
              Use the 3-step diagnostic &amp; quote form
            </button>
          </section>

          {/* PANEL 2: QUOTE (3-STEP WIZARD) */}
          <section
            data-panel="quote"
            hidden={currentMode !== 'quote'}
            aria-label="Quote request"
          >
            {reviewState === 'form' && (
              <div id="quote-content">
                <p className="quote-step" id="quote-step">
                  Step {step + 1} of 3 ·{' '}
                  {['Service & symptoms', 'Vehicle & location', 'How to follow up'][step]}
                </p>
                <h3 id="quote-title" tabIndex={-1}>
                  {
                    [
                      'Let’s start with your vehicle or equipment.',
                      'A little about your truck, car, or fleet.',
                      'How should we follow up?',
                    ][step]
                  }
                </h3>
                <p className="helper-intro">
                  Share your symptoms or maintenance needs. Services at 113 Remington Road are
                  by appointment (Mon–Fri 9:00 AM – 5:00 PM).
                </p>

                <form id="helper-quote-form" noValidate onSubmit={handleQuoteFormSubmit}>
                  <fieldset data-step="0" hidden={step !== 0}>
                    <legend className="visually-hidden">Service &amp; symptoms</legend>
                    <label>
                      What service do you need?
                      <select
                        name="service"
                        required
                        value={service}
                        onChange={(e) => setService(e.target.value)}
                      >
                        {tenantServices.map((svc) => (
                          <option key={svc.name} value={svc.name}>
                            {svc.name} ({svc.range})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      What symptoms or maintenance do you need?
                      <textarea
                        name="description"
                        rows={3}
                        minLength={3}
                        maxLength={1000}
                        required
                        placeholder="e.g., 2006 F-250 6.0 Powerstroke hard start when warm, check-engine codes, or fleet PM package…"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </label>
                    <label>
                      How urgent is it?
                      <select
                        name="urgency"
                        value={urgency}
                        onChange={(e) => setUrgency(e.target.value)}
                      >
                        <option value="Routine">Scheduled maintenance / drives normally</option>
                        <option value="Urgent">Truck / equipment is down or derated</option>
                        <option value="Needs review">Check-engine light / need diagnostic</option>
                      </select>
                    </label>
                  </fieldset>

                  <fieldset data-step="1" hidden={step !== 1}>
                    <legend className="visually-hidden">Vehicle &amp; location</legend>
                    <label>
                      ZIP code
                      <input
                        name="zip"
                        spellCheck="false"
                        inputMode="numeric"
                        autoComplete="postal-code"
                        pattern="[0-9]{5}"
                        maxLength={5}
                        required
                        placeholder="78070"
                        value={zip}
                        onChange={(e) => setZip(e.target.value)}
                      />
                    </label>
                    <p className="helper-hint">
                      Serving Spring Branch (78070), Bulverde, Canyon Lake, New Braunfels &amp; the Hill Country.
                    </p>
                    <label>
                      Vehicle Year, Make &amp; Model{' '}
                      <span className="optional">(or Equipment Unit)</span>
                      <input
                        name="address"
                        maxLength={200}
                        placeholder="e.g., 2019 Ram 3500 6.7 Cummins / 2015 Chevy Tahoe"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                      />
                    </label>
                    <div className="helper-field-pair">
                      <label>
                        Vehicle / Equipment Type
                        <select
                          name="propertyType"
                          value={propertyType}
                          onChange={(e) => setPropertyType(e.target.value)}
                        >
                          <option>Diesel Pickup (Powerstroke / Duramax / Cummins)</option>
                          <option>Gas Car, Truck or SUV</option>
                          <option>Commercial Fleet / Semi / Box Truck</option>
                          <option>Heavy / Construction Equipment</option>
                        </select>
                      </label>
                      <label>
                        Service Preference
                        <select
                          name="roofAge"
                          value={roofAge}
                          onChange={(e) => setRoofAge(e.target.value)}
                        >
                          <option>In-Shop Appointment (113 Remington Rd)</option>
                          <option>Mobile House-Call Service</option>
                          <option>Need Synchrony 6-Mo. Financing Info</option>
                        </select>
                      </label>
                    </div>
                    <label className="helper-upload">
                      Add photos <span className="optional">(optional)</span>
                      <input
                        id="helper-photos"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        onChange={handleQuotePhotoInput}
                      />
                    </label>
                    <p className="helper-hint">
                      Up to 3 photos, 5 MB each (dash warning lights, engine bay, leak, or VIN tag).
                    </p>
                    <div id="helper-photo-previews" className="helper-photos">
                      {quotePhotos.map((p) => (
                        <img
                          key={p.id}
                          src={p.url}
                          alt={`Selected photo: ${p.name}`}
                          width={80}
                          height={64}
                        />
                      ))}
                    </div>
                  </fieldset>

                  <fieldset data-step="2" hidden={step !== 2}>
                    <legend className="visually-hidden">How to follow up</legend>
                    <label>
                      Your name
                      <input
                        name="name"
                        autoComplete="name"
                        maxLength={100}
                        required
                        placeholder="Jorge M."
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </label>
                    <label>
                      Preferred contact
                      <select
                        name="method"
                        value={contactMethod}
                        onChange={(e) => setContactMethod(e.target.value)}
                      >
                        <option value="phone">Phone call / text</option>
                        <option value="email">Email</option>
                      </select>
                    </label>
                    <label>
                      <span id="helper-contact-label">
                        {contactMethod === 'phone' ? 'Phone number' : 'Email address'}
                      </span>
                      <input
                        name="value"
                        spellCheck="false"
                        type={contactMethod === 'phone' ? 'tel' : 'email'}
                        autoComplete={contactMethod === 'phone' ? 'tel' : 'email'}
                        maxLength={200}
                        required
                        placeholder={
                          contactMethod === 'phone' ? '(830) 388-1458' : 'driver@example.com'
                        }
                        value={contactValue}
                        onChange={(e) => setContactValue(e.target.value)}
                      />
                    </label>
                    <label>
                      Next step
                      <select
                        name="intent"
                        value={intent}
                        onChange={(e) => setIntent(e.target.value)}
                      >
                        <option>Schedule a diagnostic / estimate</option>
                        <option>Request mobile house-call service</option>
                        <option>Discuss fleet maintenance package</option>
                      </select>
                    </label>
                    <label>
                      Preferred time to be contacted
                      <select
                        name="contactWindow"
                        value={contactWindow}
                        onChange={(e) => setContactWindow(e.target.value)}
                      >
                        <option>Flexible (Mon–Fri 9am–5pm)</option>
                        <option>Morning (9am–12pm)</option>
                        <option>Afternoon (12pm–5pm)</option>
                      </select>
                    </label>
                    <label className="helper-consent">
                      <input
                        name="consent"
                        type="checkbox"
                        required
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                      />
                      <span>
                        I agree to follow-up about this inquiry by my chosen method.{' '}
                        {activeLeadRoute?.disclosureText}
                      </span>
                    </label>
                  </fieldset>

                  <p className="helper-error" id="helper-error" role="alert">
                    {helperError}
                  </p>

                  <div className="quote-actions">
                    <button
                      className="helper-back"
                      type="button"
                      id="quote-back"
                      hidden={step === 0}
                      onClick={() => {
                        setHelperError('')
                        setStep((s) => Math.max(0, s - 1))
                      }}
                    >
                      Back
                    </button>
                    <button className="button" type="submit" id="quote-next">
                      {step === 2 ? 'Review my request' : 'Continue'}{' '}
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M5 12h14m-6-6 6 6-6 6" />
                      </svg>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {reviewState === 'review' && (
              <div id="helper-review">
                <h3>Your request, ready to review.</h3>
                <p className="helper-intro">
                  This request routes to <strong>{activeLeadRoute?.accountLabel}</strong> (
                  {activeLeadRoute?.recipientEmail}).
                </p>
                <dl>
                  <dt>Service &amp; Symptoms</dt>
                  <dd>
                    {service}: {description}
                  </dd>
                  <dt>Vehicle &amp; ZIP</dt>
                  <dd>
                    {zip}
                    {address ? ` · ${address}` : ` · ${propertyType}`}
                  </dd>
                  <dt>Contact</dt>
                  <dd>
                    {name} · {contactValue}
                  </dd>
                  <dt>Photos</dt>
                  <dd>{quotePhotos.map((f) => f.name).join(', ') || 'None'}</dd>
                  <dt>Lead Destination</dt>
                  <dd>{activeLeadRoute?.accountLabel}</dd>
                </dl>
                <div className="quote-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setReviewState('form')
                      setStep(2)
                    }}
                  >
                    Edit details
                  </button>
                  <button type="button" className="button" onClick={handleSaveLead}>
                    Submit diagnostic request
                  </button>
                </div>
              </div>
            )}

            {reviewState === 'saved' && (
              <div id="helper-review">
                <div className="request-saved">✓</div>
                <h3>Your diagnostic request is saved.</h3>
                <p className="helper-intro">
                  Routed to <strong>{activeLeadRoute?.accountLabel}</strong> ({activeLeadRoute?.recipientEmail}).
                  For immediate shop assistance, call{' '}
                  <a href={rawPhoneHref} style={{ fontWeight: 700 }}>
                    {activeTenant.phoneDisplay}
                  </a>
                  .
                </p>
                <p className="helper-hint">Reference: {savedRef}</p>
                <div className="quote-actions">
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      setReviewState('form')
                      setStep(0)
                      goMode('booking')
                    }}
                  >
                    Choose an appointment time
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReviewState('form')
                      setStep(0)
                      setDescription('')
                      setQuotePhotos([])
                    }}
                  >
                    Start another request
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReviewState('form')
                      setStep(0)
                      closeHelperModal()
                      setActiveView('backoffice')
                    }}
                  >
                    View in Owner Inbox ↗
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* PANEL 3: BOOKING */}
          <section
            data-panel="booking"
            hidden={currentMode !== 'booking'}
            aria-label="Appointment scheduling"
          >
            <span className="panel-symbol">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 5h16v16H4zM8 2v6M16 2v6M4 10h16M8 14h3M14 14h3M8 18h3" />
              </svg>
            </span>
            <h3>Schedule by Appointment.</h3>
            <p className="helper-intro" id="booking-explanation">
              All Solutions Diesel and Auto Repair operates Monday–Friday 9:00 AM – 5:00 PM by
              appointment at 113 Remington Road, Spring Branch, TX 78070. Calendar bookings
              currently route to <strong>{activeLeadRoute?.accountLabel}</strong> (or call the
              shop directly at{' '}
              <a href={rawPhoneHref} style={{ fontWeight: 700 }}>
                {activeTenant.phoneDisplay}
              </a>
              ).
            </p>
            <div id="booking-action">
              <button
                type="button"
                className="button"
                disabled={calVisible}
                onClick={() => setCalVisible(true)}
              >
                Show available appointment times
              </button>
              <a
                className="helper-plain"
                href={`https://cal.com/${(calcomConfig?.handle || 'tiberius').replace(/^@/, '')}/${(calcomConfig?.eventSlug || 'contractor').replace(/^\//, '')}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open the calendar in a new tab
              </a>
            </div>
            {calVisible && (
              <div id="cal-embed" className="cal-embed">
                <iframe
                  title="Cal.com Live Calendar"
                  src={`https://cal.com/${(calcomConfig?.handle || 'tiberius').replace(/^@/, '')}/${(calcomConfig?.eventSlug || 'contractor').replace(/^\//, '')}?embed=true&theme=light`}
                  loading="lazy"
                />
              </div>
            )}
            <p className="helper-hint">
              Active Calendar Route: @{calcomConfig?.handle || 'tiberius'}/
              {calcomConfig?.eventSlug || 'contractor'} ({activeLeadRoute?.accountLabel}).
            </p>
          </section>

          {/* PANEL 4: TEXT */}
          <section
            data-panel="text"
            hidden={currentMode !== 'text'}
            aria-label="Business texting"
          >
            <span className="panel-symbol">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5A8.5 8.5 0 0 1 10.5 3h2A8.5 8.5 0 0 1 21 11.5Z" />
                <path d="M7 10h9M7 14h6" />
              </svg>
            </span>
            <h3>Quick Diagnostic Request or Call.</h3>
            <p className="helper-intro" id="text-explanation">
              Send your vehicle details through the AI quote form (routed to{' '}
              <strong>{activeLeadRoute?.accountLabel}</strong>) or call All Solutions directly at{' '}
              <a href={rawPhoneHref} style={{ fontWeight: 700 }}>
                {activeTenant.phoneDisplay}
              </a>
              .
            </p>
            <div className="sms-preview">
              <small>Suggested message</small>
              <p>
                Hi All Solutions, I need a diagnostic/estimate for my truck in Spring Branch
                (78070).
              </p>
            </div>
            <div id="text-action" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => goMode('quote')}>
                Use the request form
              </button>
              <a className="button" href={rawPhoneHref}>
                Call {activeTenant.phoneDisplay}
              </a>
            </div>
          </section>

          {/* PANEL 5: CALL */}
          <section data-panel="call" hidden={currentMode !== 'call'}>
            <h3>Call All Solutions Diesel &amp; Auto Repair</h3>
            <p className="helper-intro">
              Reach the shop at 113 Remington Road, Spring Branch, TX 78070 (Mon–Fri 9:00 AM –
              5:00 PM, Services by Appointment Only).
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <a className="button" href={rawPhoneHref}>
                Call {activeTenant.phoneDisplay}
              </a>
              <button
                className="quiet-button"
                type="button"
                data-mode="quote"
                onClick={() => goMode('quote')}
              >
                Or submit an AI quote request
              </button>
            </div>
          </section>

          <p className="helper-status" id="helper-status" role="status">
            {helperStatus}
          </p>
        </div>

        <div className="helper-bottom">
          <a
            href="#inquiry"
            onClick={(e) => {
              e.preventDefault()
              closeHelperModal()
            }}
          >
            {activeLeadRoute?.badgeLabel || 'AI Leads → My Accounts'}
          </a>
          <span>{activeTenant.phoneDisplay}</span>
        </div>
      </dialog>
    </div>
  )
}
