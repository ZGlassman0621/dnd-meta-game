import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
// Tokens first: they only declare custom properties, so both stylesheets
// below can consume them regardless of cascade order.
import './styles/design-tokens.css'
import './index.css'
import './styles/creator-theme.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
