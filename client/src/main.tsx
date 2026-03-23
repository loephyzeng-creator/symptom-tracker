import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerServiceWorker } from "./lib/registerSW";

// Register PWA service worker
registerServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
