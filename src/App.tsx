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
// Governance page is fully implemented but hidden while we verify the
// realm + proposal + vote + execute flow end-to-end on mainnet.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Governance from "./pages/app/Governance.tsx";
import GovernanceComingSoon from "./pages/app/GovernanceComingSoon.tsx";
import Settlement from "./pages/app/Settlement.tsx";
import Settings from "./pages/app/Settings.tsx";
import IssuerPortal from "./pages/app/IssuerPortal.tsx";
import CreateSeries from "./pages/app/CreateSeries.tsx";
import WalletModal from "./components/wallet/WalletModal.tsx";
import XRPLanding from "./pages/XRPLanding.tsx";

const App = () => (
  <TooltipProvider>
    <Sonner />
    <WalletModal />
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/xrp" element={<XRPLanding />} />
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="marketplace" element={<Marketplace />} />
          <Route path="marketplace/:mint" element={<SecurityDetail />} />
          {/* Governance is wired end-to-end but unverified on mainnet —
              hidden from the sidebar and routed to a Coming Soon placeholder
              until we've run the realm + proposal + vote + execute E2E.
              Re-enable by restoring <Governance /> here. */}
          <Route path="governance" element={<GovernanceComingSoon />} />
          <Route path="settlement" element={<Settlement />} />
          <Route path="settings" element={<Settings />} />
          <Route path="issue" element={<IssuerPortal />} />
          <Route path="issue/create" element={<CreateSeries />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
