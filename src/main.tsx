// src/main.tsx - Updated with proper initialization
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Initialize services before rendering
async function initializeApp() {
  console.log('🚀 Initializing TruScope Professional...');

  // 1. Initialize cache service
  try {
    const { AdvancedCacheService } = await import('./services/advancedCacheService');
    const cache = AdvancedCacheService.getInstance();
    const stats = cache.getStats();
    console.log('📊 Cache initialized:', stats);
  } catch (error) {
    console.warn('⚠️ Cache initialization failed:', error);
  }

  // 2. Check API keys configuration
  try {
    const { getConfigurationStatus } = await import('./services/apiKeyService');
    const status = getConfigurationStatus();

    if (!status.hasGemini) {
      console.warn('⚠️ Gemini API key not configured. Please configure in Settings.');
    } else {
      console.log('✅ API keys configured:', `${status.configuredCount}/${status.totalKeys}`);
    }
  } catch (error) {
    console.warn('⚠️ API key check failed:', error);
  }

  // 3. Check browser compatibility
  const compatibility = {
    localStorage: typeof localStorage !== 'undefined',
    fetch: typeof fetch !== 'undefined',
    Promise: typeof Promise !== 'undefined',
    crypto: typeof crypto !== 'undefined'
  };

  const incompatibleFeatures = Object.entries(compatibility)
    .filter(([_, supported]) => !supported)
    .map(([feature]) => feature);

  if (incompatibleFeatures.length > 0) {
    console.error('❌ Browser compatibility issues:', incompatibleFeatures);
    alert(`Your browser does not support required features: ${incompatibleFeatures.join(', ')}`);
  } else {
    console.log('✅ Browser compatibility check passed');
  }

  console.log('✅ TruScope Professional initialized successfully');
}

// Initialize and render
initializeApp().then(() => {
  const rootElement = document.getElementById('root');

  if (!rootElement) {
    throw new Error('Root element not found');
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}).catch(error => {
  console.error('❌ Failed to initialize application:', error);
  document.body.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: system-ui, -apple-system, sans-serif; background: linear-gradient(to bottom right, #f8fafc, #e0e7ff);">
      <div style="text-align: center; max-width: 500px; padding: 2rem; background: white; border-radius: 1rem; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
        <div style="font-size: 3rem; margin-bottom: 1rem;">❌</div>
        <h1 style="color: #1e293b; margin: 0 0 0.5rem 0;">Initialization Failed</h1>
        <p style="color: #64748b; margin: 0 0 1rem 0;">TruScope Professional failed to start. Please refresh the page or contact support.</p>
        <button onclick="location.reload()" style="background: #4f46e5; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; cursor: pointer; font-weight: 600;">
          Reload Page
        </button>
        <details style="margin-top: 1rem; text-align: left;">
          <summary style="cursor: pointer; color: #64748b; font-size: 0.875rem;">Technical Details</summary>
          <pre style="background: #f1f5f9; padding: 0.5rem; border-radius: 0.25rem; overflow-x: auto; font-size: 0.75rem; margin-top: 0.5rem;">${error instanceof Error ? error.message : String(error)}</pre>
        </details>
      </div>
    </div>
  `;
});