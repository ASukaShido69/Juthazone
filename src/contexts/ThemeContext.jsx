import { createContext, useContext, useState, useEffect, useCallback } from 'react'

// ═══════════════════════════════════════════
// JUTHAZONE THEME SYSTEM
// แต่ละ zone (red/blue) มี theme palette แยกกัน
// เก็บค่าใน localStorage เพื่อจำค่าที่เลือกไว้
// ═══════════════════════════════════════════

// 🎨 Theme Palettes — แต่ละ palette มี CSS values ครบ
export const THEME_PALETTES = {
  // ════════ RED ZONE PALETTES ════════
  red: {
    id: 'red',
    name: '🔴 แดงคลาสสิค',
    zone: 'red',
    colors: {
      primary: '#dc2626',       // red-600
      primaryLight: '#fecaca',  // red-200
      primaryDark: '#991b1b',   // red-800
      accent: '#e11d48',        // rose-600
      accentLight: '#ffe4e6',   // rose-100
      gradient1: '#dc2626',     // from
      gradient2: '#e11d48',     // via
      gradient3: '#ef4444',     // to
      tableHeader1: '#dc2626',
      tableHeader2: '#e11d48',
      tableHeader3: '#b91c1c',
      rowAlt: 'rgba(254, 202, 202, 0.3)',
      rowHover: 'rgba(254, 202, 202, 0.5)',
      cardBorder: 'rgba(254, 202, 202, 0.3)',
      glow: 'rgba(239, 68, 68, 0.15)',
      glowStrong: 'rgba(239, 68, 68, 0.3)',
      badge: '#fef2f2',
      badgeText: '#b91c1c',
      inputBorder: '#fca5a5',
      inputFocus: '#ef4444',
      bgFrom: '#1a0505',
      bgVia: '#2d1010',
      bgTo: '#1a0808',
    }
  },
  rose: {
    id: 'rose',
    name: '🌹 โรสพิงค์',
    zone: 'red',
    colors: {
      primary: '#e11d48',
      primaryLight: '#ffe4e6',
      primaryDark: '#9f1239',
      accent: '#db2777',
      accentLight: '#fce7f3',
      gradient1: '#e11d48',
      gradient2: '#db2777',
      gradient3: '#ec4899',
      tableHeader1: '#e11d48',
      tableHeader2: '#db2777',
      tableHeader3: '#be123c',
      rowAlt: 'rgba(255, 228, 230, 0.3)',
      rowHover: 'rgba(255, 228, 230, 0.5)',
      cardBorder: 'rgba(255, 228, 230, 0.3)',
      glow: 'rgba(225, 29, 72, 0.15)',
      glowStrong: 'rgba(225, 29, 72, 0.3)',
      badge: '#fff1f2',
      badgeText: '#9f1239',
      inputBorder: '#fda4af',
      inputFocus: '#e11d48',
      bgFrom: '#1a0508',
      bgVia: '#2d0e14',
      bgTo: '#1a070a',
    }
  },
  orange: {
    id: 'orange',
    name: '🟠 ส้มสดใส',
    zone: 'red',
    colors: {
      primary: '#ea580c',
      primaryLight: '#fed7aa',
      primaryDark: '#9a3412',
      accent: '#dc2626',
      accentLight: '#ffedd5',
      gradient1: '#ea580c',
      gradient2: '#dc2626',
      gradient3: '#f97316',
      tableHeader1: '#ea580c',
      tableHeader2: '#dc2626',
      tableHeader3: '#c2410c',
      rowAlt: 'rgba(254, 215, 170, 0.3)',
      rowHover: 'rgba(254, 215, 170, 0.5)',
      cardBorder: 'rgba(254, 215, 170, 0.3)',
      glow: 'rgba(234, 88, 12, 0.15)',
      glowStrong: 'rgba(234, 88, 12, 0.3)',
      badge: '#fff7ed',
      badgeText: '#9a3412',
      inputBorder: '#fdba74',
      inputFocus: '#ea580c',
      bgFrom: '#1a0c02',
      bgVia: '#2d1608',
      bgTo: '#1a0f05',
    }
  },
  amber: {
    id: 'amber',
    name: '🟡 ทองอำพัน',
    zone: 'red',
    colors: {
      primary: '#d97706',
      primaryLight: '#fde68a',
      primaryDark: '#92400e',
      accent: '#b45309',
      accentLight: '#fef3c7',
      gradient1: '#d97706',
      gradient2: '#b45309',
      gradient3: '#f59e0b',
      tableHeader1: '#d97706',
      tableHeader2: '#b45309',
      tableHeader3: '#92400e',
      rowAlt: 'rgba(253, 230, 138, 0.3)',
      rowHover: 'rgba(253, 230, 138, 0.5)',
      cardBorder: 'rgba(253, 230, 138, 0.3)',
      glow: 'rgba(217, 119, 6, 0.15)',
      glowStrong: 'rgba(217, 119, 6, 0.3)',
      badge: '#fffbeb',
      badgeText: '#92400e',
      inputBorder: '#fcd34d',
      inputFocus: '#d97706',
      bgFrom: '#1a1002',
      bgVia: '#2d1c06',
      bgTo: '#1a1305',
    }
  },
  emerald: {
    id: 'emerald',
    name: '🟢 เขียวมรกต',
    zone: 'red',
    colors: {
      primary: '#059669',
      primaryLight: '#a7f3d0',
      primaryDark: '#065f46',
      accent: '#0d9488',
      accentLight: '#d1fae5',
      gradient1: '#059669',
      gradient2: '#0d9488',
      gradient3: '#10b981',
      tableHeader1: '#059669',
      tableHeader2: '#0d9488',
      tableHeader3: '#047857',
      rowAlt: 'rgba(167, 243, 208, 0.3)',
      rowHover: 'rgba(167, 243, 208, 0.5)',
      cardBorder: 'rgba(167, 243, 208, 0.3)',
      glow: 'rgba(5, 150, 105, 0.15)',
      glowStrong: 'rgba(5, 150, 105, 0.3)',
      badge: '#ecfdf5',
      badgeText: '#065f46',
      inputBorder: '#6ee7b7',
      inputFocus: '#059669',
      bgFrom: '#021a10',
      bgVia: '#082d1a',
      bgTo: '#051a12',
    }
  },
  purple: {
    id: 'purple',
    name: '🟣 ม่วงรอยัล',
    zone: 'red',
    colors: {
      primary: '#7c3aed',
      primaryLight: '#ddd6fe',
      primaryDark: '#5b21b6',
      accent: '#a855f7',
      accentLight: '#f3e8ff',
      gradient1: '#7c3aed',
      gradient2: '#a855f7',
      gradient3: '#8b5cf6',
      tableHeader1: '#7c3aed',
      tableHeader2: '#a855f7',
      tableHeader3: '#6d28d9',
      rowAlt: 'rgba(221, 214, 254, 0.3)',
      rowHover: 'rgba(221, 214, 254, 0.5)',
      cardBorder: 'rgba(221, 214, 254, 0.3)',
      glow: 'rgba(124, 58, 237, 0.15)',
      glowStrong: 'rgba(124, 58, 237, 0.3)',
      badge: '#faf5ff',
      badgeText: '#5b21b6',
      inputBorder: '#c4b5fd',
      inputFocus: '#7c3aed',
    }
  },

  // ════════ BLUE ZONE PALETTES ════════
  blue: {
    id: 'blue',
    name: '🔵 น้ำเงินคลาสสิค',
    zone: 'blue',
    colors: {
      primary: '#2563eb',
      primaryLight: '#bfdbfe',
      primaryDark: '#1e40af',
      accent: '#0891b2',
      accentLight: '#dbeafe',
      gradient1: '#2563eb',
      gradient2: '#0891b2',
      gradient3: '#0d9488',
      tableHeader1: '#2563eb',
      tableHeader2: '#0891b2',
      tableHeader3: '#0d9488',
      rowAlt: 'rgba(191, 219, 254, 0.3)',
      rowHover: 'rgba(191, 219, 254, 0.5)',
      cardBorder: 'rgba(191, 219, 254, 0.3)',
      glow: 'rgba(59, 130, 246, 0.15)',
      glowStrong: 'rgba(59, 130, 246, 0.3)',
      badge: '#eff6ff',
      badgeText: '#1e40af',
      inputBorder: '#93c5fd',
      inputFocus: '#2563eb',
      bgFrom: '#020a1a',
      bgVia: '#0a152d',
      bgTo: '#050d1a',
    }
  },
  cyan: {
    id: 'cyan',
    name: '🩵 ฟ้าอควา',
    zone: 'blue',
    colors: {
      primary: '#0891b2',
      primaryLight: '#a5f3fc',
      primaryDark: '#155e75',
      accent: '#0d9488',
      accentLight: '#cffafe',
      gradient1: '#0891b2',
      gradient2: '#0d9488',
      gradient3: '#06b6d4',
      tableHeader1: '#0891b2',
      tableHeader2: '#0d9488',
      tableHeader3: '#0e7490',
      rowAlt: 'rgba(165, 243, 252, 0.3)',
      rowHover: 'rgba(165, 243, 252, 0.5)',
      cardBorder: 'rgba(165, 243, 252, 0.3)',
      glow: 'rgba(8, 145, 178, 0.15)',
      glowStrong: 'rgba(8, 145, 178, 0.3)',
      badge: '#ecfeff',
      badgeText: '#155e75',
      inputBorder: '#67e8f9',
      inputFocus: '#0891b2',
      bgFrom: '#021518',
      bgVia: '#08232d',
      bgTo: '#05181a',
    }
  },
  teal: {
    id: 'teal',
    name: '🫧 เขียวน้ำทะเล',
    zone: 'blue',
    colors: {
      primary: '#0d9488',
      primaryLight: '#99f6e4',
      primaryDark: '#115e59',
      accent: '#059669',
      accentLight: '#ccfbf1',
      gradient1: '#0d9488',
      gradient2: '#059669',
      gradient3: '#14b8a6',
      tableHeader1: '#0d9488',
      tableHeader2: '#059669',
      tableHeader3: '#0f766e',
      rowAlt: 'rgba(153, 246, 228, 0.3)',
      rowHover: 'rgba(153, 246, 228, 0.5)',
      cardBorder: 'rgba(153, 246, 228, 0.3)',
      glow: 'rgba(13, 148, 136, 0.15)',
      glowStrong: 'rgba(13, 148, 136, 0.3)',
      badge: '#f0fdfa',
      badgeText: '#115e59',
      inputBorder: '#5eead4',
      inputFocus: '#0d9488',
      bgFrom: '#021a16',
      bgVia: '#082d24',
      bgTo: '#051a18',
    }
  },
  indigo: {
    id: 'indigo',
    name: '💎 คราม',
    zone: 'blue',
    colors: {
      primary: '#4f46e5',
      primaryLight: '#c7d2fe',
      primaryDark: '#3730a3',
      accent: '#6366f1',
      accentLight: '#e0e7ff',
      gradient1: '#4f46e5',
      gradient2: '#6366f1',
      gradient3: '#818cf8',
      tableHeader1: '#4f46e5',
      tableHeader2: '#6366f1',
      tableHeader3: '#4338ca',
      rowAlt: 'rgba(199, 210, 254, 0.3)',
      rowHover: 'rgba(199, 210, 254, 0.5)',
      cardBorder: 'rgba(199, 210, 254, 0.3)',
      glow: 'rgba(79, 70, 229, 0.15)',
      glowStrong: 'rgba(79, 70, 229, 0.3)',
      badge: '#eef2ff',
      badgeText: '#3730a3',
      inputBorder: '#a5b4fc',
      inputFocus: '#4f46e5',
      bgFrom: '#08051a',
      bgVia: '#110e2d',
      bgTo: '#0a071a',
    }
  },
  sky: {
    id: 'sky',
    name: '☁️ ฟ้าใส',
    zone: 'blue',
    colors: {
      primary: '#0284c7',
      primaryLight: '#bae6fd',
      primaryDark: '#075985',
      accent: '#0ea5e9',
      accentLight: '#e0f2fe',
      gradient1: '#0284c7',
      gradient2: '#0ea5e9',
      gradient3: '#38bdf8',
      tableHeader1: '#0284c7',
      tableHeader2: '#0ea5e9',
      tableHeader3: '#0369a1',
      rowAlt: 'rgba(186, 230, 253, 0.3)',
      rowHover: 'rgba(186, 230, 253, 0.5)',
      cardBorder: 'rgba(186, 230, 253, 0.3)',
      glow: 'rgba(2, 132, 199, 0.15)',
      glowStrong: 'rgba(2, 132, 199, 0.3)',
      badge: '#f0f9ff',
      badgeText: '#075985',
      inputBorder: '#7dd3fc',
      inputFocus: '#0284c7',
      bgFrom: '#020e1a',
      bgVia: '#081c2d',
      bgTo: '#05111a',
    }
  },
  violet: {
    id: 'violet',
    name: '💜 ไวโอเลต',
    zone: 'blue',
    colors: {
      primary: '#7c3aed',
      primaryLight: '#ddd6fe',
      primaryDark: '#5b21b6',
      accent: '#8b5cf6',
      accentLight: '#ede9fe',
      gradient1: '#7c3aed',
      gradient2: '#8b5cf6',
      gradient3: '#a78bfa',
      tableHeader1: '#7c3aed',
      tableHeader2: '#8b5cf6',
      tableHeader3: '#6d28d9',
      rowAlt: 'rgba(221, 214, 254, 0.3)',
      rowHover: 'rgba(221, 214, 254, 0.5)',
      cardBorder: 'rgba(221, 214, 254, 0.3)',
      glow: 'rgba(124, 58, 237, 0.15)',
      glowStrong: 'rgba(124, 58, 237, 0.3)',
      badge: '#f5f3ff',
      badgeText: '#5b21b6',
      inputBorder: '#c4b5fd',
      inputFocus: '#7c3aed',
      bgFrom: '#0f051a',
      bgVia: '#1a0e2d',
      bgTo: '#0d071a',
    }
  },
}

// Get palettes for a specific zone
export const getZonePalettes = (zone) =>
  Object.values(THEME_PALETTES).filter(p => p.zone === zone)

// Apply CSS custom properties to document root
const applyThemeVars = (colors) => {
  const root = document.documentElement.style
  root.setProperty('--jz-primary', colors.primary)
  root.setProperty('--jz-primary-light', colors.primaryLight)
  root.setProperty('--jz-primary-dark', colors.primaryDark)
  root.setProperty('--jz-accent', colors.accent)
  root.setProperty('--jz-accent-light', colors.accentLight)
  root.setProperty('--jz-gradient1', colors.gradient1)
  root.setProperty('--jz-gradient2', colors.gradient2)
  root.setProperty('--jz-gradient3', colors.gradient3)
  root.setProperty('--jz-table-h1', colors.tableHeader1)
  root.setProperty('--jz-table-h2', colors.tableHeader2)
  root.setProperty('--jz-table-h3', colors.tableHeader3)
  root.setProperty('--jz-row-alt', colors.rowAlt)
  root.setProperty('--jz-row-hover', colors.rowHover)
  root.setProperty('--jz-card-border', colors.cardBorder)
  root.setProperty('--jz-glow', colors.glow)
  root.setProperty('--jz-glow-strong', colors.glowStrong)
  root.setProperty('--jz-badge', colors.badge)
  root.setProperty('--jz-badge-text', colors.badgeText)
  root.setProperty('--jz-input-border', colors.inputBorder)
  root.setProperty('--jz-input-focus', colors.inputFocus)
  root.setProperty('--jz-bg-from', colors.bgFrom)
  root.setProperty('--jz-bg-via', colors.bgVia)
  root.setProperty('--jz-bg-to', colors.bgTo)
}

// Context
const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [redTheme, setRedTheme] = useState(() => {
    try { return localStorage.getItem('jz-theme-red') || 'red' } catch { return 'red' }
  })
  const [blueTheme, setBlueTheme] = useState(() => {
    try { return localStorage.getItem('jz-theme-blue') || 'blue' } catch { return 'blue' }
  })
  const [activeZone, setActiveZone] = useState(null) // which zone is currently displayed

  // Apply theme when zone/theme changes
  useEffect(() => {
    const themeId = activeZone === 'blue' ? blueTheme : redTheme
    const palette = THEME_PALETTES[themeId]
    if (palette) applyThemeVars(palette.colors)
  }, [activeZone, redTheme, blueTheme])

  const setTheme = useCallback((zone, themeId) => {
    if (zone === 'blue') {
      setBlueTheme(themeId)
      try { localStorage.setItem('jz-theme-blue', themeId) } catch {}
    } else {
      setRedTheme(themeId)
      try { localStorage.setItem('jz-theme-red', themeId) } catch {}
    }
  }, [])

  const getCurrentPalette = useCallback((zone) => {
    const id = zone === 'blue' ? blueTheme : redTheme
    return THEME_PALETTES[id] || THEME_PALETTES[zone === 'blue' ? 'blue' : 'red']
  }, [redTheme, blueTheme])

  return (
    <ThemeContext.Provider value={{
      redTheme,
      blueTheme,
      activeZone,
      setActiveZone,
      setTheme,
      getCurrentPalette,
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

export default ThemeContext
