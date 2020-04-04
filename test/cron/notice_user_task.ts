import { Task, sleep } from '../../src';

export class NoticeUserTask extends Task {
    cron = '* * * * * *';

    async exec(): Promise<boolean | void> {
        await sleep(2000);
        console.log('NoticeUserTask...');
    }
}
