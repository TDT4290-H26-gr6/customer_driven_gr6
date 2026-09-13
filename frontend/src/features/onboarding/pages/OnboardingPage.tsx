import { useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { RoleSelect } from "../components/RoleSelect";
import type { Role } from "../types";
import styles from "./OnboardingPage.module.css";

export function OnboardingPage() {
  const { setRole } = useAuth();
  const navigate = useNavigate();

  function handleDone(role: Role) {
    setRole(role);
    navigate("/", { replace: true });
  }

  return (
    <div className={styles.page}>
      <RoleSelect onDone={handleDone} />
    </div>
  );
}
