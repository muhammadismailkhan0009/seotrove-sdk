# seotrove-sdk

A TypeScript SDK for content fetching, file management, and scheduling.

## Installation

```bash
# Using npm
npm install seotrove-sdk

# Using pnpm
pnpm add seotrove-sdk

# Using yarn
yarn add seotrove-sdk
```

## Features

- **ContentFetcher**: Fetch content from SEOTrove API and sync to local files
- **FileManager**: Utility functions for file operations
- **ContentScheduler**: Schedule and manage content synchronization
- **TypeScript Support**: Full TypeScript definitions included
- **Server-Side Only**: Optimized for Node.js environments (Next.js, Express, etc.)

## Setup with Vite React (Server-Side)

Since this SDK is designed for server-side operations, you'll typically use it in your API routes or server middleware, not directly in React components.

### 1. Install the SDK

```bash
pnpm add seotrove-sdk
```

### 2. Create an API route (for Vite React with Express backend)

Create `server/api/content-sync.js`:

```typescript
import express from "express";
import { ContentFetcher, ContentScheduler } from "seotrove-sdk";

const router = express.Router();

const contentFetcher = new ContentFetcher({
  domain: "your-domain.com",
  installId: "your-install-id",
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
import { ContentFetcher, ContentScheduler } from "seotrove-sdk";
import type { NextApiRequest, NextApiResponse } from "next";

const contentFetcher = new ContentFetcher({
  domain: "your-domain.com",
  installId: "your-install-id",
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

## Usage

### ContentFetcher

```typescript
import { ContentFetcher } from "seotrove-sdk";

const fetcher = new ContentFetcher({
  domain: "your-domain.com",
  installId: "your-install-id",
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
import { ContentFetcher, ContentScheduler } from "seotrove-sdk";

const fetcher = new ContentFetcher({
  domain: "your-domain.com",
  installId: "your-install-id",
  targetDirectory: "./public",
});

// Legacy API - backward compatible
const scheduler = new ContentScheduler(fetcher, "scheduler-id");
scheduler.start(); // No arguments needed
scheduler.stop(); // No arguments needed
```

### New ContentScheduler (Multi-fetcher Support)

```typescript
import { ContentScheduler } from "seotrove-sdk";

const scheduler = new ContentScheduler();

// Add multiple content fetchers
scheduler.addFetcher("domain1", {
  domain: "domain1.com",
  installId: "install-id-1",
  targetDirectory: "./public/domain1",
});

scheduler.addFetcher("domain2", {
  domain: "domain2.com",
  installId: "install-id-2",
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
import { FileManager } from "seotrove-sdk";

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
  installId: string; // Installation ID from SEOTrove
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