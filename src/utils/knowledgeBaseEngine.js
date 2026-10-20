// Tenant Knowledge Base (KB) & Retrieval-Augmented Generation (RAG) Grounding Engine
// Gives Alfred (AI Assistant) & the GoHighLevel Conversation Room structured access to:
// 1. Service Territory & ZIP Verification (validates 5-digit ZIP codes against tenant coverage)
// 2. Services, Ballpark Pricing & Diagnostic Rules (with strict custom rule precedence)
// 3. Warranties, Materials, Financing & Insurance Policies
// 4. Cal.com Scheduling Rules & Emergency Dispatch SOPs
// 5. Owner-Editable Custom Knowledge Base Entries

import { parseBookingIntentFromText } from './calcomService'

const DEFAULT_TERRITORY_BY_TENANT = {
  'all-solutions-diesel': {
    zips: [
      '78070',
      '78163',
      '78130',
      '78132',
      '78133',
      '78006',
      '78015',
      '78258',
      '78259',
      '78260',
      '78261',
      '78606',
    ],
    summary:
      'Located at 113 Remington Road, Spring Branch, TX 78070 (Phone: 830-388-1458 · Email: info@allsolutionsrepairs.com). Open Mon–Fri 9:00 AM – 5:00 PM (Services by Appointment Only). Serving Spring Branch, Bulverde, New Braunfels, Canyon Lake, Boerne, Blanco, and North San Antonio.',
    warranty:
      'Quality maintenance and repair for all makes and models—specializing in electrical diagnosis, fleet maintenance packages, heavy-duty diesels, 6.0 Powerstrokes, full engine & transmission replacements, air brakes, farm equipment, and construction equipment.',
    financingAndInsurance:
      'We offer Car Care Credit by Synchrony (https://www.mysynchrony.com/mmc/NT237455907) so you can make your repair purchase today and pay over time with convenient monthly payments.',
  },
  'scg-roofing': {
    zips: [
      '03106',
      '03101',
      '03102',
      '03103',
      '03104',
      '03053',
      '03820',
      '03290',
      '03301',
      '03060',
      '03038',
    ],
    summary:
      'Headquartered at 146 Londonderry Turnpike, Unit 20, Hooksett, NH 03106. Serving Hooksett, Manchester, Londonderry, Dover, Nottingham, Concord, Derry, Nashua, and all of Southern New Hampshire.',
    warranty:
      '10-Year SCG Workmanship Warranty plus 50-Year / Limited Lifetime Architectural Shingle Manufacturer Warranty. Fully licensed & insured in New Hampshire.',
    financingAndInsurance:
      'We provide full photo documentation for storm/hail insurance claims and offer 0% APR 12-month same-as-cash financing on full roof replacements.',
  },
  'apex-roofing': {
    zips: [
      '78704',
      '78701',
      '78702',
      '78745',
      '78748',
      '78660',
      '78613',
      '78681',
    ],
    summary:
      'Based at 4812 South Congress Ave, Austin, TX 78704. Covering Austin, Round Rock, Cedar Park, Buda, Kyle, and Central Texas.',
    warranty:
      '12-Year Workmanship Warranty + Class-4 Impact Shingle UL 2218 Warranty.',
    financingAndInsurance:
      'Direct Xactimate storm/hail supplement documentation for all major carriers + flexible monthly payment plans.',
  },
}

export function getTenantCoveredZips(tenant, customEntries = []) {
  const territoryMeta = DEFAULT_TERRITORY_BY_TENANT[tenant?.id] || {
    zips: ['78070', '78163', '78130', '78132', '78260', '03106'],
  }
  const zipSet = new Set(territoryMeta.zips)

  const allCustom = [
    ...(tenant?.knowledgeBase?.customArticles || []),
    ...(customEntries || []),
  ]
  allCustom.forEach((art) => {
    const matches = `${art.title || ''} ${art.content || ''}`.match(/\b\d{5}\b/g)
    if (matches) {
      matches.forEach((z) => zipSet.add(z))
    }
  })

  return Array.from(zipSet)
}

export function buildTenantKnowledgeBase(tenant, customEntries = []) {
  if (!tenant) return []

  const territoryMeta = DEFAULT_TERRITORY_BY_TENANT[tenant.id] || {
    zips: ['78070', '78163', '78130', '78132', '78260', '03106'],
    summary: `Based in ${tenant.city} (${tenant.addressLine || tenant.city}). Serving surrounding residential and commercial neighborhoods within a 35-mile radius.`,
    warranty:
      tenant.knowledgeBase?.warranty ||
      `10-Year Workmanship Guarantee backed by ${tenant.companyName} (${tenant.city}), fully licensed and insured.`,
    financingAndInsurance:
      tenant.knowledgeBase?.financingAndInsurance ||
      'Transparent written estimates prior to work, insurance documentation support, and flexible project financing options.',
  }

  const coveredZips = getTenantCoveredZips(tenant, customEntries)

  const servicesListText = (tenant.pricingRules?.services || [])
    .map(
      (s) =>
        `• ${s.name}: ${s.range} (Avg $${s.avgValue.toLocaleString()}, ${s.duration || 'Half day'}, ${s.urgency}) — ${s.description}`
    )
    .join('\n')

  const baseArticles = [
    {
      id: 'kb-pricing-matrix',
      category: 'Pricing & Diagnostics',
      title: `${tenant.companyName} Service & Ballpark Pricing Matrix`,
      keywords: [
        'price',
        'cost',
        'how much',
        'quote',
        'estimate',
        'ballpark',
        'range',
        'diagnostic',
        'inspection',
        'fee',
        'free',
        'minimum',
      ],
      content: `${
        tenant.pricingRules?.freeInspection
          ? 'We provide a $0 on-site inspection and written scope.'
          : `Our standard diagnostic visit is $${tenant.pricingRules?.baseDiagnostic || 89} (100% waived when you approve the repair).`
      } Minimum dispatch is $${tenant.pricingRules?.minimumDispatch || 350}.\n${servicesListText}`,
    },
    {
      id: 'kb-territory-zips',
      category: 'Service Territory',
      title: `Verified Coverage Area & ZIP Codes (${tenant.city})`,
      keywords: [
        'zip',
        'area',
        'cover',
        'location',
        'where',
        'address',
        'hooksett',
        'manchester',
        'dover',
        'londonderry',
        'nottingham',
        'concord',
        'austin',
        'new braunfels',
        'travel',
        ...coveredZips,
      ],
      content: `${territoryMeta.summary} Primary verified ZIP codes include: ${coveredZips.join(
        ', '
      )}.`,
    },
    {
      id: 'kb-warranty-credentials',
      category: 'Warranty & Credentials',
      title: 'Workmanship Warranty, Licensing & Materials',
      keywords: [
        'warranty',
        'guarantee',
        'licensed',
        'insured',
        'insurance',
        'shingle',
        'materials',
        'credentials',
        'experience',
        'years',
        'financing',
        'claim',
        'storm',
        'hail',
      ],
      content: `${territoryMeta.warranty} ${territoryMeta.financingAndInsurance}`,
    },
    {
      id: 'kb-calendar-sop',
      category: 'Cal.com Scheduling',
      title: 'Cal.com Live Appointment Booking & Arrival Windows',
      keywords: [
        'book',
        'schedule',
        'calendar',
        'appointment',
        'slot',
        'time',
        'today',
        'tomorrow',
        'morning',
        'afternoon',
        'available',
        'availability',
        'visit',
      ],
      content: `Alfred has direct access to ${tenant.companyName}'s Cal.com calendar (${tenant.bookingUrl}). Standard inspection windows are Morning (9:00 AM – 10:30 AM) and Afternoon (1:30 PM – 4:00 PM), with same-day emergency tarping/dispatch reserved for active water intrusion or hazards.`,
    },
    {
      id: 'kb-ai-sop-rules',
      category: 'AI Playbook',
      title: 'Contractor Qualification & Scope Guardrails',
      keywords: ['rule', 'scope', 'photo', 'upload', 'attic', 'decking', 'flashing'],
      content:
        tenant.pricingRules?.aiPromptRules ||
        'Always verify property ZIP code, provide transparent local ballpark ranges from the pricing table, and offer to lock in a confirmed Cal.com inspection slot.',
    },
  ]

  const faqArticles = (tenant.faqs || []).map((faq, idx) => ({
    id: `kb-faq-${idx + 1}`,
    category: 'FAQ Knowledge',
    title: faq.q,
    keywords: faq.q
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3),
    content: faq.a,
  }))

  const tenantCustom = (tenant.knowledgeBase?.customArticles || []).map(
    (art, idx) => ({
      id: art.id || `kb-tenant-custom-${idx}`,
      category: art.category || 'Custom SOP',
      title: art.title,
      keywords:
        art.keywords ||
        `${art.title} ${art.content}`
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
          .filter((w) => w.length > 2),
      content: art.content,
      isCustom: true,
    })
  )

  const runtimeCustom = customEntries.map((art, idx) => ({
    id: art.id || `kb-custom-${idx}`,
    category: art.category || 'Owner Rule',
    title: art.title,
    keywords:
      art.keywords ||
      `${art.title} ${art.content}`
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2),
    content: art.content,
    isCustom: true,
  }))

  return [...runtimeCustom, ...tenantCustom, ...baseArticles, ...faqArticles]
}

export function matchTenantServiceFromText(text = '', tenant) {
  const services = tenant?.pricingRules?.services || []
  if (services.length === 0) return null
  const lower = text.toLowerCase()

  let bestService = null
  let bestScore = 0

  services.forEach((srv) => {
    const tokens = `${srv.name} ${srv.category || ''} ${srv.description || ''}`
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3)

    let score = 0
    tokens.forEach((tk) => {
      if (lower.includes(tk)) score += 2
    })

    if (
      (lower.includes('powerstroke') ||
        lower.includes('diesel') ||
        lower.includes('turbo') ||
        lower.includes('6.0')) &&
      srv.name.toLowerCase().includes('diesel')
    )
      score += 7
    if (
      (lower.includes('electrical') ||
        lower.includes('check engine') ||
        lower.includes('diagnos') ||
        lower.includes('code') ||
        lower.includes('wiring')) &&
      srv.name.toLowerCase().includes('electrical')
    )
      score += 7
    if (
      (lower.includes('engine') || lower.includes('motor')) &&
      srv.name.toLowerCase().includes('engine')
    )
      score += 7
    if (
      (lower.includes('transmission') ||
        lower.includes('clutch') ||
        lower.includes('flywheel') ||
        lower.includes('gear')) &&
      srv.name.toLowerCase().includes('transmission')
    )
      score += 7
    if (
      (lower.includes('fleet') ||
        lower.includes('air brake') ||
        lower.includes('semi') ||
        lower.includes('equipment') ||
        lower.includes('hydraulic')) &&
      srv.name.toLowerCase().includes('fleet')
    )
      score += 7
    if (
      (lower.includes('brake') ||
        lower.includes('steering') ||
        lower.includes('suspension') ||
        lower.includes('tune')) &&
      srv.name.toLowerCase().includes('steering')
    )
      score += 7
    if (lower.includes('leak') && srv.name.toLowerCase().includes('leak'))
      score += 6
    if (
      lower.includes('flashing') &&
      srv.name.toLowerCase().includes('flashing')
    )
      score += 6
    if (
      lower.includes('replace') &&
      srv.name.toLowerCase().includes('replacement')
    )
      score += 6
    if (lower.includes('gutter') && srv.name.toLowerCase().includes('gutter'))
      score += 6
    if (
      lower.includes('skylight') &&
      srv.name.toLowerCase().includes('skylight')
    )
      score += 6
    if (
      lower.includes('vent') &&
      srv.name.toLowerCase().includes('ventilation')
    )
      score += 6
    if (lower.includes('deck') && srv.name.toLowerCase().includes('decking'))
      score += 5
    if (lower.includes('panel') && srv.name.toLowerCase().includes('panel'))
      score += 6
    if (lower.includes('charger') && srv.name.toLowerCase().includes('charger'))
      score += 6
    if (
      lower.includes('generator') &&
      srv.name.toLowerCase().includes('generator')
    )
      score += 6

    if (score > bestScore) {
      bestScore = score
      bestService = srv
    }
  })

  return bestScore > 0 ? bestService : null
}

export function queryKnowledgeBase({
  query = '',
  tenant,
  thread,
  availableSlots = [],
  customEntries = [],
}) {
  const articles = buildTenantKnowledgeBase(tenant, customEntries)
  const slots = Array.isArray(availableSlots) ? availableSlots : []
  const lower = query.toLowerCase()
  const firstName = thread?.contactName
    ? thread.contactName.split(' ')[0]
    : 'there'

  const coveredZips = getTenantCoveredZips(tenant, customEntries)
  const extractedZips = query.match(/\b\d{5}\b/g) || []
  const outOfAreaZips = extractedZips.filter((z) => !coveredZips.includes(z))
  const inAreaZips = extractedZips.filter((z) => coveredZips.includes(z))

  // 1. Check if customer is asking to book or confirming a slot (unless out-of-area ZIP was given)
  const bookingIntent =
    outOfAreaZips.length > 0
      ? { wantsToBook: false, matchedSlot: null, outOfTerritory: true }
      : parseBookingIntentFromText(query, slots)

  // 2. Match service if mentioned
  const matchedService =
    matchTenantServiceFromText(query, tenant) ||
    tenant?.pricingRules?.services?.find(
      (s) => s.name === thread?.jobSummary?.serviceNeeded
    ) ||
    tenant?.pricingRules?.services?.[0]

  // 3. Score Knowledge Base articles (custom rules receive priority boost)
  const scored = articles
    .map((art) => {
      let score = 0
      ;(art.keywords || []).forEach((kw) => {
        if (kw && lower.includes(String(kw).toLowerCase())) {
          score += art.isCustom ? 8 : 3
        }
      })
      if (art.title && lower.includes(art.title.toLowerCase())) {
        score += art.isCustom ? 10 : 6
      }
      if (
        art.isCustom &&
        art.category === 'Pricing & Diagnostics' &&
        /\b(price|cost|how much|quote|estimate|inspection|diagnostic|fee)\b/i.test(
          lower
        )
      ) {
        score += 12
      }
      return { article: art, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)

  const topCitations = scored.slice(0, 3).map((s) => ({
    id: s.article.id,
    category: s.article.category,
    title: s.article.title,
    snippet: s.article.content,
    isCustom: Boolean(s.article.isCustom),
  }))

  if (
    extractedZips.length > 0 &&
    !topCitations.some((c) => c.id === 'kb-territory-zips')
  ) {
    const territoryArt = articles.find((a) => a.id === 'kb-territory-zips')
    if (territoryArt) {
      topCitations.unshift({
        id: territoryArt.id,
        category: territoryArt.category,
        title: territoryArt.title,
        snippet: territoryArt.content,
      })
    }
  }

  if (topCitations.length === 0 && articles.length > 0) {
    topCitations.push({
      id: articles[0].id,
      category: articles[0].category,
      title: articles[0].title,
      snippet: articles[0].content,
      isCustom: Boolean(articles[0].isCustom),
    })
  }

  // 4. Out-of-territory ZIP handling (never claim we cover 90210!)
  const territoryArticle = articles.find((a) => a.id === 'kb-territory-zips')
  if (outOfAreaZips.length > 0) {
    return {
      replyText: `Thanks for reaching out, ${firstName}. Right now ZIP **${outOfAreaZips.join(
        ', '
      )}** is outside our primary service territory for ${
        tenant?.companyName || 'our crew'
      }. ${
        territoryArticle?.content || ''
      } If the property is located inside one of our covered communities, reply with that address or ZIP and we will gladly check our schedule!`,
      citations: topCitations.slice(0, 3),
      matchedService,
      bookingIntent: {
        wantsToBook: false,
        matchedSlot: null,
        outOfTerritory: true,
      },
    }
  }

  // 5. Verified booking intent response
  if (bookingIntent.wantsToBook && bookingIntent.matchedSlot) {
    const calCitation = articles.find((a) => a.id === 'kb-calendar-sop')
    if (calCitation && !topCitations.some((c) => c.id === calCitation.id)) {
      topCitations.unshift({
        id: calCitation.id,
        category: calCitation.category,
        title: calCitation.title,
        snippet: calCitation.content,
      })
    }
    return {
      replyText: `You got it, ${firstName}! I am locking in **${
        bookingIntent.matchedSlot.label
      }** at ${thread?.address || tenant?.city || 'your property'} for your ${
        matchedService?.name || 'inspection'
      }.`,
      citations: topCitations.slice(0, 3),
      matchedService,
      bookingIntent,
    }
  }

  const parts = []

  // 6. Custom KB rules take strict precedence over default policies
  const matchedCustomRules = scored
    .filter((s) => s.article.isCustom)
    .map((s) => s.article)

  const customOverridesInspectionFee = matchedCustomRules.some(
    (art) =>
      art.category === 'Pricing & Diagnostics' ||
      /\b(inspection|diagnostic|visit|fee|\$\d+)\b/i.test(
        `${art.title} ${art.content}`
      )
  )

  if (matchedCustomRules.length > 0) {
    matchedCustomRules.slice(0, 2).forEach((rule) => {
      parts.push(rule.content)
    })
  }

  // 7. Territory & in-area ZIP confirmation
  if (
    territoryArticle &&
    (inAreaZips.length > 0 ||
      /\b(zip|cover|area|where|spring branch|bulverde|new braunfels|canyon lake|remington|hooksett|manchester|dover|londonderry|nottingham|concord|austin)\b/i.test(
        lower
      ))
  ) {
    const zipLabel =
      inAreaZips.length > 0 ? `ZIP ${inAreaZips.join(', ')}` : 'your area'
    parts.push(
      `Yes, ${firstName} — ${zipLabel} is inside our verified coverage territory! ${territoryArticle.content}`
    )
  }

  // 8. Warranty / insurance / financing
  const warrantyMatch = scored.find(
    (s) => s.article.id === 'kb-warranty-credentials'
  )
  if (
    warrantyMatch &&
    /\b(warranty|guarantee|insured|license|insurance|claim|financ)\b/i.test(
      lower
    )
  ) {
    parts.push(warrantyMatch.article.content)
  }

  // 9. FAQ match if no custom/territory/warranty matched yet
  const faqMatch = scored.find((s) => s.article.category === 'FAQ Knowledge')
  if (faqMatch && parts.length === 0) {
    parts.push(faqMatch.article.content)
  }

  // 10. Service ballpark pricing (respecting custom inspection fee overrides!)
  if (
    matchedService &&
    (parts.length === 0 ||
      /\b(price|cost|how much|quote|estimate|range|repair|replace|leak|flashing|gutter|skylight|vent)\b/i.test(
        lower
      ))
  ) {
    if (customOverridesInspectionFee) {
      parts.push(
        `For **${matchedService.name}** in ${tenant.city}, our typical project range is **${matchedService.range}**.`
      )
    } else {
      const inspNote = tenant.pricingRules?.freeInspection
        ? 'including a $0 on-site inspection'
        : `with a $${tenant.pricingRules?.baseDiagnostic || 89} diagnostic (waived with repair)`
      parts.push(
        `For **${matchedService.name}** in ${tenant.city}, our transparent ballpark range is **${matchedService.range}** (${inspNote}).`
      )
    }
  }

  // 11. Handle unavailable requested slot vs available slots
  if (bookingIntent.requestedUnavailableSlot) {
    if (slots.length > 0) {
      const slot1 = slots[0]?.shortLabel
      const slot2 = slots[1]?.shortLabel
      parts.push(
        `We don't have **${
          bookingIntent.requestedSummary || 'that exact window'
        }** open on our Cal.com schedule right now, ${firstName}, but we do have **${slot1}** (Reply 1)${
          slot2 ? ` or **${slot2}** (Reply 2)` : ''
        } available. Would either of those work?`
      )
    } else {
      parts.push(
        `Our live Cal.com schedule has no open inspection slots over the next 5 days, ${firstName}. Would you like our dispatcher to place you on the priority standby list?`
      )
    }
  } else if (!bookingIntent.negated) {
    if (slots.length >= 2) {
      parts.push(
        `I just checked our Cal.com calendar—we have **${slots[0].shortLabel}** (Reply 1) or **${slots[1].shortLabel}** (Reply 2) open. Which window works best for you?`
      )
    } else if (slots.length === 1) {
      parts.push(
        `I just checked our Cal.com calendar—our next open window is **${slots[0].shortLabel}** (Reply 1 to lock it in).`
      )
    }
  }

  return {
    replyText: parts.join(' '),
    citations: topCitations.slice(0, 3),
    matchedService,
    bookingIntent: { wantsToBook: false, matchedSlot: null },
  }
}
