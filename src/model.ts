import * as mysql from 'mysql2';
import { ModelMeta } from './decorator/meta';
import { db } from './db';

type rowType = mysql.RowDataPacket[] | mysql.RowDataPacket | mysql.OkPacket;
type rowsType = mysql.RowDataPacket[][] | mysql.RowDataPacket[] | mysql.OkPacket | mysql.OkPacket[];

function formatRow<T extends Model>(type: new () => T, row: rowType): T {
    const instance = new type();
    for (const propertyName in instance) {
        const propertyType = typeof instance[propertyName];
        if (propertyType !== 'function') {
            instance[propertyName] = row[String(propertyName)];
        }
    }
    return instance;
}

function formatRows<T extends Model>(type: new () => T, rows: rowsType): T[] {
    if (!Array.isArray(rows)) {
        return [];
    }
    const result: T[] = [];
    for (const row of rows) {
        const rowResult = formatRow<T>(type, row);
        if (rowResult) {
            result.push(rowResult);
        }
    }
    return result;
}

function condition(whereKey: string, whereValue: any): [string, any] {
    whereKey = whereKey.trim();
    const pos = whereKey.indexOf(' ');
    const field = pos > 0 ? '`' + whereKey.slice(0, pos) + '`' : '`' + whereKey + '`';
    let op = pos > 0 ? whereKey.slice(pos + 1) : '';
    op = op.trim().toUpperCase();
    let sql = '';
    let params: any[] = [];
    if (Array.isArray(whereValue)) {
        if (!op) {
            op = 'IN';
        }
        switch (op) {
            case 'IN':
            case 'NOT IN':
                sql = `${field} ${op} (?)`;
                params.push(whereValue);
                break;
            case 'BETWEEN':
                sql = `${field} BETWEEN ? AND ?`;
                params.push(whereValue[0], whereValue[1]);
                break;
            case 'NOT BETWEEN':
                sql = `${field} NOT BETWEEN ? AND ?`;
                params.push(whereValue[0], whereValue[1]);
                break;
            default:
                throw new Error(`This op (${op}) not support an array value`);
                break;
        }
    } else {
        if (!op) {
            op = '=';
        }
        switch (op) {
            case '=':
            case '!=':
            case '<>':
            case '>':
            case '>=':
            case '<':
            case '<=':
            case 'LIKE':
            case 'NOT LIKE':
                sql = `${field} ${op} ?`;
                params.push(whereValue);
                break;
            case 'IS NULL':
            case 'IS NOT NULL':
                sql = `${field} ${op}`;
                break;
            default:
                throw new Error('Invalid op or invalid value');
                break;
        }
    }
    return [sql, params];
}

async function _findOneByPk<T extends Model>(type: new () => T, id: number | string | boolean): Promise<T | undefined> {
    const tableName = ModelMeta.tables.get(type.name);
    const primaryKey = ModelMeta.primaryKeys.get(type.name) || 'id';
    if (!tableName) {
        throw new Error(`${type.name} 未指定表名`);
    }
    const [rows] = await db.query(`SELECT * FROM \`${tableName}\` WHERE \`${primaryKey}\`=?`, [id]);
    if (!rows || !Array.isArray(rows) || !rows.length) {
        return undefined;
    }
    return formatRow(type, rows[0]);
}

async function _findOne<T extends Model>(type: new () => T, options: FindOptions): Promise<T | undefined> {
    options.offset = 0;
    options.limit = 1;
    const data = await _findAll(type, options);
    if (!data.length) {
        return undefined;
    }
    return data[0];
}

async function _findAllByPk<T extends Model>(type: new () => T, idArr: Array<number | string | boolean>): Promise<T[]> {
    if (!idArr.length) {
        return [];
    }
    const tableName = ModelMeta.tables.get(type.name);
    const primaryKey = ModelMeta.primaryKeys.get(type.name) || 'id';
    if (!tableName) {
        throw new Error(`${type.name} 未指定表名`);
    }
    const [rows] = await db.query(`SELECT * FROM \`${tableName}\` WHERE \`${primaryKey}\` IN (?)`, [idArr]);
    if (!rows || !Array.isArray(rows) || !rows.length) {
        return [];
    }
    return formatRows(type, rows);
}

async function _findAll<T extends Model>(type: new () => T, options: FindOptions): Promise<T[]> {
    const tableName = ModelMeta.tables.get(type.name);
    if (!tableName) {
        throw new Error(`${type.name} 未指定表名`);
    }

    let sql = `SELECT * FROM \`${tableName}\``;
    const sqlParams: any[] = [];

    // WHERE
    if (options.where) {
        const whereArr: string[] = [];
        for (let whereKey in options.where) {
            const [item, params] = condition(whereKey, options.where[whereKey]);
            whereArr.push(item);
            sqlParams.push(...params);
        }
        if (whereArr.length) {
            sql += ' WHERE ' + whereArr.join(' AND ');
        }
    }

    // ORDER BY
    if (options.order) {
        const orderByArr: string[] = [];
        for (const orderItem of options.order) {
            let [field, type] = orderItem.split(' ');
            field = '`' + field.trim() + '`';
            type = type ? type.trim().toUpperCase() : '';
            if (!type) {
                type = 'ASC';
            }
            orderByArr.push(`${field} ${type}`);
        }
        if (orderByArr.length) {
            sql += ' ORDER BY ' + orderByArr.join(', ');
        }
    }

    // LIMIT
    if (options.limit) {
        if (options.offset) {
            sql += ' LIMIT ?,?';
            sqlParams.push(options.offset, options.limit);
        } else {
            sql += ' LIMIT ?';
            sqlParams.push(options.limit);
        }
    }

    const [rows] = await db.query(sql, sqlParams);
    if (!rows || !Array.isArray(rows) || !rows.length) {
        return [];
    }
    return formatRows(type, rows);
}

export interface FindOptions {
    where?: object;
    order?: Array<string>;
    offset?: number;
    limit?: number;
}

export class Model {
    protected static async _findOne<T extends Model>(type: new () => T, p1: any): Promise<T | undefined> {
        if (typeof p1 === 'object') {
            return _findOne(type, p1);
        } else {
            return _findOneByPk(type, p1);
        }
    }

    protected static async _findAll<T extends Model>(type: new () => T, p1: any): Promise<T[]> {
        if (typeof p1 === 'object') {
            return _findAll(type, p1);
        } else {
            return _findAllByPk(type, p1);
        }
    }

    protected static async _fetch<T extends Model>(
        type: new () => T,
        sql: string,
        params?: any[],
    ): Promise<T | undefined> {
        const [rows] = await db.query(sql, params);
        if (!rows || !Array.isArray(rows) || !rows.length) {
            return undefined;
        }
        return formatRow(type, rows[0]);
    }

    protected static async _fetchAll<T extends Model>(type: new () => T, sql: string, params?: any[]): Promise<T[]> {
        const [rows] = await db.query(sql, params);
        if (!rows || !Array.isArray(rows) || !rows.length) {
            return [];
        }
        return formatRows(type, rows);
    }

    protected static async _insert<T extends Model>(info: T): Promise<T> {
        const tableName = ModelMeta.tables.get(info.constructor.name);
        const primaryKey = ModelMeta.primaryKeys.get(info.constructor.name) || 'id';
        if (!tableName) {
            throw new Error(`${info.constructor.name} 未指定表名`);
        }
        if (info[primaryKey] === 0 || info[primaryKey] === '') {
            delete info[primaryKey];
        }
        const [affectedResult] = await db.query(`INSERT INTO \`${tableName}\` SET ?`, [info]);
        info[primaryKey] = affectedResult['insertId'];
        return info;
    }

    protected static async _update<T extends Model>(type: new () => T, p1: any, info: Object): Promise<number> {
        const tableName = ModelMeta.tables.get(type.name);
        const primaryKey = ModelMeta.primaryKeys.get(type.name) || 'id';
        if (!tableName) {
            throw new Error(`${type.name} 未指定表名`);
        }
        const updateFields: string[] = [];
        const updateParams: any[] = [];
        for (const field in info) {
            if (info[field] !== undefined && typeof info[field] !== 'function') {
                // 支持表达式，如 amount = amount + 1
                // field 内容为 “amount = amount + 1”，而 info[field] 为该表达式的参数数组
                if (field.indexOf('=') > 0) {
                    updateFields.push(field);
                    const fieldParmas = info[field] && Array.isArray(info[field]) ? info[field] : [];
                    updateParams.push(...fieldParmas);
                } else {
                    updateFields.push(`\`${field}\`=?`);
                    updateParams.push(info[field]);
                }
            }
        }
        if (!updateFields.length) {
            return 0;
        }

        let affectedResult;
        if (typeof p1 === 'object') {
            // update by options.where
            let sql = `UPDATE \`${tableName}\` SET ${updateFields.join(', ')}`;
            const sqlParams: any[] = updateParams;
            if (p1.where) {
                const whereArr: string[] = [];
                for (let whereKey in p1.where) {
                    const [item, params] = condition(whereKey, p1.where[whereKey]);
                    whereArr.push(item);
                    sqlParams.push(...params);
                }
                if (whereArr.length) {
                    sql += ' WHERE ' + whereArr.join(' AND ');
                }
            }
            [affectedResult] = await db.query(sql, sqlParams);
        } else {
            // update by primaryKey
            [affectedResult] = await db.query(
                `UPDATE \`${tableName}\` SET ${updateFields.join(', ')} WHERE \`${primaryKey}\`=?`,
                [...updateParams, p1],
            );
        }
        return affectedResult['affectedRows'] || 0;
    }

    // 删除不允许没指定条件
    protected static async _delete<T extends Model>(type: new () => T, p1: any): Promise<number> {
        const tableName = ModelMeta.tables.get(type.name);
        const primaryKey = ModelMeta.primaryKeys.get(type.name) || 'id';
        if (!tableName) {
            throw new Error(`${type.name} 未指定表名`);
        }

        let affectedResult;
        if (typeof p1 === 'object') {
            // delete by options.where
            let sql = `DELETE FROM \`${tableName}\``;
            const sqlParams: any[] = [];
            const whereArr: string[] = [];
            if (p1.where) {
                for (let whereKey in p1.where) {
                    const [item, params] = condition(whereKey, p1.where[whereKey]);
                    whereArr.push(item);
                    sqlParams.push(...params);
                }
                if (whereArr.length) {
                    sql += ' WHERE ' + whereArr.join(' AND ');
                }
            }
            if (!whereArr.length) {
                throw new Error(`删除 ${tableName} 表时需要指定 where 条件`);
            }
            [affectedResult] = await db.query(sql, sqlParams);
        } else {
            // delete by primaryKey
            [affectedResult] = await db.query(`DELETE FROM \`${tableName}\` WHERE \`${primaryKey}\`=?`, [p1]);
        }
        return affectedResult['affectedRows'] || 0;
    }

    protected static async _exec(sql: string, params?: any[]): Promise<number> {
        const [affectedResult] = await db.query(sql, params);
        if (!affectedResult || !affectedResult['affectedRows']) {
            return 0;
        }
        return affectedResult['affectedRows'];
    }
}
