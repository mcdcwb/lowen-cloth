import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { BrowserRouter } from "react-router";
import { Toaster } from "./app/components/ui/sonner";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(<BrowserRouter>
  <App />
  <Toaster theme="light" position="top-right" duration={3500} visibleToasts={3} closeButton
    offset={{ top: 72, right: 24 }} mobileOffset={{ top: 72, left: 16, right: 16 }}
    containerAriaLabel="Notificações"
    toastOptions={{ closeButtonAriaLabel: "Fechar notificação", style: {
      fontFamily: "var(--font-sans)", padding: "12px 16px", boxShadow: "0 4px 12px rgb(0 0 0 / 0.06)",
    } }} />
</BrowserRouter>);
