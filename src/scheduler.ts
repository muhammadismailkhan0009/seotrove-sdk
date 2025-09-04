import { ContentFetcher } from './content-fetcher';
import { ContentFetcherConfig } from './types';

export class ContentScheduler {
    private fetchers: Map<string, ContentFetcher> = new Map();
    private schedulers: Map<string, NodeJS.Timeout> = new Map();

    // Legacy support: single fetcher mode
    private legacyFetcher: ContentFetcher | null = null;
    private legacyId: string | null = null;
    private isLegacyMode: boolean = false;

    // Constructor overloads for backward compatibility
    constructor();
    constructor(fetcher: ContentFetcher, id: string);
    constructor(fetcher?: ContentFetcher, id?: string) {
        if (fetcher && id) {
            // Legacy mode: single fetcher
            this.legacyFetcher = fetcher;
            this.legacyId = id;
            this.isLegacyMode = true;
            this.fetchers.set(id, fetcher);
        } else {
            this.isLegacyMode = false;
        }
    }

    addFetcher(id: string, config: ContentFetcherConfig): void {
        if (this.fetchers.has(id)) {
            console.log(`[ContentScheduler] Fetcher ${id} already exists, updating config`);
            this.fetchers.get(id)?.updateConfig(config);
        } else {
            const fetcher = new ContentFetcher(config);
            this.fetchers.set(id, fetcher);
            console.log(`[ContentScheduler] Added fetcher: ${id}`);
        }
    }

    removeFetcher(id: string): void {
        if (this.fetchers.has(id)) {
            this.stop(id);
            this.fetchers.delete(id);
            console.log(`[ContentScheduler] Removed fetcher: ${id}`);
        }
    }

    start(): void;
    start(id: string): void;
    start(id?: string): void {
        const targetId = this.isLegacyMode && !id ? this.legacyId : id;

        if (!targetId) {
            throw new Error(`[ContentScheduler] No fetcher ID provided and not in legacy mode`);
        }

        const fetcher = this.fetchers.get(targetId);
        if (!fetcher) {
            throw new Error(`[ContentScheduler] Fetcher ${targetId} not found`);
        }

        if (this.schedulers.has(targetId)) {
            console.log(`[ContentScheduler] Scheduler ${targetId} already running`);
            return;
        }

        // Run every 24 hours (24 * 60 * 60 * 1000 milliseconds)
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

        console.log(`[ContentScheduler] Starting 24-hour scheduler: ${targetId}`);

        const intervalId = setInterval(async () => {
            console.log(`[ContentScheduler] Scheduled sync triggered: ${targetId}`);
            try {
                await fetcher.syncContent();
            } catch (error) {
                console.error(`[ContentScheduler] Scheduled sync failed for ${targetId}:`, error);
            }
        }, TWENTY_FOUR_HOURS);

        this.schedulers.set(targetId, intervalId);

        // Run initial sync
        fetcher.syncContent().catch(error => {
            console.error(`[ContentScheduler] Initial sync failed for ${targetId}:`, error);
        });
    }

    stop(): void;
    stop(id: string): void;
    stop(id?: string): void {
        const targetId = this.isLegacyMode && !id ? this.legacyId : id;

        if (!targetId) {
            throw new Error(`[ContentScheduler] No fetcher ID provided and not in legacy mode`);
        }

        const intervalId = this.schedulers.get(targetId);
        if (intervalId) {
            clearInterval(intervalId);
            this.schedulers.delete(targetId);
            console.log(`[ContentScheduler] Scheduler ${targetId} stopped`);
        }
    }

    startAll(): void {
        for (const id of this.fetchers.keys()) {
            this.start(id);
        }
    }

    stopAll(): void {
        for (const id of this.schedulers.keys()) {
            this.stop(id);
        }
    }

    getActiveFetchers(): string[] {
        return Array.from(this.fetchers.keys());
    }

    getActiveSchedulers(): string[] {
        return Array.from(this.schedulers.keys());
    }

    getFetcher(id: string): ContentFetcher | undefined {
        return this.fetchers.get(id);
    }

    async syncContent(id: string): Promise<void> {
        const fetcher = this.fetchers.get(id);
        if (!fetcher) {
            throw new Error(`[ContentScheduler] Fetcher ${id} not found`);
        }
        await fetcher.syncContent();
    }

    async syncAll(): Promise<void> {
        const promises = Array.from(this.fetchers.entries()).map(async ([id, fetcher]) => {
            try {
                await fetcher.syncContent();
            } catch (error) {
                console.error(`[ContentScheduler] Sync failed for ${id}:`, error);
            }
        });
        await Promise.all(promises);
    }
}
