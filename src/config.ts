import * as toml from '@iarna/toml';
import * as fs from 'fs';
import * as path from 'path';
import { rootPath } from './core';

const env = process.env._ENV && ['local', 'dev'].includes(process.env._ENV) ? process.env._ENV : 'prod';

const context = fs.readFileSync(path.resolve(rootPath, `config/main.${env}.toml`));
const conf = toml.parse(context.toString());

export function get(key: string) {
    if (key === '') {
        return conf;
    }
    const keySegments = key.split('.');
    let value: any = undefined;
    let currentItem: any = conf;
    for (const currentKey of keySegments) {
        if (currentItem[currentKey] === undefined) {
            return undefined;
        }
        value = currentItem[currentKey];
        currentItem = value;
    }
    return value;
}
