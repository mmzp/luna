import * as Koa from 'koa';
import * as path from 'path';
import * as fs from 'fs';
import { getLogger } from './logger';

export interface mw {
    (ctx: Koa.Context, next: Koa.Next): Promise<void>;
}

let _basePath = __dirname;
let _rootPath = path.dirname(_basePath);

export function setBasePath(basePath: string) {
    _basePath = basePath;
    _rootPath = path.dirname(basePath);
}

export function getBasePath() {
    return _basePath;
}

export function getRootPath() {
    return _rootPath;
}

const logPath = `${_rootPath}/logs`;
export const logger = getLogger(logPath);

export async function scanDir(path: string, prefix = ''): Promise<Array<string>> {
    const files: Array<string> = [];
    const dir = fs.opendirSync(path);
    for await (const dirent of dir) {
        if (dirent.isFile()) {
            if (prefix) {
                files.push(`${prefix}/${dirent.name}`);
            } else {
                files.push(dirent.name);
            }
        } else if (dirent.isDirectory()) {
            const subFiles = await scanDir(`${path}/${dirent.name}`, dirent.name);
            files.push(...subFiles);
        }
    }
    return files;
}

export async function processUncaughtHandler() {
    process.on('unhandledRejection', (reason, promise) => {
        if (reason && reason instanceof Error) {
            logger.error('💣 unhandledRejection err: %s, stack: %s', reason.message, JSON.stringify(reason.stack));
        }
    });

    process.on('uncaughtException', err => {
        logger.error(`💣 uncaughtException err: %s, stack: %s`, err.message, JSON.stringify(err.stack));
        process.exit(1);
    });
}
