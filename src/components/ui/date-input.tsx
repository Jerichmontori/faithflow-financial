import * as React from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Input } from "./input";

export interface DateInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value?: string;
  onChange?: (value: string) => void;
}

// Convert user input (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY) to ISO YYYY-MM-DD
export function normalizeDateInput(val: string): string {
  if (!val) return "";
  const trimmed = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  
  const parts = trimmed.split(/[-/.]/);
  if (parts.length === 3) {
    const p0 = parts[0] ?? "";
    const p1 = parts[1] ?? "";
    const p2 = parts[2] ?? "";
    if (p0.length === 4) {
      return `${p0}-${p1.padStart(2, "0")}-${p2.padStart(2, "0")}`;
    }
    if (p2.length === 4) {
      return `${p2}-${p1.padStart(2, "0")}-${p0.padStart(2, "0")}`;
    }
  }
  return trimmed;
}

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ value = "", onChange, className, placeholder = "YYYY-MM-DD", ...props }, ref) => {
    const [textVal, setTextVal] = React.useState(value);
    const nativePickerRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
      setTextVal(value);
    }, [value]);

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setTextVal(v);
      const normalized = normalizeDateInput(v);
      if (onChange) {
        if (!v || /^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
          onChange(normalized);
        }
      }
    };

    const handleNativePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setTextVal(v);
      if (onChange) {
        onChange(v);
      }
    };

    const openCalendarPicker = () => {
      try {
        if (nativePickerRef.current) {
          if (typeof (nativePickerRef.current as any).showPicker === "function") {
            (nativePickerRef.current as any).showPicker();
          } else {
            nativePickerRef.current.focus();
            nativePickerRef.current.click();
          }
        }
      } catch {
        // Fallback for browsers that don't allow showPicker
      }
    };

    return (
      <div className="relative flex items-center w-full">
        <Input
          ref={ref}
          type="text"
          value={textVal}
          onChange={handleTextChange}
          onBlur={() => {
            const normalized = normalizeDateInput(textVal);
            setTextVal(normalized);
            if (onChange) onChange(normalized);
          }}
          placeholder={placeholder}
          className={`pr-9 font-mono text-xs ${className || ""}`}
          {...props}
        />
        <button
          type="button"
          onClick={openCalendarPicker}
          className="absolute right-2 text-muted-foreground hover:text-foreground focus:outline-none p-1 rounded hover:bg-muted"
          title="Pilih tanggal dari kalender"
          aria-label="Pilih tanggal dari kalender"
        >
          <CalendarIcon className="size-4 opacity-75" />
        </button>
        <input
          ref={nativePickerRef}
          type="date"
          className="sr-only"
          value={value || ""}
          onChange={handleNativePickerChange}
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
    );
  },
);
DateInput.displayName = "DateInput";
