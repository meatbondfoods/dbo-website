import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

type Variant = "primary" | "gold" | "outline" | "ghost" | "light";
const CLS: Record<Variant, string> = {
  primary: "btn-primary", gold: "btn-gold", outline: "btn-outline", ghost: "btn-ghost", light: "btn-light",
};

export function Button({ variant = "primary", className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${CLS[variant]} ${className}`} {...rest} />;
}

export function ButtonLink({ variant = "primary", className = "", ...rest }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${CLS[variant]} ${className}`} {...rest} />;
}
