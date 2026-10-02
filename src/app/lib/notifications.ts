import { toast } from "sonner";

// All three represent confirmed operations; color describes the action, not failure.
export const notify = {
  positive: (message: string) => toast.success(message, { className: "toast-positive" }),
  change: (message: string) => toast.success(message, { className: "toast-change" }),
  removal: (message: string) => toast.success(message, { className: "toast-removal" }),
};
