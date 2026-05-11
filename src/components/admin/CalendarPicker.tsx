import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, X } from "lucide-react";

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function parseISO(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDisplay(iso: string) {
  const d = parseISO(iso);
  if (!d) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isToday(d: Date) {
  return isSameDay(d, new Date());
}

interface CalendarGridProps {
  value: string;
  onChange: (iso: string) => void;
  rangeStart?: string;
  rangeEnd?: string;
  min?: string;
  max?: string;
  onClose: () => void;
  hoverDate?: string;
  onHoverDate?: (iso: string) => void;
}

function CalendarGrid({
  value, onChange, rangeStart, rangeEnd, min, max, onClose, hoverDate, onHoverDate,
}: CalendarGridProps) {
  const selected = parseISO(value);
  const today = new Date();

  const [viewYear, setViewYear] = useState(() => {
    const d = parseISO(value) ?? parseISO(rangeStart ?? "") ?? today;
    return d.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const d = parseISO(value) ?? parseISO(rangeStart ?? "") ?? today;
    return d.getMonth();
  });

  const minDate = parseISO(min ?? "");
  const maxDate = parseISO(max ?? "");
  const rangeStartDate = parseISO(rangeStart ?? "");
  const rangeEndDate = parseISO(rangeEnd ?? "");
  const hoverDateParsed = parseISO(hoverDate ?? "");

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function getDays() {
    const firstDay = new Date(viewYear, viewMonth, 1);
    let startDow = firstDay.getDay();
    startDow = startDow === 0 ? 6 : startDow - 1;

    const cells: { date: Date; currentMonth: boolean }[] = [];
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth, -i);
      cells.push({ date: d, currentMonth: false });
    }
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({ date: new Date(viewYear, viewMonth, i), currentMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      const next = new Date(last);
      next.setDate(last.getDate() + 1);
      cells.push({ date: next, currentMonth: false });
    }
    return cells;
  }

  function isDisabled(d: Date) {
    if (minDate && d < minDate && !isSameDay(d, minDate)) return true;
    if (maxDate && d > maxDate && !isSameDay(d, maxDate)) return true;
    return false;
  }

  function isInRange(d: Date) {
    const start = rangeStartDate;
    const end = rangeEndDate ?? hoverDateParsed;
    if (!start || !end) return false;
    const lo = start <= end ? start : end;
    const hi = start <= end ? end : start;
    return d > lo && d < hi;
  }

  function isRangeStart(d: Date) {
    if (rangeStartDate && isSameDay(d, rangeStartDate)) return true;
    return false;
  }

  function isRangeEnd(d: Date) {
    const end = rangeEndDate ?? hoverDateParsed;
    if (end && isSameDay(d, end) && rangeStartDate && !isSameDay(end, rangeStartDate)) return true;
    return false;
  }

  const cells = getDays();

  return (
    <div className="select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100">
        <button
          onClick={prevMonth}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-bold text-ink-800">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 px-3 pt-3 pb-1">
        {DAYS.map(d => (
          <div key={d} className="flex items-center justify-center">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400">{d}</span>
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5 px-3 pb-3">
        {cells.map(({ date, currentMonth }, i) => {
          const iso = toISO(date);
          const isSelected = selected ? isSameDay(date, selected) : false;
          const isStart = isRangeStart(date);
          const isEnd = isRangeEnd(date);
          const inRange = isInRange(date);
          const disabled = isDisabled(date);
          const todayMark = isToday(date);

          const isEdge = isSelected || isStart || isEnd;

          return (
            <div
              key={i}
              className={`relative flex items-center justify-center
                ${inRange ? "bg-brand-50" : ""}
                ${isStart && (rangeEndDate || hoverDateParsed) ? "rounded-l-full" : ""}
                ${isEnd ? "rounded-r-full" : ""}
                ${inRange && !isStart && !isEnd ? "" : ""}
              `}
            >
              <button
                onClick={() => { if (!disabled) { onChange(iso); onClose(); } }}
                onMouseEnter={() => onHoverDate?.(iso)}
                onMouseLeave={() => onHoverDate?.("")}
                disabled={disabled}
                className={`
                  relative flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all duration-100
                  ${disabled ? "cursor-not-allowed opacity-30" : "cursor-pointer"}
                  ${isEdge
                    ? "bg-brand-600 text-white shadow-md shadow-brand-200 scale-105"
                    : !disabled && currentMonth
                      ? "text-ink-800 hover:bg-brand-100 hover:text-brand-700"
                      : "text-ink-300 hover:bg-ink-100"
                  }
                `}
              >
                {date.getDate()}
                {todayMark && !isEdge && (
                  <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-brand-500" />
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between border-t border-ink-100 px-4 py-2.5">
        <button
          onClick={() => { onChange(toISO(new Date())); onClose(); }}
          className="text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors"
        >
          Today
        </button>
        <button
          onClick={onClose}
          className="text-xs font-semibold text-ink-400 hover:text-ink-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ── Popup wrapper ──────────────────────────────────────────────────────── */

interface CalendarPopupProps {
  value: string;
  onChange: (iso: string) => void;
  rangeStart?: string;
  rangeEnd?: string;
  min?: string;
  max?: string;
  label: string;
  placeholder?: string;
  className?: string;
  filled?: boolean;
}

export function CalendarPopup({
  value, onChange, rangeStart, rangeEnd, min, max,
  label, placeholder = "Pick date", className = "", filled,
}: CalendarPopupProps) {
  const [open, setOpen] = useState(false);
  const [hoverDate, setHoverDate] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isActive = filled ?? Boolean(value);

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`
          group flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 transition-all duration-200 min-w-[155px] text-left
          ${isActive
            ? "bg-brand-600 border-brand-600 shadow-lg shadow-brand-200/60 text-white"
            : "bg-white border-ink-200 hover:border-brand-400 hover:shadow-md text-ink-800"
          }
          ${open ? (isActive ? "ring-2 ring-brand-300 ring-offset-1" : "border-brand-400 ring-2 ring-brand-200 ring-offset-1 shadow-md") : ""}
        `}
      >
        <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl transition-colors ${isActive ? "bg-white/20" : "bg-brand-50 group-hover:bg-brand-100"}`}>
          <CalendarDays className={`h-3.5 w-3.5 ${isActive ? "text-white" : "text-brand-500"}`} />
        </span>
        <span className="flex flex-col min-w-0">
          <span className={`text-[9px] font-black uppercase tracking-[0.16em] leading-none mb-0.5 ${isActive ? "text-brand-200" : "text-ink-400"}`}>
            {label}
          </span>
          <span className={`text-[13px] font-bold leading-tight truncate ${isActive ? "text-white" : value ? "text-ink-800" : "text-ink-400"}`}>
            {value ? formatDisplay(value) : placeholder}
          </span>
        </span>
      </button>

      {/* Dropdown calendar */}
      {open && (
        <div className="calendar-in absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-2xl shadow-ink-900/10">
          <CalendarGrid
            value={value}
            onChange={onChange}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            min={min}
            max={max}
            onClose={close}
            hoverDate={hoverDate}
            onHoverDate={setHoverDate}
          />
        </div>
      )}
    </div>
  );
}
