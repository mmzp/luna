import * as conf from './config';
import * as mysql from 'mysql2';

export const db = mysql
    .createPool({
        host: conf.get('db.host'),
        port: conf.get('db.port'),
        user: conf.get('db.username'),
        password: conf.get('db.password'),
        database: conf.get('db.database'),
        charset: conf.get('db.charset') || 'utf8mb4',
        connectTimeout: conf.get('db.connectTimeout'),
        supportBigNumbers: true,
        bigNumberStrings: true,
        waitForConnections: true,
        connectionLimit: conf.get('db.connectionLimit') || 20,
    })
    .promise();
