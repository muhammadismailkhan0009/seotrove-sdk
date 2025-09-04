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

    constructor(config: ContentFetcherConfig) {
        this.config = config;
    }

    async fetchContent(): Promise<ContentApiResponse> {
        const url = `https://api.seotrove.com/api/v1/sdk/${this.config.domain}/content?installId=${this.config.installId}`;

        console.log(`[${this.config.domain}] Fetching content from: ${url}`);

        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as ContentApiResponse;
            console.log(`[${this.config.domain}] Content fetched successfully - ${data.pages?.length || 0} pages`);
            return data;
        } catch (error) {
            throw new Error(`Failed to fetch content: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
                        // Split urlPath into directory and filename
                        const pageDir = path.dirname(page.urlPath);
                        const pageFileName = path.basename(page.urlPath);

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
                        const errorMsg = `Failed to create page ${page.title}: ${pageError instanceof Error ? pageError.message : 'Unknown error'}`;
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

            const content = await this.fetchContent();
            const result = await this.createFiles(content);

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

    private sanitizeFileName(filename: string): string {
        return filename
            .replace(/[^a-z0-9]/gi, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .toLowerCase();
    }
}
