import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { TooltipProvider } from "./components/ui/Tooltip";
import "./i18n";
import "./styles.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  // Provide an actionable error instead of a non-null assertion crash.
  throw new Error(
    'Root element "#root" was not found in the document. Ensure index.html contains <div id="root"></div>.',
  );
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <TooltipProvider delayDuration={200}>
      <App />
    </TooltipProvider>
  </React.StrictMode>,
);
