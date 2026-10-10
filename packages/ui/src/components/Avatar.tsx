import { cx, type Accent } from "../lib";
import { Sticker, type StickerId } from "./Sticker";

export interface AvatarProps {
  name: string;
  color?: Accent;
  sticker?: StickerId;
  size?: number;
  className?: string;
}

/** Sticker or initial on an accent fill, with outline. */
export function Avatar({ name, color = "yellow", sticker, size = 36, className }: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      role="img"
      aria-label={name}
      className={cx("sc-avatar", `sc-fill-${color}`, className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {sticker ? <Sticker id={sticker} size={Math.round(size * 0.78)} /> : initial}
    </span>
  );
}

export interface AvatarStackProps {
  people: Array<Pick<AvatarProps, "name" | "color" | "sticker">>;
  /** shown before collapsing into "+N" */
  max?: number;
  size?: number;
  className?: string;
}

/** Overlapping avatars; shows "+N" past `max`. */
export function AvatarStack({ people, max = 3, size = 36, className }: AvatarStackProps) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span
      className={cx("sc-avatar-stack", className)}
      role="group"
      aria-label={`${people.length} people`}
    >
      {shown.map((person) => (
        <Avatar key={person.name} size={size} {...person} />
      ))}
      {extra > 0 && (
        <span
          className="sc-avatar sc-avatar--more"
          style={{ width: size, height: size }}
          aria-label={`and ${extra} more`}
          role="img"
        >
          +{extra}
        </span>
      )}
    </span>
  );
}
