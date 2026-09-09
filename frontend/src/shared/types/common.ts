export type Nullable<T> = T | null;

export type ApiError = {
  status: number;
  message: string;
};
