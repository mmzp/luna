import * as cluster from 'cluster';
import * as path from 'path';
import * as net from 'net';
import * as fs from 'fs';
import { processUncaughtHandler, rootPath } from './core';
import * as CronParser from 'cron-parser';
import { Task } from './task';
import { currentTime } from './lib/utils';

let sockPath = '';

export class CronServer {
    async run(taskList: Task[]) {
        await processUncaughtHandler();
        sockPath = path.resolve(rootPath, 'run/cron_server.sock');

        if (cluster.isMaster) {
            const runPath = path.dirname(sockPath);
            if (!fs.existsSync(runPath)) {
                fs.mkdirSync(runPath, { recursive: true });
            } else {
                const stat = fs.statSync(runPath);
                if (!stat.isDirectory()) {
                    throw new Error(`run path (${runPath}) is not a directory`);
                }
            }

            const workerNum = 1;
            for (let i = 0; i < workerNum; i++) {
                cluster.fork();
            }

            cluster.once('listening', (worker, address) => {});

            cluster.on('listening', (worker, address) => {
                worker.on('message', msg => {});
            });

            cluster.on('exit', (worker, code, signal) => {
                if (Object.keys(cluster.workers).length < workerNum) {
                    console.log('[ cluster ] refork worker');
                    cluster.fork();
                }
            });

            process.on('SIGINT', this.signalHandler);
            process.on('SIGTERM', this.signalHandler);
        } else {
            const server = net.createServer(conn => {
                console.log('client connected');
            });

            server.on('error', err => {
                console.log('server error: ', err);
            });

            server.on('close', () => {
                console.log('Worker Server close');
            });

            try {
                server.listen(sockPath, () => {
                    setInterval(async () => {
                        const promiseArr: any[] = [];
                        const currTime = currentTime();
                        taskList.forEach(task => {
                            if (task.cron) {
                                const cronInverval = CronParser.parseExpression(task.cron);
                                // TODO:
                                if (cronInverval.hasNext()) {
                                    const execTime = Math.floor(cronInverval.next().getTime() / 1000);
                                    console.log('execTime', execTime, execTime - currTime);
                                }
                            }
                            promiseArr.push(task.exec());
                        });
                        if (promiseArr.length) {
                            await Promise.all(promiseArr);
                        }
                    }, 1000);
                });
            } catch (err) {
                console.log('server.listen error:', err.message);
                process.exit(1);
            }
        }
    }

    private async signalHandler(signal) {
        if (['SIGINT', 'SIGTERM'].includes(signal)) {
            console.log(`Server pid ${process.pid} stopped by ${signal}`);
            if (fs.existsSync(sockPath)) {
                fs.unlinkSync(sockPath);
            }
            process.exit(0);
        }
    }
}
