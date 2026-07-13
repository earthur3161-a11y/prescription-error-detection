import { cn } from "@/lib/utils/cn";

export interface ChipOption {
  value: string;
  label: string;
}

type ChipSize = "sm" | "md";

interface SingleChipToggleGroupProps {
  type?: "single";
  options: ChipOption[];
  value: string;
  onChange: (value: string) => void;
  size?: ChipSize;
  className?: string;
}

interface MultipleChipToggleGroupProps {
  type: "multiple";
  options: ChipOption[];
  values: string[];
  onChange: (values: string[]) => void;
  size?: ChipSize;
  className?: string;
}

type ChipToggleGroupProps = SingleChipToggleGroupProps | MultipleChipToggleGroupProps;

const sizeClasses: Record<ChipSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
};

const chipBaseClasses = "rounded-full border font-medium transition-colors";
const chipSelectedClasses = "border-brand bg-brand-subtle text-brand";
const chipUnselectedClasses = "border-border-strong text-secondary hover:bg-surface-2";

/**
 * Shared pill/chip toggle group — single-select (radiogroup) or
 * multiple-select (pressed-button group). Markup/classes match what was
 * previously hand-duplicated across several patient-facing forms.
 */
export function ChipToggleGroup(props: ChipToggleGroupProps) {
  const { options, size = "md", className } = props;

  if (props.type === "multiple") {
    const { values, onChange } = props;
    return (
      <div role="group" className={cn("flex flex-wrap gap-2", className)}>
        {options.map((option) => {
          const selected = values.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                onChange(
                  selected ? values.filter((v) => v !== option.value) : [...values, option.value]
                )
              }
              className={cn(
                chipBaseClasses,
                sizeClasses[size],
                selected ? chipSelectedClasses : chipUnselectedClasses
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  const { value, onChange } = props;
  return (
    <div role="radiogroup" className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              chipBaseClasses,
              sizeClasses[size],
              selected ? chipSelectedClasses : chipUnselectedClasses
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
