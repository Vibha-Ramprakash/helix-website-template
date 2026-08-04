import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Helix from './helix.jsx'

// R3F puts className on a wrapper DIV, not the canvas. Inject after index.css so this wins.
const s = document.createElement('style')
s.textContent = `
  html, body, #root { height: auto !important; min-height: 100% !important; }
  .gl { position: fixed !important; top: 0 !important; left: 0 !important;
        width: 100vw !important; height: 100vh !important; z-index: 0 !important;
        display: block !important; }
  .gl > canvas { display: block !important; width: 100% !important; height: 100% !important; }
`
document.head.appendChild(s)

createRoot(document.getElementById('root')).render(<StrictMode><Helix /></StrictMode>)
