import "./polyfills";
import { createRoot } from "react-dom/client";
import SolanaProvider from "./providers/SolanaProvider";
import QueryProvider from "./providers/QueryProvider";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <QueryProvider>
    <SolanaProvider>
      <App />
    </SolanaProvider>
  </QueryProvider>,
);
