import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { usePlatform } from '../../context/usePlatform'
import { renderScrubFrame } from '../../utils/wireframeOrbitRenderer'
import ContextualAIDock from './ContextualAIDock'
import TiberiusHelperModal from './TiberiusHelperModal'
import VerifiedAuthorityBento from './VerifiedAuthorityBento'

gsap.registerPlugin(ScrollTrigger)

const TOTAL_FRAMES = 150

// Exact timeAt formula from reference/codex-original/packages/animation-engine/scroll-video.mjs
function timeAt(progress, duration = 8, fps = 24) {
  if (!Number.isFinite(duration) || duration <= 0) return 0
  const clamped = Math.min(1, Math.max(0, Number(progress) || 0))
  return clamped * Math.max(0, duration - 1 / fps)
}

export default function ClientWebsiteView() {
  const {
    activeTenant,
    activeLeadRoute,
    triggerMissedCallRescue,
    openHelperModal,
    setActiveView,
  } = usePlatform()

  const heroSectionRef = useRef(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const customFramesRef = useRef([])
  const folderInputRef = useRef(null)

  const [scrollProgress, setScrollProgress] = useState(0)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [motionPaused, setMotionPaused] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [pastHero, setPastHero] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [loadedWebpCount, setLoadedWebpCount] = useState(0)

  const seekingRef = useRef(false)
  const desiredTimeRef = useRef(0)
  const seekTimerRef = useRef(0)

  // Default to pure Codex video reveal ('video') if tenant has video; fallback to 'wireframe' only if no video
  const hasVideo = Boolean(
    activeTenant.media?.video ||
      activeTenant.id === 'all-solutions-diesel' ||
      activeTenant.id === 'scg-roofing'
  )
  const [engineMode, setEngineMode] = useState('video')
  const activeVisualMode = hasVideo && engineMode === 'video' ? 'video' : 'wireframe'

  const posterSrc =
    activeTenant.media?.poster || '/assets/diesel/poster.webp'
  const videoSrc =
    activeTenant.media?.video || '/videos/hero-scroll.mp4'
  const detailImgSrc =
    activeTenant.media?.detailImage || '/assets/diesel/photos/IMG_0971.jpg'
  const helperAvatarSrc =
    activeTenant.media?.helperAvatar || '/assets/diesel/photos/logo_rjpic.jpg'

  // Only preload 150-frame .webp sequence if explicitly configured and not in native MP4 video mode
  useEffect(() => {
    if (activeVisualMode === 'video' || !activeTenant.frameSequence?.enabled) {
      setLoadedWebpCount(0)
      return
    }
    let cancelled = false
    const frames = new Array(TOTAL_FRAMES)
    let loadedCount = 0

    const probeImg = new Image()
    const basePath = activeTenant.frameSequence?.basePath || '/sequences/default/frame_'
    probeImg.src = `${basePath}0001.webp`

    probeImg.onload = () => {
      if (cancelled) return
      for (let i = 0; i < TOTAL_FRAMES; i++) {
        const img = new Image()
        img.decoding = 'async'
        const padded = String(i + 1).padStart(4, '0')
        img.src = `${basePath}${padded}.webp`
        img.onload = () => {
          if (cancelled) return
          loadedCount += 1
          frames[i] = img
          customFramesRef.current = frames
          if (
            loadedCount === 1 ||
            loadedCount % 25 === 0 ||
            loadedCount === TOTAL_FRAMES
          ) {
            setLoadedWebpCount(loadedCount)
          }
        }
      }
    }

    probeImg.onerror = () => {
      if (!cancelled) setLoadedWebpCount(0)
    }

    return () => {
      cancelled = true
    }
  }, [activeTenant, activeVisualMode])

  const handleCustomFramesUpload = (e) => {
    const files = Array.from(e.target.files || []).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    )
    if (!files.length) return

    const frames = new Array(TOTAL_FRAMES)
    let loaded = 0
    files.slice(0, TOTAL_FRAMES).forEach((file, idx) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.decoding = 'async'
      img.src = url
      img.onload = () => {
        loaded += 1
        frames[idx] = img
        customFramesRef.current = frames
        setLoadedWebpCount(loaded)
        setEngineMode('wireframe')
      }
    })
  }

  // Exact Codex scroll-video.mjs seeking-locked video scrub + 150-frame canvas fallback
  useEffect(() => {
    const video = videoRef.current
    if (!video || activeVisualMode !== 'video') return

    const flushSeek = () => {
      if (motionPaused || seekingRef.current || video.readyState < 1) return
      const target = desiredTimeRef.current
      if (Math.abs(video.currentTime - target) < 1 / 48) {
        video.dataset.ready = 'true'
        setVideoReady(true)
        return
      }
      seekingRef.current = true
      window.clearTimeout(seekTimerRef.current)
      try {
        video.currentTime = target
      } catch {
        seekingRef.current = false
        return
      }
      seekTimerRef.current = window.setTimeout(() => {
        seekingRef.current = false
      }, 450)
    }

    const handleLoaded = () => {
      seekingRef.current = false
      window.clearTimeout(seekTimerRef.current)
      video.dataset.ready = 'true'
      setVideoReady(true)
      flushSeek()
    }

    const handleSeeked = () => {
      seekingRef.current = false
      window.clearTimeout(seekTimerRef.current)
      video.dataset.ready = 'true'
      setVideoReady(true)
      flushSeek()
    }

    video.addEventListener('loadedmetadata', handleLoaded)
    video.addEventListener('loadeddata', handleLoaded)
    video.addEventListener('canplay', handleLoaded)
    video.addEventListener('seeked', handleSeeked)

    if (video.readyState >= 1) {
      handleLoaded()
    }

    return () => {
      window.clearTimeout(seekTimerRef.current)
      video.removeEventListener('loadedmetadata', handleLoaded)
      video.removeEventListener('loadeddata', handleLoaded)
      video.removeEventListener('canplay', handleLoaded)
      video.removeEventListener('seeked', handleSeeked)
    }
  }, [activeVisualMode, videoSrc, motionPaused])

  // Sync wireframe canvas when in wireframe mode
  useEffect(() => {
    if (motionPaused || activeVisualMode !== 'wireframe') return
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return

    if (
      canvas.width !== Math.floor(rect.width * dpr) ||
      canvas.height !== Math.floor(rect.height * dpr)
    ) {
      canvas.width = Math.floor(rect.width * dpr)
      canvas.height = Math.floor(rect.height * dpr)
    }

    const ctx = canvas.getContext('2d')
    ctx.save()
    ctx.scale(dpr, dpr)
    renderScrubFrame(
      ctx,
      rect.width,
      rect.height,
      currentFrame,
      TOTAL_FRAMES,
      activeTenant,
      customFramesRef.current,
      false
    )
    ctx.restore()
  }, [currentFrame, activeVisualMode, activeTenant, motionPaused])

  // Native rAF scroll progress driver (starts scrubbing immediately from scrollY > 0 through the sticky hero track)
  useEffect(() => {
    const section = heroSectionRef.current
    if (!section) return

    let rafId = 0

    const updateOnScroll = () => {
      rafId = 0
      if (motionPaused) return

      const sticky = section.querySelector('.hero-sticky')
      const rect = section.getBoundingClientRect()
      const stickyHeight = sticky ? sticky.offsetHeight : window.innerHeight
      const totalScrollable = Math.max(
        1,
        section.offsetTop + section.offsetHeight - stickyHeight - 58
      )
      const p = Math.min(1, Math.max(0, window.scrollY / totalScrollable))

      section.dataset.progress = p.toFixed(3)
      section.style.setProperty('--scene-progress', String(p))

      const isPast = rect.bottom < 120
      setPastHero((prev) => (prev !== isPast ? isPast : prev))

      const video = videoRef.current
      if (activeVisualMode === 'video' && video) {
        const duration = Math.min(
          8,
          Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 8
        )
        desiredTimeRef.current = timeAt(p, duration, 24)
        if (!seekingRef.current && video.readyState >= 1) {
          if (Math.abs(video.currentTime - desiredTimeRef.current) > 1 / 48) {
            seekingRef.current = true
            window.clearTimeout(seekTimerRef.current)
            try {
              video.currentTime = desiredTimeRef.current
            } catch {
              seekingRef.current = false
            }
            seekTimerRef.current = window.setTimeout(() => {
              seekingRef.current = false
            }, 450)
          }
        }
      }

      setScrollProgress(p)
      setCurrentFrame(
        Math.min(TOTAL_FRAMES - 1, Math.max(0, Math.round(p * (TOTAL_FRAMES - 1))))
      )
    }

    const onScroll = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(updateOnScroll)
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    updateOnScroll()

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [activeTenant.id, activeVisualMode, motionPaused])

  const isDiesel = activeTenant.id === 'all-solutions-diesel'
  const isScg = activeTenant.id === 'scg-roofing'
  const brandWords = activeTenant.companyName.split(' ')
  const brandMain = isDiesel
    ? 'ALL SOLUTIONS'
    : isScg
      ? 'SCG'
      : brandWords[0]?.toUpperCase() || 'ALL SOLUTIONS'
  const brandSub = isDiesel
    ? 'DIESEL & AUTO REPAIR'
    : isScg
      ? 'ROOFING'
      : brandWords.slice(1).join(' ').toUpperCase() || activeTenant.niche.toUpperCase()

  const rawPhoneHref = `tel:${(activeTenant.phoneDisplay || '8303881458').replace(/[^0-9+]/g, '')}`

  const activeCallout = activeTenant.callouts?.find(
    (c) => scrollProgress >= c.startProgress && scrollProgress <= c.endProgress
  )

  return (
    <div
      className="codex-site-wrapper"
      style={{ '--accent': activeTenant.brandColor || '#c8232c' }}
    >
      <a className="skip" href="#main">
        Skip to content
      </a>

      {/* DEMO BAR */}
      <div className="demo-bar">
        <span>
          <b>TIBERIUS SMART SITES</b>
          <span className="demo-separator"> / </span>
          {activeTenant.companyName} ({activeTenant.city}) ·{' '}
          <strong>{activeLeadRoute?.badgeLabel || 'AI Leads → My Accounts'}</strong>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <a
            href={rawPhoneHref}
            style={{ fontWeight: 700 }}
            aria-label={`Call ${activeTenant.companyName} at ${activeTenant.phoneDisplay}`}
          >
            📞 {activeTenant.phoneDisplay}
          </a>
          <a
            href="#owner"
            onClick={(e) => {
              e.preventDefault()
              setActiveView('backoffice')
            }}
          >
            Owner sign-in <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>

      {/* SITE HEADER */}
      <header className="site-header">
        <a
          className="brand"
          href="#hero"
          aria-label={`${activeTenant.companyName} home`}
        >
          {isDiesel ? (
            <img
              src="/assets/diesel/photos/logo_rjpic.jpg"
              alt="All Solutions Diesel and Auto Repair"
              width="40"
              height="40"
              loading="eager"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                objectFit: 'cover',
                border: '1px solid rgba(200,35,44,0.35)',
              }}
            />
          ) : (
            <svg viewBox="0 0 48 40" aria-hidden="true">
              <path d="M3 30L24 8l21 22M12 30l12-12 12 12" />
            </svg>
          )}
          <span>
            {brandMain}
            <small>{brandSub}</small>
          </span>
        </a>

        <button
          className="menu-toggle"
          id="menu-toggle"
          type="button"
          aria-expanded={mobileMenuOpen}
          aria-controls="site-nav"
          aria-label="Open navigation"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
        >
          Menu <span aria-hidden="true">☰</span>
        </button>

        <nav
          id="site-nav"
          className={`site-nav ${mobileMenuOpen ? 'is-open' : ''}`}
          aria-label="Main navigation"
        >
          <a href="#services" onClick={() => setMobileMenuOpen(false)}>
            Services
          </a>
          <a href="#approach" onClick={() => setMobileMenuOpen(false)}>
            Mission &amp; Financing
          </a>
          <a href="#proof" onClick={() => setMobileMenuOpen(false)}>
            Shop Photos &amp; Reviews
          </a>
          <a href="#faqs" onClick={() => setMobileMenuOpen(false)}>
            FAQs
          </a>
          <a
            href={rawPhoneHref}
            onClick={() => setMobileMenuOpen(false)}
            style={{ fontWeight: 700 }}
          >
            {activeTenant.phoneDisplay}
          </a>
          <a
            className="mobile-contact"
            href="#inquiry"
            onClick={() => setMobileMenuOpen(false)}
          >
            Start an inquiry <span aria-hidden="true">↗</span>
          </a>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <a
            className="button button-small header-cta"
            href="#inquiry"
            data-engage="quote"
            data-cta
            onClick={(e) => {
              e.preventDefault()
              openHelperModal('quote')
            }}
          >
            Get a quote <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>

      <main id="main">
        {/* HERO SECTION */}
        <section
          ref={heroSectionRef}
          className="hero"
          id="hero"
          data-motion={motionPaused ? 'paused' : 'scroll'}
          data-progress={scrollProgress.toFixed(3)}
          style={{ '--scene-progress': String(scrollProgress) }}
          aria-labelledby="hero-title"
        >
          <div className="hero-sticky">
            <img
              className="hero-art"
              src={posterSrc}
              width="1280"
              height="720"
              fetchPriority="high"
              alt="Heavy-duty diesel truck in diagnostic service bay with turbocharger and fuel system cutaway reveal"
            />

            <video
              ref={videoRef}
              className="hero-video"
              src={videoSrc}
              data-ready={
                videoReady && activeVisualMode === 'video' ? 'true' : 'false'
              }
              muted
              playsInline
              preload="auto"
              disablePictureInPicture
              aria-hidden="true"
              tabIndex={-1}
              onLoadedData={() => setVideoReady(true)}
            />

            <canvas
              ref={canvasRef}
              className="hero-canvas"
              data-ready={activeVisualMode === 'wireframe' ? 'true' : 'false'}
              aria-hidden="true"
            />

            <div className="hero-shade"></div>

            <div className="hero-copy wrap">
              <p className="eyebrow">
                <span className="small-line"></span>{' '}
                {isDiesel
                  ? 'SPRING BRANCH, TX · 113 REMINGTON ROAD · (830) 388-1458'
                  : `${activeTenant.city.toUpperCase()} / ${activeTenant.niche.toUpperCase()}`}
              </p>

              <h1 id="hero-title">
                {isDiesel ? (
                  <>
                    Diesel, Auto &amp; Fleet{' '}
                    <br />
                    <em>Built for the Hill Country.</em>
                  </>
                ) : (
                  <>
                    {activeTenant.heroHeadline}
                    <br />
                    <em>{activeTenant.companyName}.</em>
                  </>
                )}
              </h1>

              <p className="hero-description">
                {activeTenant.heroSubheadline}
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                <a
                  className="button"
                  href="#inquiry"
                  data-cta
                  onClick={(e) => {
                    e.preventDefault()
                    openHelperModal('quote')
                  }}
                >
                  Request a diagnostic or quote <span aria-hidden="true">↗</span>
                </a>
                <a
                  className="button"
                  href={rawPhoneHref}
                  style={{
                    background: 'rgba(15, 23, 42, 0.78)',
                    border: '1px solid rgba(248, 250, 252, 0.28)',
                    color: '#F8FAFC',
                  }}
                >
                  Call {activeTenant.phoneDisplay}
                </a>
              </div>

              <div className="hero-proof">
                <ul
                  className="trust-indicators"
                  aria-label={`${activeTenant.companyName} published credentials`}
                >
                  {(
                    activeTenant.trustCredentials || [
                      { metric: 'Diesel & Auto', label: 'Full-service repair bay' },
                      { metric: 'Fleet & Heavy', label: 'Commercial & construction' },
                      { metric: '6 Mo. Financing', label: 'Synchrony Car Care™' },
                      { metric: '(830) 388-1458', label: 'Spring Branch, TX 78070' },
                    ]
                  ).map((cred, idx) => (
                    <li key={idx}>
                      <strong>{cred.metric}</strong>
                      <span>{cred.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Choreographed Value Callout (Subtle editorial card on scroll) */}
            {activeCallout && (
              <aside
                className="codex-scroll-callout"
                aria-label={activeCallout.title}
              >
                <span className="codex-callout-eyebrow">
                  {activeCallout.eyebrow} · {activeCallout.frameRange}
                </span>
                <strong>{activeCallout.title}</strong>
                <p>{activeCallout.body}</p>
                <small>{activeCallout.metric}</small>
              </aside>
            )}

            <div className="scene-meter" aria-hidden="true">
              <span></span>
            </div>

            <div className="hero-bottom wrap">
              <span>
                <i></i> HEAVY-DUTY DIESEL, GAS &amp; FLEET REPAIR · SPRING BRANCH, TX
              </span>
              <div className="motion-tools">
                <button
                  id="motion-toggle"
                  className="text-button"
                  type="button"
                  aria-pressed={motionPaused}
                  onClick={() => setMotionPaused((prev) => !prev)}
                >
                  {motionPaused ? 'Enable motion' : 'Pause motion'}
                </button>
                <span className="scroll-hint">
                  {scrollProgress >= 0.98
                    ? 'THE WHOLE PICTURE ↓'
                    : 'SCROLL TO REVEAL ↓'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* DEDICATED AI DOCK BAND (Below Hero so it never blocks hero content or video) */}
        <section
          className="hero-ai-dock-band"
          aria-label="Instant AI Quote & Diagnostic Dock"
        >
          <ContextualAIDock />
        </section>

        {/* 5.0-STAR VERIFIED AUTHORITY BENTO SECTION (Immediate Bridge Below Hero Track) */}
        <VerifiedAuthorityBento onOpenQuote={() => openHelperModal('quote')} />

        {/* HELP DOCK */}
        <div className="help-dock wrap" aria-label="Choose your next step">
          <button
            type="button"
            data-engage="chat"
            onClick={() => openHelperModal('chat')}
          >
            <span className="dock-icon">
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
            <span>
              <strong>Have a diesel or auto question?</strong>
              <small>Ask the AI shop assistant</small>
            </span>
            <span aria-hidden="true">↗</span>
          </button>

          <button
            type="button"
            data-engage="quote"
            onClick={() => openHelperModal('quote')}
          >
            <span className="dock-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 3h12v18H6zM9 7h6M9 11h6M9 15h2M14 15h1M9 18h2M14 18h1" />
              </svg>
            </span>
            <span>
              <strong>Need repair or fleet service?</strong>
              <small>Start your diagnostic or quote request</small>
            </span>
            <span aria-hidden="true">↗</span>
          </button>

          <button
            type="button"
            data-engage="booking"
            onClick={() => openHelperModal('booking')}
          >
            <span className="dock-icon">
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
            <span>
              <strong>Schedule by appointment</strong>
              <small>Book online or call {activeTenant.phoneDisplay}</small>
            </span>
            <span aria-hidden="true">↗</span>
          </button>
        </div>

        {/* DIESEL, AUTO & FLEET SERVICES */}
        <section className="roof-services wrap" id="services">
          <div className="roof-section-heading">
            <div>
              <p className="section-kicker">
                {activeTenant.niche} · Spring Branch, TX
              </p>
              <h2>
                {isDiesel ? (
                  <>
                    Diesel trucks, auto repair,{' '}
                    <br />
                    fleets &amp; heavy equipment.
                  </>
                ) : (
                  <>
                    Transparent scope &amp; pricing
                    <br />
                    for {activeTenant.city}.
                  </>
                )}
              </h2>
            </div>
            <p>
              From 6.0 Powerstroke, Duramax, and Cummins diagnostics to commercial fleet
              maintenance, transmissions, A/C, electrical, and heavy construction equipment —
              services by appointment at 113 Remington Road or via mobile house call.
            </p>
          </div>

          <div className="roof-service-layout">
            <div className="primary-services">
              {(activeTenant.pricingRules?.services || []).slice(0, 2).map((svc, idx) => (
                <a
                  key={svc.name}
                  href="#inquiry"
                  data-engage="quote"
                  data-service={svc.name}
                  className="primary-service"
                  onClick={(e) => {
                    e.preventDefault()
                    openHelperModal('quote', svc.name)
                  }}
                >
                  <span className="service-symbol">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      {idx === 0 ? (
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                      ) : (
                        <path d="m5 12 4 4L20 5" />
                      )}
                    </svg>
                  </span>
                  <div>
                    <h3>{svc.name}</h3>
                    <p>{svc.description}</p>
                    <span>
                      {svc.range} · Request quote <span aria-hidden="true">↗</span>
                    </span>
                  </div>
                </a>
              ))}
            </div>

            <figure className="roof-material">
              <img
                src={detailImgSrc}
                width="960"
                height="540"
                loading="eager"
                alt="All Solutions Diesel and Auto Repair shop bay with full powertrain and subframe service on lift"
              />
              <figcaption>
                Heavy-duty shop bay &amp; full powertrain capability in Spring Branch, TX.
                <small>
                  Authentic shop photograph · 113 Remington Road, Spring Branch, TX 78070
                </small>
              </figcaption>
            </figure>
          </div>

          <div className="service-grid">
            {(activeTenant.pricingRules?.services || []).slice(2).map((svc) => (
              <a
                key={svc.name}
                className="service-tile"
                href="#inquiry"
                data-engage="quote"
                data-service={svc.name}
                onClick={(e) => {
                  e.preventDefault()
                  openHelperModal('quote', svc.name)
                }}
              >
                <h3>
                  {svc.name} <span aria-hidden="true">↗</span>
                </h3>
                <p>
                  {svc.description} ({svc.range})
                </p>
              </a>
            ))}
          </div>
        </section>

        {/* MISSION, SHOP CAPABILITY & SYNCHRONY CAR CARE FINANCING */}
        <section className="roof-process structural-approach" id="approach">
          <div className="wrap roof-process-grid">
            <figure>
              <img
                src="/assets/diesel/photos/IMG_3841.jpg"
                width="960"
                height="540"
                loading="eager"
                alt="All Solutions Diesel and Auto Repair shop floor in Spring Branch, Texas with lifts, trucks, and service bays"
              />
              <figcaption>
                Inside All Solutions Diesel &amp; Auto Repair · 113 Remington Road, Spring Branch, TX
              </figcaption>
            </figure>
            <div>
              <p className="section-kicker">Our Mission &amp; Financing Options</p>
              <h2>
                Keeping the vehicles &amp; equipment that power our community on the road.
              </h2>
              <p className="process-intro">
                “To keep the heart of our community beating by ensuring the reliability and
                longevity of the vehicles and equipment that power our daily lives.” Whether you
                drive a heavy-duty diesel pickup, manage a commercial fleet, or need honest auto
                repair, our family-owned shop diagnoses the root cause before turning a wrench.
              </p>
              <ul className="structural-details">
                <li>
                  Diesel Engine Repair (6.0 Powerstroke, Duramax, Cummins, Semi &amp; Box Trucks)
                </li>
                <li>
                  Fleet Maintenance Packages &amp; Heavy Construction Equipment Service
                </li>
                <li>
                  Electrical Troubleshooting, Transmissions, A/C, Brakes, Tires &amp; Mobile House Calls
                </li>
              </ul>

              {/* Synchrony Car Care Financing Card */}
              <div
                style={{
                  marginTop: '20px',
                  padding: '16px',
                  borderRadius: '14px',
                  background: 'rgba(15, 23, 42, 0.05)',
                  border: '1px solid rgba(15, 23, 42, 0.12)',
                  display: 'grid',
                  gridTemplateColumns: 'minmax(110px, 150px) 1fr',
                  gap: '16px',
                  alignItems: 'center',
                }}
              >
                <img
                  src="/assets/diesel/photos/IMG_2500.jpg"
                  alt="Synchrony Car Care 6 Months Promotional Financing Available"
                  width="300"
                  height="220"
                  loading="eager"
                  style={{
                    width: '100%',
                    height: 'auto',
                    borderRadius: '8px',
                    objectFit: 'cover',
                  }}
                />
                <div>
                  <strong style={{ display: 'block', fontSize: '1rem', marginBottom: '4px' }}>
                    6 Months Promotional Financing Available*
                  </strong>
                  <p style={{ fontSize: '0.88rem', margin: '0 0 10px', opacity: 0.85 }}>
                    Big repair? Don’t sweat it. Apply for Synchrony Car Care™ financing for engine,
                    transmission, diesel, or fleet repairs.
                  </p>
                  <a
                    href={
                      activeTenant.financing?.applyUrl ||
                      'https://www.mysynchrony.com/mmc/NT237455907'
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontWeight: 700,
                      color: 'var(--accent, #c8232c)',
                      textDecoration: 'underline',
                    }}
                  >
                    Apply with Synchrony Car Care™ <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CUSTOMER PROOF & AUTHENTIC SHOP GALLERY */}
        <section
          className="customer-proof wrap"
          id="proof"
          aria-labelledby="proof-title"
        >
          <div className="proof-heading">
            <p className="section-kicker">
              From {activeTenant.companyName}’s shop bays &amp; customers
            </p>
            <h2 id="proof-title">
              Real trucks. Real heavy equipment.{' '}
              <br />
              Real Hill Country reviews.
            </h2>
          </div>

          <div className="proof-layout">
            <div className="project-showcase">
              {(activeTenant.projects || []).map((proj, idx) => (
                <figure key={`${proj.city}-${idx}`}>
                  <div className="project-photo">
                    <img
                      src={proj.image}
                      width="1100"
                      height="733"
                      loading="eager"
                      decoding="async"
                      alt={`${activeTenant.companyName} — ${proj.scope} in ${proj.city}`}
                    />
                  </div>
                  <figcaption>
                    <strong>{proj.scope}</strong> · {proj.city}
                  </figcaption>
                </figure>
              ))}
            </div>

            <div
              className="testimonial-section"
              aria-label={`Customer testimonials from ${activeTenant.companyName}`}
            >
              {(activeTenant.projects || []).slice(0, 4).map((proj, idx) => (
                <figure key={`${proj.author}-${idx}`}>
                  <blockquote>
                    <p>“{proj.quote}”</p>
                  </blockquote>
                  <figcaption>
                    <strong>{proj.author}</strong>
                    <span>{proj.scope}</span>
                    <small>Verified Customer · {proj.city}</small>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>

          <div className="proof-source">
            <span>
              Authentic shop photographs and customer reviews from All Solutions Diesel and Auto
              Repair in Spring Branch, TX.
            </span>
            <a
              href={activeTenant.existingWebsiteUrl || 'https://allsolutionsrepairs.com/'}
              target="_blank"
              rel="noopener noreferrer"
            >
              View original website (allsolutionsrepairs.com){' '}
              <span aria-hidden="true">↗</span>
              <span className="proof-sr"> (opens in a new tab)</span>
            </a>
          </div>
        </section>

        {/* QUOTE INVITATION */}
        <section
          className="quote-invitation wrap"
          aria-labelledby="quote-invite-title"
        >
          <div>
            <p className="section-kicker">Let’s talk about your truck, car, or fleet</p>
            <h2 id="quote-invite-title">
              Less guesswork.{' '}
              <br />A clearer diagnostic conversation.
            </h2>
            <p>
              Hearing a turbo whine, dealing with a rough idle, or planning scheduled maintenance
              for your work fleet? Ask our AI shop assistant or start a diagnostic request in
              under a minute.
            </p>
            <div className="invitation-actions">
              <button
                className="button"
                type="button"
                data-engage="quote"
                onClick={() => openHelperModal('quote')}
              >
                Request a quote{' '}
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
              <button
                className="quiet-button"
                type="button"
                data-engage="chat"
                onClick={() => openHelperModal('chat')}
              >
                Ask a question{' '}
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
              </button>
            </div>
            <small>
              Services by appointment only · Mon–Fri 9:00 AM – 5:00 PM · Call{' '}
              <a href={rawPhoneHref}>{activeTenant.phoneDisplay}</a>
            </small>
          </div>

          <div className="helper-feature">
            <img
              src={helperAvatarSrc}
              width="210"
              height="210"
              loading="eager"
              alt="All Solutions Diesel and Auto Repair emblem"
              style={{ borderRadius: '18px', objectFit: 'cover' }}
            />
            <div>
              <span>Hi, driver or fleet manager.</span>
              <p>
                What can we help
                <br />
                you diagnose today?
              </p>
              <button
                type="button"
                data-engage="chat"
                onClick={() => openHelperModal('chat')}
              >
                Start a conversation <span aria-hidden="true">↗</span>
              </button>
              <small>Ask the live diesel &amp; auto assistant</small>
            </div>
          </div>
        </section>

        {/* LOCAL QUESTIONS & FAQS */}
        <section className="local-questions">
          <div className="wrap local-questions-grid">
            <div className="local-business" id="service-area">
              <p className="section-kicker">Spring Branch &amp; Texas Hill Country</p>
              <h2>
                Based at 113 Remington Rd.{' '}
                <br />
                Shop &amp; Mobile Service.
              </h2>
              <p>
                {activeTenant.companyName} serves {activeTenant.city}, Canyon Lake, Bulverde,
                New Braunfels, Blanco, Boerne, and surrounding Comal County communities — with
                in-shop lifts and mobile house calls available.
              </p>
              <address>
                <strong>{activeTenant.companyName}</strong>
                <span>
                  {activeTenant.addressLine ||
                    '113 Remington Road, Spring Branch, TX 78070'}
                </span>
                <span>
                  <a href={rawPhoneHref} style={{ fontWeight: 700 }}>
                    {activeTenant.phoneDisplay}
                  </a>{' '}
                  · {activeTenant.email || 'info@allsolutionsrepairs.com'}
                </span>
                <span>
                  {activeTenant.hours ||
                    'Mon–Fri: 9:00 AM – 5:00 PM · Sat–Sun: Closed · Services by Appointment Only'}
                </span>
              </address>
            </div>

            <div className="home-questions" id="faqs">
              <h2>Common questions before you book.</h2>
              <div className="faq-list">
                {(activeTenant.faqs || []).map((faq) => (
                  <details key={faq.q}>
                    <summary>
                      {faq.q}
                      <span aria-hidden="true">+</span>
                    </summary>
                    <p>{faq.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* INQUIRY GRID */}
        <section
          className="section wrap inquiry-grid"
          id="inquiry"
          aria-labelledby="inquiry-title"
        >
          <div className="inquiry-copy">
            <p className="eyebrow">Your truck, car, or fleet. Your next step.</p>
            <h2 id="inquiry-title">
              Let’s get the{' '}
              <br />
              symptoms down.
            </h2>
            <p>
              Tell us your vehicle year, make, model, and what you’re experiencing — or call{' '}
              <a href={rawPhoneHref} style={{ fontWeight: 700 }}>
                {activeTenant.phoneDisplay}
              </a>{' '}
              directly.
            </p>
            <div className="expectations">
              <h3>A faster diagnostic handoff</h3>
              <ul>
                <li>Instant answers on diesel, auto, fleet &amp; heavy equipment service</li>
                <li>Structured quote &amp; diagnostic intake with photo upload</li>
                <li>
                  Active AI Lead Routing: <strong>{activeLeadRoute?.accountLabel}</strong>
                </li>
              </ul>
            </div>
            <p className="demo-note">
              {activeLeadRoute?.disclosureText ||
                'AI lead capture elements currently route to Michael’s Tiberius accounts for initial testing and will transition to All Solutions Diesel and Auto Repair.'}
            </p>
          </div>

          <div className="intake-shell live-intake-card">
            <img
              src={helperAvatarSrc}
              width="110"
              height="110"
              loading="eager"
              alt="All Solutions Diesel and Auto Repair assistant"
              style={{ borderRadius: '14px', objectFit: 'cover' }}
            />
            <h3>What can we help you diagnose?</h3>
            <p>
              Ask about 6.0 Powerstroke repair, diesel diagnostics, fleet maintenance, A/C,
              brakes, or Synchrony financing.
            </p>
            <button
              className="button"
              type="button"
              data-engage="chat"
              onClick={() => openHelperModal('chat')}
            >
              Ask the diesel &amp; auto assistant ↗
            </button>
            <button
              className="quiet-button"
              type="button"
              data-engage="quote"
              onClick={() => openHelperModal('quote')}
            >
              Use the quote &amp; diagnostic form
            </button>
            <button
              className="quiet-button"
              type="button"
              data-engage="booking"
              onClick={() => openHelperModal('booking')}
            >
              Schedule an appointment
            </button>
          </div>
        </section>

        {/* NATIVE CODEX .demo-lab FOR TESTING 150-FRAME .WEBP FALLBACK & MISSED CALL RESCUE */}
        <details className="demo-lab wrap">
          <summary>
            Tiberius Demo Lab · Video Scrubbing &amp; Missed-Call Rescue Controls
          </summary>
          <div>
            <span>
              Hero Engine:{' '}
              <strong>
                {activeVisualMode === 'video'
                  ? '24fps MP4 Scroll Video (hero-scroll.mp4)'
                  : `150-Frame .webp / 3D CAD Fallback (Frame ${currentFrame + 1}/${TOTAL_FRAMES})`}
              </strong>
              {loadedWebpCount > 0 && ` · ${loadedWebpCount} .webp frames loaded`}
            </span>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                setEngineMode((prev) => (prev === 'video' ? 'wireframe' : 'video'))
              }
            >
              Switch to{' '}
              {activeVisualMode === 'video'
                ? '150-Frame .webp / 3D CAD Fallback'
                : '24fps MP4 Video'}
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => folderInputRef.current?.click()}
            >
              Load local .webp sequence
            </button>
            <input
              ref={folderInputRef}
              type="file"
              aria-label="Upload custom webp frame sequence"
              accept="image/webp,image/png,image/jpeg"
              multiple
              hidden
              onChange={handleCustomFramesUpload}
            />
            <button
              type="button"
              className="text-button"
              onClick={() => triggerMissedCallRescue()}
            >
              Simulate Missed-Call Rescue SMS ({activeTenant.phoneDisplay})
            </button>
          </div>
        </details>
      </main>

      {/* FULL FOOTER */}
      <footer className="full-footer">
        <div className="wrap footer-grid">
          <div>
            <a
              className="brand"
              href="#hero"
              aria-label={`${activeTenant.companyName} home`}
            >
              {isDiesel ? (
                <img
                  src="/assets/diesel/photos/logo_rjpic.jpg"
                  alt="All Solutions Diesel and Auto Repair"
                  width="36"
                  height="36"
                  loading="eager"
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <svg viewBox="0 0 48 40" aria-hidden="true">
                  <path d="M3 30L24 8l21 22M12 30l12-12 12 12" />
                </svg>
              )}
              <span>
                {brandMain}
                <small>{brandSub}</small>
              </span>
            </a>
            <p>
              All Solutions Diesel and Auto Repair, LLC.
              <br />
              {activeTenant.city}.
            </p>
            <small>
              Smart Site powered by Tiberius Smart Sites.
              <br />
              Lead Capture Routing: {activeLeadRoute?.accountLabel}.
              <br />
              Shop gallery: authentic All Solutions photographs.
            </small>
          </div>

          <div>
            <h2>Explore</h2>
            <a href="#services">Diesel, Auto &amp; Fleet Services</a>
            <a href="#approach">Mission &amp; Synchrony Financing</a>
            <a href="#proof">Shop Gallery &amp; Reviews</a>
            <a href="#service-area">Location &amp; Hours</a>
            <a href="#faqs">Common Questions</a>
          </div>

          <div>
            <h2>Shop Contact &amp; Hours</h2>
            <p>
              <a href={rawPhoneHref} style={{ fontWeight: 700 }}>
                {activeTenant.phoneDisplay}
              </a>
              <br />
              {activeTenant.email || 'info@allsolutionsrepairs.com'}
            </p>
            <p>
              113 Remington Road
              <br />
              Spring Branch, TX 78070
              <br />
              Mon–Fri: 9:00 AM – 5:00 PM (By Appointment)
            </p>
            {activeTenant.socialLinks?.facebook && (
              <a
                href={activeTenant.socialLinks.facebook}
                target="_blank"
                rel="noopener noreferrer"
              >
                Facebook <span aria-hidden="true">↗</span>
              </a>
            )}
            {activeTenant.socialLinks?.instagram && (
              <a
                href={activeTenant.socialLinks.instagram}
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram <span aria-hidden="true">↗</span>
              </a>
            )}
            <a
              href="#owner"
              onClick={(e) => {
                e.preventDefault()
                setActiveView('backoffice')
              }}
            >
              Owner sign-in <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>

        <div className="wrap footer-bottom">
          <span>TIBERIUS SMART SITES / ALL SOLUTIONS DIESEL &amp; AUTO REPAIR</span>
          <a
            href={activeTenant.existingWebsiteUrl || 'https://allsolutionsrepairs.com/'}
            target="_blank"
            rel="noopener noreferrer"
          >
            allsolutionsrepairs.com <span aria-hidden="true">↗</span>
          </a>
          <span>{activeLeadRoute?.badgeLabel}</span>
        </div>
      </footer>

      {/* ENGAGEMENT TOOLS */}
      <div className="engagement-tools">
        <button
          className={`helper-launcher ${pastHero ? '' : 'is-hidden-in-hero'}`}
          type="button"
          aria-label="Open diesel & auto assistant"
          data-engage="chat"
          aria-haspopup="dialog"
          aria-controls="roof-helper"
          onClick={() => openHelperModal('chat')}
        >
          <img
            src={helperAvatarSrc}
            width="64"
            height="64"
            alt=""
            style={{ borderRadius: '50%', objectFit: 'cover' }}
          />
          <span>
            Diesel or auto questions?
            <strong>Let’s talk</strong>
          </span>
          <span className="launcher-icon">
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
        </button>

        <div className="mobile-contact-bar" aria-label="Quick contact">
          <a
            href={rawPhoneHref}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              textDecoration: 'none',
              color: '#ffffff',
              fontWeight: 600,
              minHeight: '48px',
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m7 3 3 5-3 2c1 3 4 6 7 7l2-3 5 3c0 3-2 5-5 4C9 19 5 15 3 8 2 5 4 3 7 3Z" />
            </svg>
            <span>Call {activeTenant.phoneDisplay}</span>
          </a>
          <button
            type="button"
            data-engage="text"
            onClick={() => openHelperModal('text')}
          >
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
            <span>Text / AI Quote</span>
          </button>
        </div>

        <TiberiusHelperModal />
      </div>
    </div>
  )
}
