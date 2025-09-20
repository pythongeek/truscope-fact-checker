export const calculateRecency = (publishedDate?: string): number => {
  if (!publishedDate) return 30; // Default moderate recency

  try {
    const published = new Date(publishedDate);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - published.getTime()) / (1000 * 60 * 60 * 24));

    // Recency scoring: 100 for today, decreasing over time
    if (daysDiff <= 1) return 100;
    if (daysDiff <= 7) return 90;
    if (daysDiff <= 30) return 80;
    if (daysDiff <= 90) return 70;
    if (daysDiff <= 365) return 60;
    return 40;
  } catch {
    return 30;
  }
};
