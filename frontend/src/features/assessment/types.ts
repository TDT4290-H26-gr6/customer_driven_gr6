export type PieContent = {
  elements: Record<string, string>;
  models: unknown[];
  markup: string;
};

export type Question = {
  id: string;
  prompt: string;
  questionType: string;
  competenceArea: { name: string };
  content: PieContent;
};

export type SatInstance = {
  id: string;
  learnerId: string;
  instanceNum: number;
  startedAt: string;
  completedAt: string | null;
};
