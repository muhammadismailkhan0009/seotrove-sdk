# @myriadcodelabs/seotrove-sdk

A server-side TypeScript SDK for retrieving SeoTrove public content, sitemap XML,
and robots.txt.

## Installation

```bash
# Using npm
npm install @myriadcodelabs/seotrove-sdk

# Using pnpm
pnpm add @myriadcodelabs/seotrove-sdk

# Using yarn
yarn add @myriadcodelabs/seotrove-sdk
```

## Features

- **Slug content delivery**: Fetch one READY_TO_PUBLISH page by domain and slug
- **Sitemap and robots providers**: Retrieve ready-content sitemap XML and robots.txt
- **TypeScript support**: Full TypeScript definitions included
- **Server-side only**: Optimized for Node.js environments such as Next.js and Express
- **Legacy file sync**: Existing sync helpers remain available for compatibility

## Public Delivery Usage

```typescript
import { ContentFetcher, SeoTroveNotFoundError } from "@myriadcodelabs/seotrove-sdk";

const seoTrove = new ContentFetcher({
  domain: "your-domain.com",
  apiKey: process.env.SEOTROVE_API_KEY!,
});

try {
  const content = await seoTrove.getContent({
    slug: "how-mutual-consent-video-chat-works",
  });

  console.log(content.title);
  console.log(content.html);
} catch (error) {
  if (error instanceof SeoTroveNotFoundError) {
    // Return the target framework's 404 response.
  }
  throw error;
}
```

```typescript
const sitemapXml = await seoTrove.getSitemap();
const robotsTxt = await seoTrove.getRobots();
```

The SDK is intended to run on the target website server. Do not expose
`apiKey` in browser-side JavaScript.

## Setup with Vite React (Server-Side)

Since this SDK is designed for server-side operations, you'll typically use it in your API routes or server middleware, not directly in React components.

### 1. Install the SDK

```bash
pnpm add @myriadcodelabs/seotrove-sdk
```

### 2. Create an API route (for Vite React with Express backend)

Create `server/api/content-sync.js`:

```typescript
import express from "express";
import { ContentFetcher, ContentScheduler } from "@myriadcodelabs/seotrove-sdk";

const router = express.Router();

const contentFetcher = new ContentFetcher({
  domain: "your-domain.com",
  apiKey: "your-api-key",
  targetDirectory: "./public",
});

// Initialize scheduler
const scheduler = new ContentScheduler(contentFetcher, "main-scheduler");

// Start automatic syncing
router.post("/start-sync", async (req, res) => {
  try {
    scheduler.start();
    res.json({ success: true, message: "Content sync started" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manual sync trigger
router.post("/sync-now", async (req, res) => {
  try {
    const result = await contentFetcher.syncContent();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
```

### 3. For Next.js Projects

Create `pages/api/content-sync.ts` or `app/api/content-sync/route.ts`:

```typescript
import { ContentFetcher, ContentScheduler } from "@myriadcodelabs/seotrove-sdk";
import type { NextApiRequest, NextApiResponse } from "next";

const contentFetcher = new ContentFetcher({
  domain: "your-domain.com",
  apiKey: "your-api-key",
  targetDirectory: "./public",
});

const scheduler = new ContentScheduler(contentFetcher, "next-scheduler");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    try {
      const result = await contentFetcher.syncContent();
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
```

### 4. React Component Integration

In your React components, call the API routes:

```typescript
import { useState } from "react";

function ContentSyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/content-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <button onClick={handleSync} disabled={syncing}>
        {syncing ? "Syncing..." : "Sync Content"}
      </button>
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}

export default ContentSyncButton;
```

## Legacy Sync Usage

### ContentFetcher

```typescript
import { ContentFetcher } from "@myriadcodelabs/seotrove-sdk";

const fetcher = new ContentFetcher({
  domain: "your-domain.com",
  apiKey: "your-api-key",
  targetDirectory: "./public",
});

// Fetch and sync content
const result = await fetcher.syncContent();
console.log(result);

// Start automatic scheduling (24-hour intervals)
fetcher.startScheduler();

// Stop scheduling
fetcher.stopScheduler();
```

### Legacy ContentScheduler (Backward Compatible)

```typescript
import { ContentFetcher, ContentScheduler } from "@myriadcodelabs/seotrove-sdk";

const fetcher = new ContentFetcher({
  domain: "your-domain.com",
  apiKey: "your-api-key",
  targetDirectory: "./public",
});

// Legacy API - backward compatible
const scheduler = new ContentScheduler(fetcher, "scheduler-id");
scheduler.start(); // No arguments needed
scheduler.stop(); // No arguments needed
```

### New ContentScheduler (Multi-fetcher Support)

```typescript
import { ContentScheduler } from "@myriadcodelabs/seotrove-sdk";

const scheduler = new ContentScheduler();

// Add multiple content fetchers
scheduler.addFetcher("domain1", {
  domain: "domain1.com",
  apiKey: "api-key-1",
  targetDirectory: "./public/domain1",
});

scheduler.addFetcher("domain2", {
  domain: "domain2.com",
  apiKey: "api-key-2",
  targetDirectory: "./public/domain2",
});

// Start all scheduled content fetching
scheduler.startAll();

// Start specific scheduler
scheduler.start("domain1");

// Stop all scheduling
scheduler.stopAll();
```

### FileManager

```typescript
import { FileManager } from "@myriadcodelabs/seotrove-sdk";

// Write a file
await FileManager.writeFile("./path/to/file.txt", "content");

// Ensure directory exists
await FileManager.ensureDirectoryExists("./path/to/directory");

// Check if file exists
const exists = await FileManager.fileExists("./path/to/file.txt");

// Sanitize file names
const cleanName = FileManager.sanitizeFileName("unsafe/file:name.txt");
```

## API Reference

### Types

- `ContentApiResponse`: Response structure from content API
- `ContentPage`: Individual page content structure
- `ContentFetcherConfig`: Configuration for ContentFetcher
- `SyncResult`: Result of synchronization operations

### ContentFetcherConfig

```typescript
interface ContentFetcherConfig {
  domain: string; // Your domain name
  apiKey: string; // Public delivery API key from SeoTrove
  targetDirectory: string; // Directory to save content
}
```

### SyncResult

```typescript
interface SyncResult {
  success: boolean;
  message: string;
  filesCreated: string[];
  errors?: string[];
}
```

## Requirements

- Node.js >= 18.0.0
- TypeScript >= 5.0.0 (for development)
- Server-side environment (not for browser usage)

## Common Use Cases

1. **Next.js API Routes**: Use in API routes for content management
2. **Express.js Middleware**: Integrate with Express servers
3. **Scheduled Jobs**: Set up automated content synchronization
4. **Build Processes**: Include in your build pipeline
5. **CMS Integration**: Connect with headless CMS systems

## Error Handling

```typescript
try {
  const result = await fetcher.syncContent();
  if (!result.success) {
    console.error("Sync failed:", result.message);
    console.error("Errors:", result.errors);
  }
} catch (error) {
  console.error("Sync error:", error);
}
```

## License

ISC
