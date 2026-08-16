import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Apply the saved theme before first paint to avoid a light-mode flash
function applyInitialTheme() {
  try {
    const saved = window.localStorage.getItem('hesabyar:theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch {
    // ignore
  }
}
applyInitialTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
