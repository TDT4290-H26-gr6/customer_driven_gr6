// Single place that reads import.meta.env. Nothing else touches it directly.
import { DEFAULT_API_URL } from "./defaults";

type Env = {
  API_URL: string;
  GOOGLE_CLIENT_ID: string;
};

export const env: Env = {
  API_URL: import.meta.env.VITE_API_URL || DEFAULT_API_URL,
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
};
