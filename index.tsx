import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

/**
 * The main entry point for the React application.
 * It finds the root DOM element and renders the App component into it.
 */
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element with id 'root' to mount the application to.");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
