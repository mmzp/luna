import * as crypto from 'crypto';
import { resolve } from 'dns';

export function currentTime(): number {
    return Math.floor(Date.now() / 1000);
}

export function rand(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

export function md5(str: string): string {
    return crypto
        .createHash('md5')
        .update(str)
        .digest('hex');
}

export function sha1(str: string): string {
    return crypto
        .createHash('sha1')
        .update(str)
        .digest('hex');
}

export async function sleep(time: number) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, time);
    });
}
