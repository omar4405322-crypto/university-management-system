export function getSubmissionDestinationHostname(fileUrl: string): string | null {
  try {
    return new URL(fileUrl).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return null;
  }
}
