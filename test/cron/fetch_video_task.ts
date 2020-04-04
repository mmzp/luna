import { Task, sleep } from '../../src';

export class FetchVideoTask extends Task {
    cron = '* * * * * *';

    async exec(): Promise<boolean | void> {
        await sleep(3000);
        console.log('FetchVideoTask...');
    }
}
