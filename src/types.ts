export interface Profile {
  id: string;
  url: string;
  status: 'pending' | 'scraping' | 'completed' | 'failed';
  lastScrapedAt?: string | null;
  createdAt?: string | null;
  startedAt?: string | null;
  error?: string | null;
  progressMessage?: string | null;
  scrapedCount?: number;
  totalCount?: number;
  lastRunStats?: {
    successCount: number;
    failedCount: number;
    total: number;
  } | null;
}

export interface Shot {
  profileUrl: string;
  url: string;
  title: string | null;
  imageUrl: string | null;
  posted: string | null;
  views: number | null;
  saves: number | null;
  likes: number | null;
  comments: number | null;
  tags: string[];
  status: string;
  error: string | null;
  scrapedAt: string | null;
  lastError?: string | null;
  lastFailedAt?: string | null;
  history?: {
    date: string;
    timestamp: number;
    views: number;
    likes: number;
    saves: number;
    comments: number;
  }[];
}
