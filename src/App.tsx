import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AppLayout from "./components/dashboard/AppLayout.tsx";
import Dashboard from "./pages/app/Dashboard.tsx";
import Portfolio from "./pages/app/Portfolio.tsx";
import Marketplace from "./pages/app/Marketplace.tsx";
import SecurityDetail from "./pages/app/SecurityDetail.tsx";
import Governance from "./pages/app/Governance.tsx";
import Settlement from "./pages/app/Settlement.tsx";
import Settings from "./pages/app/Settings.tsx";

const App = () => (
  <TooltipProvider>
    <Sonner />
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="marketplace" element={<Marketplace />} />
          <Route path="marketplace/:mint" element={<SecurityDetail />} />
          <Route path="governance" element={<Governance />} />
          <Route path="settlement" element={<Settlement />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
