import { useEffect, useRef, useState } from 'react'
import {
  Sparkles,
  Mic,
  Send,
  Volume2,
  Pause,
  Hand,
  Bot,
  Wand2,
  Star,
  FileEdit,
  Settings2,
  Check,
  X,
  ZoomIn,
  BookOpen,
  Calendar,
  Plus,
  Trash2,
  ExternalLink,
  MessageSquarePlus,
} from 'lucide-react'
import { usePlatform } from '../../context/usePlatform'

export default function UnifiedTimeline() {
  const {
    selectedThread,
    activeTenant,
    setThreadHandoffMode,
    approveAlfredDraft,
    dismissAlfredDraft,
    alfredSetup,
    updateAlfredSetup,
    alfredPresets,
    setLightboxPhoto,
    sendHumanMessage,
    updateThreadStatus,
    generateCoPilotSuggestion,
    polishFieldVoiceNote,
    triggerJobCompletedCheckIn,
    simulateCustomerInboundMessage,
    calcomConfig,
    updateCalcomConfig,
    calcomStatus,
    setCalcomEmbedOpen,
    knowledgeBaseArticles,
    addCustomKnowledgeArticle,
    deleteCustomKnowledgeArticle,
  } = usePlatform()

  const [composerText, setComposerText] = useState('')
  const [composerChannel, setComposerChannel] = useState('SMS')
  const [showVoiceModal, setShowVoiceModal] = useState(false)
  const [showAlfredSetup, setShowAlfredSetup] = useState(false)
  const [showKbDrawer, setShowKbDrawer] = useState(false)
  const [showCalDrawer, setShowCalDrawer] = useState(false)
  const [showInboundSim, setShowInboundSim] = useState(true)
  const [simCustomerText, setSimCustomerText] = useState('')
  const [kbSearch, setKbSearch] = useState('')
  const [newKbCategory, setNewKbCategory] = useState('Owner Rule')
  const [newKbTitle, setNewKbTitle] = useState('')
  const [newKbContent, setNewKbContent] = useState('')

  // Cal.com v2 Drawer Form State (Tenant-Scoped, Derived During Render)
  const [calEditsByTenant, setCalEditsByTenant] = useState({})
  const tenantCalEdits = calEditsByTenant[activeTenant.id] || {}
  const calHandleInput =
    tenantCalEdits.handle !== undefined
      ? tenantCalEdits.handle
      : calcomConfig.handle || 'tiberius'
  const calSlugInput =
    tenantCalEdits.eventSlug !== undefined
      ? tenantCalEdits.eventSlug
      : calcomConfig.eventSlug || 'contractor'
  const calEventIdInput =
    tenantCalEdits.eventTypeId !== undefined
      ? tenantCalEdits.eventTypeId
      : calcomConfig.eventTypeId || ''
  const calProxyEnabled =
    tenantCalEdits.proxyEnabled !== undefined
      ? Boolean(tenantCalEdits.proxyEnabled)
      : Boolean(calcomConfig.proxyEnabled)

  const updateCalDraftField = (field, value) => {
    setCalEditsByTenant((prev) => ({
      ...prev,
      [activeTenant.id]: {
        ...(prev[activeTenant.id] || {}),
        [field]: value,
      },
    }))
  }

  const [draftEdits, setDraftEdits] = useState({})
  const [rawVoiceText, setRawVoiceText] = useState(
    'tell him we looked at the flashing gap by the brick, we can seal and re-lead it tomorrow at 2pm for 580 bucks'
  )
  const [playingVoicemailId, setPlayingVoicemailId] = useState(null)

  const timelineEndRef = useRef(null)

  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedThread?.id, selectedThread?.messages?.length])

  if (!selectedThread) return null

  const currentHandoff =
    selectedThread.handoffMode || (selectedThread.aiAutopilot ? 'AI' : 'Human')
  const activeDraftText =
    selectedThread.alfredDraft &&
    draftEdits[selectedThread.alfredDraft.id] !== undefined
      ? draftEdits[selectedThread.alfredDraft.id]
      : selectedThread.alfredDraft?.text || ''

  const handleSendHuman = (e) => {
    e.preventDefault()
    if (!composerText.trim()) return
    sendHumanMessage(selectedThread.id, composerText, composerChannel)
    setComposerText('')
  }

  const handleSuggestReply = () => {
    const draft = generateCoPilotSuggestion(selectedThread.id)
    setComposerText(draft)
  }

  const handleConvertVoiceNote = () => {
    const polished = polishFieldVoiceNote(rawVoiceText, selectedThread.id)
    setComposerText(polished)
    setShowVoiceModal(false)
  }

  const handleSimulateInboundSubmit = (e) => {
    e.preventDefault()
    if (!simCustomerText.trim()) return
    simulateCustomerInboundMessage(selectedThread.id, simCustomerText, 'SMS')
    setSimCustomerText('')
  }

  const handleAddKbRule = (e) => {
    e.preventDefault()
    if (!newKbTitle.trim() || !newKbContent.trim()) return
    addCustomKnowledgeArticle({
      category: newKbCategory,
      title: newKbTitle,
      content: newKbContent,
    })
    setNewKbTitle('')
    setNewKbContent('')
  }

  const handleSaveCalcomSettings = (e) => {
    e.preventDefault()
    updateCalcomConfig({
      handle: calHandleInput.trim() || 'tiberius',
      eventSlug: calSlugInput.trim() || 'contractor',
      eventTypeId: calEventIdInput.trim(),
      proxyEnabled: Boolean(calProxyEnabled),
    })
  }

  const filteredKbArticles = knowledgeBaseArticles.filter(
    (art) =>
      !kbSearch.trim() ||
      art.title.toLowerCase().includes(kbSearch.toLowerCase()) ||
      art.content.toLowerCase().includes(kbSearch.toLowerCase()) ||
      art.category.toLowerCase().includes(kbSearch.toLowerCase())
  )

  const spentDollars = (alfredSetup.spentMicros / 1_000_000).toFixed(2)
  const reservedDollars = (alfredSetup.reservedMicros / 1_000_000).toFixed(2)
  const limitDollars = (alfredSetup.limitMicros / 1_000_000).toFixed(2)
  const budgetPct = Math.min(
    100,
    Math.round(
      ((alfredSetup.spentMicros + alfredSetup.reservedMicros) /
        alfredSetup.limitMicros) *
        100
    )
  )

  return (
    <main className="pane-center-timeline">
      {/* Top Header with CRITICAL FEATURE: [ 🤖 AI Autopilot | 📝 Alfred Drafts | ✋ Take Over ] */}
      <div className="timeline-header">
        <div className="timeline-contact-info">
          <div className="timeline-contact-top">
            <h2>{selectedThread.contactName}</h2>
            <span className="timeline-phone-tag">{selectedThread.phone}</span>
            <select
              aria-label="AI Status Pill"
              className={`status-select-pill status-${selectedThread.aiStatus}`}
              value={selectedThread.aiStatus}
              onChange={(e) =>
                updateThreadStatus(selectedThread.id, e.target.value)
              }
            >
              <option value="qualifying">🤖 AI Qualifying</option>
              <option value="ready_for_quote">🟢 Ready for Quote</option>
              <option value="needs_human">🚨 Needs Human</option>
            </select>
          </div>
          <div className="timeline-contact-sub">
            <span>{selectedThread.address}</span>
            {selectedThread.propertyType && (
              <span>
                {' '}
                • {selectedThread.propertyType} ({selectedThread.roofAge || 'Age TBD'})
              </span>
            )}
          </div>
        </div>

        {/* CRITICAL FEATURE: 3-Mode Handoff Toggle + Knowledge Base & Cal.com Controls */}
        <div className="autopilot-control-group">
          <div
            className={`autopilot-segmented-toggle ${
              selectedThread.aiAutopilot ? 'is-autopilot' : 'is-human'
            }`}
          >
            <button
              type="button"
              className={`seg-btn ${currentHandoff === 'AI' ? 'active-on' : ''}`}
              onClick={() => setThreadHandoffMode(selectedThread.id, 'AI')}
              title="Alfred replies automatically using contractor Knowledge Base & Cal.com"
            >
              <Bot size={14} />
              <span>
                🤖 AI Autopilot: {currentHandoff === 'AI' ? 'ON' : 'Auto'}
              </span>
            </button>

            <button
              type="button"
              className={`seg-btn ${
                currentHandoff === 'Draft' ? 'active-draft' : ''
              }`}
              onClick={() => setThreadHandoffMode(selectedThread.id, 'Draft')}
              title="Alfred drafts a private reply for you to approve before sending"
            >
              <FileEdit size={13} />
              <span>📝 Alfred Drafts</span>
            </button>

            <button
              type="button"
              className={`seg-btn ${
                currentHandoff === 'Human' ? 'active-takeover' : ''
              }`}
              onClick={() => setThreadHandoffMode(selectedThread.id, 'Human')}
              title="Pause AI Autopilot and handle this conversation yourself"
            >
              <Hand size={14} />
              <span>✋ Take Over</span>
            </button>
          </div>

          <button
            type="button"
            className={`btn-job-complete-trigger ${showKbDrawer ? 'active-drawer-btn' : ''}`}
            onClick={() => {
              setShowKbDrawer((prev) => !prev)
              setShowCalDrawer(false)
              setShowAlfredSetup(false)
            }}
            title="Inspect or add rules to Alfred's Tenant Knowledge Base"
          >
            <BookOpen size={13} />
            <span>Knowledge Base ({knowledgeBaseArticles.length})</span>
          </button>

          <button
            type="button"
            className={`btn-job-complete-trigger ${showCalDrawer ? 'active-drawer-btn' : ''}`}
            onClick={() => {
              setShowCalDrawer((prev) => !prev)
              setShowKbDrawer(false)
              setShowAlfredSetup(false)
            }}
            title="Configure Dual-Mode Cal.com Calendar & API Sync"
          >
            <Calendar size={13} />
            <span>Cal.com Sync</span>
          </button>

          <button
            type="button"
            className={`btn-job-complete-trigger ${showAlfredSetup ? 'active-drawer-btn' : ''}`}
            onClick={() => {
              setShowAlfredSetup((prev) => !prev)
              setShowKbDrawer(false)
              setShowCalDrawer(false)
            }}
            title="Configure 'Make Alfred Your Own' presets & AI budget"
          >
            <Settings2 size={13} />
            <span>Alfred Setup</span>
          </button>

          <button
            type="button"
            className="btn-job-complete-trigger"
            onClick={() => triggerJobCompletedCheckIn(selectedThread.id)}
            title="Trigger TOS-Safe Job Completed Review Check-In SMS"
          >
            <Star size={13} />
            <span>Job Completed</span>
          </button>
        </div>
      </div>

      {/* Knowledge Base Inspector & Custom Rule Drawer */}
      {showKbDrawer && (
        <div className="alfred-setup-drawer kb-manager-drawer">
          <div className="alfred-setup-header">
            <div>
              <span
                className="section-tag"
                style={{ color: activeTenant.brandColor }}
              >
                GROUNDED AI BRAIN // {activeTenant.companyName.toUpperCase()} KNOWLEDGE BASE
              </span>
              <h4>
                Active Knowledge Base ({knowledgeBaseArticles.length} indexed articles)
              </h4>
            </div>
            <div className="kb-search-inline">
              <input
                type="text"
                placeholder="Filter KB articles (e.g. warranty, zip, price)..."
                value={kbSearch}
                onChange={(e) => setKbSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="icon-close-btn"
              onClick={() => setShowKbDrawer(false)}
            >
              <X size={15} />
            </button>
          </div>

          <div className="kb-drawer-grid">
            <div className="kb-articles-list">
              {filteredKbArticles.map((art) => (
                <div key={art.id} className="kb-article-item">
                  <div className="kb-article-top">
                    <span className="kb-cat-pill">{art.category}</span>
                    <strong>{art.title}</strong>
                    {art.isCustom && (
                      <button
                        type="button"
                        className="kb-delete-btn"
                        onClick={() => deleteCustomKnowledgeArticle(art.id)}
                        title="Remove custom rule"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <p className="kb-article-body">{art.content}</p>
                </div>
              ))}
            </div>

            <form className="kb-add-form" onSubmit={handleAddKbRule}>
              <span className="kb-form-title">
                <Plus size={13} /> Add Custom Owner Rule to Knowledge Base
              </span>
              <select
                aria-label="Rule Category"
                className="kb-select"
                value={newKbCategory}
                onChange={(e) => setNewKbCategory(e.target.value)}
              >
                <option value="Owner Rule">Owner Rule / SOP</option>
                <option value="Pricing & Diagnostics">
                  Pricing &amp; Diagnostics
                </option>
                <option value="Service Territory">
                  Service Territory &amp; ZIPs
                </option>
                <option value="Warranty & Credentials">
                  Warranty &amp; Credentials
                </option>
              </select>
              <input
                type="text"
                placeholder="Rule title (e.g. Financing & Storm Deductible Policy)"
                value={newKbTitle}
                onChange={(e) => setNewKbTitle(e.target.value)}
              />
              <textarea
                rows={3}
                placeholder="Write the exact policy, ZIP code, or pricing fact Alfred should cite when answering homeowners..."
                value={newKbContent}
                onChange={(e) => setNewKbContent(e.target.value)}
              />
              <button
                type="submit"
                className="btn-xs-primary"
                style={{ backgroundColor: '#283e34', color: '#ffffff' }}
              >
                <Plus size={13} /> Save Rule to Knowledge Base
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Dual-Mode Cal.com v2 Calendar Connection Drawer */}
      {showCalDrawer && (
        <div className="alfred-setup-drawer calcom-setup-drawer">
          <div className="alfred-setup-header">
            <div>
              <span
                className="section-tag"
                style={{ color: activeTenant.brandColor }}
              >
                DUAL-MODE CAL.COM v2 CALENDAR ENGINE // {calcomStatus.sourceLabel}
              </span>
              <h4>
                Connect Your Cal.com Handle or Server-Proxied Cal.com API v2
              </h4>
            </div>
            <div className="cal-drawer-top-actions">
              <button
                type="button"
                className="btn-xs-outline"
                onClick={() => setCalcomEmbedOpen(true)}
              >
                <ExternalLink size={12} /> Preview Live Cal.com Embed
              </button>
              <button
                type="button"
                className="icon-close-btn"
                onClick={() => setShowCalDrawer(false)}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <form className="calcom-config-form" onSubmit={handleSaveCalcomSettings}>
            <div className="calcom-fields-row">
              <label>
                <span>Cal.com Username / Handle ({activeTenant.companyName})</span>
                <input
                  type="text"
                  value={calHandleInput}
                  onChange={(e) => updateCalDraftField('handle', e.target.value)}
                  placeholder="e.g. tiberius"
                />
              </label>
              <label>
                <span>Event Slug</span>
                <input
                  type="text"
                  value={calSlugInput}
                  onChange={(e) =>
                    updateCalDraftField('eventSlug', e.target.value)
                  }
                  placeholder="e.g. contractor"
                />
              </label>
              <label>
                <span>Event Type ID (For Cal.com REST API v2)</span>
                <input
                  type="text"
                  value={calEventIdInput}
                  onChange={(e) =>
                    updateCalDraftField('eventTypeId', e.target.value)
                  }
                  placeholder="e.g. 123456"
                />
              </label>
              <label className="calcom-proxy-toggle-label">
                <span>Cal.com API v2 Server Proxy (/api/calcom/*)</span>
                <div className="calcom-proxy-check-row">
                  <input
                    type="checkbox"
                    checked={calProxyEnabled}
                    onChange={(e) =>
                      updateCalDraftField('proxyEnabled', e.target.checked)
                    }
                  />
                  <span>
                    Use server-side <code>CALCOM_API_KEY</code> in <code>.env</code>
                  </span>
                </div>
              </label>
            </div>
            <div className="calcom-form-footer">
              <span className="calcom-status-hint">
                Booking URL:{' '}
                <code>
                  https://cal.com/{calHandleInput || 'tiberius'}/
                  {calSlugInput || 'contractor'}
                </code>
                {calcomStatus.apiError ? ` • Note: ${calcomStatus.apiError}` : ''}
              </span>
              <button
                type="submit"
                className="btn-xs-primary"
                style={{ backgroundColor: '#283e34', color: '#ffffff' }}
              >
                <Check size={13} /> Save &amp; Sync Cal.com Slots
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tiberius "Make Alfred Your Own" 4-Preset Setup Drawer + AI Budget Meter */}
      {showAlfredSetup && (
        <div className="alfred-setup-drawer">
          <div className="alfred-setup-header">
            <div>
              <span
                className="section-tag"
                style={{ color: activeTenant.brandColor }}
              >
                MAKE ALFRED YOUR OWN // DEFAULT CO-PILOT BEHAVIOR
              </span>
              <h4>How should Alfred handle new homeowner inquiries?</h4>
            </div>
            <div className="alfred-budget-pill">
              <span>
                AI Budget: <strong>${spentDollars}</strong> used • ${reservedDollars}{' '}
                reserved / ${limitDollars}
              </span>
              <div className="budget-bar-track">
                <div
                  className="budget-bar-fill"
                  style={{
                    width: `${budgetPct}%`,
                    backgroundColor: activeTenant.brandColor,
                  }}
                />
              </div>
            </div>
            <button
              type="button"
              className="icon-close-btn"
              onClick={() => setShowAlfredSetup(false)}
            >
              <X size={15} />
            </button>
          </div>

          <div className="alfred-presets-grid">
            {alfredPresets.map((preset) => {
              const isSelected = alfredSetup.preset === preset.id
              return (
                <label
                  key={preset.id}
                  className={`alfred-preset-card ${isSelected ? 'selected' : ''}`}
                  style={
                    isSelected
                      ? { borderColor: activeTenant.brandColor }
                      : undefined
                  }
                >
                  <input
                    type="radio"
                    name="alfredPreset"
                    checked={isSelected}
                    onChange={() => updateAlfredSetup(preset.id)}
                  />
                  <div>
                    <div className="preset-title-row">
                      <strong>{preset.label}</strong>
                      <span className="preset-mode-tag">
                        {preset.defaultHandoff}
                      </span>
                    </div>
                    <p>{preset.description}</p>
                  </div>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* Autopilot / Handoff Guardrail Status Banner */}
      <div
        className={`autopilot-guardrail-bar ${
          selectedThread.aiAutopilot ? 'bar-on' : 'bar-off'
        }`}
      >
        {currentHandoff === 'AI' && (
          <span>
            <strong>🤖 AI Autopilot Active (“Alfred replies”):</strong> Grounded in{' '}
            <code>{activeTenant.companyName}</code> Knowledge Base + live Cal.com
            slots.{' '}
            <em>
              (Typing &amp; sending a manual message below automatically flips to ✋ Human Takeover.)
            </em>
          </span>
        )}
        {currentHandoff === 'Draft' && (
          <span>
            <strong>📝 AI Draft-First Active (“Alfred drafts”):</strong> Alfred
            prepares KB-grounded private replies below and waits for your approval before texting the customer.
          </span>
        )}
        {currentHandoff === 'Human' && (
          <span>
            <strong>✋ Human-in-the-Loop Active (Autopilot OFF):</strong> Alfred is
            paused on this thread so you and the AI never talk over each other.
          </span>
        )}
      </div>

      {/* Chronological Multi-Channel Stream */}
      <div className="timeline-messages-stream">
        {selectedThread.messages.map((msg) => {
          if (msg.sender === 'system') {
            return (
              <div
                key={msg.id}
                className={`timeline-system-event event-${msg.eventType || 'info'}`}
              >
                <span>{msg.text}</span>
                <span className="sys-time">{msg.timestamp}</span>
              </div>
            )
          }

          const isCustomer = msg.sender === 'customer'
          const isAI = msg.sender === 'ai'

          return (
            <div
              key={msg.id}
              className={`timeline-msg-row ${
                isCustomer ? 'row-customer' : 'row-outbound'
              }`}
            >
              <div
                className={`timeline-bubble ${
                  isCustomer
                    ? 'bubble-customer'
                    : isAI
                    ? 'bubble-ai'
                    : 'bubble-human'
                }`}
                style={
                  !isCustomer && !isAI
                    ? { borderColor: activeTenant.brandColor }
                    : undefined
                }
              >
                <div className="bubble-meta-top">
                  <span className="sender-badge">
                    {isCustomer
                      ? `👤 ${selectedThread.contactName}`
                      : isAI
                      ? `🤖 Alfred · ${activeTenant.companyName} AI`
                      : `👷‍♂️ Human Operator (${activeTenant.companyName})`}
                  </span>
                  <span className="channel-pill-mini">{msg.channel}</span>
                  <span className="msg-time">{msg.timestamp}</span>
                </div>

                {/* Audio Voicemail Player (if present) */}
                {msg.voicemail && (
                  <div className="voicemail-card">
                    <div className="voicemail-controls">
                      <button
                        type="button"
                        className="vm-play-btn"
                        style={{ backgroundColor: activeTenant.brandColor }}
                        onClick={() =>
                          setPlayingVoicemailId(
                            playingVoicemailId === msg.id ? null : msg.id
                          )
                        }
                      >
                        {playingVoicemailId === msg.id ? (
                          <Pause size={14} />
                        ) : (
                          <Volume2 size={14} />
                        )}
                      </button>
                      <div className="vm-waveform">
                        {[38, 65, 90, 52, 84, 95, 44, 72, 60, 88, 50, 76, 40, 68].map(
                          (h, idx) => (
                            <span
                              key={idx}
                              className={`wave-bar ${
                                playingVoicemailId === msg.id ? 'animating' : ''
                              }`}
                              style={{
                                height: `${h}%`,
                                backgroundColor:
                                  playingVoicemailId === msg.id
                                    ? activeTenant.brandColor
                                    : undefined,
                              }}
                            />
                          )
                        )}
                      </div>
                      <span className="vm-duration">{msg.voicemail.duration}</span>
                    </div>
                    <div className="vm-transcript">{msg.voicemail.transcript}</div>
                  </div>
                )}

                {/* Uploaded Customer Damage Photo — Clickable for Lightbox */}
                {msg.photoUrl && (
                  <div
                    className="timeline-photo-attachment clickable-photo"
                    onClick={() =>
                      setLightboxPhoto({
                        url: msg.photoUrl,
                        caption:
                          msg.photoCaption ||
                          `${selectedThread.contactName} Project Photo`,
                      })
                    }
                    title="Click to enlarge photo in inspection lightbox"
                  >
                    <img
                      src={msg.photoUrl}
                      alt={msg.photoCaption || 'Customer upload'}
                    />
                    <div className="photo-caption-bar">
                      <Sparkles
                        size={12}
                        style={{ color: activeTenant.brandColor }}
                      />
                      <span>{msg.photoCaption || 'Customer Inspection Photo'}</span>
                      <ZoomIn size={12} className="photo-zoom-icon" />
                    </div>
                  </div>
                )}

                <p className="bubble-text">{msg.text}</p>

                {/* Grounded Knowledge Base & Cal.com Citations on AI Replies */}
                {Array.isArray(msg.kbCitations) && msg.kbCitations.length > 0 && (
                  <div className="kb-citations-row">
                    {msg.kbCitations.map((cit) => (
                      <span
                        key={cit.id}
                        className="kb-citation-pill"
                        title={cit.snippet || cit.title}
                      >
                        <BookOpen size={10} />
                        <span>
                          KB: {cit.category} — {cit.title}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        <div ref={timelineEndRef} />
      </div>

      {/* Tiberius Private Alfred Draft Approval Box (#alfred-draft from owner.mjs) */}
      {selectedThread.alfredDraft && (
        <div className="alfred-private-draft-card">
          <div className="alfred-draft-top">
            <div className="alfred-draft-badge">
              <Sparkles size={13} style={{ color: activeTenant.brandColor }} />
              <strong>ALFRED PRIVATE DRAFT (AWAITING OWNER APPROVAL)</strong>
              <span>• {selectedThread.alfredDraft.createdAt}</span>
            </div>
            <span className="alfred-draft-reason">
              {selectedThread.alfredDraft.reason}
            </span>
          </div>
          {Array.isArray(selectedThread.alfredDraft.citations) &&
            selectedThread.alfredDraft.citations.length > 0 && (
              <div className="kb-citations-row draft-citations">
                {selectedThread.alfredDraft.citations.map((cit) => (
                  <span key={cit.id} className="kb-citation-pill">
                    <BookOpen size={10} />
                    <span>
                      KB: {cit.category} — {cit.title}
                    </span>
                  </span>
                ))}
              </div>
            )}
          <textarea
            aria-label="Review or edit Alfred's draft before sending"
            className="alfred-draft-textarea"
            rows={2}
            value={activeDraftText}
            onChange={(e) =>
              setDraftEdits((prev) => ({
                ...prev,
                [selectedThread.alfredDraft.id]: e.target.value,
              }))
            }
          />
          <div className="alfred-draft-actions">
            <button
              type="button"
              className="btn-xs-primary"
              disabled={!activeDraftText.trim()}
              style={{
                backgroundColor: '#283e34',
                color: '#ffffff',
                opacity: activeDraftText.trim() ? 1 : 0.55,
              }}
              onClick={() => {
                if (!activeDraftText.trim()) return
                approveAlfredDraft(selectedThread.id, activeDraftText)
              }}
            >
              <Check size={13} />{' '}
              {selectedThread.alfredDraft.pendingSlot
                ? `Approve & Book Cal.com (${selectedThread.alfredDraft.pendingSlot.shortLabel})`
                : 'Approve & Send to Homeowner'}
            </button>
            <button
              type="button"
              className="btn-xs-outline"
              onClick={() => {
                setComposerText(activeDraftText)
                dismissAlfredDraft(selectedThread.id)
              }}
            >
              <FileEdit size={13} /> Move to Composer
            </button>
            <button
              type="button"
              className="btn-xs-outline"
              onClick={() => dismissAlfredDraft(selectedThread.id)}
            >
              <X size={13} /> Dismiss Draft
            </button>
          </div>
        </div>
      )}

      {/* Live GHL Inbound Homeowner Simulator Bar (Test Knowledge Base & Cal.com Auto-Booking) */}
      {showInboundSim && (
        <div className="inbound-simulator-bar">
          <div className="inbound-sim-header">
            <div className="inbound-sim-title">
              <MessageSquarePlus size={13} style={{ color: activeTenant.brandColor }} />
              <strong>
                LIVE TEST: Simulate Homeowner SMS to Test Knowledge Base &amp; Cal.com Booking
              </strong>
            </div>
            <div className="inbound-sim-presets">
              <button
                type="button"
                className="btn-sim-chip"
                onClick={() =>
                  simulateCustomerInboundMessage(
                    selectedThread.id,
                    'Do you cover my ZIP code and what is your workmanship warranty?',
                    'SMS'
                  )
                }
              >
                ❓ Test Warranty &amp; ZIP KB
              </button>
              <button
                type="button"
                className="btn-sim-chip"
                onClick={() =>
                  simulateCustomerInboundMessage(
                    selectedThread.id,
                    'What is your ballpark price for a skylight or gutter installation?',
                    'SMS'
                  )
                }
              >
                💰 Test Pricing Matrix KB
              </button>
              <button
                type="button"
                className="btn-sim-chip cal-chip"
                onClick={() =>
                  simulateCustomerInboundMessage(
                    selectedThread.id,
                    'Tomorrow at 9:00 AM works great—please book me on your calendar!',
                    'SMS'
                  )
                }
              >
                📅 Test Cal.com Auto-Book
              </button>
              <button
                type="button"
                className="sim-hide-btn"
                onClick={() => setShowInboundSim(false)}
                title="Hide test bar"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          <form className="inbound-sim-form" onSubmit={handleSimulateInboundSubmit}>
            <input
              type="text"
              value={simCustomerText}
              onChange={(e) => setSimCustomerText(e.target.value)}
              placeholder={`Type as ${selectedThread.contactName} (e.g. "Do you offer emergency tarping?" or "Book me tomorrow at 9am")...`}
            />
            <button type="submit" className="btn-xs-outline">
              Simulate Inbound SMS
            </button>
          </form>
        </div>
      )}

      {/* Field Voice-Note-to-Polished-SMS Drawer */}
      {showVoiceModal && (
        <div className="voice-whisper-drawer">
          <div className="voice-drawer-top">
            <div className="voice-title">
              <Mic size={15} style={{ color: activeTenant.brandColor }} />
              <strong>Field Voice-Note → Polished Client SMS</strong>
            </div>
            <span className="voice-hint">
              Speak or type rough field notes from the truck/roof:
            </span>
          </div>
          <textarea
            className="voice-raw-input"
            rows={2}
            value={rawVoiceText}
            onChange={(e) => setRawVoiceText(e.target.value)}
          />
          <div className="voice-drawer-actions">
            <button
              type="button"
              className="btn-xs-outline"
              onClick={() => setShowVoiceModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-xs-primary"
              style={{ backgroundColor: activeTenant.brandColor }}
              onClick={handleConvertVoiceNote}
            >
              <Wand2 size={13} /> Polish into Client SMS
            </button>
          </div>
        </div>
      )}

      {/* Composer with Co-Pilot Whisper + Auto-Autopilot-Off Human Send */}
      <form className="timeline-composer" onSubmit={handleSendHuman}>
        <div className="composer-copilot-bar">
          <div className="copilot-left">
            <button
              type="button"
              className="btn-copilot-whisper"
              onClick={handleSuggestReply}
            >
              <Sparkles size={14} style={{ color: activeTenant.brandColor }} />
              <span>✨ Suggest Reply (KB + Cal.com)</span>
            </button>

            <button
              type="button"
              className="btn-copilot-voice"
              onClick={() => setShowVoiceModal((prev) => !prev)}
            >
              <Mic size={14} />
              <span>🎙️ Voice-Note to Polished SMS</span>
            </button>

            {!showInboundSim && (
              <button
                type="button"
                className="btn-copilot-voice"
                onClick={() => setShowInboundSim(true)}
              >
                <MessageSquarePlus size={14} />
                <span>Test Homeowner SMS</span>
              </button>
            )}
          </div>

          <div className="composer-channel-selector">
            <span>Channel:</span>
            <select
              aria-label="Reply Channel"
              value={composerChannel}
              onChange={(e) => setComposerChannel(e.target.value)}
            >
              <option value="SMS">SMS ({activeTenant.phoneDisplay})</option>
              <option value="Webchat">Webchat</option>
            </select>
          </div>
        </div>

        <div className="composer-input-row">
          <textarea
            className="composer-textarea"
            rows={2}
            placeholder={
              selectedThread.aiAutopilot
                ? 'Type a human reply (sending automatically flips 🤖 AI Autopilot to OFF)...'
                : 'Type your reply to the homeowner...'
            }
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendHuman(e)
              }
            }}
          />
          <button
            type="submit"
            className="btn-composer-send"
            style={{ backgroundColor: activeTenant.brandColor }}
          >
            <Send size={15} />
            <span>
              {selectedThread.aiAutopilot ? 'Send & Pause AI' : 'Send Reply'}
            </span>
          </button>
        </div>
      </form>
    </main>
  )
}
