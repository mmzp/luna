import * as Koa from 'koa';
import * as Router from '@koa/router';
import * as bodyParser from 'koa-bodyparser';
import * as fs from 'fs';
import * as path from 'path';
import * as cluster from 'cluster';
import * as os from 'os';
import * as websockify from 'koa-websocket';
import * as net from 'net';
import got from 'got';
import * as ws from 'ws';

interface RunOptions {
    recvUrl: string;
}

class WebsocketServer {
    private requestClients: Map<number, ws> = new Map();

    async run(host: string, port: number, options: RunOptions) {
        const app = websockify(new Koa());
        const router = new Router();

        router.use(async (ctx, next) => {
            if (ctx.headers.token !== 'secret') {
                ctx.throw(401, 'Invalid token');
            }
            await next();
        });
        router.post('/ws/send', async ctx => {
            const { reqId, msg } = ctx.request.body;
            console.log(`[ws-send] reqId: ${reqId}, msg: ${msg}`);
            const reqIdByInt = parseInt(reqId);
            if (this.requestClients.has(reqIdByInt)) {
                this.requestClients.get(reqIdByInt)?.send(msg);
            }
            ctx.body = {};
        });
        router.post('/ws/broadcast', async ctx => {
            const { roomId, excludeReqIds, msg } = ctx.request.body;
            console.log(`[ws-broadcast] roomId: ${roomId}, excludeReqIds: ${excludeReqIds}, msg: ${msg}`);
            ctx.body = {};
        });

        app.use(bodyParser());
        app.use(router.routes());
        app.use(router.allowedMethods());

        app.ws.use(async (ctx, next) => {
            ctx.reqId = this.genReqId();
            this.requestClients.set(ctx.reqId, ctx.websocket);
            console.log('ws-connect', ctx.reqId);
            await next();
        });

        app.ws.use(async ctx => {
            ctx.websocket.send('hello~');
            ctx.websocket.on('message', async msg => {
                console.log(`[ ws-message ] ${msg}`);
                try {
                    const { statusCode, statusMessage } = await got.post(options.recvUrl, {
                        body: msg.toString(),
                        headers: {
                            'content-type': 'text/plain',
                        },
                    });
                    if (statusCode !== 200) {
                        ctx.websocket.send(`[error] ${statusCode} ${statusMessage}`);
                    }
                } catch (err) {
                    ctx.websocket.send(`[error] 0 ${err.message}`);
                }
            });
        });

        const server = app.listen(port, host);
        server.on('listening', () => {
            const address = server.address() as net.AddressInfo;
            console.log(`WebSocket Server start at ws://${address.address}:${address.port}`);
        });
    }

    private rand(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    private genReqId(): number {
        return Date.now() * 1000000 + this.rand(100000, 999999);
    }
}

export { WebsocketServer };
