import { useState, useRef, useEffect, useCallback, useMemo } from 'react'

// ═══════════════════════════════════════════════════════════════
//  THEME PICKER  ·  Color Studio  ·  Mobile-First + Draggable
//  ลากวางได้ทุกอุปกรณ์ — Mobile Bottom-Sheet เปิดจากปุ่ม
// ═══════════════════════════════════════════════════════════════

function hslToHex(h, s, l) {
  s /= 100; l /= 100
  const k = n => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('')
}

function buildPalette(h, s, l) {
  return {
    primary:    hslToHex(h, s, l),
    gradient1:  hslToHex(h, s, l),
    gradient2:  hslToHex((h + 22) % 360, Math.max(s - 5, 20), Math.min(l + 8, 75)),
    gradient3:  hslToHex((h + 44) % 360, Math.max(s - 12, 15), Math.min(l + 16, 80)),
    glow:       hslToHex(h, Math.min(s + 10, 100), Math.min(l + 10, 80)) + '90',
    bgFrom:     hslToHex(h, Math.max(s - 30, 20), Math.max(Math.min(l - 30, 22), 10)),
    bgVia:      hslToHex((h + 15) % 360, Math.max(s - 35, 15), Math.max(Math.min(l - 28, 25), 12)),
    bgTo:       hslToHex((h + 30) % 360, Math.max(s - 40, 10), Math.max(Math.min(l - 33, 20), 10)),
    cardBorder: hslToHex(h, s, l) + '55',
    text:       hslToHex(h, 20, 92),
    accent:     hslToHex((h + 180) % 360, s, l),
  }
}

const PRESETS = [
  { name: 'Ruby',      hue: 0,   sat: 85, lit: 52, icon: '🔴' },
  { name: 'Tangerine', hue: 22,  sat: 88, lit: 54, icon: '🟠' },
  { name: 'Gold',      hue: 45,  sat: 90, lit: 52, icon: '🟡' },
  { name: 'Jade',      hue: 145, sat: 78, lit: 50, icon: '🟢' },
  { name: 'Cyan',      hue: 185, sat: 82, lit: 50, icon: '🩵' },
  { name: 'Ocean',     hue: 210, sat: 80, lit: 52, icon: '🔵' },
  { name: 'Iris',      hue: 250, sat: 75, lit: 58, icon: '🟣' },
  { name: 'Orchid',    hue: 295, sat: 72, lit: 56, icon: '🌸' },
  { name: 'Rose',      hue: 335, sat: 80, lit: 56, icon: '💗' },
]

// ── Universal Draggable (mouse + touch, all devices) ────────────
function useDraggable(btnSize = 60) {
  const P = 14
  const getInit = () => {
    const W = typeof window !== 'undefined' ? window.innerWidth : 400
    const H = typeof window !== 'undefined' ? window.innerHeight : 800
    return { x: W - btnSize - P, y: H - btnSize - P - 20 }
  }
  const [pos, setPos] = useState(getInit)
  const [dragging, setDragging] = useState(false)
  const [didDrag, setDidDrag] = useState(false)
  const ref = useRef(null)

  // Re-init on resize
  useEffect(() => {
    const fn = () => {
      setPos(p => {
        const W = window.innerWidth, H = window.innerHeight
        return { x: Math.max(P, Math.min(W - btnSize - P, p.x)), y: Math.max(P, Math.min(H - btnSize - P, p.y)) }
      })
    }
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [btnSize])

  const onDown = useCallback((e) => {
    if (e.type === 'mousedown' && e.button !== 0) return
    const cx = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX
    const cy = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY
    ref.current = { sx: cx, sy: cy, ox: pos.x, oy: pos.y }
    setDidDrag(false)
    // Must preventDefault to stop scroll while dragging on touch
    e.preventDefault()
  }, [pos])

  useEffect(() => {
    const B = btnSize
    const snap = (x, y) => {
      const W = window.innerWidth, H = window.innerHeight
      // Snap to nearest horizontal edge
      const nx = x + B / 2 < W / 2 ? P : W - B - P
      const ny = Math.max(P, Math.min(H - B - P, y))
      return { x: nx, y: ny }
    }
    const move = (e) => {
      if (!ref.current) return
      const cx = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX
      const cy = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY
      const dx = cx - ref.current.sx, dy = cy - ref.current.sy
      if (!dragging && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        setDragging(true); setDidDrag(true)
      }
      if (dragging || Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        const W = window.innerWidth, H = window.innerHeight
        setPos({ x: Math.max(P, Math.min(W - B - P, ref.current.ox + dx)), y: Math.max(P, Math.min(H - B - P, ref.current.oy + dy)) })
        e.preventDefault()
      }
    }
    const up = () => {
      if (ref.current && dragging) setPos(p => snap(p.x, p.y))
      ref.current = null; setDragging(false)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('touchend', up)
    return () => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up)
      window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up)
    }
  }, [dragging, btnSize])

  return { pos, dragging, didDrag, setDidDrag, onDown }
}

// ── Hue Ring SVG ────────────────────────────────────────────────
function HueRing({ hue, onChange, size }) {
  const svgRef = useRef(null)
  const cx = size / 2, cy = size / 2
  const R = size / 2 - 20
  const THICK = Math.round(size * 0.1)
  const thumbR = Math.round(size * 0.058)

  const thumbAngle = (hue - 90) * (Math.PI / 180)
  const thumbX = cx + R * Math.cos(thumbAngle)
  const thumbY = cy + R * Math.sin(thumbAngle)

  const getHue = useCallback((e) => {
    if (!svgRef.current) return hue
    const rect = svgRef.current.getBoundingClientRect()
    const ex = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX
    const ey = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY
    let a = Math.atan2(ey - (rect.top + rect.height / 2), ex - (rect.left + rect.width / 2)) * (180 / Math.PI) + 90
    if (a < 0) a += 360
    return Math.round(a) % 360
  }, [hue])

  const active = useRef(false)
  const onDown = (e) => { active.current = true; onChange(getHue(e)); e.preventDefault() }
  useEffect(() => {
    const move = (e) => { if (active.current) { onChange(getHue(e)); e.preventDefault() } }
    const up = () => { active.current = false }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
    window.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', up)
    return () => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up)
      window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up)
    }
  }, [getHue, onChange])

  const segs = useMemo(() => Array.from({ length: 180 }, (_, i) => {
    const a1 = (i / 180) * 2 * Math.PI - Math.PI / 2
    const a2 = ((i + 1.4) / 180) * 2 * Math.PI - Math.PI / 2
    const r1 = R - THICK / 2, r2 = R + THICK / 2
    const p = (a, r) => `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`
    return { d: `M${p(a1,r1)} L${p(a1,r2)} L${p(a2,r2)} L${p(a2,r1)}Z`, color: `hsl(${Math.round(i*2)},88%,58%)` }
  }), [cx, cy, R, THICK])

  const hex = hslToHex(hue, 85, 55)
  const fs = Math.round(size * 0.058)

  return (
    <svg ref={svgRef} width={size} height={size}
      style={{ cursor: 'crosshair', touchAction: 'none', userSelect: 'none', display: 'block' }}
      onMouseDown={onDown} onTouchStart={onDown}>
      <defs>
        <radialGradient id={`tp_cg_${hue}`} cx="38%" cy="32%">
          <stop offset="0%" stopColor={hslToHex(hue, 90, 78)} />
          <stop offset="50%" stopColor={hslToHex(hue, 85, 52)} />
          <stop offset="100%" stopColor={hslToHex(hue, 72, 26)} />
        </radialGradient>
        <filter id="tp_glow2"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="tp_tg2"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      {segs.map((s, i) => <path key={i} d={s.d} fill={s.color} />)}
      <circle cx={cx} cy={cy} r={R - THICK / 2 - 2} fill="rgba(7,7,16,0.9)" />
      <circle cx={cx} cy={cy} r={R - THICK / 2 - 12} fill={`url(#tp_cg_${hue})`} filter="url(#tp_glow2)" />
      <text x={cx} y={cy - fs * 0.6} textAnchor="middle" fill="rgba(255,255,255,0.92)" fontSize={fs} fontWeight="800" fontFamily="monospace">{hex.toUpperCase()}</text>
      <text x={cx} y={cy + fs * 0.9} textAnchor="middle" fill="rgba(255,255,255,0.42)" fontSize={Math.round(fs * 0.82)} fontWeight="600">{hue}° hue</text>
      <circle cx={thumbX} cy={thumbY} r={thumbR + 5} fill={hex} opacity="0.25" />
      <circle cx={thumbX} cy={thumbY} r={thumbR} fill={hex} stroke="white" strokeWidth="3" filter="url(#tp_tg2)" />
      <circle cx={thumbX} cy={thumbY} r={thumbR * 0.38} fill="white" opacity="0.95" />
    </svg>
  )
}

// ── Gradient Slider ──────────────────────────────────────────────
function Slider({ label, value, min = 0, max = 100, fromColor, toColor, onChange, trackH = 28 }) {
  const trackRef = useRef(null)
  const active = useRef(false)
  const getVal = (e) => {
    const r = trackRef.current.getBoundingClientRect()
    const x = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX
    return Math.round(min + Math.max(0, Math.min(1, (x - r.left) / r.width)) * (max - min))
  }
  const onDown = (e) => { active.current = true; onChange(getVal(e)); e.preventDefault() }
  useEffect(() => {
    const move = (e) => { if (active.current) { onChange(getVal(e)); e.preventDefault() } }
    const up = () => { active.current = false }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
    window.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', up)
    return () => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up)
      window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up)
    }
  }, [])
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 700, letterSpacing: '0.1em' }}>{label}</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 800, fontFamily: 'monospace' }}>{value}%</span>
      </div>
      <div ref={trackRef} onMouseDown={onDown} onTouchStart={onDown}
        style={{ position: 'relative', height: trackH, borderRadius: trackH / 2, cursor: 'pointer',
          background: `linear-gradient(to right, ${fromColor}, ${toColor})`,
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)', userSelect: 'none', touchAction: 'none' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: trackH / 2, background: 'linear-gradient(to right,rgba(0,0,0,0.2),transparent)' }} />
        <div style={{
          position: 'absolute', top: '50%', left: `${pct}%`, transform: 'translate(-50%,-50%)',
          width: trackH + 8, height: trackH + 8, borderRadius: '50%',
          background: 'white', border: '3px solid rgba(255,255,255,0.95)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.5)', pointerEvents: 'none',
        }} />
      </div>
    </div>
  )
}

// ── Live Preview ────────────────────────────────────────────────
function Preview({ p }) {
  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', background: `linear-gradient(135deg, ${p.bgFrom}, ${p.bgVia}, ${p.bgTo})` }}>
      <div style={{ padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ flex: 1, borderRadius: 10, padding: '9px 11px', background: 'rgba(255,255,255,0.07)', border: `1px solid ${p.cardBorder}` }}>
          <div style={{ height: 6, borderRadius: 4, width: '72%', marginBottom: 5, background: `linear-gradient(to right, ${p.gradient1}, ${p.gradient2})`, boxShadow: `0 0 10px ${p.glow}` }} />
          <div style={{ height: 4, borderRadius: 3, width: '50%', marginBottom: 4, background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ height: 4, borderRadius: 3, width: '68%', background: 'rgba(255,255,255,0.12)' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ padding: '6px 12px', borderRadius: 9, fontSize: 11, fontWeight: 800, color: 'white', background: `linear-gradient(135deg, ${p.gradient1}, ${p.gradient2})`, boxShadow: `0 3px 12px ${p.glow}` }}>Action</div>
          <div style={{ padding: '6px 12px', borderRadius: 9, fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.09)', color: p.text, border: `1px solid ${p.cardBorder}` }}>Ghost</div>
        </div>
      </div>
      <div style={{ height: 3, background: `linear-gradient(to right, ${p.gradient1}, ${p.gradient2}, ${p.gradient3})` }} />
    </div>
  )
}

// ══════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════
export default function ThemePicker({ zone = 'red', onPaletteChange }) {
  const [hue, setHue] = useState(zone === 'blue' ? 210 : 0)
  const [sat, setSat] = useState(82)
  const [lit, setLit] = useState(53)
  const [isOpen, setIsOpen] = useState(false)
  const [tab, setTab] = useState('wheel')
  const [applied, setApplied] = useState(false)
  const [screenW, setScreenW] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 400)

  const isMobile = screenW < 640
  const btnSize = isMobile ? 60 : 56

  useEffect(() => {
    const fn = () => setScreenW(window.innerWidth)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  const { pos, dragging, didDrag, setDidDrag, onDown } = useDraggable(btnSize)
  const panelRef = useRef(null)
  const btnRef = useRef(null)

  const palette = useMemo(() => buildPalette(hue, sat, lit), [hue, sat, lit])
  useEffect(() => { onPaletteChange?.(palette) }, [palette])

  // Lock body scroll on mobile sheet
  useEffect(() => {
    document.body.style.overflow = (isMobile && isOpen) ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isMobile, isOpen])

  // Outside click close
  useEffect(() => {
    if (!isOpen) return
    const fn = (e) => {
      if (!isMobile && panelRef.current?.contains(e.target)) return
      if (btnRef.current?.contains(e.target)) return
      if (!isMobile) setIsOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [isOpen, isMobile])

  const handleApply = () => {
    const root = document.documentElement
    Object.entries({
      '--jz-primary': palette.primary, '--jz-gradient1': palette.gradient1,
      '--jz-gradient2': palette.gradient2, '--jz-gradient3': palette.gradient3,
      '--jz-glow': palette.glow, '--jz-bg-from': palette.bgFrom,
      '--jz-bg-via': palette.bgVia, '--jz-bg-to': palette.bgTo,
      '--jz-card-border': palette.cardBorder, '--jz-text': palette.text, '--jz-accent': palette.accent,
    }).forEach(([k, v]) => root.style.setProperty(k, v))
    setApplied(true)
    setTimeout(() => { setApplied(false); setIsOpen(false) }, 1400)
  }

  // Panel position for desktop/tablet (opens toward screen center)
  const desktopPanelStyle = useMemo(() => {
    if (typeof window === 'undefined') return {}
    const W = window.innerWidth, H = window.innerHeight, G = 10
    const openUp = pos.y + btnSize > H * 0.55
    const openLeft = pos.x + btnSize > W / 2
    const s = { position: 'fixed', zIndex: 9998 }
    s[openUp ? 'bottom' : 'top'] = openUp ? `${H - pos.y + G}px` : `${pos.y + btnSize + G}px`
    s[openLeft ? 'right' : 'left'] = openLeft ? `${W - pos.x - btnSize}px` : `${pos.x}px`
    return s
  }, [pos, btnSize])

  // Wheel size
  const wheelSize = isMobile ? Math.min(screenW - 56, 290) : 200

  const TABS = [{ id: 'wheel', label: '⬤ Wheel' }, { id: 'sliders', label: '≡ Sliders' }, { id: 'presets', label: '✦ Presets' }]

  // ── Shared panel content ────────────────────────────────────────
  const panelInner = (
    <>
      {isMobile && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 40, height: 4.5, borderRadius: 3, background: 'rgba(255,255,255,0.22)' }} />
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: isMobile ? 42 : 34, height: isMobile ? 42 : 34, borderRadius: 11, flexShrink: 0, background: `linear-gradient(135deg, ${palette.gradient1}, ${palette.gradient2})`, boxShadow: `0 0 16px ${palette.glow}` }} />
          <div>
            <div style={{ fontSize: isMobile ? 16 : 13, fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>Color Studio</div>
            <div style={{ fontSize: isMobile ? 11 : 10, color: 'rgba(255,255,255,0.4)', marginTop: 2, fontFamily: 'monospace', letterSpacing: '0.04em' }}>
              {palette.primary.toUpperCase()} · {hue}° {sat}% {lit}%
            </div>
          </div>
        </div>
        <button onClick={() => setIsOpen(false)} style={{
          width: isMobile ? 42 : 30, height: isMobile ? 42 : 30, borderRadius: 10, flexShrink: 0,
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.6)', fontSize: isMobile ? 16 : 13,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', padding: isMobile ? '12px 18px 0' : '10px 14px 0', gap: 6 }}>
        {TABS.map(t => {
          const on = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: isMobile ? '12px 0' : '8px 0', borderRadius: 11,
              fontSize: isMobile ? 13 : 11, fontWeight: 700, letterSpacing: '0.02em',
              cursor: 'pointer', transition: 'all 0.2s', WebkitTapHighlightColor: 'transparent',
              background: on ? `linear-gradient(135deg,${palette.gradient1}35,${palette.gradient2}20)` : 'transparent',
              border: on ? `1.5px solid ${palette.cardBorder}` : '1.5px solid rgba(255,255,255,0.06)',
              color: on ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.38)',
              boxShadow: on ? `0 0 16px ${palette.glow}` : 'none',
            }}>{t.label}</button>
          )
        })}
      </div>

      {/* Wheel tab */}
      {tab === 'wheel' && (
        <div style={{ padding: isMobile ? '20px 18px 8px' : '14px 16px 8px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <HueRing hue={hue} onChange={setHue} size={wheelSize} />
          </div>
          <p style={{ textAlign: 'center', fontSize: isMobile ? 12 : 10, color: 'rgba(255,255,255,0.3)', marginBottom: 16, letterSpacing: '0.06em' }}>
            ↻ ลากวงล้อเพื่อเลือกสี
          </p>
          <div style={{ display: 'flex', gap: isMobile ? 10 : 7, justifyContent: 'center', flexWrap: 'wrap', paddingBottom: 4 }}>
            {PRESETS.map(p => {
              const on = Math.abs(hue - p.hue) < 10
              return (
                <button key={p.hue} onClick={() => { setHue(p.hue); setSat(p.sat); setLit(p.lit) }} title={p.name}
                  style={{
                    width: isMobile ? 40 : 30, height: isMobile ? 40 : 30,
                    borderRadius: isMobile ? 12 : 9, border: 'none', cursor: 'pointer',
                    background: `linear-gradient(135deg, ${hslToHex(p.hue,p.sat,p.lit)}, ${hslToHex((p.hue+30)%360,p.sat-8,p.lit+8)})`,
                    outline: on ? '2.5px solid white' : '2.5px solid rgba(255,255,255,0.08)',
                    transform: on ? 'scale(1.28)' : 'scale(1)',
                    boxShadow: on ? `0 0 18px ${hslToHex(p.hue,90,62)}bb` : 'none',
                    transition: 'all 0.2s', WebkitTapHighlightColor: 'transparent',
                  }} />
              )
            })}
          </div>
        </div>
      )}

      {/* Sliders tab */}
      {tab === 'sliders' && (
        <div style={{ padding: isMobile ? '20px 18px 8px' : '16px 16px 8px' }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: isMobile ? 12 : 10, color: 'rgba(255,255,255,0.45)', fontWeight: 700, letterSpacing: '0.1em' }}>HUE</span>
              <span style={{ fontSize: isMobile ? 13 : 11, color: 'rgba(255,255,255,0.85)', fontWeight: 800, fontFamily: 'monospace' }}>{hue}°</span>
            </div>
            <div style={{ position: 'relative', height: isMobile ? 32 : 26, borderRadius: 16, overflow: 'visible', boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.5)' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: 16, background: `linear-gradient(to right, ${Array.from({length:13},(_,i)=>`hsl(${i*30},86%,57%)`).join(',')})` }} />
              <input type="range" min={0} max={359} value={hue} onChange={e => setHue(+e.target.value)}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 2 }} />
              <div style={{
                position: 'absolute', top: '50%', left: `${(hue / 359) * 100}%`,
                transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 3,
                width: isMobile ? 36 : 28, height: isMobile ? 36 : 28, borderRadius: '50%',
                background: hslToHex(hue, 85, 55), border: '3px solid white',
                boxShadow: `0 2px 12px rgba(0,0,0,0.45), 0 0 14px ${hslToHex(hue,90,65)}99`,
              }} />
            </div>
          </div>
          <Slider label="SATURATION" value={sat} min={20} max={100} fromColor={hslToHex(hue,20,lit)} toColor={hslToHex(hue,100,lit)} onChange={setSat} trackH={isMobile ? 30 : 24} />
          <Slider label="LIGHTNESS" value={lit} min={30} max={75} fromColor={hslToHex(hue,sat,30)} toColor={hslToHex(hue,sat,75)} onChange={setLit} trackH={isMobile ? 30 : 24} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginTop: 8, padding: isMobile ? '12px 14px' : '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {[['H',`${hue}°`],['S',`${sat}%`],['L',`${lit}%`],['HEX',palette.primary.toUpperCase()]].map(([k,v]) => (
              <div key={k} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 3, letterSpacing: '0.1em', fontWeight: 700 }}>{k}</div>
                <div style={{ fontSize: k==='HEX' ? 9 : (isMobile?13:11), color: 'white', fontWeight: 800, fontFamily: 'monospace' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Presets tab */}
      {tab === 'presets' && (
        <div style={{ padding: isMobile ? '20px 18px 8px' : '14px 16px 8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: isMobile ? 10 : 8 }}>
            {PRESETS.map(p => {
              const pal = buildPalette(p.hue, p.sat, p.lit)
              const on = Math.abs(hue - p.hue) < 10 && Math.abs(sat - p.sat) < 10
              return (
                <button key={p.hue} onClick={() => { setHue(p.hue); setSat(p.sat); setLit(p.lit) }} style={{
                  borderRadius: 14, overflow: 'hidden', cursor: 'pointer', padding: 0, background: 'transparent',
                  border: on ? `2px solid ${pal.primary}` : '2px solid rgba(255,255,255,0.07)',
                  transform: on ? 'scale(1.04)' : 'scale(1)',
                  boxShadow: on ? `0 0 22px ${pal.glow}` : 'none',
                  transition: 'all 0.22s', WebkitTapHighlightColor: 'transparent',
                }}>
                  <div style={{ height: isMobile ? 48 : 40, background: `linear-gradient(135deg, ${pal.gradient1}, ${pal.gradient2}, ${pal.gradient3})` }} />
                  <div style={{ height: isMobile ? 20 : 16, background: `linear-gradient(to right, ${pal.bgFrom}, ${pal.bgTo})` }} />
                  <div style={{ padding: isMobile ? '8px 4px 10px' : '6px 4px 8px', background: 'rgba(255,255,255,0.04)', textAlign: 'center' }}>
                    <div style={{ fontSize: isMobile ? 18 : 15, marginBottom: 2 }}>{p.icon}</div>
                    <div style={{ fontSize: isMobile ? 11 : 10, color: on ? 'white' : 'rgba(255,255,255,0.6)', fontWeight: 700, letterSpacing: '0.04em' }}>{p.name}</div>
                    {on && <div style={{ width: 5, height: 5, borderRadius: '50%', background: pal.primary, margin: '4px auto 0', boxShadow: `0 0 8px ${pal.glow}` }} />}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Preview */}
      <div style={{ padding: isMobile ? '14px 18px 8px' : '10px 16px 8px' }}>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 7 }}>LIVE PREVIEW</div>
        <Preview p={palette} />
      </div>

      {/* Color chips */}
      <div style={{ padding: isMobile ? '0 18px 12px' : '0 16px 10px', display: 'flex', gap: 5 }}>
        {[palette.gradient1, palette.gradient2, palette.gradient3, palette.accent, palette.bgFrom, palette.text].map((c, i) => (
          <div key={i} title={c} style={{ flex: 1, height: isMobile ? 26 : 22, borderRadius: 7, background: c, border: '1px solid rgba(255,255,255,0.1)', boxShadow: i < 3 ? `0 0 10px ${palette.glow}` : 'none' }} />
        ))}
      </div>

      {/* Apply */}
      <div style={{ padding: isMobile ? `0 18px max(20px, env(safe-area-inset-bottom))` : '0 16px 16px' }}>
        <button onClick={handleApply} style={{
          width: '100%', padding: isMobile ? '16px' : '13px', borderRadius: 13,
          border: 'none', cursor: 'pointer', fontSize: isMobile ? 15 : 14, fontWeight: 800,
          letterSpacing: '-0.01em', color: 'white',
          background: applied ? 'rgba(52,211,153,0.2)' : `linear-gradient(135deg, ${palette.gradient1}, ${palette.gradient2}, ${palette.gradient3})`,
          outline: applied ? '1.5px solid rgba(52,211,153,0.4)' : 'none',
          boxShadow: applied ? '0 0 24px rgba(52,211,153,0.35)' : `0 4px 24px ${palette.glow}`,
          transition: 'all 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          WebkitTapHighlightColor: 'transparent', minHeight: isMobile ? 54 : 44,
        }}>
          {applied ? <><span style={{fontSize:18}}>✓</span> Applied!</> : <><span style={{fontSize:18}}>⬤</span> Apply Theme</>}
        </button>
      </div>
    </>
  )

  const conicBg = `conic-gradient(from ${hue}deg, ${Array.from({length:7},(_,i)=>`hsl(${(hue+i*51)%360},85%,58%)`).join(',')})`

  return (
    <>
      {/* ═══ Floating Button — draggable on ALL devices ═══ */}
      <button
        ref={btnRef}
        onMouseDown={onDown}
        onTouchStart={onDown}
        onClick={() => { if (didDrag) { setDidDrag(false); return }; setIsOpen(p => !p) }}
        aria-label="Color Studio"
        style={{
          position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999,
          width: btnSize, height: btnSize, borderRadius: Math.round(btnSize * 0.31),
          border: 'none', padding: 0, background: conicBg,
          boxShadow: `0 0 0 2.5px rgba(255,255,255,0.2), 0 6px 24px ${palette.glow}, 0 12px 48px ${palette.glow}`,
          cursor: dragging ? 'grabbing' : 'grab',
          transform: dragging ? 'scale(1.16)' : isOpen ? 'scale(1.07)' : 'scale(1)',
          transition: 'box-shadow 0.3s, transform 0.18s',
          userSelect: 'none', touchAction: 'none', WebkitTapHighlightColor: 'transparent',
        }}
      >
        <div style={{
          position: 'absolute', inset: 6, borderRadius: Math.round(btnSize * 0.2),
          background: 'rgba(6,6,15,0.8)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: isMobile ? 22 : 20, pointerEvents: 'none',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.18)',
        }}>🎨</div>
        <div style={{ position: 'absolute', top: 5, left: '50%', transform: 'translateX(-50%)', width: 16, height: 2.5, borderRadius: 2, background: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: -4, borderRadius: btnSize / 2, background: `conic-gradient(from 0deg, transparent 55%, ${hslToHex(hue,90,65)}aa 72%, transparent 88%)`, animation: 'tp_spin 3s linear infinite', pointerEvents: 'none' }} />
      </button>

      {/* ═══ Mobile: Backdrop + Bottom Sheet ═══ */}
      {isMobile && isOpen && (
        <>
          <div onClick={() => setIsOpen(false)} className="tp_fadeIn"
            style={{ position: 'fixed', inset: 0, zIndex: 9997, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)' }} />
          <div ref={panelRef} className="tp_sheetUp"
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9998,
              borderRadius: '24px 24px 0 0',
              background: 'rgba(7,7,16,0.97)', backdropFilter: 'blur(32px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none',
              boxShadow: `0 -20px 60px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.12), 0 0 0 1px ${palette.cardBorder}`,
              maxHeight: '92vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
            }}>
            {panelInner}
          </div>
        </>
      )}

      {/* ═══ Tablet/Desktop: Floating Panel ═══ */}
      {!isMobile && isOpen && (
        <div ref={panelRef} style={desktopPanelStyle}>
          <div className="tp_panelIn" style={{
            width: 320, borderRadius: 20,
            background: 'rgba(7,7,16,0.95)', backdropFilter: 'blur(28px) saturate(170%)',
            border: '1px solid rgba(255,255,255,0.09)',
            boxShadow: `0 30px 80px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.1), 0 0 0 1px ${palette.cardBorder}`,
            overflow: 'hidden',
          }}>
            {panelInner}
          </div>
        </div>
      )}

      <style>{`
        @keyframes tp_spin   { to { transform: rotate(360deg); } }
        @keyframes tp_panelIn { from { opacity:0; transform:scale(0.88) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes tp_sheetUp { from { opacity:0; transform:translateY(110%); } to { opacity:1; transform:translateY(0); } }
        @keyframes tp_fadeIn  { from { opacity:0; } to { opacity:1; } }
        .tp_panelIn { animation: tp_panelIn 0.26s cubic-bezier(0.34,1.25,0.64,1) forwards; }
        .tp_sheetUp { animation: tp_sheetUp 0.32s cubic-bezier(0.34,1.12,0.64,1) forwards; }
        .tp_fadeIn  { animation: tp_fadeIn  0.22s ease forwards; }
      `}</style>
    </>
  )
}