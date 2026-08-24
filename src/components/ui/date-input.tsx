import * as React from "react";
import { X } from "lucide-react";
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
  ({ value = "", onChange, className, ...props }, ref) => {
    const formattedVal = normalizeDateInput(value);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      if (onChange) {
        onChange(v);
      }
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onChange) onChange("");
    };

    return (
      <div className="relative flex items-center w-full">
        <Input
          ref={ref}
          type="date"
          value={formattedVal}
          onChange={handleChange}
          className={`h-9 font-mono text-xs cursor-pointer ${value ? "pr-8" : ""} ${className || ""}`}
          {...props}
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-7 text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
            title="Hapus tanggal"
            aria-label="Hapus tanggal"
          >
            <X className="size-3.5 opacity-60 hover:opacity-100" />
          </button>
        )}
      </div>
    );
  },
);
DateInput.displayName = "DateInput";
