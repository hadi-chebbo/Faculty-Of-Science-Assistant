import { LANGUAGES, RESOURCE_TYPES } from "@/db/constants";
import type { Language, ResourceType } from "@/db/constants";
import { TYPE_ICONS } from "@/components/site/resource-row";
import { RESOURCE_TYPE_SINGULAR_LABELS } from "@/lib/labels";

// Native radio buttons laid over their styled label: the browser gives the group its keyboard
// behaviour (arrow keys move the choice) and screen readers announce a radio group. The input is
// invisible but covers the whole label, so a click or a tap always lands on it.
const RADIO = "peer absolute inset-0 z-10 size-full cursor-pointer opacity-0";

const FOCUS = "peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50";

const LANGUAGE_NAMES: Record<Language, string> = { en: "English", fr: "French" };

// The type is the one choice that changes the rest of the form, so it is shown, not hidden in a list.
export function TypeChooser({ value, onChange }: { value: ResourceType; onChange: (type: ResourceType) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {RESOURCE_TYPES.map((t) => {
        const Icon = TYPE_ICONS[t];
        return (
          <label key={t} className="relative block cursor-pointer">
            <input type="radio" name="type" value={t} checked={value === t} onChange={() => onChange(t)} className={RADIO} />
            <span
              className={`flex min-h-12 items-center gap-2.5 rounded-lg border bg-card px-3 py-2 text-sm font-medium text-heading transition-colors hover:bg-muted peer-checked:border-primary peer-checked:bg-accent peer-checked:text-accent-foreground peer-checked:shadow-[inset_0_0_0_1px_var(--primary)] ${FOCUS}`}
            >
              <Icon aria-hidden className="size-[18px] shrink-0 text-muted-foreground" />
              {RESOURCE_TYPE_SINGULAR_LABELS[t]}
            </span>
          </label>
        );
      })}
    </div>
  );
}

// A two-option switch for the language, sending "en" or "fr".
export function LanguageSwitch({ value, onChange }: { value: Language; onChange: (language: Language) => void }) {
  return (
    <div className="inline-flex rounded-lg border bg-muted p-[3px]">
      {LANGUAGES.map((l) => (
        <label key={l} className="relative block cursor-pointer">
          <input type="radio" name="language" value={l} checked={value === l} onChange={() => onChange(l)} className={RADIO} />
          <span
            className={`block min-h-10 min-w-20 rounded-md px-3.5 py-2.5 text-center text-sm font-medium text-muted-foreground transition-colors peer-checked:bg-card peer-checked:text-heading peer-checked:shadow-[0_0_0_1px_var(--border)] ${FOCUS}`}
          >
            {LANGUAGE_NAMES[l]}
          </span>
        </label>
      ))}
    </div>
  );
}
