import * as React from "react";
import {
  Avatar as UiAvatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type AvatarRole = "user" | "assistant" | "system";

export interface AvatarAtomProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Who the avatar represents. */
  role: AvatarRole;
  /** Optional image URL. */
  src?: string;
  /** Display name used for the fallback initials. */
  name?: string;
  /** Avatar diameter in pixels. */
  size?: number;
}

const ROLE_TONE: Record<AvatarRole, string> = {
  user: "bg-secondary text-secondary-foreground",
  assistant: "bg-primary text-primary-foreground",
  system: "bg-muted text-muted-foreground",
};

function initials(name?: string): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

/**
 * Role-aware avatar with image + initials fallback.
 *
 * @example
 * <AvatarAtom role="assistant" name="Hermit" />
 */
export function AvatarAtom({
  role,
  src,
  name,
  size = 36,
  className,
  ...props
}: AvatarAtomProps): React.JSX.Element {
  return (
    <UiAvatar
      className={cn(ROLE_TONE[role], className)}
      style={{ width: size, height: size }}
      {...props}
    >
      {src ? <AvatarImage src={src} alt={name ?? ""} /> : null}
      <AvatarFallback className={ROLE_TONE[role]}>
        {initials(name) || role[0]?.toUpperCase()}
      </AvatarFallback>
    </UiAvatar>
  );
}
