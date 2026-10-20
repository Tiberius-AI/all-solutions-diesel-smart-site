import { useEffect, useRef, useState } from 'react'
import contractorsData from '../config/contractors.json'
import {
  INITIAL_THREADS,
  SAMPLE_DAMAGE_PHOTOS,
  createDamagePhotoSvg,
} from '../data/initialConversations'
import {
  getSavedCalcomConfig,
  saveCalcomConfig,
  buildDefaultCalendarSlots,
  fetchCalcomAvailableSlots,
  createCalcomBooking,
  cancelCalcomBooking,
} from '../utils/calcomService'
import {
  buildTenantKnowledgeBase,
  queryKnowledgeBase,
} from '../utils/knowledgeBaseEngine'
import { PlatformContext } from './usePlatform'

function formatNowTime() {
  const now = new Date()
  return now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const ALFRED_PRESETS = [
  {
    id: 'book_first',
    label: 'Answer and help them book',
    description:
      'Alfred answers roofing & exterior questions, provides local ballpark ranges, and guides homeowners to lock in an inspection slot.',
    defaultHandoff: 'AI',
  },
  {
    id: 'qualify_only',
    label: 'Answer questions and collect details',
    description:
      'Alfred gathers ZIP code, photos, roof age, and urgency, then flags the thread Ready for Quote.',
    defaultHandoff: 'AI',
  },
  {
    id: 'draft_first',
    label: 'Write a reply for me to approve',
    description:
      'Alfred prepares a private draft in the conversation room and waits for your one-click approval before texting the homeowner.',
    defaultHandoff: 'Draft',
  },
  {
    id: 'human_only',
    label: 'Let me reply',
    description:
      'New inquiries log photos and job summaries silently without automated replies until you respond.',
    defaultHandoff: 'Human',
  },
]

export function PlatformProvider({ children }) {
  const [tenants, setTenants] = useState(contractorsData.tenants)
  const [activeTenantId, setActiveTenantId] = useState(contractorsData.tenants[0].id)
  const [activePlanId, setActivePlanId] = useState('rent-to-own')
  const [activeView, setActiveView] = useState('client') // 'client' | 'backoffice' | 'workflows'
  const [threads, setThreads] = useState(INITIAL_THREADS)
  const threadsRef = useRef(INITIAL_THREADS)
  const [selectedThreadId, setSelectedThreadId] = useState(INITIAL_THREADS[0].id)
  const [toastNotification, setToastNotification] = useState(null)

  useEffect(() => {
    threadsRef.current = threads
  }, [threads])

  const activeTenant = tenants.find((t) => t.id === activeTenantId) || tenants[0]

  // Dual-Mode Cal.com v2 Calendar State (Tenant-Scoped)
  const [calcomConfigByTenant, setCalcomConfigByTenant] = useState(() => {
    const map = {}
    contractorsData.tenants.forEach((t) => {
      map[t.id] = getSavedCalcomConfig(t)
    })
    return map
  })

  const calcomConfig =
    calcomConfigByTenant[activeTenant.id] || getSavedCalcomConfig(activeTenant)

  const [availableSlots, setAvailableSlots] = useState(() =>
    buildDefaultCalendarSlots()
  )
  const [calcomStatus, setCalcomStatus] = useState({
    liveApiActive: false,
    emptyLiveAvailability: false,
    sourceLabel: 'Cal.com Schedule Ready',
    loading: false,
  })
  const [calcomEmbedOpen, setCalcomEmbedOpen] = useState(false)

  // Tenant Knowledge Base Custom Entries (Owner-editable per tenant)
  const [customKbByTenant, setCustomKbByTenant] = useState({
    'all-solutions-diesel': [
      {
        id: 'kb-custom-synchrony-financing',
        category: 'Warranty & Credentials',
        title: 'Synchrony Car Care Credit Financing & Appointment Policy',
        content:
          'All Solutions Diesel and Auto Repair (113 Remington Road, Spring Branch, TX · 830-388-1458) offers Car Care Credit financing by Synchrony (https://www.mysynchrony.com/mmc/NT237455907) with convenient monthly payments. Services are by appointment only, Mon–Fri 9:00 AM – 5:00 PM.',
      },
    ],
    'scg-roofing': [
      {
        id: 'kb-custom-nh-ice',
        category: 'Owner Rule',
        title: 'Southern NH Ice Dam & Emergency Tarping Policy',
        content:
          'For active interior ceiling drips in Hooksett, Manchester, or Dover, SCG Roofing offers same-day emergency tarping ($350 credited toward your permanent flashing or roof repair).',
      },
    ],
  })

  // Lead Capture Account Routing ('tiberius' = My Accounts first | 'client' = Client Account later)
  const [leadRoutingMode, setLeadRoutingModeState] = useState(
    activeTenant.leadRouting?.activeMode || 'tiberius'
  )

  const activeLeadRoute =
    activeTenant.leadRouting?.[leadRoutingMode] ||
    activeTenant.leadRouting?.tiberius || {
      mode: leadRoutingMode,
      badgeLabel:
        leadRoutingMode === 'client'
          ? `Lead Routing: ${activeTenant.companyName} Account`
          : 'Lead Routing: My Accounts (Tiberius)',
      accountOwner:
        leadRoutingMode === 'client'
          ? activeTenant.companyName
          : 'Michael · Tiberius Smart Sites',
      calcomHandle:
        leadRoutingMode === 'client' ? 'all-solutions-repairs' : 'tiberius',
      calcomEventSlug:
        leadRoutingMode === 'client' ? 'service-appointment' : 'contractor',
      bookingUrl:
        leadRoutingMode === 'client'
          ? 'https://cal.com/all-solutions-repairs/service-appointment'
          : 'https://cal.com/tiberius/contractor',
      destinationEmail:
        leadRoutingMode === 'client'
          ? activeTenant.emailDisplay || 'info@allsolutionsrepairs.com'
          : 'michael@tiberiussmartsites.com',
      destinationInbox:
        leadRoutingMode === 'client'
          ? `${activeTenant.companyName} Direct Dispatch`
          : 'Tiberius Master Conversation Room (My Accounts)',
      disclosureNote:
        leadRoutingMode === 'client'
          ? `All AI lead capture elements route directly to ${activeTenant.companyName} (${activeTenant.emailDisplay} · ${activeTenant.phoneDisplay}).`
          : "All AI lead capture elements currently route to Michael's Tiberius accounts first and can be switched to the client's account in one click.",
    }

  const setLeadRoutingMode = (nextMode) => {
    const resolved = nextMode === 'client' ? 'client' : 'tiberius'
    setLeadRoutingModeState(resolved)
    const targetRoute = activeTenant.leadRouting?.[resolved]
    if (targetRoute) {
      updateCalcomConfig({
        handle: targetRoute.calcomHandle,
        eventSlug: targetRoute.calcomEventSlug,
      })
    }
    showToast({
      title:
        resolved === 'tiberius'
          ? 'Lead Capture Routed to My Accounts (Tiberius)'
          : `Lead Capture Moved to ${activeTenant.companyName} Account`,
      message:
        resolved === 'tiberius'
          ? 'All AI Dock, Chat, Quote Wizard & Calendar leads now route to Michael’s Tiberius accounts.'
          : `All AI lead capture elements now route to ${activeTenant.emailDisplay} (${activeTenant.phoneDisplay}).`,
      type: 'success',
    })
  }

  // Tiberius "Make Alfred Your Own" Setup & AI Budget Telemetry (from owner-setup.mjs & owner.mjs)
  const [alfredSetup, setAlfredSetup] = useState({
    preset: 'book_first',
    spentMicros: 4120000, // $4.12
    reservedMicros: 380000, // $0.38
    limitMicros: 25000000, // $25.00
  })

  // Tiberius Multi-Mode Helper & 3-Step Quote Modal State (from widget.mjs)
  const [helperModal, setHelperModal] = useState({
    open: false,
    mode: 'chat', // 'chat' | 'quote' | 'booking' | 'text'
    preselectedService: '',
  })

  // Tiberius Conversation Photo Lightbox State (from conversation-photos.mjs)
  const [lightboxPhoto, setLightboxPhoto] = useState(null)

  const activePlan =
    contractorsData.platformPlans.find((p) => p.id === activePlanId) ||
    contractorsData.platformPlans[1]

  const selectedThread =
    threads.find((t) => t.id === selectedThreadId) || threads[0]

  const customKbEntries = customKbByTenant[activeTenant.id] || []
  const knowledgeBaseArticles = buildTenantKnowledgeBase(
    activeTenant,
    customKbEntries
  )

  const showToast = (toast) => {
    setToastNotification({ id: Date.now(), ...toast })
  }

  const refreshCalcomSlots = async (overrideConfig = calcomConfig) => {
    setCalcomStatus((prev) => ({ ...prev, loading: true }))
    const res = await fetchCalcomAvailableSlots(overrideConfig)
    setAvailableSlots(res.slots)
    setCalcomStatus({
      liveApiActive: res.liveApiActive,
      emptyLiveAvailability: Boolean(res.emptyLiveAvailability),
      sourceLabel: res.sourceLabel,
      apiError: res.apiError || null,
      loading: false,
    })
    return res
  }

  useEffect(() => {
    let cancelled = false
    const tenantConfig =
      calcomConfigByTenant[activeTenant.id] || getSavedCalcomConfig(activeTenant)
    fetchCalcomAvailableSlots(tenantConfig).then((res) => {
      if (cancelled) return
      setAvailableSlots(res.slots)
      setCalcomStatus({
        liveApiActive: res.liveApiActive,
        emptyLiveAvailability: Boolean(res.emptyLiveAvailability),
        sourceLabel: res.sourceLabel,
        apiError: res.apiError || null,
        loading: false,
      })
    })
    return () => {
      cancelled = true
    }
  }, [activeTenant, activeTenantId, calcomConfigByTenant])

  const updateCalcomConfig = async (nextPartial) => {
    const currentTenantConfig =
      calcomConfigByTenant[activeTenant.id] || getSavedCalcomConfig(activeTenant)
    const merged = saveCalcomConfig(
      { ...currentTenantConfig, ...nextPartial, tenantId: activeTenant.id },
      activeTenant.id
    )
    setCalcomConfigByTenant((prev) => ({
      ...prev,
      [activeTenant.id]: merged,
    }))
    const res = await refreshCalcomSlots(merged)
    showToast({
      title: res.liveApiActive
        ? 'Cal.com API v2 Connected!'
        : 'Cal.com Calendar Updated',
      message: res.sourceLabel,
      type: res.apiError ? 'warning' : 'success',
    })
  }

  const addCustomKnowledgeArticle = ({ category = 'Owner Rule', title, content }) => {
    if (!title?.trim() || !content?.trim()) return
    const newArt = {
      id: `kb-custom-${Date.now()}`,
      category,
      title: title.trim(),
      content: content.trim(),
      isCustom: true,
    }
    setCustomKbByTenant((prev) => ({
      ...prev,
      [activeTenant.id]: [newArt, ...(prev[activeTenant.id] || [])],
    }))
    showToast({
      title: 'Knowledge Base Rule Added',
      message: `Alfred now grounds replies using "${newArt.title}".`,
      type: 'success',
    })
  }

  const deleteCustomKnowledgeArticle = (articleId) => {
    setCustomKbByTenant((prev) => ({
      ...prev,
      [activeTenant.id]: (prev[activeTenant.id] || []).filter(
        (a) => a.id !== articleId
      ),
    }))
  }

  const openHelperModal = (mode = 'chat', preselectedService = '') => {
    setHelperModal({
      open: true,
      mode,
      preselectedService:
        preselectedService || activeTenant.pricingRules.services[0]?.name || '',
    })
  }

  const closeHelperModal = () => {
    setHelperModal((prev) => ({ ...prev, open: false }))
  }

  const updateAlfredSetup = (newPresetId) => {
    const presetObj =
      ALFRED_PRESETS.find((p) => p.id === newPresetId) || ALFRED_PRESETS[0]
    setAlfredSetup((prev) => ({
      ...prev,
      preset: presetObj.id,
    }))
    showToast({
      title: 'Alfred Co-Pilot Behavior Updated',
      message: `New conversations will use "${presetObj.label}" (${presetObj.defaultHandoff} mode).`,
      type: 'success',
    })
  }

  const updateActiveTenantConfig = (updatedConfig) => {
    setTenants((prev) =>
      prev.map((t) => (t.id === activeTenant.id ? { ...t, ...updatedConfig } : t))
    )
    showToast({
      title: 'Multi-Tenant JSON Updated',
      message: `Live config applied for ${updatedConfig.companyName || activeTenant.companyName}.`,
      type: 'success',
    })
  }

  // Pillar 1 -> Pillar 2 Live Handshake from Embedded Contextual AI Dock or 3-Step Quote Modal
  const submitHeroLead = ({
    question,
    photo,
    photos = [],
    phone,
    customerName,
    email,
    zipCode,
    address,
    serviceName,
    urgency,
    propertyType = 'Heavy-Duty Diesel / Pickup',
    roofAge = '2018 Ford F-250 / Fleet Truck',
    preferredWindow = 'Flexible',
    sourceLabel = 'Hero AI Dock',
  }) => {
    const cleanPhone = phone?.trim() || activeTenant.phoneDisplay || '(830) 388-1458'
    const name = customerName?.trim() || 'Alex Mercer'
    const zip = zipCode?.trim() || (activeTenant.id === 'all-solutions-diesel' ? '78070' : '03106')
    const allInputPhotos =
      photos.length > 0 ? photos : photo ? [photo] : []
    const requestedService = (
      serviceName ||
      allInputPhotos[0]?.serviceMatch ||
      question ||
      ''
    )
      .toLowerCase()
      .trim()
    const matchedService =
      activeTenant.pricingRules.services.find((s) => s.name === serviceName) ||
      activeTenant.pricingRules.services.find((s) =>
        requestedService
          ? s.name.toLowerCase().includes(requestedService) ||
            requestedService.includes(s.name.toLowerCase()) ||
            s.name
              .toLowerCase()
              .split(/\s+/)
              .some(
                (word) =>
                  word.length > 3 &&
                  word !== 'roof' &&
                  requestedService.includes(word)
              )
          : false
      ) ||
      activeTenant.pricingRules.services[0]

    const resolvedPhotoUrl =
      allInputPhotos[0]?.url ||
      allInputPhotos[0]?.dataUrl ||
      createDamagePhotoSvg({
        title: `${activeTenant.niche.toUpperCase()} PRE-SCAN`,
        zone: `ZIP ${zip} // ${sourceLabel.toUpperCase()}`,
        confidence: '96.2%',
        accent: activeTenant.brandColor,
        finding1: matchedService.name.slice(0, 28),
        finding2: `Est: ${matchedService.range}`,
      })

    const visionAnalysis =
      allInputPhotos[0]?.visionSummary ||
      `Vision AI analyzed ${
        allInputPhotos.length || 1
      } photo(s) for ${activeTenant.companyName}: matched "${matchedService.name}" scope (${
        urgency || matchedService.urgency
      }). Estimated local range in ${activeTenant.city}: ${matchedService.range}.`

    const newThreadId = `thread-lead-${Date.now()}`
    const timestamp = formatNowTime()

    const presetObj =
      ALFRED_PRESETS.find((p) => p.id === alfredSetup.preset) || ALFRED_PRESETS[0]
    const initialHandoff = presetObj.defaultHandoff // 'AI' | 'Draft' | 'Human'
    const isAutopilot = initialHandoff !== 'Human'

    const userPrompt =
      question?.trim() ||
      `Hi, I submitted a ${matchedService.name.toLowerCase()} inquiry for ZIP ${zip} (${propertyType}, roof age: ${roofAge}). What's the ballpark cost and earliest availability?`

    const aiReplyText = `Hi ${name.split(' ')[0]}! This is Alfred, the ${
      activeTenant.companyName
    } AI Assistant in ${activeTenant.city}. I just received your ${sourceLabel} request${
      allInputPhotos.length > 0 ? ' and ran a Vision AI pre-scan on your photo(s)' : ''
    }. Based on our ${activeTenant.city} pricing rules for ${
      matchedService.name
    }, our transparent ballpark range is ${matchedService.range}${
      activeTenant.pricingRules.freeInspection
        ? ' (includes a $0 on-site structural inspection)'
        : ` ($${activeTenant.pricingRules.baseDiagnostic} diagnostic waived with repair)`
    }. Can we lock in a ${preferredWindow.toLowerCase()} inspection window for you?`

    const builtPhotos =
      allInputPhotos.length > 0
        ? allInputPhotos.map((p, idx) => ({
            id: `photo-${Date.now()}-${idx}`,
            caption: p.label || p.name || `Customer Upload #${idx + 1}`,
            url: p.url || p.dataUrl || resolvedPhotoUrl,
            visionTag: `Vision Pre-Scan: ${matchedService.range}`,
          }))
        : [
            {
              id: `photo-${Date.now()}`,
              caption: `${sourceLabel} Diagnostic Frame`,
              url: resolvedPhotoUrl,
              visionTag: `Vision Pre-Scan: ${matchedService.range}`,
            },
          ]

    const initialMessages = [
      {
        id: `msg-${Date.now()}-1`,
        sender: 'customer',
        channel: 'Webchat',
        timestamp,
        text: userPrompt,
        photoUrl: resolvedPhotoUrl,
        photoCaption: `${sourceLabel} • ${matchedService.name} (${builtPhotos.length} photo${
          builtPhotos.length === 1 ? '' : 's'
        })`,
      },
      {
        id: `msg-${Date.now()}-2`,
        sender: 'system',
        channel: 'SMS',
        timestamp,
        eventType: 'handshake',
        text: `⚡ Instant SMS Handshake triggered to ${cleanPhone} • Routed to: ${activeLeadRoute.accountOwner} (${activeLeadRoute.destinationEmail}) • Mode: ${initialHandoff}`,
      },
    ]

    const leadCitations = [
      {
        id: 'kb-pricing-matrix',
        category: 'Pricing & Diagnostics',
        title: `${matchedService.name} (${matchedService.range})`,
      },
      {
        id: 'kb-territory-zips',
        category: 'Service Territory',
        title: `Verified Territory (${zip})`,
      },
    ]

    if (initialHandoff === 'AI') {
      initialMessages.push({
        id: `msg-${Date.now()}-3`,
        sender: 'ai',
        channel: 'SMS',
        timestamp,
        text: aiReplyText,
        kbCitations: leadCitations,
      })
    }

    const newThread = {
      id: newThreadId,
      contactName: name,
      phone: cleanPhone,
      email:
        email?.trim() ||
        `${name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@homeowner.io`,
      address: address?.trim()
        ? `${address.trim()}, ${zip} (${activeTenant.city})`
        : `Verified Territory (${zip}), ${activeTenant.city}`,
      zipVerified: true,
      propertyType,
      roofAge,
      preferredWindow,
      unread: true,
      unreadCount: 1,
      lastActivity: 'Just now',
      channels: ['Webchat', 'SMS'],
      primaryChannel: 'SMS',
      aiStatus: 'ready_for_quote',
      opportunityStage: 'quote_sent',
      aiAutopilot: isAutopilot,
      handoffMode: initialHandoff,
      alfredDraft:
        initialHandoff === 'Draft'
          ? {
              id: `draft-${Date.now()}`,
              createdAt: timestamp,
              reason: `Alfred prepared a reply for ${name}'s ${matchedService.name} inquiry.`,
              text: aiReplyText,
              citations: leadCitations,
            }
          : null,
      jobSummary: {
        serviceNeeded: matchedService.name,
        urgency: urgency || matchedService.urgency,
        estimatedValue: matchedService.avgValue,
        estimatedRange: matchedService.range,
        visionSummary: visionAnalysis,
        bookedSlot: null,
        lastKbCitations: leadCitations,
        reviewStage: 'none',
        photos: builtPhotos,
      },
      messages: initialMessages,
    }

    setThreads((prev) => {
      const next = [newThread, ...prev]
      threadsRef.current = next
      return next
    })
    setSelectedThreadId(newThreadId)
    setAlfredSetup((prev) => ({
      ...prev,
      spentMicros: prev.spentMicros + 45000,
    }))

    showToast({
      title: `AI Lead Captured → ${leadRoutingMode === 'tiberius' ? 'My Accounts (Tiberius)' : activeTenant.companyName}`,
      message: `Saved ${name} (${cleanPhone}) to ${activeLeadRoute.destinationInbox} with Vision AI pre-scan.`,
      actionLabel: 'Open in 3-Pane Back-Office →',
      onAction: () => setActiveView('backoffice'),
      type: 'success',
    })

    return newThreadId
  }

  // Toggle AI Autopilot explicitly (supports boolean or 3-mode Tiberius handoff)
  const toggleAutopilot = (threadId, nextState) => {
    const timestamp = formatNowTime()
    setThreads((prev) => {
      const next = prev.map((thread) => {
        if (thread.id !== threadId) return thread
        const resolved =
          typeof nextState === 'boolean' ? nextState : !thread.aiAutopilot
        const nextMode = resolved ? 'AI' : 'Human'
        const sysMsg = {
          id: `sys-${Date.now()}`,
          sender: 'system',
          channel: thread.primaryChannel || 'SMS',
          timestamp,
          eventType: resolved ? 'autopilot_on' : 'autopilot_off',
          text: resolved
            ? '🤖 AI Autopilot (Alfred Replies) switched ON — qualifying & quoting using contractor rules.'
            : '✋ Human Takeover activated — AI Autopilot switched OFF.',
        }
        return {
          ...thread,
          aiAutopilot: resolved,
          handoffMode: nextMode,
          messages: [...thread.messages, sysMsg],
        }
      })
      threadsRef.current = next
      return next
    })
  }

  // Set explicit Tiberius 3-Mode Handoff ('AI' | 'Draft' | 'Human')
  const setThreadHandoffMode = (threadId, mode) => {
    const timestamp = formatNowTime()
    setThreads((prev) => {
      const next = prev.map((thread) => {
        if (thread.id !== threadId) return thread
        const isAutopilot = mode !== 'Human'
        const modeLabels = {
          AI: '🤖 AI Autopilot ("Alfred replies" automatically)',
          Draft: '📝 AI Draft Mode ("Alfred drafts" privately for approval)',
          Human: '✋ Human Takeover ("I’ll handle it" — AI paused)',
        }

        const existingDraft =
          mode === 'Draft' && !thread.alfredDraft
            ? {
                id: `draft-${Date.now()}`,
                createdAt: timestamp,
                reason: `Generated private draft for ${thread.jobSummary.serviceNeeded} (${thread.jobSummary.estimatedRange}).`,
                text: `Hi ${
                  thread.contactName.split(' ')[0]
                }! Based on our ${activeTenant.city} pricing for ${
                  thread.jobSummary.serviceNeeded
                }, our transparent ballpark is ${
                  thread.jobSummary.estimatedRange
                }. Would you like our estimator to stop by today at 2:30 PM or tomorrow at 9:00 AM?`,
              }
            : thread.alfredDraft

        return {
          ...thread,
          aiAutopilot: isAutopilot,
          handoffMode: mode,
          alfredDraft: existingDraft,
          messages: [
            ...thread.messages,
            {
              id: `sys-mode-${Date.now()}`,
              sender: 'system',
              channel: thread.primaryChannel || 'SMS',
              timestamp,
              eventType: isAutopilot ? 'autopilot_on' : 'autopilot_off',
              text: `Switched conversation mode to ${modeLabels[mode] || mode}`,
            },
          ],
        }
      })
      threadsRef.current = next
      return next
    })
  }

  // Approve & Send or Dismiss Alfred Private Draft (from Tiberius owner.mjs)
  const approveAlfredDraft = async (threadId, customText) => {
    const targetThread = threadsRef.current.find((t) => t.id === threadId)
    if (!targetThread || !targetThread.alfredDraft) return
    const rawText =
      customText !== undefined ? customText : targetThread.alfredDraft.text
    const finalMsg = String(rawText ?? '').trim()
    if (!finalMsg) return

    const draftObj = targetThread.alfredDraft
    let calBooking = null
    if (draftObj.pendingSlot) {
      calBooking = await createCalcomBooking({
        calConfig: calcomConfig,
        slot: draftObj.pendingSlot,
        attendee: {
          name: targetThread.contactName,
          email: targetThread.email,
          phone: targetThread.phone,
          address: targetThread.address,
        },
        serviceName: targetThread.jobSummary.serviceNeeded,
        companyName: activeTenant.companyName,
      })
    }

    const bookingSucceeded = Boolean(calBooking && calBooking.ok)
    const bookingRef =
      calBooking?.bookingUid || calBooking?.holdReference || 'PENDING'
    const timestamp = formatNowTime()

    setThreads((prev) => {
      const next = prev.map((thread) => {
        if (thread.id !== threadId || !thread.alfredDraft) return thread
        const extraEvents = calBooking
          ? [
              {
                id: `sys-cal-draft-${Date.now() + 2}`,
                sender: 'system',
                channel: thread.primaryChannel || 'SMS',
                timestamp,
                eventType: bookingSucceeded ? 'booking' : 'escalation',
                text: bookingSucceeded
                  ? `📅 ${calBooking.mode} (${
                      calBooking.apiVerified ? `UID: ${bookingRef}` : `Hold: ${bookingRef}`
                    }): ${calBooking.slotLabel}`
                  : `⚠️ Calendar booking failed (${calBooking.error}). Sent reply without confirming calendar slot.`,
              },
            ]
          : []
        return {
          ...thread,
          alfredDraft: null,
          opportunityStage: bookingSucceeded
            ? 'appointment_booked'
            : thread.opportunityStage || 'quote_sent',
          lastActivity: 'Just now',
          jobSummary: bookingSucceeded
            ? {
                ...thread.jobSummary,
                bookedSlot: calBooking.slotLabel,
                calcomBooking: calBooking,
              }
            : thread.jobSummary,
          messages: [
            ...thread.messages,
            {
              id: `sys-draft-ok-${Date.now()}`,
              sender: 'system',
              channel: thread.primaryChannel || 'SMS',
              timestamp,
              eventType: 'autopilot_on',
              text: '✅ Owner approved & dispatched Alfred’s private draft',
            },
            ...extraEvents,
            {
              id: `ai-approved-${Date.now() + 1}`,
              sender: 'ai',
              channel: thread.primaryChannel || 'SMS',
              timestamp,
              text: finalMsg,
              kbCitations: draftObj.citations || [],
            },
          ],
        }
      })
      threadsRef.current = next
      return next
    })
    showToast({
      title: bookingSucceeded
        ? `Draft Sent & ${calBooking.mode}`
        : calBooking && !calBooking.ok
          ? 'Draft Sent (Calendar Booking Failed)'
          : 'Alfred Draft Approved & Sent',
      message: bookingSucceeded
        ? `${calBooking.slotLabel} (${bookingRef}).`
        : calBooking?.error || 'Dispatched approved reply to homeowner timeline.',
      type: calBooking && !calBooking.ok ? 'warning' : 'success',
    })
  }

  const dismissAlfredDraft = (threadId) => {
    setThreads((prev) => {
      const next = prev.map((thread) =>
        thread.id === threadId ? { ...thread, alfredDraft: null } : thread
      )
      threadsRef.current = next
      return next
    })
  }

  // CRITICAL FEATURE (Blueprint + Tiberius owner.mjs):
  // Human sending a message automatically flips AI Autopilot to OFF & handoffMode to 'Human'
  const sendHumanMessage = (threadId, text, channel = 'SMS') => {
    if (!text?.trim()) return
    const timestamp = formatNowTime()

    setThreads((prev) => {
      const next = prev.map((thread) => {
        if (thread.id !== threadId) return thread
        const wasAutopilotOn =
          thread.aiAutopilot || thread.handoffMode !== 'Human'
        const newMessages = [...thread.messages]

        if (wasAutopilotOn) {
          newMessages.push({
            id: `sys-auto-off-${Date.now()}`,
            sender: 'system',
            channel,
            timestamp,
            eventType: 'autopilot_off',
            text: '✋ Human operator sent a reply — AI Autopilot automatically flipped to OFF ("I’ll handle it") so AI and humans never talk over each other.',
          })
        }

        newMessages.push({
          id: `human-${Date.now()}`,
          sender: 'human',
          channel,
          timestamp,
          text: text.trim(),
        })

        return {
          ...thread,
          aiAutopilot: false,
          handoffMode: 'Human',
          unread: false,
          unreadCount: 0,
          lastActivity: 'Just now',
          messages: newMessages,
        }
      })
      threadsRef.current = next
      return next
    })
  }

  // Update AI Status Pill ('qualifying' | 'ready_for_quote' | 'needs_human')
  const updateThreadStatus = (threadId, newStatus) => {
    setThreads((prev) => {
      const next = prev.map((thread) =>
        thread.id === threadId ? { ...thread, aiStatus: newStatus } : thread
      )
      threadsRef.current = next
      return next
    })
  }

  // Update GHL Opportunity Pipeline Stage ('new_lead' | 'qualifying' | 'quote_sent' | 'appointment_booked' | 'job_won')
  const updateOpportunityStage = (threadId, nextStage) => {
    setThreads((prev) => {
      const next = prev.map((thread) =>
        thread.id === threadId
          ? { ...thread, opportunityStage: nextStage }
          : thread
      )
      threadsRef.current = next
      return next
    })
  }

  // Co-Pilot Whisper: Drafts a context-aware reply grounded in Knowledge Base & live Cal.com slots
  const generateCoPilotSuggestion = (threadId) => {
    const thread =
      threadsRef.current.find((t) => t.id === threadId) || selectedThread
    const lastCustomerMsg = [...(thread?.messages || [])]
      .reverse()
      .find((m) => m.sender === 'customer')

    if (lastCustomerMsg?.text) {
      const kbResult = queryKnowledgeBase({
        query: lastCustomerMsg.text,
        tenant: activeTenant,
        thread,
        availableSlots,
        customEntries: customKbEntries,
      })
      return kbResult.replyText.replace(/\*\*/g, '')
    }

    const firstName = thread.contactName.split(' ')[0]
    const service = thread.jobSummary.serviceNeeded
    const range = thread.jobSummary.estimatedRange
    const slot1 = availableSlots[0]?.shortLabel || 'Today at 2:30 PM'
    const slot2 = availableSlots[1]?.shortLabel || 'Tomorrow at 9:00 AM'

    if (thread.aiStatus === 'needs_human') {
      return `Hi ${firstName}, this is the Senior Project Estimator at ${activeTenant.companyName}. I reviewed your photo and notes for ${service}. I can personally meet on-site ${slot2} to inspect the structure—shall I lock you onto our Cal.com calendar?`
    }
    return `Hi ${firstName}! Locking in your ${range} estimate range for ${service} here in ${activeTenant.city}. Our Cal.com calendar has ${slot1} (Reply 1) or ${slot2} (Reply 2) open—which works best for you?`
  }

  // Field Voice-Note-to-Polished-SMS converter
  const polishFieldVoiceNote = (rawVoiceTranscript, threadId) => {
    const thread =
      threadsRef.current.find((t) => t.id === threadId) || selectedThread
    const firstName = thread.contactName.split(' ')[0]
    const cleanRaw =
      rawVoiceTranscript?.trim() ||
      'tell him we looked at the flashing gap by the brick, we can seal and re-lead it tomorrow at 2pm for 580 bucks'

    return `Hi ${firstName}, our lead technician just reviewed your ${thread.jobSummary.serviceNeeded.toLowerCase()} details ("${cleanRaw}"). We can complete the full repair and waterproof seal tomorrow at 2:00 PM for $580 flat, backed by our ${activeTenant.companyName} workmanship warranty. Would you like me to lock in that 2:00 PM arrival window on our Cal.com calendar?`
  }

  // Dual-Mode Cal.com v2 Calendar Booking in Right Pane (or Public Modal / AI Autonomous Booking)
  const bookInspectionSlot = async (
    threadId,
    slotOrLabel = availableSlots[0] || 'Today, 2:30 PM – 4:00 PM',
    attendeeOverride = null
  ) => {
    const resolvedThreadId = threadId || selectedThreadId
    // Never fall back to selectedThread if an explicit threadId was passed
    const targetThread = threadId
      ? threadsRef.current.find((t) => t.id === threadId)
      : selectedThread

    if (!targetThread && !attendeeOverride) return null

    const resolvedSlotObj =
      typeof slotOrLabel === 'string'
        ? availableSlots.find((s) => s.label === slotOrLabel) || {
            label: slotOrLabel,
            shortLabel: slotOrLabel,
            startIso: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            endIso: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
          }
        : slotOrLabel

    const attendee = {
      name:
        attendeeOverride?.name || targetThread?.contactName || 'Homeowner',
      email:
        attendeeOverride?.email ||
        targetThread?.email ||
        'homeowner@example.com',
      phone: attendeeOverride?.phone || targetThread?.phone || '',
      address:
        attendeeOverride?.address ||
        targetThread?.address ||
        activeTenant.city,
    }
    const serviceName =
      attendeeOverride?.serviceNeeded ||
      targetThread?.jobSummary?.serviceNeeded ||
      activeTenant.pricingRules.services[0]?.name ||
      'Inspection'

    const calBooking = await createCalcomBooking({
      calConfig: calcomConfig,
      slot: resolvedSlotObj,
      attendee,
      serviceName,
      companyName: activeTenant.companyName,
    })

    const timestamp = formatNowTime()

    if (!calBooking.ok) {
      setThreads((prev) => {
        const next = prev.map((thread) => {
          if (thread.id !== resolvedThreadId) return thread
          return {
            ...thread,
            lastActivity: 'Just now',
            messages: [
              ...thread.messages,
              {
                id: `book-err-${Date.now()}`,
                sender: 'system',
                channel: 'SMS',
                timestamp,
                eventType: 'escalation',
                text: `⚠️ Cal.com v2 Booking Error: ${calBooking.error} — Slot was NOT confirmed. Direct booking link: ${calBooking.calUrl}`,
              },
            ],
          }
        })
        threadsRef.current = next
        return next
      })
      showToast({
        title: '⚠️ Cal.com Booking Failed',
        message: calBooking.error || 'Could not verify booking with Cal.com v2.',
        type: 'warning',
      })
      return calBooking
    }

    const refId =
      calBooking.bookingUid || calBooking.holdReference || 'SCHEDULED'

    setThreads((prev) => {
      const next = prev.map((thread) => {
        if (thread.id !== resolvedThreadId) return thread
        const firstName = (attendee.name || thread.contactName).split(' ')[0]
        return {
          ...thread,
          aiStatus: 'ready_for_quote',
          opportunityStage: 'appointment_booked',
          lastActivity: 'Just now',
          jobSummary: {
            ...thread.jobSummary,
            bookedSlot: calBooking.slotLabel,
            calcomBooking: calBooking,
          },
          messages: [
            ...thread.messages,
            {
              id: `book-sys-${Date.now()}`,
              sender: 'system',
              channel: 'SMS',
              timestamp,
              eventType: 'booking',
              text: calBooking.apiVerified
                ? `📅 Cal.com API v2 Verified Booking (UID: ${refId}): ${calBooking.slotLabel}`
                : `📅 Crew Dispatch Hold Reserved (${calBooking.mode} • Ref: ${refId}): ${calBooking.slotLabel}`,
            },
            {
              id: `book-sms-${Date.now() + 1}`,
              sender: 'ai',
              channel: 'SMS',
              timestamp,
              text: calBooking.apiVerified
                ? `Confirmed on our live Cal.com calendar, ${firstName}! You are booked with ${activeTenant.companyName} for ${calBooking.slotLabel} at ${attendee.address}. Booking UID: ${refId}`
                : `Reserved on our ${activeTenant.companyName} dispatch schedule for ${calBooking.slotLabel}, ${firstName}! You can also finalize or manage your calendar invite on Cal.com here: ${calBooking.calUrl}`,
              kbCitations: [
                {
                  id: 'kb-calendar-sop',
                  category: 'Cal.com Scheduling',
                  title: `${calBooking.apiVerified ? 'Verified UID' : 'Hold Ref'}: ${refId}`,
                },
              ],
            },
          ],
        }
      })
      threadsRef.current = next
      return next
    })

    showToast({
      title: calBooking.apiVerified
        ? '📅 Cal.com v2 Booking Verified!'
        : `📅 Reserved on ${calBooking.mode}`,
      message: `${calBooking.slotLabel} • ${refId}`,
      type: 'success',
    })
    return calBooking
  }

  // Sync a booking completed inside the live Cal.com Embed iframe (via postMessage or operator sync)
  const confirmEmbedBooking = (
    threadId = selectedThreadId,
    embedPayload = {}
  ) => {
    const timestamp = formatNowTime()
    const cleanHandle = (calcomConfig?.handle || 'tiberius')
      .replace(/^@/, '')
      .trim()
    const cleanSlug = (calcomConfig?.eventSlug || 'contractor')
      .replace(/^\//, '')
      .trim()
    const slotLabel =
      embedPayload.slotLabel ||
      availableSlots[0]?.label ||
      'Cal.com Embed Appointment'
    const bookingUid =
      embedPayload.bookingUid || `cal-embed-${Date.now().toString(36)}`
    const calBooking = {
      ok: true,
      mode: 'Cal.com Live Embed',
      reservationType: 'calcom_embed',
      bookingUid,
      slotLabel,
      startIso: embedPayload.startIso || new Date().toISOString(),
      calUrl: `https://cal.com/${cleanHandle}/${cleanSlug}`,
      apiVerified: Boolean(embedPayload.verifiedEvent),
    }

    setThreads((prev) => {
      const next = prev.map((thread) => {
        if (thread.id !== threadId) return thread
        return {
          ...thread,
          aiStatus: 'ready_for_quote',
          opportunityStage: 'appointment_booked',
          lastActivity: 'Just now',
          jobSummary: {
            ...thread.jobSummary,
            bookedSlot: slotLabel,
            calcomBooking: calBooking,
          },
          messages: [
            ...thread.messages,
            {
              id: `embed-book-${Date.now()}`,
              sender: 'system',
              channel: 'SMS',
              timestamp,
              eventType: 'booking',
              text: `📅 Cal.com Embed Booking Synced (${slotLabel} • Ref: ${bookingUid})`,
            },
          ],
        }
      })
      threadsRef.current = next
      return next
    })

    setCalcomEmbedOpen(false)
    showToast({
      title: '📅 Cal.com Embed Booking Synced!',
      message: `${slotLabel} recorded on conversation timeline.`,
      type: 'success',
    })
  }

  const cancelOrRescheduleBooking = async (threadId = selectedThreadId) => {
    const targetThread = threadsRef.current.find((t) => t.id === threadId)
    if (!targetThread) return

    const existingBooking = targetThread.jobSummary?.calcomBooking
    const cancelRes = await cancelCalcomBooking(existingBooking)
    const timestamp = formatNowTime()

    if (!cancelRes.ok) {
      setThreads((prev) => {
        const next = prev.map((thread) => {
          if (thread.id !== threadId) return thread
          return {
            ...thread,
            messages: [
              ...thread.messages,
              {
                id: `book-cancel-err-${Date.now()}`,
                sender: 'system',
                channel: 'SMS',
                timestamp,
                eventType: 'escalation',
                text: `⚠️ Could not cancel live Cal.com booking (${cancelRes.error}). Existing appointment remains active.`,
              },
            ],
          }
        })
        threadsRef.current = next
        return next
      })
      showToast({
        title: '⚠️ Cal.com Cancellation Failed',
        message: cancelRes.error,
        type: 'warning',
      })
      return
    }

    setThreads((prev) => {
      const next = prev.map((thread) => {
        if (thread.id !== threadId) return thread
        return {
          ...thread,
          opportunityStage: 'quote_sent',
          lastActivity: 'Just now',
          jobSummary: {
            ...thread.jobSummary,
            bookedSlot: null,
            calcomBooking: null,
          },
          messages: [
            ...thread.messages,
            {
              id: `book-reset-${Date.now()}`,
              sender: 'system',
              channel: 'SMS',
              timestamp,
              eventType: 'info',
              text: cancelRes.cancelledRemote
                ? `🔄 Cancelled live Cal.com v2 booking (${existingBooking?.bookingUid}) and reopened thread for rescheduling.`
                : '🔄 Released crew dispatch hold and reopened thread for rescheduling.',
            },
          ],
        }
      })
      threadsRef.current = next
      return next
    })
    showToast({
      title: cancelRes.cancelledRemote
        ? 'Cal.com v2 Booking Cancelled'
        : 'Calendar Slot Reopened',
      message: 'Ready to select a new time slot or test AI booking.',
      type: 'info',
    })
  }

  // Live Inbound Homeowner Message Simulator (Tests Knowledge Base RAG + Autonomous Cal.com Booking in GHL Room)
  const simulateCustomerInboundMessage = async (
    threadId = selectedThreadId,
    customerText = '',
    channel = 'SMS'
  ) => {
    const cleanText = customerText?.trim()
    if (!cleanText) return
    const targetThread =
      threadsRef.current.find((t) => t.id === threadId) || selectedThread
    if (!targetThread) return

    const timestamp = formatNowTime()
    const kbResult = queryKnowledgeBase({
      query: cleanText,
      tenant: activeTenant,
      thread: targetThread,
      availableSlots,
      customEntries: customKbEntries,
    })

    const initialMode =
      targetThread.handoffMode || (targetThread.aiAutopilot ? 'AI' : 'Human')

    let calBooking = null
    if (
      initialMode === 'AI' &&
      kbResult.bookingIntent.wantsToBook &&
      kbResult.bookingIntent.matchedSlot
    ) {
      calBooking = await createCalcomBooking({
        calConfig: calcomConfig,
        slot: kbResult.bookingIntent.matchedSlot,
        attendee: {
          name: targetThread.contactName,
          email: targetThread.email,
          phone: targetThread.phone,
          address: targetThread.address,
        },
        serviceName:
          kbResult.matchedService?.name || targetThread.jobSummary.serviceNeeded,
        companyName: activeTenant.companyName,
      })
    }

    // Re-check live thread handoff mode after async await to prevent Human Takeover race condition!
    const liveThreadAfterAwait =
      threadsRef.current.find((t) => t.id === threadId) || targetThread
    const liveMode =
      liveThreadAfterAwait.handoffMode ||
      (liveThreadAfterAwait.aiAutopilot ? 'AI' : 'Human')

    if (liveMode !== 'AI' && calBooking?.ok && calBooking?.apiVerified) {
      await cancelCalcomBooking(calBooking)
      calBooking = null
    }

    const bookingSucceeded = Boolean(
      liveMode === 'AI' && calBooking && calBooking.ok
    )
    const bookingRef =
      calBooking?.bookingUid || calBooking?.holdReference || 'HOLD'

    setThreads((prev) => {
      const next = prev.map((thread) => {
        if (thread.id !== threadId) return thread

        const currentMode =
          thread.handoffMode || (thread.aiAutopilot ? 'AI' : 'Human')

        const customerMsg = {
          id: `cust-sim-${Date.now()}`,
          sender: 'customer',
          channel,
          timestamp,
          text: cleanText,
        }

        const updatedJobSummary = {
          ...thread.jobSummary,
          serviceNeeded:
            kbResult.matchedService?.name || thread.jobSummary.serviceNeeded,
          estimatedValue:
            kbResult.matchedService?.avgValue ||
            thread.jobSummary.estimatedValue,
          estimatedRange:
            kbResult.matchedService?.range || thread.jobSummary.estimatedRange,
          lastKbCitations: kbResult.citations,
          ...(bookingSucceeded && currentMode === 'AI'
            ? {
                bookedSlot: calBooking.slotLabel,
                calcomBooking: calBooking,
              }
            : {}),
        }

        if (currentMode === 'AI') {
          const newMessages = [...thread.messages, customerMsg]
          let aiReply = kbResult.replyText.replace(/\*\*/g, '')

          if (bookingSucceeded) {
            newMessages.push({
              id: `sys-ai-cal-${Date.now() + 1}`,
              sender: 'system',
              channel,
              timestamp,
              eventType: 'booking',
              text: calBooking.apiVerified
                ? `📅 Alfred AI Cal.com v2 Verified Booking (UID: ${bookingRef}): ${calBooking.slotLabel}`
                : `📅 Alfred AI Reserved Crew Dispatch Hold (${calBooking.mode} • Ref: ${bookingRef}): ${calBooking.slotLabel}`,
            })
            aiReply = calBooking.apiVerified
              ? `${aiReply} Confirmed on Cal.com (UID: ${bookingRef}).`
              : `${aiReply} Reserved under crew dispatch hold (${bookingRef}) — finalize or manage on Cal.com: ${calBooking.calUrl}`
          } else if (calBooking && !calBooking.ok) {
            newMessages.push({
              id: `sys-ai-cal-err-${Date.now() + 1}`,
              sender: 'system',
              channel,
              timestamp,
              eventType: 'escalation',
              text: `⚠️ Cal.com v2 Booking Failed (${calBooking.error}) — Slot was NOT confirmed.`,
            })
            aiReply = `I tried to lock in ${calBooking.slotLabel} on our live Cal.com calendar, ${
              thread.contactName.split(' ')[0]
            }, but the calendar service returned an error (${
              calBooking.error
            }). You can book directly here: ${calBooking.calUrl}`
          }

          newMessages.push({
            id: `ai-kb-${Date.now() + 2}`,
            sender: 'ai',
            channel,
            timestamp,
            text: aiReply,
            kbCitations: kbResult.citations,
          })

          return {
            ...thread,
            aiStatus: bookingSucceeded ? 'ready_for_quote' : thread.aiStatus,
            opportunityStage: bookingSucceeded
              ? 'appointment_booked'
              : thread.opportunityStage || 'quote_sent',
            lastActivity: 'Just now',
            jobSummary: updatedJobSummary,
            messages: newMessages,
          }
        }

        if (currentMode === 'Draft') {
          return {
            ...thread,
            unread: true,
            unreadCount: (thread.unreadCount || 0) + 1,
            lastActivity: 'Just now',
            jobSummary: updatedJobSummary,
            alfredDraft: {
              id: `draft-kb-${Date.now()}`,
              createdAt: timestamp,
              reason: kbResult.bookingIntent.wantsToBook
                ? `Customer requested Cal.com booking (${kbResult.bookingIntent.matchedSlot?.label}) • Grounded in ${kbResult.citations.length} KB article(s).`
                : `Grounded in Knowledge Base: ${kbResult.citations
                    .map((c) => c.title)
                    .join(', ')}`,
              text: kbResult.replyText.replace(/\*\*/g, ''),
              citations: kbResult.citations,
              pendingSlot: kbResult.bookingIntent.matchedSlot || null,
            },
            messages: [
              ...thread.messages,
              customerMsg,
              {
                id: `sys-draft-ready-${Date.now() + 1}`,
                sender: 'system',
                channel,
                timestamp,
                eventType: 'info',
                text: `📝 Alfred prepared a KB-grounded private draft (${kbResult.citations.length} citation${
                  kbResult.citations.length === 1 ? '' : 's'
                }) awaiting your approval.`,
              },
            ],
          }
        }

        // Human Takeover mode: AI stays silent so operator can reply
        return {
          ...thread,
          unread: true,
          unreadCount: (thread.unreadCount || 0) + 1,
          lastActivity: 'Just now',
          jobSummary: updatedJobSummary,
          messages: [
            ...thread.messages,
            customerMsg,
            {
              id: `sys-human-hold-${Date.now() + 1}`,
              sender: 'system',
              channel,
              timestamp,
              eventType: 'autopilot_off',
              text: `✋ Thread in Human Takeover — Alfred stayed silent and matched ${kbResult.citations.length} Knowledge Base article(s) for Co-Pilot Whisper.`,
            },
          ],
        }
      })
      threadsRef.current = next
      return next
    })

    setAlfredSetup((prev) => ({
      ...prev,
      spentMicros: prev.spentMicros + 32000,
    }))

    if (bookingSucceeded) {
      showToast({
        title: calBooking.apiVerified
          ? '🤖📅 Alfred Booked on Cal.com v2!'
          : '🤖📅 Alfred Reserved Dispatch Slot!',
        message: `${calBooking.slotLabel} (${bookingRef})`,
        type: 'success',
      })
    } else if (calBooking && !calBooking.ok) {
      showToast({
        title: '⚠️ Calendar Booking Rejected',
        message: calBooking.error,
        type: 'warning',
      })
    } else {
      showToast({
        title:
          liveMode === 'AI'
            ? `🤖 Alfred Replied (${kbResult.citations.length} KB Citation${
                kbResult.citations.length === 1 ? '' : 's'
              })`
            : liveMode === 'Draft'
              ? '📝 Alfred Prepared KB-Grounded Draft'
              : '👤 Customer Message Logged (Human Mode)',
        message:
          kbResult.citations[0]?.title || 'Knowledge Base grounded response.',
        type: 'info',
      })
    }
  }

  // PILLAR 3.1: Missed-Call Rescue Trigger
  const triggerMissedCallRescue = ({
    callerName = 'Jordan Miller',
    callerPhone = '(603) 814-2905',
    callerAddress = '146 Londonderry Tpke, Hooksett, NH 03106',
  } = {}) => {
    const timestamp = formatNowTime()
    const newThreadId = `thread-missed-${Date.now()}`
    const primaryService = activeTenant.pricingRules.services[0]

    const rescueSms = `Hey ${callerName.split(' ')[0]}! Sorry we missed your call at ${activeTenant.companyName} (${activeTenant.city})—our crews are up on a roof right now. How can we help today? Feel free to reply here or snap a photo of your project for an instant ballpark quote!`

    const newThread = {
      id: newThreadId,
      contactName: callerName,
      phone: callerPhone,
      email: 'jordan.miller@nhhome.io',
      address: callerAddress,
      zipVerified: true,
      propertyType: 'Single-family home',
      roofAge: 'Not sure',
      preferredWindow: 'Flexible',
      unread: true,
      unreadCount: 1,
      lastActivity: 'Just now',
      channels: ['Missed Call', 'SMS'],
      primaryChannel: 'Missed Call',
      aiStatus: 'qualifying',
      opportunityStage: 'new_lead',
      aiAutopilot: true,
      handoffMode: 'AI',
      alfredDraft: null,
      jobSummary: {
        serviceNeeded: `${primaryService.name} (Missed-Call Rescue)`,
        urgency: 'High — Inbound Call Rescue',
        estimatedValue: primaryService.avgValue,
        estimatedRange: primaryService.range,
        visionSummary:
          'Missed call rescued in 1.4 seconds via automated SMS. Awaiting homeowner reply or project photo.',
        bookedSlot: null,
        reviewStage: 'none',
        photos: [],
      },
      messages: [
        {
          id: `mc-1-${Date.now()}`,
          sender: 'system',
          channel: 'Missed Call',
          timestamp,
          eventType: 'missed_call',
          text: `📞 Missed Inbound Call from ${callerPhone} — Automated Missed-Call Rescue fired in 1.4s`,
        },
        {
          id: `mc-2-${Date.now()}`,
          sender: 'ai',
          channel: 'SMS',
          timestamp,
          text: rescueSms,
        },
      ],
    }

    setThreads((prev) => [newThread, ...prev])
    setSelectedThreadId(newThreadId)

    showToast({
      title: '📞 Missed-Call Rescue Fired (1.4s)',
      message: `Sent instant conversational SMS to ${callerName} (${callerPhone}).`,
      actionLabel: 'View Thread →',
      onAction: () => setActiveView('backoffice'),
      type: 'info',
    })

    return newThreadId
  }

  // PILLAR 3.2: TOS-Safe Conversational Review Engine — Step 1: Natural Check-In
  const triggerJobCompletedCheckIn = (threadId = selectedThreadId) => {
    const timestamp = formatNowTime()
    setThreads((prev) =>
      prev.map((thread) => {
        if (thread.id !== threadId) return thread
        const firstName = thread.contactName.split(' ')[0]
        return {
          ...thread,
          opportunityStage: 'job_won',
          lastActivity: 'Just now',
          jobSummary: {
            ...thread.jobSummary,
            reviewStage: 'check_in_sent',
          },
          messages: [
            ...thread.messages,
            {
              id: `rev-sys-${Date.now()}`,
              sender: 'system',
              channel: 'SMS',
              timestamp,
              eventType: 'job_completed',
              text: '✅ Job Marked Completed — TOS-Safe Conversational Check-In + Direct Google Review Link sent (Zero Review-Gating)',
            },
            {
              id: `rev-sms-${Date.now() + 1}`,
              sender: 'ai',
              channel: 'SMS',
              timestamp,
              text: `Hi ${firstName}! Thanks again for trusting ${activeTenant.companyName} with your ${thread.jobSummary.serviceNeeded.toLowerCase()} today. How did everything go with the crew? You can also share a public review anytime on Google: ${activeTenant.googleReviewUrl}`,
            },
          ],
        }
      })
    )

    showToast({
      title: 'Job Completed Check-In Sent',
      message: 'Unconditional Google review link + natural SMS check-in sent.',
      type: 'success',
    })
  }

  // PILLAR 3.2: Step 2 — AI Sentiment Analysis & Routing
  const simulateCustomerReviewReply = (
    threadId = selectedThreadId,
    customReplyText = '',
    forcedSentiment = null
  ) => {
    const timestamp = formatNowTime()
    const negativeKeywords = [
      'bad',
      'late',
      'mess',
      'nails',
      'leak',
      'leaking',
      'unhappy',
      'issue',
      'problem',
      'wrong',
      'uneven',
      'expensive',
      'rude',
      'disappointed',
      'dented',
      'damaged',
    ]

    setThreads((prev) =>
      prev.map((thread) => {
        if (thread.id !== threadId) return thread
        const firstName = thread.contactName.split(' ')[0]

        const replyText =
          customReplyText?.trim() ||
          (forcedSentiment === 'negative'
            ? 'Honestly the repair looks okay, but the crew left roofing nails near our driveway and a dented downspout.'
            : 'Everything went great! The crew arrived right on time, showed me the flashing photos, and cleaned the whole driveway.')

        // Strip resolved-leak praise (e.g. "fixed the flashing leak") before checking negative keywords
        const sanitizedForKeywords = replyText
          .toLowerCase()
          .replace(
            /\b(?:fixed|repaired|stopped|solved|sealed)\s+(?:the\s+|our\s+|my\s+|a\s+)?(?:\w+\s+)?leaks?\b/g,
            'resolved_repair'
          )

        const isNegative =
          forcedSentiment === 'negative' ||
          (forcedSentiment !== 'positive' &&
            negativeKeywords.some((kw) => sanitizedForKeywords.includes(kw)))

        const customerMsg = {
          id: `rev-cust-${Date.now()}`,
          sender: 'customer',
          channel: 'SMS',
          timestamp,
          text: replyText,
        }

        if (!isNegative) {
          const sysRouteMsg = {
            id: `rev-route-pos-${Date.now() + 1}`,
            sender: 'system',
            channel: 'SMS',
            timestamp,
            eventType: 'sentiment_positive',
            text: '🟢 AI Sentiment Analysis: POSITIVE (0.97) — Sending warm thank-you & Google Review reminder',
          }
          const aiReviewLinkMsg = {
            id: `rev-ai-pos-${Date.now() + 2}`,
            sender: 'ai',
            channel: 'SMS',
            timestamp,
            text: `That means the world to our local crew, ${firstName}! If you haven't already and have 30 seconds, we'd love for you to share your experience on Google: ${activeTenant.googleReviewUrl} — Thank you again!`,
          }

          return {
            ...thread,
            lastActivity: 'Just now',
            jobSummary: {
              ...thread.jobSummary,
              reviewStage: 'positive_routed',
            },
            messages: [...thread.messages, customerMsg, sysRouteMsg, aiReviewLinkMsg],
          }
        } else {
          const sysEscalationMsg = {
            id: `rev-route-neg-${Date.now() + 1}`,
            sender: 'system',
            channel: 'SMS',
            timestamp,
            eventType: 'escalation',
            text: '🚨 AI Sentiment Analysis: ISSUE DETECTED (0.94) — Flipped thread to [🚨 Needs Human], paused AI Autopilot, and alerted Owner for immediate resolution.',
          }
          const aiEmpatheticHoldMsg = {
            id: `rev-ai-neg-${Date.now() + 2}`,
            sender: 'ai',
            channel: 'SMS',
            timestamp,
            text: `Thank you for telling us directly, ${firstName}—I am so sorry about that. I have flagged our owner & field supervisor right now so we can come make this 100% right today. Expect a personal call/text shortly, and our public Google review link (${activeTenant.googleReviewUrl}) remains open anytime.`,
          }

          return {
            ...thread,
            aiStatus: 'needs_human',
            aiAutopilot: false,
            handoffMode: 'Human',
            unread: true,
            unreadCount: thread.unreadCount + 1,
            lastActivity: 'Just now',
            jobSummary: {
              ...thread.jobSummary,
              reviewStage: 'negative_escalated',
            },
            messages: [
              ...thread.messages,
              customerMsg,
              sysEscalationMsg,
              aiEmpatheticHoldMsg,
            ],
          }
        }
      })
    )

    showToast({
      title:
        forcedSentiment === 'negative'
          ? '🚨 Negative Sentiment Escalated to Human'
          : '⭐ Sentiment Analyzed & Routed',
      message:
        forcedSentiment === 'negative'
          ? 'Thread flipped to 🚨 Needs Human & AI Autopilot paused.'
          : 'Direct Google Review link sent in Unified Timeline.',
      actionLabel: 'Inspect Timeline →',
      onAction: () => setActiveView('backoffice'),
      type: forcedSentiment === 'negative' ? 'warning' : 'success',
    })
  }

  const selectThread = (threadId) => {
    setSelectedThreadId(threadId)
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId ? { ...t, unread: false, unreadCount: 0 } : t
      )
    )
  }

  return (
    <PlatformContext.Provider
      value={{
        platformPlans: contractorsData.platformPlans,
        activePlan,
        activePlanId,
        setActivePlanId,
        tenants,
        activeTenant,
        activeTenantId,
        setActiveTenantId,
        updateActiveTenantConfig,
        activeView,
        setActiveView,
        threads,
        selectedThread,
        selectedThreadId,
        selectThread,
        submitHeroLead,
        toggleAutopilot,
        setThreadHandoffMode,
        approveAlfredDraft,
        dismissAlfredDraft,
        alfredSetup,
        updateAlfredSetup,
        alfredPresets: ALFRED_PRESETS,
        helperModal,
        openHelperModal,
        closeHelperModal,
        lightboxPhoto,
        setLightboxPhoto,
        sendHumanMessage,
        updateThreadStatus,
        updateOpportunityStage,
        generateCoPilotSuggestion,
        polishFieldVoiceNote,
        bookInspectionSlot,
        confirmEmbedBooking,
        cancelOrRescheduleBooking,
        simulateCustomerInboundMessage,
        calcomConfig,
        updateCalcomConfig,
        availableSlots,
        calcomStatus,
        refreshCalcomSlots,
        calcomEmbedOpen,
        setCalcomEmbedOpen,
        knowledgeBaseArticles,
        customKbEntries,
        addCustomKnowledgeArticle,
        deleteCustomKnowledgeArticle,
        triggerMissedCallRescue,
        triggerJobCompletedCheckIn,
        simulateCustomerReviewReply,
        samplePhotos: SAMPLE_DAMAGE_PHOTOS,
        leadRoutingMode,
        setLeadRoutingMode,
        activeLeadRoute,
        toastNotification,
        setToastNotification,
      }}
    >
      {children}
    </PlatformContext.Provider>
  )
}
