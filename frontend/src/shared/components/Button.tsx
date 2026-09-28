import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

/** Presentational, reusable button. No domain knowledge. */
export function Button({ variant = "primary", className, ...rest }: Props) {
  const variantClass = variant === "secondary" ? styles.secondary : styles.primary;
  const classes = [styles.button, variantClass, className].filter(Boolean).join(" ");
  return <button className={classes} {...rest} />;
}
