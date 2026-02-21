import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ThemeProvider } from './contexts/ThemeContext'
import './index.css'

// Preload critical font
const fontLink = document.createElement('link')
fontLink.rel = 'preload'
fontLink.href = 'https://fonts.googleapis.com/css2?family=Mali:wght@400;600;700&display=swap'
fontLink.as = 'style'
document.head.appendChild(fontLink)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
