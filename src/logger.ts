import * as pino from 'pino';
import { rootPath } from './core';

const logPath = `${rootPath}/logs`;
const isTTY = process.stdout.isTTY;

const loggerOptions: pino.LoggerOptions = {
    useLevelLabels: true,
    prettyPrint: {
        colorize: isTTY,
        translateTime: 'yyyy-mm-dd HH:MM:ss',
        ignore: 'pid,hostname,req,res',
    },
};

const loggerStream = isTTY ? process.stdout : pino.destination(`${logPath}/default.log`);

const logger = pino(loggerOptions, loggerStream);

export { logger };
