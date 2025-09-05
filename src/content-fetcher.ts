import path from 'path';
import { ContentApiResponse, ContentFetcherConfig, SyncResult } from './types';
import { FileManager } from './file-manager';

// Check if we're in a browser environment
if (typeof globalThis !== 'undefined' && 'window' in globalThis) {
    throw new Error('ContentFetcher can only be used on the server side');
}

export class ContentFetcher {
    private config: ContentFetcherConfig;
    private intervalId: NodeJS.Timeout | null = null;
    private isFirstSync: boolean = true;

    constructor(config: ContentFetcherConfig) {
        this.config = config;
    }

    async fetchContent(): Promise<ContentApiResponse> {
        const url = `https://api.seotrove.com/api/v1/sdk/${this.config.domain}/content?installId=${this.config.installId}`;

        console.log(`[${this.config.domain}] Fetching new content from: ${url}`);

        try {
            const response = await fetch(url);

            if (!response.ok) {
                // Handle the "No generated pages to publish" case
                if (response.status === 404) {
                    const errorData = await response.json().catch(() => ({})) as any;
                    if (errorData.error === "No generated pages to publish.") {
                        console.log(`[${this.config.domain}] No new content available to sync`);
                        return {
                            sitemapXml: '',
                            robotTxt: '',
                            pages: []
                        };
                    }
                }
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as ContentApiResponse;
            console.log(`[${this.config.domain}] New content fetched successfully - ${data.pages?.length || 0} pages`);
            return data;
        } catch (error) {
            throw new Error(`Failed to fetch new content: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async fetchPreviouslyPublishedContent(): Promise<ContentApiResponse> {
        const url = `https://api.seotrove.com/api/v1/sdk/${this.config.domain}/content/previously-published?installId=${this.config.installId}`;

        console.log(`[${this.config.domain}] Fetching previously published content from: ${url}`);

        try {
            const response = await fetch(url);

            if (!response.ok) {
                // Handle the "No generated pages to publish" case
                if (response.status === 404) {
                    const errorData = await response.json().catch(() => ({})) as any;
                    if (errorData.error === "No generated pages to publish.") {
                        console.log(`[${this.config.domain}] No previously published content available`);
                        return {
                            sitemapXml: '',
                            robotTxt: '',
                            pages: []
                        };
                    }
                }
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as ContentApiResponse;
            console.log(`[${this.config.domain}] Previously published content fetched successfully - ${data.pages?.length || 0} pages`);
            return data;
        } catch (error) {
            throw new Error(`Failed to fetch previously published content: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async fetchAllContent(): Promise<ContentApiResponse> {
        console.log(`[${this.config.domain}] Fetching all content (new + previously published)...`);

        try {
            // Fetch both new and previously published content in parallel
            // Handle cases where one might fail (404) but the other succeeds
            const [newContentResult, previousContentResult] = await Promise.allSettled([
                this.fetchContent(),
                this.fetchPreviouslyPublishedContent()
            ]);

            // Get successful results or empty content for failed ones
            const newContent = newContentResult.status === 'fulfilled' 
                ? newContentResult.value 
                : { sitemapXml: '', robotTxt: '', pages: [] };

            const previousContent = previousContentResult.status === 'fulfilled' 
                ? previousContentResult.value 
                : { sitemapXml: '', robotTxt: '', pages: [] };

            // Log any failures
            if (newContentResult.status === 'rejected') {
                console.log(`[${this.config.domain}] New content fetch failed: ${newContentResult.reason}`);
            }
            if (previousContentResult.status === 'rejected') {
                console.log(`[${this.config.domain}] Previously published content fetch failed: ${previousContentResult.reason}`);
            }

            // Merge the content
            const mergedContent: ContentApiResponse = {
                sitemapXml: newContent.sitemapXml || previousContent.sitemapXml,
                robotTxt: newContent.robotTxt || previousContent.robotTxt,
                pages: [...(previousContent.pages || []), ...(newContent.pages || [])]
            };

            console.log(`[${this.config.domain}] All content merged successfully - Total: ${mergedContent.pages?.length || 0} pages (${previousContent.pages?.length || 0} previous + ${newContent.pages?.length || 0} new)`);
            return mergedContent;
        } catch (error) {
            throw new Error(`Failed to fetch all content: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async createFiles(content: ContentApiResponse): Promise<SyncResult> {
        const filesCreated: string[] = [];
        const errors: string[] = [];
        const startTime = Date.now();

        try {
            const baseDir = path.resolve(this.config.targetDirectory);

            // Create sitemap.xml
            if (content.sitemapXml) {
                try {
                    const sitemapPath = path.join(baseDir, 'sitemap.xml');
                    await FileManager.writeFile(sitemapPath, content.sitemapXml);
                    filesCreated.push('sitemap.xml');
                    console.log(`[${this.config.domain}] Created sitemap.xml`);
                } catch (error) {
                    const errorMsg = `Failed to create sitemap.xml: ${error instanceof Error ? error.message : 'Unknown error'}`;
                    errors.push(errorMsg);
                    console.error(`[${this.config.domain}] ${errorMsg}`);
                }
            }

            // Create robots.txt
            if (content.robotTxt) {
                try {
                    const robotsPath = path.join(baseDir, 'robots.txt');
                    await FileManager.writeFile(robotsPath, content.robotTxt);
                    filesCreated.push('robots.txt');
                    console.log(`[${this.config.domain}] Created robots.txt`);
                } catch (error) {
                    const errorMsg = `Failed to create robots.txt: ${error instanceof Error ? error.message : 'Unknown error'}`;
                    errors.push(errorMsg);
                    console.error(`[${this.config.domain}] ${errorMsg}`);
                }
            }

            // Create page files
            if (content.pages && Array.isArray(content.pages)) {
                for (const page of content.pages) {
                    try {
                        // Ensure urlPath has .html extension
                        let urlPath = page.urlPath;
                        if (!urlPath.endsWith('.html')) {
                            urlPath = urlPath + '.html';
                        }

                        // Split urlPath into directory and filename
                        const pageDir = path.dirname(urlPath);
                        const pageFileName = path.basename(urlPath);

                        // Create the full directory path
                        const fullDir = pageDir === '.' ? baseDir : path.join(baseDir, pageDir);
                        await FileManager.ensureDirectoryExists(fullDir);

                        // Use the exact filename from urlPath
                        const filePath = path.join(fullDir, pageFileName);

                        await FileManager.writeFile(filePath, page.html);
                        const relativePath = path.relative(baseDir, filePath);
                        filesCreated.push(relativePath);
                        console.log(`[${this.config.domain}] Created page: ${relativePath}`);

                    } catch (pageError) {
                        const errorMsg = `Failed to create page ${page.urlPath}: ${pageError instanceof Error ? pageError.message : 'Unknown error'}`;
                        errors.push(errorMsg);
                        console.error(`[${this.config.domain}] ${errorMsg}`);
                    }
                }
            }

            const duration = Date.now() - startTime;
            console.log(`[${this.config.domain}] File creation completed: ${filesCreated.length} files created, ${errors.length} errors, ${duration}ms`);

            const result: SyncResult = {
                success: errors.length === 0,
                message: errors.length === 0
                    ? `Successfully created ${filesCreated.length} files in ${duration}ms`
                    : `Created ${filesCreated.length} files with ${errors.length} errors in ${duration}ms`,
                filesCreated
            };

            if (errors.length > 0) {
                result.errors = errors;
            }

            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMsg = `Failed to create files: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(`[${this.config.domain}] ${errorMsg} (${duration}ms)`);

            return {
                success: false,
                message: errorMsg,
                filesCreated,
                errors: [errorMsg]
            };
        }
    }

    async syncContent(): Promise<SyncResult> {
        const startTime = Date.now();

        try {
            console.log(`[${this.config.domain}] Starting content sync...`);

            let content: ContentApiResponse;

            if (this.isFirstSync) {
                console.log(`[${this.config.domain}] First sync - attempting to fetch all content...`);
                try {
                    content = await this.fetchAllContent();
                } catch (error) {
                    console.log(`[${this.config.domain}] Failed to fetch all content on first sync, falling back to new content only: ${error}`);
                    content = await this.fetchContent();
                }
            } else {
                console.log(`[${this.config.domain}] Subsequent sync - fetching new content only...`);
                content = await this.fetchContent();
            }

            const result = await this.createFiles(content);

            // Mark that first sync is complete
            if (this.isFirstSync) {
                this.isFirstSync = false;
                console.log(`[${this.config.domain}] First sync completed - future syncs will only fetch new content`);
            }

            const duration = Date.now() - startTime;
            console.log(`[${this.config.domain}] Sync completed: ${result.message} (Total: ${duration}ms)`);
            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMsg = `Content sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(`[${this.config.domain}] ${errorMsg} (${duration}ms)`);

            return {
                success: false,
                message: errorMsg,
                filesCreated: [],
                errors: [errorMsg]
            };
        }
    }

    async syncNewContentOnly(): Promise<SyncResult> {
        const startTime = Date.now();

        try {
            console.log(`[${this.config.domain}] Starting new content sync...`);

            const content = await this.fetchContent();
            const result = await this.createFiles(content);

            const duration = Date.now() - startTime;
            console.log(`[${this.config.domain}] New content sync completed: ${result.message} (Total: ${duration}ms)`);
            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMsg = `New content sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(`[${this.config.domain}] ${errorMsg} (${duration}ms)`);

            return {
                success: false,
                message: errorMsg,
                filesCreated: [],
                errors: [errorMsg]
            };
        }
    }

    async syncPreviousContentOnly(): Promise<SyncResult> {
        const startTime = Date.now();

        try {
            console.log(`[${this.config.domain}] Starting previously published content sync...`);

            const content = await this.fetchPreviouslyPublishedContent();
            const result = await this.createFiles(content);

            const duration = Date.now() - startTime;
            console.log(`[${this.config.domain}] Previously published content sync completed: ${result.message} (Total: ${duration}ms)`);
            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMsg = `Previously published content sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(`[${this.config.domain}] ${errorMsg} (${duration}ms)`);

            return {
                success: false,
                message: errorMsg,
                filesCreated: [],
                errors: [errorMsg]
            };
        }
    }

    async syncAllContent(): Promise<SyncResult> {
        const startTime = Date.now();

        try {
            console.log(`[${this.config.domain}] Starting full content sync (new + previously published)...`);

            const content = await this.fetchAllContent();
            const result = await this.createFiles(content);

            const duration = Date.now() - startTime;
            console.log(`[${this.config.domain}] Full content sync completed: ${result.message} (Total: ${duration}ms)`);
            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMsg = `Full content sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(`[${this.config.domain}] ${errorMsg} (${duration}ms)`);

            return {
                success: false,
                message: errorMsg,
                filesCreated: [],
                errors: [errorMsg]
            };
        }
    }

    startScheduler(): void {
        if (this.intervalId) {
            console.log(`[${this.config.domain}] Scheduler already running`);
            return;
        }

        // Run every 24 hours (24 * 60 * 60 * 1000 milliseconds)
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

        console.log(`[${this.config.domain}] Starting 24-hour scheduler...`);

        this.intervalId = setInterval(async () => {
            console.log(`[${this.config.domain}] Running scheduled content sync...`);
            try {
                await this.syncContent();
            } catch (error) {
                console.error(`[${this.config.domain}] Scheduled sync failed:`, error);
            }
        }, TWENTY_FOUR_HOURS);

        console.log(`[${this.config.domain}] Scheduler started - next sync in 24 hours`);

        // Run initial sync
        this.syncContent();
    }

    stopScheduler(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log(`[${this.config.domain}] Scheduler stopped`);
        }
    }

    updateConfig(newConfig: Partial<ContentFetcherConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    resetFirstSyncFlag(): void {
        this.isFirstSync = true;
        console.log(`[${this.config.domain}] First sync flag reset - next sync will fetch all content`);
    }

    isFirstSyncPending(): boolean {
        return this.isFirstSync;
    }

    // Alias for better naming consistency - checks if this is the first sync
    checkIsFirstSync(): boolean {
        return this.isFirstSync;
    }

    /**
     * Manually sync only previously published content
     */
    async syncWithPreviousContent(): Promise<SyncResult> {
        return this.syncPreviousContentOnly();
    }

    /**
     * Manually sync both new and previously published content
     */
    async syncAllContentManual(): Promise<SyncResult> {
        return this.syncAllContent();
    }

    private sanitizeFileName(filename: string): string {
        return filename
            .replace(/[^a-z0-9]/gi, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .toLowerCase();
    }
}
