// Dual-Mode Cal.com v2 Calendar Integration Service
// Supports:
// 1. Cal.com Handle / Embed & Local Crew Schedule Mode (per-tenant config)
// 2. Server-Proxied Cal.com REST API v2 Mode (/api/calcom/* using server-side CALCOM_API_KEY)

const STORAGE_PREFIX = 'nb_insider_calcom_config_v2_'

function getStorageKey(tenantId) {
  return `${STORAGE_PREFIX}${tenantId || 'default'}`
}

export function getSavedCalcomConfig(tenant) {
  const tenantId = tenant?.id || 'default'
  let saved = {}
  try {
    const raw = localStorage.getItem(getStorageKey(tenantId))
    if (raw) saved = JSON.parse(raw)
  } catch {
    saved = {}
  }

  const tenantUrl = tenant?.bookingUrl || 'https://cal.com/tiberius/contractor'
  const urlParts = tenantUrl
    .replace(/^https?:\/\/(www\.)?cal\.com\//i, '')
    .split('/')
  const defaultHandle = urlParts[0] || 'tiberius'
  const defaultEventSlug = urlParts[1] || 'contractor'

  return {
    tenantId,
    handle:
      saved.handle ||
      tenant?.calcomConfig?.handle ||
      import.meta.env?.VITE_CALCOM_HANDLE ||
      defaultHandle,
    eventSlug:
      saved.eventSlug ||
      tenant?.calcomConfig?.eventSlug ||
      import.meta.env?.VITE_CALCOM_EVENT_SLUG ||
      defaultEventSlug,
    eventTypeId:
      saved.eventTypeId ??
      tenant?.calcomConfig?.eventTypeId ??
      import.meta.env?.VITE_CALCOM_EVENT_TYPE_ID ??
      '',
    proxyEnabled: Boolean(
      saved.proxyEnabled ?? tenant?.calcomConfig?.proxyEnabled ?? false
    ),
    timeZone:
      saved.timeZone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      'America/Chicago',
  }
}

export function saveCalcomConfig(nextConfig, tenantId) {
  const resolvedTenantId = tenantId || nextConfig?.tenantId || 'default'
  const sanitized = {
    tenantId: resolvedTenantId,
    handle: (nextConfig?.handle || 'tiberius').trim(),
    eventSlug: (nextConfig?.eventSlug || 'contractor').trim(),
    eventTypeId: String(nextConfig?.eventTypeId || '').trim(),
    proxyEnabled: Boolean(nextConfig?.proxyEnabled),
    timeZone: nextConfig?.timeZone || 'America/Chicago',
  }
  try {
    localStorage.setItem(
      getStorageKey(resolvedTenantId),
      JSON.stringify(sanitized)
    )
  } catch {
    // Ignore storage errors in restricted environments
  }
  return sanitized
}

function enrichSlotMetadata(startDate, endDate, idx, source = 'schedule') {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const slotDayStart = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  )
  const diffDays = Math.round(
    (slotDayStart.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000)
  )

  const weekdayShort = startDate.toLocaleDateString('en-US', { weekday: 'short' })
  const weekdayLong = startDate
    .toLocaleDateString('en-US', { weekday: 'long' })
    .toLowerCase()
  const monthDay = startDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  const dayPrefix =
    diffDays === 0
      ? `Today (${weekdayShort}, ${monthDay})`
      : diffDays === 1
        ? `Tomorrow (${weekdayShort}, ${monthDay})`
        : `${weekdayShort}, ${monthDay}`

  const dayKey =
    diffDays === 0 ? 'today' : diffDays === 1 ? 'tomorrow' : weekdayLong

  const startTimeStr = startDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  const endTimeStr = endDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  const hour24 = startDate.getHours()
  const windowTag = hour24 < 12 ? 'Morning' : 'Afternoon'

  return {
    id:
      source === 'calcom_api_v2'
        ? `cal-v2-${startDate.getTime()}`
        : `slot-${idx + 1}`,
    label: `${dayPrefix}, ${startTimeStr} – ${endTimeStr}`,
    shortLabel: `${diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : `${weekdayShort}, ${monthDay}`} at ${startTimeStr}`,
    startIso: startDate.toISOString(),
    endIso: endDate.toISOString(),
    windowTag,
    dayKey,
    weekdayLong,
    weekdayShort: weekdayShort.toLowerCase(),
    hour24,
    minute: startDate.getMinutes(),
    source,
  }
}

export function buildDefaultCalendarSlots() {
  const now = new Date()
  const addDays = (days, hour, minute) => {
    const d = new Date(now)
    d.setDate(d.getDate() + days)
    d.setHours(hour, minute, 0, 0)
    return d
  }

  const rawSlots = [
    { offset: 0, hour: 14, min: 30 },
    { offset: 1, hour: 9, min: 0 },
    { offset: 1, hour: 13, min: 30 },
    { offset: 2, hour: 10, min: 0 },
    { offset: 2, hour: 15, min: 0 },
  ]

  return rawSlots.map((item, idx) => {
    const startDate = addDays(item.offset, item.hour, item.min)
    const endDate = new Date(startDate.getTime() + 90 * 60 * 1000)
    return enrichSlotMetadata(startDate, endDate, idx, 'schedule')
  })
}

export async function fetchCalcomAvailableSlots(calConfig) {
  const fallbackSlots = buildDefaultCalendarSlots()
  const cleanHandle = calConfig?.handle || 'tiberius'
  const cleanSlug = calConfig?.eventSlug || 'contractor'

  if (!calConfig?.proxyEnabled || !calConfig?.eventTypeId) {
    return {
      slots: fallbackSlots,
      liveApiActive: false,
      emptyLiveAvailability: false,
      sourceLabel: `Crew Schedule (${cleanHandle}/${cleanSlug})`,
    }
  }

  try {
    const now = new Date()
    const end = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)
    const params = new URLSearchParams({
      eventTypeId: String(calConfig.eventTypeId).trim(),
      startTime: now.toISOString(),
      endTime: end.toISOString(),
      timeZone: calConfig.timeZone || 'America/Chicago',
    })

    const res = await fetch(`/api/calcom/slots?${params.toString()}`)
    const payload = await res.json().catch(() => ({}))

    if (!res.ok || !payload?.ok) {
      throw new Error(
        payload?.error || `Cal.com v2 proxy returned HTTP ${res.status}`
      )
    }

    const slotsMap =
      payload?.data?.data?.slots ||
      payload?.data?.slots ||
      payload?.slots ||
      {}
    const extracted = []

    if (slotsMap && typeof slotsMap === 'object') {
      Object.values(slotsMap).forEach((daySlots) => {
        if (Array.isArray(daySlots)) {
          daySlots.slice(0, 2).forEach((s) => {
            const rawStart = s?.time || s?.start
            if (rawStart) {
              const startDate = new Date(rawStart)
              if (!Number.isNaN(startDate.getTime())) {
                const endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
                extracted.push(
                  enrichSlotMetadata(
                    startDate,
                    endDate,
                    extracted.length,
                    'calcom_api_v2'
                  )
                )
              }
            }
          })
        }
      })
    }

    return {
      slots: extracted.slice(0, 6),
      liveApiActive: true,
      emptyLiveAvailability: extracted.length === 0,
      sourceLabel:
        extracted.length > 0
          ? `Cal.com API v2 Verified (Event #${calConfig.eventTypeId})`
          : `Cal.com API v2 — No Open Slots Next 5 Days`,
    }
  } catch (err) {
    return {
      slots: fallbackSlots,
      liveApiActive: false,
      emptyLiveAvailability: false,
      apiError: err.message,
      sourceLabel: `Crew Schedule Fallback (${err.message})`,
    }
  }
}

export async function createCalcomBooking({
  calConfig,
  slot,
  attendee,
  serviceName,
  companyName,
  notes,
}) {
  const resolvedSlot =
    typeof slot === 'string'
      ? buildDefaultCalendarSlots().find((s) => s.label === slot) || {
          label: slot,
          shortLabel: slot,
          startIso: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          endIso: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
          source: 'schedule',
        }
      : slot

  if (!resolvedSlot) {
    return {
      ok: false,
      apiVerified: false,
      error: 'No valid calendar slot selected for booking.',
    }
  }

  const cleanHandle = (calConfig?.handle || 'tiberius').replace(/^@/, '').trim()
  const cleanSlug = (calConfig?.eventSlug || 'contractor')
    .replace(/^\//, '')
    .trim()
  const bookingLinkParams = new URLSearchParams({
    name: attendee?.name || 'Homeowner',
    email: attendee?.email || 'homeowner@example.com',
    notes: `${serviceName || 'Inspection'} — ${attendee?.address || ''} (${attendee?.phone || ''})`,
  })
  const directCalUrl = `https://cal.com/${cleanHandle}/${cleanSlug}?${bookingLinkParams.toString()}`

  const shouldUseLiveApi = Boolean(
    (calConfig?.proxyEnabled && calConfig?.eventTypeId) ||
      resolvedSlot.source === 'calcom_api_v2'
  )

  if (shouldUseLiveApi) {
    try {
      const payload = {
        eventTypeId: Number(calConfig.eventTypeId),
        start: resolvedSlot.startIso,
        attendee: {
          name: attendee?.name || 'Homeowner',
          email: attendee?.email || 'homeowner@example.com',
          timeZone: calConfig?.timeZone || 'America/Chicago',
          language: 'en',
        },
        metadata: {
          source: 'NB-Insider-GHL-Conversation-Room',
          companyName: companyName || 'Contractor AI OS',
          serviceNeeded: serviceName || 'Inspection',
          phone: attendee?.phone || 'N/A',
          address: attendee?.address || 'N/A',
          notes: notes || '',
        },
      }

      const res = await fetch('/api/calcom/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.ok) {
        return {
          ok: false,
          apiVerified: false,
          error:
            body?.error ||
            `Cal.com v2 API rejected booking (HTTP ${res.status}).`,
          slotLabel: resolvedSlot.label,
          startIso: resolvedSlot.startIso,
          calUrl: directCalUrl,
        }
      }

      const bookingData = body?.data?.data || body?.data || {}
      const verifiedUid = bookingData?.uid || bookingData?.id
      if (!verifiedUid) {
        return {
          ok: false,
          apiVerified: false,
          error: 'Cal.com v2 response did not include a verified booking UID.',
          slotLabel: resolvedSlot.label,
          startIso: resolvedSlot.startIso,
          calUrl: directCalUrl,
        }
      }

      return {
        ok: true,
        mode: 'Cal.com API v2 Verified',
        reservationType: 'calcom_v2',
        bookingUid: String(verifiedUid),
        slotLabel: resolvedSlot.label,
        startIso: resolvedSlot.startIso,
        calUrl: directCalUrl,
        apiVerified: true,
      }
    } catch (err) {
      return {
        ok: false,
        apiVerified: false,
        error: err?.message || 'Cal.com v2 booking request failed.',
        slotLabel: resolvedSlot.label,
        startIso: resolvedSlot.startIso,
        calUrl: directCalUrl,
      }
    }
  }

  return {
    ok: true,
    mode: `Crew Dispatch Hold (${cleanHandle}/${cleanSlug})`,
    reservationType: 'schedule_hold',
    bookingUid: null,
    holdReference: `HOLD-${Date.now().toString(36).toUpperCase()}`,
    slotLabel: resolvedSlot.label,
    startIso: resolvedSlot.startIso,
    calUrl: directCalUrl,
    apiVerified: false,
  }
}

export async function cancelCalcomBooking(bookedSlot) {
  if (!bookedSlot) {
    return { ok: true, cancelledRemote: false }
  }

  if (bookedSlot.apiVerified && bookedSlot.bookingUid) {
    try {
      const res = await fetch('/api/calcom/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingUid: bookedSlot.bookingUid,
          cancellationReason:
            'Rescheduled or cancelled by operator in GHL Conversation Room',
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.ok) {
        return {
          ok: false,
          error:
            body?.error ||
            `Could not cancel live Cal.com booking ${bookedSlot.bookingUid}.`,
        }
      }
      return { ok: true, cancelledRemote: true }
    } catch (err) {
      return {
        ok: false,
        error:
          err?.message ||
          `Network error while cancelling Cal.com booking ${bookedSlot.bookingUid}.`,
      }
    }
  }

  return { ok: true, cancelledRemote: false }
}

// Strict, negation-safe, availability-verified booking intent parser
export function parseBookingIntentFromText(text = '', availableSlots = []) {
  const trimmed = (text || '').trim()
  const lower = trimmed.toLowerCase()
  const slots = Array.isArray(availableSlots) ? availableSlots : []

  if (!trimmed) {
    return { wantsToBook: false, matchedSlot: null }
  }

  // 1. Reject any negation of booking or scheduling ("Do not book me tomorrow", "don't schedule", "not ready to book")
  const hasNegation =
    /\b(?:don'?t|do\s+not|never|not\s+ready\s+to|no\s+need\s+to|hold\s+off|wait\s+to|avoid|stop|cancel)\b[^.?!]{0,30}\b(?:book|schedule|appointment|come|visit|slot|tomorrow|today)\b/i.test(
      lower
    ) ||
    /\bnot\s+(?:today|tomorrow|this\s+week|morning|afternoon)\b/i.test(lower)

  if (hasNegation) {
    return { wantsToBook: false, matchedSlot: null, negated: true }
  }

  // 2. Explicit option number reply ("1", "option 1", "slot 1", "2", "option 2")
  if (/^\s*(?:option|slot)?\s*1\s*$/i.test(trimmed)) {
    if (slots[0]) return { wantsToBook: true, matchedSlot: slots[0] }
    return {
      wantsToBook: false,
      matchedSlot: null,
      requestedUnavailableSlot: true,
      requestedSummary: 'Option 1',
    }
  }
  if (/^\s*(?:option|slot)?\s*2\s*$/i.test(trimmed)) {
    if (slots[1]) return { wantsToBook: true, matchedSlot: slots[1] }
    return {
      wantsToBook: false,
      matchedSlot: null,
      requestedUnavailableSlot: true,
      requestedSummary: 'Option 2',
    }
  }

  // 3. Require explicit scheduling/booking intent (prevent "My roof started leaking today" from booking!)
  const hasExplicitBookingVerb =
    /\b(?:book|schedule|set\s+up\s+(?:an?\s+)?(?:appointment|inspection|visit)|lock\s+in|reserve|put\s+me\s+down|confirm\s+(?:that|the|my)?\s*(?:slot|time|appointment)|can\s+you\s+(?:book|schedule)|let'?s\s+(?:book|schedule|do\s+tomorrow|do\s+today|lock\s+in))\b/i.test(
      lower
    ) ||
    /\b(?:works\s+for\s+me|book\s+me)\b/i.test(lower)

  if (!hasExplicitBookingVerb) {
    return { wantsToBook: false, matchedSlot: null }
  }

  if (slots.length === 0) {
    return {
      wantsToBook: false,
      matchedSlot: null,
      requestedUnavailableSlot: true,
      requestedSummary: 'any open slot',
    }
  }

  // 4. Parse requested day / window / hour constraints and verify against actual availableSlots
  const wantsToday = /\btoday\b/i.test(lower)
  const wantsTomorrow = /\btomorrow\b/i.test(lower)
  const weekdayMatch = lower.match(
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i
  )
  const requestedWeekday = weekdayMatch ? weekdayMatch[1].toLowerCase() : null

  const wantsMorning = /\bmorning\b/i.test(lower)
  const wantsAfternoon = /\bafternoon\b/i.test(lower)

  const timeTokenMatch = lower.match(
    /\b(?:at\s+|for\s+)?(9:00|9am|9\s*am|10:00|10am|10\s*am|1:30|1pm|1\s*pm|2:30|2pm|2\s*pm|3:00|3pm|3\s*pm)\b/i
  )
  const requestedHourMap = {
    '9:00': 9,
    '9am': 9,
    '9 am': 9,
    '10:00': 10,
    '10am': 10,
    '10 am': 10,
    '1:30': 13,
    '1pm': 13,
    '1 pm': 13,
    '2:30': 14,
    '2pm': 14,
    '2 pm': 14,
    '3:00': 15,
    '3pm': 15,
    '3 pm': 15,
  }
  const requestedHour = timeTokenMatch
    ? requestedHourMap[timeTokenMatch[1].replace(/\s+/g, ' ').toLowerCase()]
    : null

  const hasSpecificConstraint = Boolean(
    wantsToday ||
      wantsTomorrow ||
      requestedWeekday ||
      wantsMorning ||
      wantsAfternoon ||
      requestedHour !== null
  )

  const matchingSlot = slots.find((slot) => {
    const slotLabelLower = (slot.label || '').toLowerCase()
    if (wantsToday && slot.dayKey !== 'today' && !slotLabelLower.includes('today')) {
      return false
    }
    if (
      wantsTomorrow &&
      slot.dayKey !== 'tomorrow' &&
      !slotLabelLower.includes('tomorrow')
    ) {
      return false
    }
    if (
      requestedWeekday &&
      slot.weekdayLong !== requestedWeekday &&
      !slotLabelLower.includes(requestedWeekday.slice(0, 3))
    ) {
      return false
    }
    if (
      wantsMorning &&
      slot.windowTag?.toLowerCase() !== 'morning' &&
      (typeof slot.hour24 === 'number' ? slot.hour24 >= 12 : false)
    ) {
      return false
    }
    if (
      wantsAfternoon &&
      slot.windowTag?.toLowerCase() !== 'afternoon' &&
      (typeof slot.hour24 === 'number' ? slot.hour24 < 12 : false)
    ) {
      return false
    }
    if (requestedHour !== null && typeof slot.hour24 === 'number') {
      if (slot.hour24 !== requestedHour) return false
    }
    return true
  })

  if (matchingSlot) {
    return {
      wantsToBook: true,
      matchedSlot: matchingSlot,
    }
  }

  // If the customer asked for a specific day/time that is NOT in availableSlots, do not book the wrong day!
  if (hasSpecificConstraint) {
    return {
      wantsToBook: false,
      matchedSlot: null,
      requestedUnavailableSlot: true,
      requestedSummary: [
        wantsToday ? 'Today' : '',
        wantsTomorrow ? 'Tomorrow' : '',
        requestedWeekday || '',
        wantsMorning ? 'Morning' : '',
        wantsAfternoon ? 'Afternoon' : '',
        timeTokenMatch ? timeTokenMatch[1] : '',
      ]
        .filter(Boolean)
        .join(' '),
    }
  }

  // Generic positive booking request ("Yes please book me for the next open slot")
  return {
    wantsToBook: true,
    matchedSlot: slots[0],
  }
}
