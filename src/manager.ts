import { fork } from 'child_process';
import * as fs from 'fs';
import { getRootPath, getBasePath, logger } from './core';

class Manager {
    private runPath = `${getRootPath()}/run`;
    private managerPidFile = '';
    private moduleServerPidMap: Map<string, string> = new Map();
    private modulePaths: Array<string> = [];

    constructor(modulePaths: Array<string>) {
        this.managerPidFile = `${this.runPath}/manager.pid`;
        this.modulePaths = modulePaths;
    }

    run() {
        if (!fs.existsSync(this.runPath)) {
            fs.mkdirSync(this.runPath, { recursive: true });
        } else {
            const stat = fs.statSync(this.runPath);
            if (!stat.isDirectory()) {
                logger.error('Manager run failed, runPath (%s) is not a directory', this.runPath);
                return;
            }
        }

        fs.writeFileSync(`${this.runPath}/manager.pid`, process.pid);
        logger.info(`manager pid ${process.pid}`);

        this.startModuleServer(this.modulePaths);

        process.on('SIGINT', signal => {
            for (const [modulePath, pidFile] of this.moduleServerPidMap) {
                if (!fs.existsSync(pidFile)) {
                    logger.error('Stop server %s failed, pidFile (%s) not exists', modulePath, pidFile);
                    continue;
                }
                const pid = parseInt(fs.readFileSync(pidFile).toString()) || 0;
                if (pid < 0) {
                    logger.error('Stop server %s failed, pidFile (%s) not valid pid', modulePath, pidFile);
                    continue;
                }
                fs.unlinkSync(pidFile);
                process.kill(pid);
            }
            fs.unlinkSync(this.managerPidFile);
            process.exit(0);
        });
        process.on('SIGTERM', signal => {
            for (const [modulePath, pidFile] of this.moduleServerPidMap) {
                if (!fs.existsSync(pidFile)) {
                    logger.error('Stop server %s failed, pidFile (%s) not exists', modulePath, pidFile);
                    continue;
                }
                const pid = parseInt(fs.readFileSync(pidFile).toString()) || 0;
                if (pid < 0) {
                    logger.error('Stop server %s failed, pidFile (%s) not valid pid', modulePath, pidFile);
                    continue;
                }
                fs.unlinkSync(pidFile);
                process.kill(pid);
            }
            fs.unlinkSync(this.managerPidFile);
            process.exit(0);
        });
        process.on('SIGUSR2', signal => {
            for (const [modulePath, pidFile] of this.moduleServerPidMap) {
                if (!fs.existsSync(pidFile)) {
                    logger.error('Restart server %s failed, pidFile (%s) not exists', modulePath, pidFile);
                    process.exit(-1);
                }
                const pid = parseInt(fs.readFileSync(pidFile).toString()) || 0;
                if (pid < 0) {
                    logger.error('Restart server %s failed, pidFile (%s) not valid pid', modulePath, pidFile);
                    process.exit(-1);
                }
                process.kill(pid);
            }
            this.startModuleServer(this.modulePaths);
        });
    }

    startModuleServer(modulePaths: Array<string>) {
        for (const modulePath of modulePaths) {
            const forked = fork(`${getBasePath()}/${modulePath}`);
            const pidFile = `${this.runPath}/${modulePath.replace('/', '-')}.pid`;
            fs.writeFileSync(pidFile, forked.pid);
            this.moduleServerPidMap.set(modulePath, pidFile);

            forked.on('message', msg => {
                logger.info(`message from ${forked.pid}: ${msg}`);
            });
        }
    }
}

export { Manager };
