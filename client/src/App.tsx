import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Router as WouterRouter } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import { OfflineBanner } from "./components/OfflineBanner";

// Base path for GitHub Pages deployment
// import.meta.env.BASE_URL is set by vite.config.ts base option
// e.g. "/symptom-tracker/" -> strip trailing slash -> "/symptom-tracker"
const rawBase = import.meta.env.BASE_URL ?? "/";
const BASE_PATH = rawBase === "/" ? "" : rawBase.replace(/\/$/, "");

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                fontFamily: "'Noto Sans SC', sans-serif",
              },
            }}
          />
          <OfflineBanner />
          <WouterRouter base={BASE_PATH}>
            <Router />
          </WouterRouter>
          <PWAInstallPrompt />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
