export function dedupeKey(route: string, date: string, program: string, cabin: string): string {
  return `${route}|${date}|${program}|${cabin}`.toLowerCase();
}

export function shouldSendAlert(key: string, hasSeen: (key: string) => boolean): boolean {
  return !hasSeen(key);
}
