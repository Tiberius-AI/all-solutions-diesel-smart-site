import { useState } from 'react'
import {
  Search,
  PhoneMissed,
  MessageSquare,
  Globe,
  PhoneIncoming,
  CalendarCheck,
} from 'lucide-react'
import { usePlatform } from '../../context/usePlatform'

const AI_STATUS_META = {
  qualifying: {
    pillText: '🤖 AI Qualifying',
    className: 'status-qualifying',
  },
  ready_for_quote: {
    pillText: '🟢 Ready for Quote',
    className: 'status-ready',
  },
  needs_human: {
    pillText: '🚨 Needs Human',
    className: 'status-human',
  },
}

const STAGE_LABELS = {
  new_lead: 'New Lead',
  qualifying: 'Qualifying',
  quote_sent: 'Quote Sent',
  appointment_booked: '📅 Cal.com Booked',
  job_won: '🏆 Job Won',
}

export default function ThreadQueue() {
  const {
    threads,
    selectedThread,
    selectThread,
    activeTenant,
    triggerMissedCallRescue,
  } = usePlatform()

  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('all') // 'all' | 'unread' | 'ai_active' | 'booked' | 'needs_human'

  const filteredThreads = threads.filter((thread) => {
    const matchesSearch =
      thread.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      thread.phone.includes(searchQuery) ||
      thread.jobSummary.serviceNeeded
        .toLowerCase()
        .includes(searchQuery.toLowerCase())

    if (!matchesSearch) return false

    if (activeFilter === 'unread') return thread.unread
    if (activeFilter === 'ai_active') return thread.aiAutopilot
    if (activeFilter === 'booked') return Boolean(thread.jobSummary.bookedSlot)
    if (activeFilter === 'needs_human') return thread.aiStatus === 'needs_human'
    return true
  })

  const renderChannelBadge = (channel) => {
    if (channel === 'Missed Call') {
      return (
        <span key={channel} className="channel-badge missed">
          <PhoneMissed size={11} /> Missed Call
        </span>
      )
    }
    if (channel === 'Webchat') {
      return (
        <span key={channel} className="channel-badge webchat">
          <Globe size={11} /> Webchat
        </span>
      )
    }
    return (
      <span key={channel} className="channel-badge sms">
        <MessageSquare size={11} /> SMS
      </span>
    )
  }

  const bookedCount = threads.filter((t) => Boolean(t.jobSummary.bookedSlot)).length

  return (
    <aside className="pane-left-queue">
      <div className="pane-header">
        <div className="queue-title-row">
          <h3>Conversations ({threads.length})</h3>
          <button
            type="button"
            className="btn-xs-outline"
            onClick={() => triggerMissedCallRescue()}
            title="Simulate an incoming missed call rescue thread"
          >
            <PhoneIncoming size={12} />
            <span>+ Missed Call</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="queue-search-box">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            placeholder="Search homeowner, phone, or scope..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter Pills (All, Unread, AI Active, Booked, Needs Human) */}
        <div className="queue-filter-tabs">
          <button
            type="button"
            className={`filter-pill ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All ({threads.length})
          </button>
          <button
            type="button"
            className={`filter-pill ${activeFilter === 'unread' ? 'active' : ''}`}
            onClick={() => setActiveFilter('unread')}
          >
            Unread ({threads.filter((t) => t.unread).length})
          </button>
          <button
            type="button"
            className={`filter-pill ${activeFilter === 'ai_active' ? 'active' : ''}`}
            onClick={() => setActiveFilter('ai_active')}
          >
            AI Active ({threads.filter((t) => t.aiAutopilot).length})
          </button>
          <button
            type="button"
            className={`filter-pill ${activeFilter === 'booked' ? 'active' : ''}`}
            onClick={() => setActiveFilter('booked')}
          >
            Booked ({bookedCount})
          </button>
          <button
            type="button"
            className={`filter-pill human-filter ${
              activeFilter === 'needs_human' ? 'active' : ''
            }`}
            onClick={() => setActiveFilter('needs_human')}
          >
            Needs Human ({threads.filter((t) => t.aiStatus === 'needs_human').length})
          </button>
        </div>
      </div>

      {/* Contact Thread Queue */}
      <div className="thread-list-scroll">
        {filteredThreads.map((thread) => {
          const isSelected = thread.id === selectedThread?.id
          const statusMeta =
            AI_STATUS_META[thread.aiStatus] || AI_STATUS_META.qualifying
          const lastMsg = thread.messages[thread.messages.length - 1]
          const stageKey =
            thread.opportunityStage ||
            (thread.jobSummary.bookedSlot ? 'appointment_booked' : 'quote_sent')

          return (
            <div
              key={thread.id}
              className={`thread-card ${isSelected ? 'selected' : ''} ${
                thread.unread ? 'unread' : ''
              }`}
              onClick={() => selectThread(thread.id)}
              style={
                isSelected
                  ? { borderLeftColor: activeTenant.brandColor }
                  : undefined
              }
            >
              <div className="thread-card-top">
                <div className="contact-name-group">
                  <span className="contact-avatar">
                    {thread.contactName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)}
                  </span>
                  <div>
                    <div className="contact-name">
                      {thread.contactName}
                      {thread.unread && (
                        <span
                          className="unread-dot"
                          style={{ backgroundColor: activeTenant.brandColor }}
                        />
                      )}
                    </div>
                    <div className="contact-phone">{thread.phone}</div>
                  </div>
                </div>
                <span className="thread-time">{thread.lastActivity}</span>
              </div>

              {/* AI Status Pill + Autopilot Indicator + GHL Opportunity Stage */}
              <div className="thread-pills-row">
                <span className={`ai-status-pill ${statusMeta.className}`}>
                  {statusMeta.pillText}
                </span>
                <span
                  className={`autopilot-mini-badge ${
                    thread.aiAutopilot ? 'on' : 'off'
                  }`}
                >
                  {thread.aiAutopilot ? '🤖 Auto: ON' : '✋ Human Mode'}
                </span>
                {thread.jobSummary.bookedSlot && (
                  <span className="cal-booked-mini-pill">
                    <CalendarCheck size={10} /> Cal.com
                  </span>
                )}
              </div>

              {/* Snippet */}
              <p className="thread-snippet">
                {lastMsg?.text || 'New conversation thread'}
              </p>

              {/* Channel Badges + Opportunity Stage & Est Value */}
              <div className="thread-card-footer">
                <div className="channel-badges-group">
                  {thread.channels.map((ch) => renderChannelBadge(ch))}
                  <span className="ghl-stage-mini-tag">
                    {STAGE_LABELS[stageKey] || 'Open'}
                  </span>
                </div>
                <span
                  className="thread-est-val"
                  style={{ color: activeTenant.brandColor }}
                >
                  ${thread.jobSummary.estimatedValue.toLocaleString()}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
