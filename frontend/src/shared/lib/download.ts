/**
 * Saves a Blob as a file download, for a response fetched with
 * apiFetch({ responseType: "blob" }), which carries the auth header a plain
 * `<a href>` to the API couldn't. Revokes the object URL once the browser
 * has started the download.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
