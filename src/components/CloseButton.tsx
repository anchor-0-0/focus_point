"use client";

import { forwardRef } from "react";

export const CloseButton = forwardRef<
  HTMLButtonElement,
  {
    onClose: () => void;
    ariaLabel: string;
    className?: string;
    disabled?: boolean;
  }
>(function CloseButton({ onClose, ariaLabel, className, disabled }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={className}
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onClose}
      disabled={disabled}
      style={{
        minWidth: "44px",
        minHeight: "44px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        touchAction: "manipulation",
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    </button>
  );
});
