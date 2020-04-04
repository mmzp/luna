import * as Koa from 'koa';
import * as Router from '@koa/router';
import * as bodyParser from 'koa-bodyparser';
import * as path from 'path';
import * as cluster from 'cluster';
import * as os from 'os';
import { mw, processUncaughtHandler, scanDir } from './core';
import { Controller } from './controller';
import { RouterMeta } from './decorator/meta';
import * as error from './error';
import { logger } from './logger';
import ctxLogger = require('@u-work/koa-pino-logger');

interface RunOptions {
    workerNum?: number;
    middlewares?: Array<mw>;
}

class HttpServer {
    private stoppingWorkers: Array<cluster.Worker> = [];

    async run(host: string, port: number, options?: RunOptions) {
        await processUncaughtHandler();

        if (cluster.isMaster) {
            logger.info(`cluster master pid: ${process.pid}`);

            let reloadTimes = 0;
            let needReload = false;

            const workerNum = options?.workerNum || os.cpus().length;
            for (let i = 0; i < workerNum; i++) {
                cluster.fork();
            }

            cluster.once('listening', (worker, address) => {
                logger.info(`🔋 Server start at http://${address.address}:${address.port}`);
            });

            let newListeningCount = 0;
            let oldWorkers: Array<cluster.Worker | undefined>;
            cluster.on('listening', (worker, address) => {
                if (needReload) {
                    newListeningCount++;
                    if (newListeningCount === workerNum) {
                        for (const oldWorker of oldWorkers) {
                            if (oldWorker) {
                                this.shutdownWorker(oldWorker);
                            }
                        }

                        needReload = false;
                        newListeningCount = 0;
                    }
                }

                worker.on('message', msg => {
                    if (msg === 'worker:request-limited') {
                        // logger.info('worker:request-limited', process.pid, worker.process.pid);
                        if (!this.stoppingWorkers.includes(worker)) {
                            this.stoppingWorkers.push(worker);
                            cluster.fork();
                            this.shutdownWorker(worker);
                        } else {
                            // logger.info('worker stopping', worker.process.pid);
                        }
                    } else {
                        // logger.info(`[ worker ] pid: ${worker.process.pid}, message: ${msg}`);
                    }
                });
            });

            cluster.on('exit', (worker, code, signal) => {
                // logger.info('[ cluster ] worker exit. (pid: %d, code: %d)', worker.process.pid, code);
                if (Object.keys(cluster.workers).length < workerNum) {
                    // logger.info('[ cluster ] refork worker');
                    cluster.fork();
                }
            });

            // cluster.on('disconnect', worker => {
            //     logger.info('[ cluster ] worker disconnect. (pid: %d)', worker.process.pid);
            // });

            // 重启 worker 进程
            process.on('SIGUSR2', signal => {
                oldWorkers = Object.keys(cluster.workers).map(idx => cluster.workers[idx]);
                needReload = true;
                reloadTimes++;
                // logger.info('[ reload workers] ', reloadTimes);

                for (let i = 0; i < workerNum; i++) {
                    cluster.fork();
                }
            });

            process.on('SIGTERM', signal => {
                logger.info(`Server stopped ${signal}`);
                for (const idx in cluster.workers) {
                    const worker = cluster.workers[idx];
                    if (worker) {
                        this.shutdownWorker(worker);
                    }
                }
                process.exit(0);
            });
        } else {
            const app = await this.app(options);
            const server = app.listen(port, host);

            server.once('listening', () => {
                server.address();
            });

            let requestTimes = 0;
            server.on('request', (req, res) => {
                requestTimes++;

                if (process.send && process.connected) {
                    if (requestTimes > 10000) {
                        process.send('worker:request-limited');
                    } else {
                        process.send(`requestTimes=${requestTimes}`);
                    }
                }
            });

            process.on('message', msg => {
                if (msg === 'worker:stop') {
                    const killTimeout = setTimeout(() => {
                        logger.error('[ process ] killTimeout');
                        process.exit(1);
                    }, 15000);
                    server.close(err => {
                        logger.info('[ process ] worker server closed');
                        clearTimeout(killTimeout);
                        process.exit(0);
                    });
                }
            });
        }
    }

    private async app(options?: RunOptions) {
        const app = new Koa();
        const router = await this.route();

        app.use(
            ctxLogger({
                logger: logger,
                autoLogging: false,
            }),
        );

        if (options?.middlewares) {
            for (const mw of options.middlewares) {
                app.use(mw);
            }
        }

        // LunaError 重设
        app.use(async (ctx, next) => {
            try {
                await next();
            } catch (err) {
                if (err instanceof error.LunaError) {
                    if (err.code < 500) {
                        ctx.throw(err.code, err.message);
                    } else {
                        ctx.log.error(
                            'system error, code: %d, message: %s, stack: %s',
                            err.code,
                            err.message,
                            err.stack,
                        );
                        ctx.throw(500, '系统错误，请稍后重试');
                    }
                } else {
                    throw err;
                }
            }
        });

        // 数据库错误重设为 DbError 错误类
        app.use(async (ctx, next) => {
            try {
                // // 连接数据库
                // ctx.db = pool;

                await next();
            } catch (err) {
                if (err.errno && err.sqlState) {
                    let errCode = error.DB_SQL_EXECUTE_ERROR;
                    if (err.errno === 1062) {
                        errCode = error.DB_DUPLICATE_KEY;
                    }
                    err = new error.DbError(
                        errCode,
                        err.message,
                        err.errno,
                        err.sqlState,
                        err.stack,
                        err.query,
                        err.parameters,
                    );
                }

                throw err;
            }
        });

        app.use(
            bodyParser({
                enableTypes: ['json', 'form', 'text'],
            }),
        );
        app.use(router.routes());
        app.use(router.allowedMethods());
        return app;
    }

    private async route() {
        const router = new Router();

        const controllerPath = path.resolve(__dirname, './controller');
        const controllerFiles = await scanDir(controllerPath);
        for (const controllerFile of controllerFiles) {
            if (!['.ts', '.js'].includes(controllerFile.substring(controllerFile.indexOf('.')))) {
                continue;
            }
            const controllerImport = require(`${controllerPath}/${controllerFile}`);
            const controllerClass = controllerImport.default;
            if (controllerClass && typeof controllerClass === 'function') {
                // 实例化控制器
                const controllerInstance = new controllerClass();
                if (controllerInstance instanceof Controller) {
                    const controllerMiddlewares = RouterMeta.getControllerMiddlewares(controllerClass);
                    for (const fn of Object.getOwnPropertyNames(Object.getPrototypeOf(controllerInstance))) {
                        if (controllerInstance[fn].constructor.name === 'AsyncFunction') {
                            const routerMetaInfo = RouterMeta.get(controllerClass, fn);

                            let routerPath = '/';
                            if (routerMetaInfo?.path) {
                                routerPath = routerMetaInfo.path;
                            } else {
                                const controllerName = controllerFile.substring(0, controllerFile.indexOf('.'));
                                routerPath += controllerName;
                                if (fn !== 'index') {
                                    routerPath += '/' + fn;
                                }

                                // 修正首页路由路径
                                if (controllerName === 'home' && fn === 'index') {
                                    routerPath = '/';
                                }
                            }

                            let routerMethod = routerMetaInfo?.method;
                            const allowedMethods = [
                                'get',
                                'post',
                                'put',
                                'link',
                                'unlink',
                                'delete',
                                'head',
                                'options',
                                'patch',
                                'all',
                            ];
                            if (!routerMethod || !allowedMethods.includes(routerMethod)) {
                                routerMethod = 'all';
                            }

                            const actionMiddlewares = RouterMeta.getActionMiddlewares(controllerClass, fn);
                            const middlewares: Array<mw> = [];
                            if (controllerMiddlewares && controllerMiddlewares.length) {
                                middlewares.push(...controllerMiddlewares);
                            }
                            if (actionMiddlewares && actionMiddlewares.length) {
                                middlewares.push(...actionMiddlewares);
                            }
                            middlewares.push(controllerInstance[fn]);

                            router[routerMethod](routerPath, ...middlewares);
                        }
                    }
                }
            }
        }
        return router;
    }

    private shutdownWorker(worker: cluster.Worker) {
        const timeoutHandle = setTimeout(() => {
            worker.process.kill();
            this.removeStoppingWorker(worker);
            logger.info(`[ shutdown ] timeout, kill worker ${worker.process.pid}`);
        }, 15000);
        worker.on('disconnect', () => {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
            this.removeStoppingWorker(worker);
            logger.info(`[ disconnect ] shutdown worker ${worker.process.pid}`);
        });
        // 停止接收新请求，等待旧请求结束后会结束进程
        worker.send('worker:stop');
        worker.disconnect();
    }

    private removeStoppingWorker(worker: cluster.Worker) {
        const pos = this.stoppingWorkers.indexOf(worker);
        if (pos !== -1) {
            this.stoppingWorkers.splice(pos, 1);
        }
    }
}

export { HttpServer };
