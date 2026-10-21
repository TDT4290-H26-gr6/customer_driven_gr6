// Single place that reads import.meta.env. Nothing else touches it directly.
type Env = {
  API_URL: string;
  GOOGLE_CLIENT_ID: string;
  ORCID_CLIENT_ID: string;
  ORCID_REDIRECT_URI: string;
};

export const env: Env = {
  API_URL: import.meta.env.VITE_API_URL || "http://localhost:4000",
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
  ORCID_CLIENT_ID: import.meta.env.VITE_ORCID_CLIENT_ID || "",
  ORCID_REDIRECT_URI: import.meta.env.VITE_ORCID_REDIRECT_URI || "",
};
