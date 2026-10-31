import type { Grantable } from "../../types";
import styles from "./GrantChecklist.module.css";

type Props = {
  title: string;
  hint: string;
  items: Grantable[];
  grantedIds: Set<string>;
  isPending: (id: string) => boolean;
  onToggle: (id: string, granted: boolean) => void;
};

/** One card of checkboxes: which items the selected role is granted. */
export function GrantChecklist({ title, hint, items, grantedIds, isPending, onToggle }: Props) {
  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <span className={styles.count}>
          {grantedIds.size} of {items.length}
        </span>
      </div>
      <p className={styles.hint}>{hint}</p>

      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id}>
            <label className={styles.item}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={grantedIds.has(item.id)}
                disabled={isPending(item.id)}
                onChange={(e) => onToggle(item.id, e.target.checked)}
              />
              <span className={styles.text}>
                <span className={styles.name}>{item.name}</span>
                {item.description && <span className={styles.description}>{item.description}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
