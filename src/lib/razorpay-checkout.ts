import type { CheckoutOrder } from "./billing-api";

interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", cb: (resp: { error?: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let loading: Promise<void> | null = null;

/** Razorpay's checkout script, loaded only when someone actually pays. */
function loadScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("Could not load Razorpay. Check your internet and try again."));
    };
    document.body.appendChild(script);
  });
  return loading;
}

export type CheckoutResult =
  | { status: "paid"; orderId: string; paymentId: string; signature: string }
  | { status: "dismissed" }
  | { status: "failed"; reason: string };

/** Opens Razorpay Checkout (UPI, cards, netbanking) for a server-created order. */
export async function openRazorpay(order: CheckoutOrder, opts: { description: string; color: string }): Promise<CheckoutResult> {
  await loadScript();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error("Could not load Razorpay. Check your internet and try again.");
  return new Promise<CheckoutResult>((resolve) => {
    let settled = false;
    const done = (r: CheckoutResult) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };
    const rzp = new Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: "SethSathi",
      description: opts.description,
      prefill: order.prefill,
      notes: { business: order.businessName },
      theme: { color: opts.color },
      handler: (resp: RazorpaySuccess) =>
        done({ status: "paid", orderId: resp.razorpay_order_id, paymentId: resp.razorpay_payment_id, signature: resp.razorpay_signature }),
      modal: { ondismiss: () => done({ status: "dismissed" }) },
    });
    rzp.on("payment.failed", (resp) => done({ status: "failed", reason: resp.error?.description ?? "" }));
    rzp.open();
  });
}
