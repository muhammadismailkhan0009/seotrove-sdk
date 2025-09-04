export interface ContentApiResponse {
    sitemapXml: string;
    robotTxt: string;
    pages: ContentPage[];
}

export interface ContentPage {
    urlPath: string;
    title: string;
    html: string;
}

export interface ContentFetcherConfig {
    domain: string;
    installId: string;
    targetDirectory: string;
}

export interface SyncResult {
    success: boolean;
    message: string;
    filesCreated: string[];
    errors?: string[];
}
