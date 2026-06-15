import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { ContentFetcher, SeoTroveNotFoundError } from '../dist/index.mjs';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('getContent calls the slug endpoint and maps ready content', async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response(JSON.stringify({
      domain: 'example.com',
      slug: 'ready-page',
      title: 'Ready page',
      metaTitle: 'Ready page | Example',
      metaDescription: 'Ready description',
      html: '<article>Ready</article>',
      summary: 'Ready summary',
      updatedAt: '2026-06-15T12:00:00Z'
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const fetcher = new ContentFetcher({
    domain: 'example.com',
    installId: 'install 1',
    apiBaseUrl: 'https://api.test'
  });

  const content = await fetcher.getContent({ slug: 'ready-page' });

  assert.equal(content.slug, 'ready-page');
  assert.equal(calls[0], 'https://api.test/api/v1/sdk/example.com/content/ready-page?installId=install%201');
});

test('getContent surfaces public absence as SeoTroveNotFoundError', async () => {
  globalThis.fetch = async () => new Response('not found', { status: 404 });

  const fetcher = new ContentFetcher({
    domain: 'example.com',
    installId: 'install-1',
    apiBaseUrl: 'https://api.test'
  });

  await assert.rejects(
    () => fetcher.getContent({ slug: 'draft-page' }),
    SeoTroveNotFoundError
  );
});

test('getSitemap and getRobots call read-only public routes', async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response(calls.length === 1 ? '<urlset />' : 'User-agent: *', { status: 200 });
  };

  const fetcher = new ContentFetcher({
    domain: 'example.com',
    installId: 'install-1',
    apiBaseUrl: 'https://api.test'
  });

  assert.equal(await fetcher.getSitemap(), '<urlset />');
  assert.equal(await fetcher.getRobots(), 'User-agent: *');
  assert.deepEqual(calls, [
    'https://api.test/api/v1/sdk/example.com/sitemap?installId=install-1',
    'https://api.test/api/v1/sdk/example.com/robots?installId=install-1'
  ]);
  assert.ok(calls.every((url) => !url.includes('previously-published')));
});
