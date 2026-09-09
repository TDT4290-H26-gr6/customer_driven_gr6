import type { Learner, Role } from "@prisma/client";

export type LearnerWithRole = Learner & { userRole: Role | null };

export type LearnerDto = {
  id: string;
  email: string;
  name: string | null;
  role: Role | null;
};

export function toLearnerDto(learner: LearnerWithRole): LearnerDto {
  return {
    id: learner.id,
    email: learner.email,
    name: learner.name,
    role: learner.userRole,
  };
}
