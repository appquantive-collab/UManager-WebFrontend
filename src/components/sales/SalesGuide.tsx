import { useTranslation } from "react-i18next";
import { BellRing, ClipboardList, ReceiptText, Wallet } from "lucide-react";
import { PageGuide } from "../page/kit";

// Plain-language walkthrough of the sales flow: order → bill → payment → reminder.
export function SalesGuide({ onNewOrder, onNewSale }: { onNewOrder: () => void; onNewSale: () => void }) {
  const { t } = useTranslation();
  return (
    <PageGuide
      storageKey="sales"
      title={t("sales.guide.title")}
      subtitle={t("sales.guide.subtitle")}
      stepLabel={(number) => t("sales.guide.step", { number })}
      steps={[
        {
          icon: ClipboardList,
          tone: "info",
          title: t("sales.guide.steps.order.title"),
          body: t("sales.guide.steps.order.body"),
          action: { label: t("sales.guide.newOrder"), onClick: onNewOrder },
        },
        {
          icon: ReceiptText,
          tone: "primary",
          title: t("sales.guide.steps.bill.title"),
          body: t("sales.guide.steps.bill.body"),
          action: { label: t("sales.guide.newSale"), onClick: onNewSale },
        },
        { icon: Wallet, tone: "success", title: t("sales.guide.steps.payment.title"), body: t("sales.guide.steps.payment.body") },
        { icon: BellRing, tone: "warning", title: t("sales.guide.steps.remind.title"), body: t("sales.guide.steps.remind.body") },
      ]}
      terms={(["order", "bill", "payment"] as const).map((term) => ({
        term: t(`sales.guide.terms.${term}.term`),
        meaning: t(`sales.guide.terms.${term}.meaning`),
      }))}
    />
  );
}
