import { useEffect, useState } from "react";
import { emptyStoreDetails, storeDetailsRequest } from "../lib/store-settings";
export function useStoreDetails() {
  const [details, setDetails] = useState(emptyStoreDetails);
  useEffect(() => {
    let active = true;
    let pending: AbortController | null = null;
    async function load() {
      pending?.abort();
      const controller = new AbortController(); pending = controller;
      const timer = setTimeout(() => controller.abort(), 10000);
      try { const next = await storeDetailsRequest(undefined, undefined, controller.signal); if (active && !controller.signal.aborted) setDetails(next); }
      catch { if (active && !controller.signal.aborted) setDetails(emptyStoreDetails); }
      finally { clearTimeout(timer); }
    }
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    void load();
    window.addEventListener("focus", refresh);
    window.addEventListener("store-details-updated", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = setInterval(refresh, 30000);
    return () => { active = false; pending?.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("store-details-updated", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  return details;
}
