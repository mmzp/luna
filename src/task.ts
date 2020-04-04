export abstract class Task {
    cron: string = '';
    abstract async exec(): Promise<boolean | void>;
}
