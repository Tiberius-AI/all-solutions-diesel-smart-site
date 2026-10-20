// Generates crisp SVG data-URI previews with Vision AI bounding-box telemetry
// and pairs them with authentic All Solutions Diesel and Auto Repair shop photos.

export function createDamagePhotoSvg({
  title = '6.0L POWERSTROKE TURBO & FUEL RAIL SCAN',
  zone = 'ENGINE BAY SECTOR A-01 // HIGH-PRESSURE RAIL',
  confidence = '97.4%',
  accent = '#c93b2b',
  finding1 = 'EGR / Oil Cooler Delta & FICM Voltage Check',
  finding2 = 'Turbo VGT Actuator & Boost Hose Seal',
}) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" width="640" height="400">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="55%" stop-color="#1e293b"/>
        <stop offset="100%" stop-color="#090d16"/>
      </linearGradient>
      <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
        <path d="M0 32 L32 32 M32 0 L32 32" stroke="#334155" stroke-width="1" fill="none" opacity="0.45"/>
      </pattern>
    </defs>

    <!-- Background Engine Bay Schematic -->
    <rect width="640" height="400" fill="url(#bg)"/>
    <rect width="640" height="400" fill="url(#grid)"/>

    <!-- Turbocharger & Intake Manifold Silhouette -->
    <circle cx="210" cy="220" r="68" fill="#1e293b" stroke="#64748b" stroke-width="3"/>
    <circle cx="210" cy="220" r="34" fill="#0f172a" stroke="#94a3b8" stroke-width="2"/>
    <rect x="290" y="130" width="210" height="145" rx="10" fill="#1e293b" stroke="#475569" stroke-width="2.5"/>

    <!-- Glowing Amber High-Pressure Fuel & Electrical Lines -->
    <path d="M265,195 L320,165 L455,165 L485,220" stroke="#f59e0b" stroke-width="4" fill="none"/>
    <path d="M245,255 L340,245 L470,245" stroke="${accent}" stroke-width="3.5" fill="none"/>

    <!-- Vision AI Bounding Box 1 -->
    <rect x="280" y="120" width="230" height="96" rx="6" fill="none" stroke="${accent}" stroke-width="2.5" stroke-dasharray="8 4"/>
    <rect x="280" y="96" width="230" height="22" rx="4" fill="${accent}"/>
    <text x="288" y="111" fill="#ffffff" font-family="monospace" font-weight="bold" font-size="10">${finding1}</text>

    <!-- Vision AI Bounding Box 2 -->
    <rect x="132" y="142" width="156" height="156" rx="6" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="5 3"/>
    <rect x="132" y="120" width="185" height="20" rx="4" fill="#d97706"/>
    <text x="138" y="134" fill="#090d16" font-family="monospace" font-weight="bold" font-size="10">${finding2}</text>

    <!-- HUD Header Bar -->
    <rect x="14" y="14" width="612" height="34" rx="6" fill="#090d16" opacity="0.88" stroke="#334155" stroke-width="1"/>
    <circle cx="32" cy="31" r="5" fill="#22c55e"/>
    <text x="46" y="35" fill="#f8fafc" font-family="monospace" font-size="12" font-weight="bold">VISION-AI // ${title}</text>
    <text x="480" y="35" fill="#f59e0b" font-family="monospace" font-size="12" font-weight="bold">CONF: ${confidence}</text>

    <!-- Footer Telemetry -->
    <rect x="14" y="354" width="612" height="32" rx="6" fill="#090d16" opacity="0.88" stroke="#1e293b"/>
    <text x="26" y="374" fill="#94a3b8" font-family="monospace" font-size="11">${zone}</text>
    <text x="415" y="374" fill="#38bdf8" font-family="monospace" font-size="11">PRE-SCAN: READY FOR SHOP QUOTE</text>
  </svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export const SAMPLE_DAMAGE_PHOTOS = [
  {
    id: 'sample-diesel-dually',
    label: 'Heavy-Duty Diesel & 6.0 Powerstroke / Cummins',
    serviceMatch: 'Heavy-Duty Diesel & 6.0 Powerstroke Repair',
    estimatedRange: '$650 – $4,800',
    estimatedValue: 2450,
    urgency: 'High — Power Loss / Coolant or Fuel Issue',
    visionSummary:
      'Vision AI identified a heavy-duty dually diesel work truck requiring turbo/EGR/fuel-rail & electrical load diagnostics at our Spring Branch shop.',
    url: '/assets/diesel/photos/IMG_1169.jpg',
  },
  {
    id: 'sample-engine-bay',
    label: 'V8 / Diesel Engine Bay & Electrical Diagnosis',
    serviceMatch: 'Electrical Diagnosis & Check-Engine Troubleshooting',
    estimatedRange: '$125 – $350',
    estimatedValue: 225,
    urgency: 'High — Active Fault / Warning Light',
    visionSummary:
      'Engine bay inspection photo showing alternator, intake tract, battery/charging harness, and sensor routing ready for pinpoint electrical diagnosis.',
    url: '/assets/diesel/photos/suburban_2008.jpg',
  },
  {
    id: 'sample-transmission-clutch',
    label: 'Transmission, Clutch & Flywheel Assembly',
    serviceMatch: 'Transmission, Clutch & Drivetrain Service',
    estimatedRange: '$850 – $5,200',
    estimatedValue: 2950,
    urgency: 'High — Shifting / Drivetrain Issue',
    visionSummary:
      'Under-lift drivetrain inspection showing exposed flywheel/clutch assembly and bellhousing for transmission & drivetrain service.',
    url: '/assets/diesel/photos/IMG_5138.jpg',
  },
]

export const INITIAL_THREADS = [
  {
    id: 'thread-jorge',
    contactName: 'Jorge M.',
    phone: '(830) 481-2940',
    email: 'jorge.m@hillcountryfleets.com',
    address: '113 Remington Road Area, Spring Branch, TX 78070',
    zipVerified: true,
    propertyType: 'Commercial Fleet / Heavy-Duty Diesel',
    roofAge: '2019 Ram 3500 Dually & Ford F-350 6.0L',
    preferredWindow: 'Morning',
    unread: true,
    unreadCount: 2,
    lastActivity: '2m ago',
    channels: ['Webchat', 'SMS'],
    primaryChannel: 'SMS',
    aiStatus: 'ready_for_quote',
    opportunityStage: 'quote_sent',
    aiAutopilot: true,
    handoffMode: 'AI',
    alfredDraft: {
      id: 'draft-jorge-1',
      createdAt: '10:19 AM',
      reason:
        'Customer confirmed Morning appointment slot for 6.0 Powerstroke + Fleet Maintenance package ($650–$4,800 range).',
      text: 'Locked in, Jorge! We have your 6.0 Powerstroke & dually fleet truck scheduled for tomorrow at 9:00 AM at 113 Remington Road, Spring Branch (78070). Note: this demo booking is saved in Michael’s Tiberius inbox first and ready for shop handoff.',
    },
    jobSummary: {
      serviceNeeded: 'Heavy-Duty Diesel & 6.0 Powerstroke Repair',
      urgency: 'High — Fleet Truck Down / Boost & Electrical Fault',
      estimatedValue: 2450,
      estimatedRange: '$650 – $4,800',
      visionSummary:
        'Fleet owner uploaded photos of heavy-duty dually work truck and Class-8 semi intake. Reported 6.0 Powerstroke FICM/injector fault code plus scheduled fleet maintenance.',
      bookedSlot: null,
      reviewStage: 'none',
      photos: [
        {
          id: 'photo-jorge-1',
          caption: 'Heavy-Duty Dually Fleet Truck #02',
          url: '/assets/diesel/photos/IMG_1169.jpg',
          visionTag: 'Heavy Diesel & Electrical Scope',
        },
        {
          id: 'photo-jorge-2',
          caption: 'Commercial Semi Turbo & Intake Check',
          url: '/assets/diesel/photos/IMG_2949.jpg',
          visionTag: 'Fleet Maintenance Package',
        },
      ],
    },
    messages: [
      {
        id: 'm-1',
        sender: 'customer',
        channel: 'Webchat',
        timestamp: '10:14 AM',
        text: 'We run a local fleet in Spring Branch (78070). One of our 6.0 Powerstrokes is throwing an electrical/injector code under load, and our dually needs a full fleet maintenance check. What is your diagnostic & repair range?',
        photoUrl: '/assets/diesel/photos/IMG_1169.jpg',
        photoCaption:
          'Vision AI Pre-Scan: Heavy-Duty Diesel & 6.0 Powerstroke / Fleet Maintenance',
      },
      {
        id: 'm-2',
        sender: 'ai',
        channel: 'SMS',
        timestamp: '10:14 AM',
        text: 'Hi Jorge! This is Alfred, the AI assistant for All Solutions Diesel and Auto Repair in Spring Branch. We specialize in electrical diagnosis, fleet maintenance packages, heavy-duty diesels, and 6.0 Powerstrokes. (Note: During initial setup, AI lead capture routes to Michael’s Tiberius account first.)',
        kbCitations: [
          {
            id: 'kb-territory-zips',
            category: 'Service Territory',
            title: 'Spring Branch & Hill Country Coverage (78070)',
          },
        ],
      },
      {
        id: 'm-3',
        sender: 'ai',
        channel: 'SMS',
        timestamp: '10:15 AM',
        text: 'Pinpoint electrical & computer diagnosis runs $125–$350, and 6.0 Powerstroke / heavy-duty diesel repairs typically range from $650–$4,800 depending on whether it is a harness/FICM issue, EGR/oil cooler, or injectors. Services at 113 Remington Rd are by appointment only—would you like tomorrow at 9:00 AM or 1:30 PM?',
        kbCitations: [
          {
            id: 'kb-pricing-matrix',
            category: 'Pricing & Diagnostics',
            title: 'Heavy-Duty Diesel & 6.0 Powerstroke ($650–$4,800)',
          },
          {
            id: 'kb-calendar-sop',
            category: 'Cal.com Scheduling',
            title: 'Appointment-Only Shop Windows (Mon–Fri 9am–5pm)',
          },
        ],
      },
      {
        id: 'm-4',
        sender: 'customer',
        channel: 'SMS',
        timestamp: '10:18 AM',
        text: 'Tomorrow at 9:00 AM works great. I wouldn’t trust my fleet trucks to anyone else!',
      },
    ],
  },
  {
    id: 'thread-christina',
    contactName: 'Christina D.',
    phone: '(830) 624-8815',
    email: 'christina.d@springbranchtx.org',
    address: 'Spring Branch, TX 78070',
    zipVerified: true,
    propertyType: 'Personal / Family SUV',
    roofAge: '2008 Chevrolet Suburban 5.3L V8',
    preferredWindow: 'Afternoon',
    unread: true,
    unreadCount: 1,
    lastActivity: '9m ago',
    channels: ['Missed Call', 'SMS'],
    primaryChannel: 'Missed Call',
    aiStatus: 'needs_human',
    opportunityStage: 'qualifying',
    aiAutopilot: false,
    handoffMode: 'Human',
    alfredDraft: {
      id: 'draft-christina-1',
      createdAt: '9:59 AM',
      reason:
        'Private Alfred Draft prepared for full engine replacement + Synchrony Car Care financing inquiry ($5,400 est.).',
      text: 'Hi Christina! We reviewed your Suburban engine bay photo and voicemail. We can perform an on-site diagnostic check or schedule your Suburban into our Spring Branch bay for a full engine replacement ($1,800–$9,500 range), and you can use Synchrony Car Care Credit for convenient monthly payments.',
    },
    jobSummary: {
      serviceNeeded: 'Engine Repair & Full Engine Replacement',
      urgency: 'Critical — No-Start / Major Engine Replacement Scope',
      estimatedValue: 5400,
      estimatedRange: '$1,800 – $9,500',
      visionSummary:
        'Customer left voicemail regarding family SUV engine knock/no-start in Spring Branch and asked about full engine replacement + Synchrony Car Care Credit financing.',
      bookedSlot: null,
      reviewStage: 'none',
      photos: [
        {
          id: 'photo-christina-1',
          caption: 'Shop Bay Engine Drop & Replacement Reference',
          url: '/assets/diesel/photos/IMG_0971.jpg',
          visionTag: 'Full Engine Replacement Scope',
        },
        {
          id: 'photo-christina-2',
          caption: '2008 Chevrolet Suburban Engine Bay',
          url: '/assets/diesel/photos/suburban_2008.jpg',
          visionTag: 'V8 Powertrain & Electrical Check',
        },
      ],
    },
    messages: [
      {
        id: 'e-1',
        sender: 'system',
        channel: 'Missed Call',
        timestamp: '9:52 AM',
        eventType: 'missed_call',
        text: '📞 Missed Call from (830) 624-8815 — Instant Missed-Call Rescue SMS fired in 1.4s',
      },
      {
        id: 'e-2',
        sender: 'customer',
        channel: 'Missed Call',
        timestamp: '9:53 AM',
        voicemail: {
          duration: '0:24',
          transcript:
            '“Hi, this is Christina in Spring Branch. Our family SUV developed a severe bottom-end knock and won’t stay running. We need to know if you can diagnose and replace the engine, and if you accept Synchrony Car Care financing.”',
        },
        text: '🎙️ Audio Voicemail (0:24) — Auto-transcribed by AI Whisper',
      },
      {
        id: 'e-3',
        sender: 'ai',
        channel: 'SMS',
        timestamp: '9:53 AM',
        text: 'Hi Christina! Sorry we missed your call—our technicians are under a lift in the Spring Branch shop. I transcribed your voicemail about your SUV’s engine and Synchrony Car Care financing. Can you text a quick photo under the hood so our lead tech can review it right away?',
      },
      {
        id: 'e-4',
        sender: 'customer',
        channel: 'SMS',
        timestamp: '9:58 AM',
        text: 'Here is a photo under the hood. Can someone confirm the engine replacement process and send the Synchrony financing link?',
        photoUrl: '/assets/diesel/photos/suburban_2008.jpg',
        photoCaption: 'Vision AI Pre-Scan: V8 Engine Bay & Replacement Scope',
      },
      {
        id: 'e-5',
        sender: 'system',
        channel: 'SMS',
        timestamp: '9:58 AM',
        eventType: 'escalation',
        text: '🚨 Alfred AI flagged high-value Full Engine Replacement + Synchrony Financing inquiry ($5.4k est.) — Escalated to [🚨 Needs Human], paused Autopilot, and drafted a reply for approval.',
      },
    ],
  },
  {
    id: 'thread-travis',
    contactName: 'Travis K.',
    phone: '(830) 312-9044',
    email: 'travis@hillcountryexcavation.com',
    address: 'Bulverde / US-281 Corridor, TX 78163',
    zipVerified: true,
    propertyType: 'Construction & Heavy Equipment',
    roofAge: 'RAMVAC HX-12 Hydro-Vac & Dump Truck',
    preferredWindow: 'Flexible',
    unread: false,
    unreadCount: 0,
    lastActivity: '34m ago',
    channels: ['SMS'],
    primaryChannel: 'SMS',
    aiStatus: 'qualifying',
    aiAutopilot: true,
    handoffMode: 'Draft',
    alfredDraft: {
      id: 'draft-travis-1',
      createdAt: '9:32 AM',
      reason:
        'Alfred operating in "Write a reply for me to approve" (Draft Mode).',
      text: 'Hi Travis! Yes—we service commercial construction equipment, hydro-vac trucks, hydraulics, and air brakes at our 113 Remington Road shop in Spring Branch (78070). Fleet & air-brake packages typically run $250–$1,650. Would you like to book a Thursday morning appointment?',
    },
    jobSummary: {
      serviceNeeded: 'Fleet Maintenance Packages & Air Brakes',
      urgency: 'Scheduled Fleet Uptime',
      estimatedValue: 780,
      estimatedRange: '$250 – $1,650',
      visionSummary:
        'Contractor in Bulverde (78163) inquired about air brake service, hydraulic inspection, and preventative maintenance on a RAMVAC HX-12 truck.',
      bookedSlot: null,
      reviewStage: 'none',
      photos: [
        {
          id: 'photo-travis-1',
          caption: 'RAMVAC HX-12 Commercial Hydro-Vac Truck',
          url: '/assets/diesel/photos/IMG_7354.jpg',
          visionTag: 'Heavy Equipment & Air Brakes',
        },
      ],
    },
    messages: [
      {
        id: 'd-1',
        sender: 'customer',
        channel: 'SMS',
        timestamp: '9:30 AM',
        text: 'Hey, do you guys work on heavy construction equipment, hydraulics, and commercial air brakes near Bulverde / Spring Branch (78163)?',
      },
      {
        id: 'd-2',
        sender: 'ai',
        channel: 'SMS',
        timestamp: '9:30 AM',
        text: 'Hey Travis! Yes—at All Solutions Diesel and Auto Repair we work on commercial trucking fleets, air brakes, farm equipment, and construction equipment alongside heavy-duty diesels and personal vehicles. I drafted a quote summary for our shop lead to approve for you shortly!',
      },
    ],
  },
]
