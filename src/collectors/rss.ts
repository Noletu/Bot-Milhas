import RssParser from 'rss-parser';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import type { AppError } from '../types.js';
import type { RssItem } from '../parsers/promo-detector.js';

const FEED_URLS = [
  'https://www.melhoresdestinos.com.br/feed',
  'https://passageirodeprimeira.com/feed',
];

const httpClient = axios.create({ timeout: 15000 });
axiosRetry(httpClient, {
  retries: 3,
  retryDelay: (count, err) => axiosRetry.exponentialDelay(count, err),
  retryCondition: (err) => axiosRetry.isNetworkOrIdempotentRequestError(err),
});

const parser = new RssParser();

export async function fetchAllFeeds(
  urls: string[] = FEED_URLS
): Promise<Result<RssItem[], AppError>> {
  const results = await Promise.all(urls.map(fetchFeed));
  const items: RssItem[] = [];
  const errors: string[] = [];

  for (const result of results) {
    if (result.isOk()) {
      items.push(...result.value);
    } else {
      errors.push(result.error.message);
    }
  }

  if (items.length === 0 && errors.length > 0) {
    return err({ code: 'RSS_ALL_FAILED', message: errors.join('; ') });
  }

  return ok(items);
}

async function fetchFeed(url: string): Promise<Result<RssItem[], AppError>> {
  try {
    const response = await httpClient.get<string>(url, {
      responseType: 'text',
      headers: { 'User-Agent': 'award-bot/0.1 (flight monitor)' },
    });
    const feed = await parser.parseString(response.data);

    const items: RssItem[] = (feed.items ?? []).map((item) => ({
      title: item.title ?? '',
      link: item.link ?? '',
      content: item.contentSnippet ?? item.content ?? item.summary ?? '',
      pubDate: item.pubDate ?? '',
    }));

    return ok(items);
  } catch (e) {
    return err({
      code: 'RSS_FETCH_ERROR',
      message: `Failed to fetch RSS from ${url}: ${String(e)}`,
      cause: e,
    });
  }
}
