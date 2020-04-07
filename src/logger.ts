import * as pino from 'pino';

export function getLogger(logPath: string) {
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

    return pino(loggerOptions, loggerStream);
}
