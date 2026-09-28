export type AdminRole = { id: string; name: string };

/** A section or competence a role can be granted visibility of. */
export type Grantable = { id: string; name: string; description: string | null };

/** Everything the admin screen needs: every role, every grantable, and every grant. */
export type VisibilityMatrix = {
  roles: AdminRole[];
  sections: Grantable[];
  competences: Grantable[];
  roleSections: { roleId: string; sectionId: string }[];
  roleCompetences: { roleId: string; competenceId: string }[];
};
