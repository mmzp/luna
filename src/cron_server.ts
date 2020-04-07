import * as cluster from 'cluster';
import * as path from 'path';
import * as net from 'net';
import * as fs from 'fs';
import { processUncaughtHandler, getRootPath, logger } from './core';
import * as CronParser from 'cron-parser';
import { Task } from './task';
import { currentTime } from './lib/utils';
import * as os from 'os';

let sockPath = '';
const cronExecTimeMap: Map<number, Set<string>> = new Map();

interface RunOptions {
    workerNum?: number;
}
export class CronServer {
    async run(taskList: Task[], options?: RunOptions) {
        await processUncaughtHandler();
        sockPath = path.resolve(getRootPath(), 'run/cron_server.sock');

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

            const workerNum = options?.workerNum || os.cpus().length;
            for (let i = 0; i < workerNum; i++) {
                cluster.fork();
            }

            const listeningWorkers: cluster.Worker[] = [];

            cluster.once('listening', (worker, address) => {
                setInterval(() => {
                    for (const i in taskList) {
                        const task = taskList[i];
                        if (task.cron) {
                            try {
                                const cronInverval = CronParser.parseExpression(task.cron);
                                if (cronInverval.hasNext()) {
                                    const execTime = Math.floor(cronInverval.next().getTime() / 1000);
                                    let taskSet = cronExecTimeMap.get(execTime);
                                    if (taskSet && taskSet instanceof Set) {
                                        taskSet.add(i);
                                    } else {
                                        taskSet = new Set([i]);
                                    }
                                    cronExecTimeMap.set(execTime, taskSet);
                                }
                            } catch (err) {}
                        }
                    }
                }, 1000);

                setInterval(() => {
                    const currTime = currentTime();
                    const taskSet = cronExecTimeMap.get(currTime);
                    if (taskSet && taskSet instanceof Set) {
                        const taskArr = Array.from(taskSet);
                        if (listeningWorkers.length) {
                            const chuckSize = Math.ceil(taskArr.length / listeningWorkers.length);
                            for (let i = 0; i < listeningWorkers.length; i++) {
                                const chuckArr = taskArr.slice(i * chuckSize, (i + 1) * chuckSize);
                                listeningWorkers[i].send({
                                    cmd: 'tasks',
                                    taskIndexArr: chuckArr,
                                });
                            }
                        }
                    }
                }, 1000);
            });

            cluster.on('listening', (worker, address) => {
                listeningWorkers.push(worker);
                worker.on('message', msg => {});
            });

            cluster.on('exit', (worker, code, signal) => {
                if (Object.keys(cluster.workers).length < workerNum) {
                    // console.log('[ cluster ] refork worker');
                    cluster.fork();
                }
            });

            process.on('SIGINT', this.signalHandler);
            process.on('SIGTERM', this.signalHandler);
        } else {
            const server = net.createServer(conn => {});

            server.on('error', err => {
                logger.error('[ cron server ] server error:', err);
            });

            server.on('close', () => {
                logger.error('[ cron server ] worker close');
            });

            try {
                server.listen(sockPath, () => {});
            } catch (err) {
                logger.error('[ cron server ] server listen error:', err);
                process.exit(1);
            }

            process.on('message', async msg => {
                if (msg && msg.cmd) {
                    switch (msg.cmd) {
                        case 'tasks':
                            {
                                const taskIndexArr = msg.taskIndexArr;
                                if (taskIndexArr) {
                                    const promiseArr: any[] = [];
                                    for (const idx of taskIndexArr) {
                                        promiseArr.push(taskList[idx].exec());
                                    }
                                    if (promiseArr.length) {
                                        await Promise.all(promiseArr);
                                    }
                                }
                            }
                            break;
                    }
                }
            });
        }
    }

    private async signalHandler(signal) {
        if (['SIGINT', 'SIGTERM'].includes(signal)) {
            // console.log(`Server pid ${process.pid} stopped by ${signal}`);
            if (fs.existsSync(sockPath)) {
                fs.unlinkSync(sockPath);
            }
            process.exit(0);
        }
    }
}
