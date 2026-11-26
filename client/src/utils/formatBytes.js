export function formatBytes(bytes = 0) {
  const num = Number(bytes) || 0;
  if (num <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(num) / Math.log(1024)), units.length - 1);
  if (i === 0) return `${num} B`;
  return `${(num / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function getStorageBarColor(percent = 0) {
  if (percent > 90) return 'bg-rose-500';
  if (percent >= 70) return 'bg-amber-500';
  return 'bg-emerald-500';
}

export function getStorageBadgeColor(percent = 0) {
  if (percent > 90) return 'rose';
  if (percent >= 70) return 'amber';
  return 'emerald';
}
