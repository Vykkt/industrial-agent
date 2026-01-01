import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import IndustrialLayout from "./components/IndustrialLayout";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Tickets from "./pages/Tickets";
import Tools from "./pages/Tools";
import Knowledge from "./pages/Knowledge";
import Analytics from "./pages/Analytics";

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => (
        <IndustrialLayout>
          <Dashboard />
        </IndustrialLayout>
      )} />
      <Route path="/chat" component={() => (
        <IndustrialLayout>
          <Chat />
        </IndustrialLayout>
      )} />
      <Route path="/tickets" component={() => (
        <IndustrialLayout>
          <Tickets />
        </IndustrialLayout>
      )} />
      <Route path="/tickets/:id" component={() => (
        <IndustrialLayout>
          <Tickets />
        </IndustrialLayout>
      )} />
      <Route path="/tools" component={() => (
        <IndustrialLayout>
          <Tools />
        </IndustrialLayout>
      )} />
      <Route path="/knowledge" component={() => (
        <IndustrialLayout>
          <Knowledge />
        </IndustrialLayout>
      )} />
      <Route path="/analytics" component={() => (
        <IndustrialLayout>
          <Analytics />
        </IndustrialLayout>
      )} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
