import { config } from "../../config";

/**
 * Whether this email may use admin mode (see ADMIN_EMAILS in config.ts).
 * A stopgap until the planned `security` module has real admin accounts
 * (context/backend-structure.md) — email comparison is case-insensitive.
 */
export function isAdminEmail(email: string, admins = config.adminEmails): boolean {
  return admins === "everyone" || admins.includes(email.toLowerCase());
}
