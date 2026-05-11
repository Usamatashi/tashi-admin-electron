import { useState } from "react";
import { MoveRight, X } from "lucide-react";
import { CalendarPopup } from "./CalendarPicker";

interface DateRangeFilterProps {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  maxDate?: string;
  className?: string;
}

export function DateRangeFilter({
  from, to, onFromChange, onToChange, maxDate, className = "",
}: DateRangeFilterProps) {
  const hasValues = from || to;

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <CalendarPopup
        label="From"
        value={from}
        onChange={onFromChange}
        max={to || maxDate}
        rangeStart={from}
        rangeEnd={to}
        placeholder="Start date"
      />

      <MoveRight className={`h-4 w-4 flex-shrink-0 transition-colors duration-200 ${from && to ? "text-brand-500" : "text-ink-300"}`} />

      <CalendarPopup
        label="To"
        value={to}
        onChange={onToChange}
        min={from}
        max={maxDate}
        rangeStart={from}
        rangeEnd={to}
        placeholder="End date"
      />

      {hasValues && (
        <button
          onClick={() => { onFromChange(""); onToChange(""); }}
          title="Clear dates"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-ink-200 bg-white text-ink-300 hover:bg-red-500 hover:border-red-500 hover:text-white transition-all duration-200 hover:shadow-md"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

interface SingleDateFilterProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  className?: string;
}

export function SingleDateFilter({
  label = "As of", value, onChange, min, max, className = "",
}: SingleDateFilterProps) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <CalendarPopup
        label={label}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        placeholder="Pick date"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          title="Clear"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-ink-200 bg-white text-ink-300 hover:bg-red-500 hover:border-red-500 hover:text-white transition-all duration-200 hover:shadow-md"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

interface FormDateInputProps {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  className?: string;
}

export function FormDateInput({ value, onChange, min, max, className = "" }: FormDateInputProps) {
  return (
    <CalendarPopup
      label="Date"
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      placeholder="Pick a date"
      className={`w-full ${className}`}
    />
  );
}
