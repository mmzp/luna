import { CronServer } from '../../src';
import { FetchVideoTask } from './fetch_video_task';
import { NoticeUserTask } from './notice_user_task';

const cronServer = new CronServer();
cronServer.run([new FetchVideoTask(), new NoticeUserTask()]);
