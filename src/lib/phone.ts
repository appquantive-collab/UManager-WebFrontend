/** Indian mobile numbers as WhatsApp/tel links want them (91XXXXXXXXXX), or null if unusable. */
export function indianMobile(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return null;
}

/** A wa.me link that opens WhatsApp with the message ready to send. */
export function whatsappLink(mobile: string, message: string): string {
  return `https://wa.me/${mobile}?text=${encodeURIComponent(message)}`;
}
