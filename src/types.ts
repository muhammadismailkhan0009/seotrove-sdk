export interface ContentApiResponse {
    sitemapXml: string;
    robotTxt: string;
    pages: ContentPage[];
}

export interface ContentPage {
    urlPath: string;
    html: string;
}

export interface ContentFetcherConfig {
    domain: string;
    installId: string;
    targetDirectory?: string;
    apiBaseUrl?: string;
}

export interface PublicContentRequest {
    domain?: string;
    slug: string;
}

export interface PublicDomainRequest {
    domain?: string;
}

export interface PublicContentPage {
    domain: string;
    slug: string;
    title: string;
    metaTitle: string;
    metaDescription: string;
    html: string;
    summary: string;
    updatedAt: string;
}

export interface SyncResult {
    success: boolean;
    message: string;
    filesCreated: string[];
    errors?: string[];
}

export class SeoTroveNotFoundError extends Error {
    constructor(message = 'SeoTrove content was not found') {
        super(message);
        this.name = 'SeoTroveNotFoundError';
    }
}
