import fs from 'fs/promises';
import path from 'path';

export class FileManager {
    static async ensureDirectoryExists(dirPath: string): Promise<void> {
        try {
            await fs.access(dirPath);
        } catch {
            await fs.mkdir(dirPath, { recursive: true });
        }
    }

    static async writeFile(filePath: string, content: string): Promise<void> {
        const dir = path.dirname(filePath);
        await this.ensureDirectoryExists(dir);
        await fs.writeFile(filePath, content, 'utf-8');
    }

    static sanitizeFileName(fileName: string): string {
        // Remove or replace invalid characters for file names
        return fileName
            .replace(/[<>:"/\\|?*]/g, '-')
            .replace(/\s+/g, '-')
            .toLowerCase()
            .substring(0, 100);
    }

    static async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}
