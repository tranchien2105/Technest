import { useLayoutEffect, useRef } from "react";
import "./formatted-inputs.css";

const onlyDigits = (value) => String(value ?? "").replace(/\D/g, "");
const groupedDigits = (value) => {
  const digits = onlyDigits(value);
  return digits ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(BigInt(digits)) : "";
};

export default function CurrencyInput({ value, onValueChange, onFocus, onBlur, ...props }) {
  const inputRef = useRef(null);
  const pendingCaret = useRef(null);
  const rawValue = onlyDigits(value);
  const formattedValue = groupedDigits(rawValue);

  useLayoutEffect(() => {
    if (pendingCaret.current === null || !inputRef.current) return;
    let digitCount = 0;
    let position = formattedValue.length;
    if (pendingCaret.current.digits === 0) position = 0;
    else {
      for (let index = 0; index < formattedValue.length; index += 1) {
        if (/\d/.test(formattedValue[index])) digitCount += 1;
        if (digitCount === pendingCaret.current.digits) {
          position = index + 1;
          break;
        }
      }
    }
    inputRef.current.setSelectionRange(position, position);
    pendingCaret.current = null;
  }, [formattedValue]);

  return (
    <span className="currency-input-wrap">
      <input
        {...props}
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={formattedValue}
        onFocus={(event) => {
          onFocus?.(event);
        }}
        onChange={(event) => {
          const input = event.currentTarget;
          const digitsBeforeCaret = onlyDigits(input.value.slice(0, input.selectionStart ?? 0)).length;
          const nextValue = onlyDigits(input.value);
          pendingCaret.current = { digits: digitsBeforeCaret };
          onValueChange(nextValue);
        }}
        onBlur={(event) => {
          onBlur?.(event);
        }}
      />
      <span className="currency-input-unit" aria-hidden="true">₫</span>
    </span>
  );
}
