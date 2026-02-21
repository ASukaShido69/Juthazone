import { useState, useRef, useEffect } from 'react'
import { useTheme, getZonePalettes } from '../contexts/ThemeContext'

// ═══════════════════════════════════════════
// THEME PICKER — Floating color palette selector
// แผ่นสีลอยตัว สวยงาม พร้อม preview สด
// ═══════════════════════════════════════════

export default function ThemePicker({ zone = 'red' }) {
  const { setTheme, getCurrentPalette, setActiveZone } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef(null)

  const currentPalette = getCurrentPalette(zone)
  const palettes = getZonePalettes(zone)

  // Set active zone on mount
  useEffect(() => {
    setActiveZone(zone)
  }, [zone, setActiveZone])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  const handleSelect = (paletteId) => {
    setTheme(zone, paletteId)
    setIsOpen(false)
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999]" ref={panelRef}>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative w-14 h-14 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${currentPalette.colors.gradient1}, ${currentPalette.colors.gradient2}, ${currentPalette.colors.gradient3})`,
        }}
        title="เปลี่ยนธีมสี"
      >
        <span className="text-xl drop-shadow-md relative z-10">🎨</span>
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-all" />
        {/* Pulse ring */}
        <div
          className="absolute inset-0 rounded-2xl animate-ping opacity-20"
          style={{ background: currentPalette.colors.primary, animationDuration: '3s' }}
        />
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          className="absolute bottom-[calc(100%+12px)] right-0 w-80 modal-in"
          style={{ transformOrigin: 'bottom right' }}
        >
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border overflow-hidden"
            style={{ borderColor: currentPalette.colors.cardBorder }}
          >
            {/* Header */}
            <div
              className="px-5 py-4 text-white"
              style={{
                background: `linear-gradient(135deg, ${currentPalette.colors.gradient1}, ${currentPalette.colors.gradient2})`,
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold drop-shadow-sm">🎨 เปลี่ยนธีมสี</h3>
                  <p className="text-xs text-white/80 mt-0.5">
                    {zone === 'blue' ? 'Blue Zone' : 'Red Zone'} — {currentPalette.name}
                  </p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/30 flex items-center justify-center text-sm font-bold transition-all"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Palette Grid */}
            <div className="p-4">
              <div className="grid grid-cols-3 gap-3">
                {palettes.map((palette) => {
                  const isActive = palette.id === currentPalette.id
                  return (
                    <button
                      key={palette.id}
                      onClick={() => handleSelect(palette.id)}
                      className={`group relative rounded-xl p-3 transition-all duration-200 hover:scale-105 active:scale-95 ${
                        isActive
                          ? 'ring-2 shadow-lg scale-105'
                          : 'hover:shadow-md border border-gray-100'
                      }`}
                      style={{
                        ringColor: isActive ? palette.colors.primary : undefined,
                        boxShadow: isActive ? `0 0 20px ${palette.colors.glow}` : undefined,
                      }}
                    >
                      {/* Color Preview */}
                      <div className="flex gap-1 mb-2 justify-center">
                        <div
                          className="w-6 h-6 rounded-lg shadow-sm transition-transform group-hover:scale-110"
                          style={{ background: palette.colors.gradient1 }}
                        />
                        <div
                          className="w-6 h-6 rounded-lg shadow-sm transition-transform group-hover:scale-110"
                          style={{ background: palette.colors.gradient2, transitionDelay: '0.05s' }}
                        />
                        <div
                          className="w-6 h-6 rounded-lg shadow-sm transition-transform group-hover:scale-110"
                          style={{ background: palette.colors.gradient3, transitionDelay: '0.1s' }}
                        />
                      </div>

                      {/* Gradient Preview Bar */}
                      <div
                        className="h-1.5 rounded-full mb-2"
                        style={{
                          background: `linear-gradient(to right, ${palette.colors.gradient1}, ${palette.colors.gradient2}, ${palette.colors.gradient3})`,
                        }}
                      />

                      {/* Name */}
                      <div className="text-[10px] font-bold text-center leading-tight truncate"
                        style={{ color: isActive ? palette.colors.primary : '#6b7280' }}
                      >
                        {palette.name}
                      </div>

                      {/* Active Indicator */}
                      {isActive && (
                        <div
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] shadow-md"
                          style={{ background: palette.colors.primary }}
                        >
                          ✓
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Footer Preview */}
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl shadow-md flex items-center justify-center text-white text-sm font-bold"
                  style={{
                    background: `linear-gradient(135deg, ${currentPalette.colors.gradient1}, ${currentPalette.colors.gradient2})`,
                  }}
                >
                  ✓
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-700">กำลังใช้: {currentPalette.name}</div>
                  <div className="flex items-center gap-1 mt-1">
                    {[currentPalette.colors.gradient1, currentPalette.colors.gradient2, currentPalette.colors.gradient3].map((c, i) => (
                      <div key={i} className="w-3 h-3 rounded-full shadow-sm" style={{ background: c }} />
                    ))}
                    <span className="text-[10px] text-gray-400 ml-1">{currentPalette.colors.primary}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
