export type SatHistoryArea = {
  name: string;
  score: number;
  maxScore: number;
};

export type SatHistoryEntry = {
  instanceNum: number;
  completedAt: string;
  sumScore: number;
  sumMaxScore: number;
  areas: SatHistoryArea[];
};
