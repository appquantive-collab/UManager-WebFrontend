import { useEffect, useState, type InputHTMLAttributes } from "react";

/**
 * Number box that behaves like a shopkeeper expects: it can be emptied, never
 * keeps a stuck leading zero ("045" → "45"), and still allows "0.5".
 * The parent gets a number (empty = 0).
 */
export function DecimalInput({
  value,
  onValue,
  ...props
}: { value: number; onValue: (n: number) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  const [text, setText] = useState(value ? String(value) : "");

  // Follow outside changes (e.g. unit switch recalculating the price).
  useEffect(() => {
    setText((current) => (Number(current || 0) === value ? current : value ? String(value) : ""));
  }, [value]);

  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        let next = e.target.value.replace(/,/g, ".").replace(/[^\d.]/g, "");
        const dot = next.indexOf(".");
        if (dot !== -1) next = next.slice(0, dot + 1) + next.slice(dot + 1).replace(/\./g, "");
        next = next.replace(/^0+(?=\d)/, ""); // "045" → "45", "0.5" stays
        setText(next);
        onValue(Number(next) || 0);
      }}
    />
  );
}
