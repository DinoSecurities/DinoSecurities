import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import ComplianceSimulator from "./pages/ComplianceSimulator.tsx";
import AppLayout from "./components/dashboard/AppLayout.tsx";
import Dashboard from "./pages/app/Dashboard.tsx";
import Portfolio from "./pages/app/Portfolio.tsx";
import Marketplace from "./pages/app/Marketplace.tsx";
import SecurityDetail from "./pages/app/SecurityDetail.tsx";
import Governance from "./pages/app/Governance.tsx";
import Settlement from "./pages/app/Settlement.tsx";
import Settings from "./pages/app/Settings.tsx";
import IssuerPortal from "./pages/app/IssuerPortal.tsx";
import CreateSeries from "./pages/app/CreateSeries.tsx";
import SanctionsOverrides from "./pages/app/SanctionsOverrides.tsx";
import BulkWhitelist from "./pages/app/BulkWhitelist.tsx";
import IssuerWebhooks from "./pages/app/IssuerWebhooks.tsx";
import XrplCredentials from "./pages/app/XrplCredentials.tsx";
import XrplWhitelist from "./pages/app/XrplWhitelist.tsx";
import SupplyReconciliation from "./pages/app/SupplyReconciliation.tsx";
import DinoTiers from "./pages/app/DinoTiers.tsx";
import WalletModal from "./components/wallet/WalletModal.tsx";
import XRPLanding from "./pages/XRPLanding.tsx";
import Embed from "./pages/Embed.tsx";

const App = () => (
  <TooltipProvider>
    <Sonner />
    <WalletModal />
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/xrp" element={<XRPLanding />} />
        <Route path="/compliance" element={<ComplianceSimulator />} />
        <Route path="/embed/:symbol" element={<Embed />} />
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="marketplace" element={<Marketplace />} />
          <Route path="marketplace/:mint" element={<SecurityDetail />} />
          <Route path="governance" element={<Governance />} />
          <Route path="settlement" element={<Settlement />} />
          <Route path="settings" element={<Settings />} />
          <Route path="issue" element={<IssuerPortal />} />
          <Route path="issue/create" element={<CreateSeries />} />
          <Route path="issue/overrides" element={<SanctionsOverrides />} />
          <Route path="issue/bulk-whitelist/:mint" element={<BulkWhitelist />} />
          <Route path="issue/webhooks/:mint" element={<IssuerWebhooks />} />
          <Route path="issue/xrpl-credentials" element={<XrplCredentials />} />
          <Route path="whitelist/xrpl/:mint" element={<XrplWhitelist />} />
          <Route path="admin/reconciliation" element={<SupplyReconciliation />} />
          <Route path="dino" element={<DinoTiers />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
