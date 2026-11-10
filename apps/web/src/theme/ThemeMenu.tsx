import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger, Tooltip } from "@throughline/ui";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { type ThemeChoice, useThemeChoice } from "./theme";

const OPTIONS: { id: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "Match system", icon: Monitor },
];

/** Icon button that switches between the light, dark and system themes. */
export function ThemeMenu({ className }: { className?: string }) {
  const [choice, setChoice] = useThemeChoice();
  const Current = OPTIONS.find((o) => o.id === choice)?.icon ?? Moon;
  return (
    <Menu>
      <Tooltip content="Theme: light, dark or system" side="bottom">
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label="Theme"
            className={
              className ??
              "text-muted hover:bg-surface-raised hover:text-foreground grid size-9 cursor-pointer place-items-center rounded-md"
            }
          >
            <Current className="size-4" />
          </button>
        </MenuTrigger>
      </Tooltip>
      <MenuContent align="end">
        <MenuLabel>Theme</MenuLabel>
        {OPTIONS.map(({ id, label, icon: Icon }) => (
          <MenuItem key={id} onSelect={() => setChoice(id)}>
            <Icon className="text-muted size-4" aria-hidden /> {label}
            {choice === id ? <Check className="text-agent-fg ml-auto size-4" aria-label="Selected" /> : null}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
