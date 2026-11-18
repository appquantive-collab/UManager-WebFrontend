import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AiChatPanel } from "../../components/ai/AiChatPanel";

/**
 * Phones: Munshi AI takes the whole screen like a WhatsApp chat, over the app's
 * top bar and bottom dock; only Munshi's own header shows. It follows the
 * visible area, so the message box sits right above the keyboard (iPhones
 * don't shrink the page for the keyboard, so the visual viewport is used).
 */
export function MobileAiCopilot() {
  const navigate = useNavigate();
  const [box, setBox] = useState<{ height: number; top: number } | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setBox({ height: vv.height, top: vv.offsetTop });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  // The page behind must not scroll while the chat covers it.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/app"));

  return (
    <div
      className="fixed inset-x-0 top-0 z-[100] flex h-dvh flex-col bg-surface"
      style={box ? { height: box.height, transform: `translateY(${box.top}px)` } : undefined}
    >
      <AiChatPanel onBack={back} />
    </div>
  );
}
