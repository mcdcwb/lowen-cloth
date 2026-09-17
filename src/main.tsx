import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { BrowserRouter } from "react-router";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(<BrowserRouter><App /></BrowserRouter>);
