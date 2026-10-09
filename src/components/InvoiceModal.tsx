"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/LanguageProvider";
import { formatThousands } from "@/lib/money";
import type { DiscountScope, DiscountType } from "@/lib/discount";

// بيانات الفاتورة — تُبنى في صفحة النهاية (خادومية) وتُمرَّر هنا للعرض
// داخل النافذة المنبثقة ولميزة الطباعة.
export type InvoiceDiscount = {
  scope: DiscountScope;
  type: DiscountType;
  value: number;
  amount: number;
  note: string | null;
};

export type InvoiceData = {
  guest: string;
  phone: string | null;
  place: string;
  checkInText: string;
  checkOutText: string;
  issueDateText: string;
  durationText: string;
  billableHours: number;
  hourlyRate: number;
  sessionAmount: number;
  services: {
    name: string;
    price: number;
    units: number;
    total: number;
  }[];
  servicesTotal: number;
  /** المجموع قبل الخصم (رسوم الساعات + الخدمات). */
  grossTotal: number;
  /** الخصم المطبّق — null بلا خصم. */
  discount: InvoiceDiscount | null;
  /** المبلغ النهائي بعد الخصم. */
  total: number;
};

export function InvoiceModal({ invoice }: { invoice: InvoiceData }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  // قفل تمرير الصفحة خلف النافذة + إغلاق بزر Escape.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const currency = t("admin.currency");

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary invoice-open-btn mt-8 no-print"
        onClick={() => setOpen(true)}
      >
        {t("ended.invoice.view")}
      </button>

      {open && (
        <div className="invoice-modal" role="dialog" aria-modal="true" aria-label={t("ended.invoice.title")}>
          <div
            className="invoice-modal-overlay no-print"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="invoice-modal-dialog">
            <div className="invoice-modal-bar no-print">
              <button
                type="button"
                className="btn btn-ghost invoice-modal-close"
                onClick={() => setOpen(false)}
              >
                <span aria-hidden="true">✕</span>
                {t("ended.invoice.close")}
              </button>
              <button
                type="button"
                className="btn btn-primary invoice-modal-print"
                onClick={() => window.print()}
              >
                {t("ended.invoice.print")}
              </button>
            </div>

            {/* الفاتورة نفسها — تُطبع بمفردها */}
            <div className="invoice-sheet" id="invoice-sheet">
              <div className="invoice-sheet-head">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/v1-dark.svg"
                  alt="Focus Point"
                  width={71}
                  height={48}
                  className="h-11 w-auto object-contain"
                />
                <div className="text-end">
                  <p className="text-sm font-semibold text-primary">{t("ended.invoice.title")}</p>
                  <p className="text-xs text-muted">Focus Point</p>
                  <p className="tabula mt-0.5 text-[11px] text-muted" dir="ltr">
                    {invoice.issueDateText}
                  </p>
                </div>
              </div>

              {/* تفاصيل الإقامة */}
              <div className="invoice-stay">
                <h3 className="invoice-section-label">{t("ended.invoice.stay")}</h3>
                <dl className="invoice-rows">
                  <div className="invoice-row">
                    <dt>{t("ended.invoice.guest")}</dt>
                    <dd className="font-semibold text-foreground">
                      {invoice.guest}
                      {invoice.phone && (
                        <span className="ms-2 font-normal text-muted" dir="ltr">
                          {"· "}
                          {invoice.phone}
                        </span>
                      )}
                    </dd>
                  </div>
                  <div className="invoice-row">
                    <dt>{t("ended.invoice.place")}</dt>
                    <dd className="font-medium text-foreground">{invoice.place}</dd>
                  </div>
                  <div className="invoice-row">
                    <dt>{t("ended.invoice.checkIn")}</dt>
                    <dd className="tabular-nums text-foreground" dir="ltr">
                      {invoice.checkInText}
                    </dd>
                  </div>
                  <div className="invoice-row">
                    <dt>{t("ended.invoice.checkOut")}</dt>
                    <dd className="tabular-nums text-foreground" dir="ltr">
                      {invoice.checkOutText}
                    </dd>
                  </div>
                  <div className="invoice-row">
                    <dt>{t("ended.invoice.duration")}</dt>
                    <dd className="font-medium text-foreground">{invoice.durationText}</dd>
                  </div>
                </dl>
              </div>

              <div className="invoice-subrule" />

              {/* الرسوم */}
              <div className="invoice-fees">
                <h3 className="invoice-section-label">{t("ended.invoice.sessionFee")}</h3>
                <dl className="invoice-rows">
                  <div className="invoice-row">
                    <dt>{t("ended.invoice.hours")}</dt>
                    <dd className="font-semibold text-foreground">
                      {invoice.billableHours}{" "}
                      {t(
                        invoice.billableHours === 1
                          ? "ended.duration.hour"
                          : "ended.duration.hours"
                      )}
                    </dd>
                  </div>
                  <div className="invoice-row">
                    <dt>{t("ended.invoice.rate")}</dt>
                    <dd className="tabular-nums text-foreground" dir="ltr">
                      {formatThousands(invoice.hourlyRate)} {currency}
                    </dd>
                  </div>
                  <div className="invoice-row invoice-row-strong">
                    <dt>{t("ended.invoice.sessionFee")}</dt>
                    <dd className="tabular-nums font-semibold text-foreground" dir="ltr">
                      {formatThousands(invoice.sessionAmount)} {currency}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* جدول الخدمات المنفذة — محاذاة عمودية واضحة */}
              <div className="invoice-subrule" />
              <div className="invoice-services">
                <h3 className="invoice-section-label">{t("ended.invoice.services")}</h3>
                {invoice.services.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">
                    {t("ended.invoice.servicesEmpty")}
                  </p>
                ) : (
                  <table className="invoice-table mt-3 w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-start">{t("admin.col.service")}</th>
                        <th className="text-center">{t("admin.col.qty")}</th>
                        <th className="text-end">{t("admin.col.unitPrice")}</th>
                        <th className="text-end">{t("admin.col.lineTotal")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.services.map((s, idx) => (
                        <tr key={`${s.name}-${idx}`}>
                          <td className="py-1.5 font-medium text-foreground">{s.name}</td>
                          <td className="py-1.5 text-center tabular-nums text-foreground">
                            {s.units}
                          </td>
                          <td className="py-1.5 text-end tabular-nums text-muted" dir="ltr">
                            {formatThousands(s.price)} {currency}
                          </td>
                          <td className="py-1.5 text-end tabular-nums font-semibold text-foreground" dir="ltr">
                            {formatThousands(s.total)} {currency}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* الخصم — يظهر فقط إن وُجد (بين الخدمات والإجمالي) */}
              {invoice.discount && (
                <>
                  <div className="invoice-subrule" />
                  <div className="invoice-discount">
                    <h3 className="invoice-section-label">
                      {t("ended.invoice.discount")}
                    </h3>
                    <dl className="invoice-rows">
                      <div className="invoice-row invoice-row-discount">
                        <dt>{t("ended.invoice.discount")}</dt>
                        <dd className="tabular-nums font-semibold text-danger" dir="ltr">
                          − {formatThousands(invoice.discount.amount)} {currency}
                          <span className="invoice-discount-meta" dir="rtl">
                            {" ("}
                            {t(`admin.end.scope.${invoice.discount.scope}`)}
                            {" — "}
                            {t(`admin.end.type.${invoice.discount.type}`)}
                            {invoice.discount.type === "percent"
                              ? ` · ${formatThousands(invoice.discount.value)}${t("admin.end.valueSuffix.percent")}`
                              : ""}
                            {")"}
                          </span>
                        </dd>
                      </div>
                      {invoice.discount.note && (
                        <div className="invoice-row">
                          <dt>{t("ended.invoice.discountNote")}</dt>
                          <dd className="text-foreground">{invoice.discount.note}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </>
              )}

              {/* الإجمالي المستحق — أكبر عنصر بالفاتورة */}
              <div className="invoice-sheet-total">
                {invoice.discount && (
                  <span className="invoice-total-before tabular-nums" dir="ltr">
                    {t("ended.invoice.discountBefore")}:{" "}
                    {formatThousands(invoice.grossTotal)} {currency}
                  </span>
                )}
                <span className="invoice-total-label">
                  {t("ended.invoice.total")}
                </span>
                <span className="invoice-total-value tabular-nums" dir="ltr">
                  {formatThousands(invoice.total)} {currency}
                </span>
              </div>

              <p className="invoice-sheet-footer">{t("ended.invoice.footer")}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}