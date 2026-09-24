export type PieContent = {
  elements: Record<string, string>;
  models: unknown[];
  markup: string;
};

export type Question = {
  id: string;
  prompt: string;
  questionType: string;
  competence: { id: string; name: string };
  content: PieContent;
};
