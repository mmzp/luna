import * as mysql from 'mysql2';
import { ModelMeta } from './decorator/meta';
import { db } from './db';
import { PoolConnection } from 'mysql2/promise';

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

async function _findOneByPk<T extends Model>(
    type: new () => T,
    id: number | string | boolean,
    conn?: PoolConnection,
): Promise<T | undefined> {
    const tableName = ModelMeta.tables.get(type.name);
    const primaryKey = ModelMeta.primaryKeys.get(type.name) || 'id';
    if (!tableName) {
        throw new Error(`${type.name} 未指定表名`);
    }
    const sqlStr = `SELECT * FROM \`${tableName}\` WHERE \`${primaryKey}\`=?`;
    const params = [id];
    let result;
    if (conn) {
        [result] = await conn.query(sqlStr, params);
    } else {
        [result] = await db.query(sqlStr, params);
    }
    if (!result || !Array.isArray(result) || !result.length) {
        return undefined;
    }
    return formatRow(type, result[0]);
}

async function _findOne<T extends Model>(
    type: new () => T,
    options: FindOptions,
    conn?: PoolConnection,
): Promise<T | undefined> {
    options.offset = 0;
    options.limit = 1;
    const data = await _findAll(type, options, conn);
    if (!data.length) {
        return undefined;
    }
    return data[0];
}

async function _findAllByPk<T extends Model>(
    type: new () => T,
    idArr: Array<number | string | boolean>,
    conn?: PoolConnection,
): Promise<T[]> {
    if (!idArr.length) {
        return [];
    }
    const tableName = ModelMeta.tables.get(type.name);
    const primaryKey = ModelMeta.primaryKeys.get(type.name) || 'id';
    if (!tableName) {
        throw new Error(`${type.name} 未指定表名`);
    }
    const sqlStr = `SELECT * FROM \`${tableName}\` WHERE \`${primaryKey}\` IN (?)`;
    const params = [idArr];
    let result;
    if (conn) {
        [result] = await conn.query(sqlStr, params);
    } else {
        [result] = await db.query(sqlStr, params);
    }
    if (!result || !Array.isArray(result) || !result.length) {
        return [];
    }
    return formatRows(type, result);
}

async function _findAll<T extends Model>(type: new () => T, options: FindOptions, conn?: PoolConnection): Promise<T[]> {
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

    let result;
    if (conn) {
        [result] = await conn.query(sql, sqlParams);
    } else {
        [result] = await db.query(sql, sqlParams);
    }
    if (!result || !Array.isArray(result) || !result.length) {
        return [];
    }
    return formatRows(type, result);
}

export { PoolConnection };

export interface FindOptions {
    where?: object;
    order?: Array<string>;
    offset?: number;
    limit?: number;
}

export interface InsertOptions {
    ignoreDuplicate?: boolean;
    updateFieldsOnDuplicate?: string[];
}

export interface BatchInsertOptions {
    ignoreDuplicate?: boolean;
    updateFieldsOnDuplicate?: string[];
    batchCount?: number;
}

export interface BatchUpdateOptions {
    updateFields?: string[];
    keyFields?: string[];
    batchCount?: number;
}

export class Model {
    protected static async _findOne<T extends Model>(
        type: new () => T,
        p1: any,
        conn?: PoolConnection,
    ): Promise<T | undefined> {
        if (typeof p1 === 'object') {
            return _findOne(type, p1, conn);
        } else {
            return _findOneByPk(type, p1, conn);
        }
    }

    protected static async _findAll<T extends Model>(type: new () => T, p1: any, conn?: PoolConnection): Promise<T[]> {
        if (typeof p1 === 'object') {
            return _findAll(type, p1, conn);
        } else {
            return _findAllByPk(type, p1, conn);
        }
    }

    protected static async _fetch<T extends Model>(
        type: new () => T,
        sql: string,
        params?: any[],
        conn?: PoolConnection,
    ): Promise<T | undefined> {
        let result;
        if (conn) {
            [result] = await conn.query(sql, params);
        } else {
            [result] = await db.query(sql, params);
        }
        if (!result || !Array.isArray(result) || !result.length) {
            return undefined;
        }
        return formatRow(type, result[0]);
    }

    protected static async _fetchAll<T extends Model>(
        type: new () => T,
        sql: string,
        params?: any[],
        conn?: PoolConnection,
    ): Promise<T[]> {
        let result;
        if (conn) {
            [result] = await conn.query(sql, params);
        } else {
            [result] = await db.query(sql, params);
        }
        if (!result || !Array.isArray(result) || !result.length) {
            return [];
        }
        return formatRows(type, result);
    }

    protected static async _insert<T extends Model>(
        info: T,
        options?: InsertOptions,
        conn?: PoolConnection,
    ): Promise<T> {
        const tableName = ModelMeta.tables.get(info.constructor.name);
        const primaryKey = ModelMeta.primaryKeys.get(info.constructor.name) || 'id';
        if (!tableName) {
            throw new Error(`${info.constructor.name} 未指定表名`);
        }
        if (info[primaryKey] === 0 || info[primaryKey] === '') {
            delete info[primaryKey];
        }
        // 'INSERT IGNORE' or 'ON DUPLICATE KEY UPDATE'
        let ignoreStr = '';
        let duplicateStr = '';
        if (options && options.ignoreDuplicate === true) {
            ignoreStr = ' IGNORE';
        } else if (options && options.updateFieldsOnDuplicate) {
            let keyStrArr: Array<string> = [];
            if (options.updateFieldsOnDuplicate.length) {
                keyStrArr = options.updateFieldsOnDuplicate.map(k => `${k} = VALUES(${k})`);
            } else {
                for (const field in info) {
                    if (field !== primaryKey) {
                        keyStrArr.push(`${field} = VALUES(${field})`);
                    }
                }
            }
            duplicateStr = ` ON DUPLICATE KEY UPDATE ${keyStrArr.join(',')}`;
        }
        const sqlStr = `INSERT${ignoreStr} INTO \`${tableName}\` SET ?${duplicateStr}`;
        const params = [info];
        let affectedResult;
        if (conn) {
            [affectedResult] = await conn.query(sqlStr, params);
        } else {
            [affectedResult] = await db.query(sqlStr, params);
        }
        info[primaryKey] = affectedResult['insertId'];
        return info;
    }

    protected static async _update<T extends Model>(
        type: new () => T,
        p1: any,
        info: Object,
        conn?: PoolConnection,
    ): Promise<number> {
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

        let sql = '';
        let sqlParams: any[] = [];
        let affectedResult;
        if (typeof p1 === 'object') {
            // update by options.where
            sql = `UPDATE \`${tableName}\` SET ${updateFields.join(', ')}`;
            sqlParams = updateParams;
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
        } else {
            // update by primaryKey
            sql = `UPDATE \`${tableName}\` SET ${updateFields.join(', ')} WHERE \`${primaryKey}\`=?`;
            sqlParams = [...updateParams, p1];
        }

        if (conn) {
            [affectedResult] = await conn.query(sql, sqlParams);
        } else {
            [affectedResult] = await db.query(sql, sqlParams);
        }
        return affectedResult['affectedRows'] || 0;
    }

    // 删除不允许没指定条件
    protected static async _delete<T extends Model>(
        type: new () => T,
        p1: any,
        conn?: PoolConnection,
    ): Promise<number> {
        const tableName = ModelMeta.tables.get(type.name);
        const primaryKey = ModelMeta.primaryKeys.get(type.name) || 'id';
        if (!tableName) {
            throw new Error(`${type.name} 未指定表名`);
        }

        let sql = '';
        let sqlParams: any[] = [];
        let affectedResult;
        if (typeof p1 === 'object') {
            // delete by options.where
            sql = `DELETE FROM \`${tableName}\``;
            sqlParams = [];
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
        } else {
            // delete by primaryKey
            sql = `DELETE FROM \`${tableName}\` WHERE \`${primaryKey}\`=?`;
            sqlParams = [p1];
        }

        if (conn) {
            [affectedResult] = await conn.query(sql, sqlParams);
        } else {
            [affectedResult] = await db.query(sql, sqlParams);
        }

        return affectedResult['affectedRows'] || 0;
    }

    protected static async _exec(sql: string, params?: any[], conn?: PoolConnection): Promise<number> {
        let affectedResult;
        if (conn) {
            [affectedResult] = await conn.query(sql, params);
        } else {
            [affectedResult] = await db.query(sql, params);
        }
        if (!affectedResult || !affectedResult['affectedRows']) {
            return 0;
        }
        return affectedResult['affectedRows'];
    }

    /**
     * 批量插入
     */
    protected static async _batchInsert<T extends Model>(
        infoArr: Array<T>,
        options?: BatchInsertOptions,
        conn?: PoolConnection,
    ): Promise<number> {
        if (infoArr.length === 0) {
            return 0;
        }
        const info = infoArr[0];
        const tableName = ModelMeta.tables.get(info.constructor.name);
        const primaryKey = ModelMeta.primaryKeys.get(info.constructor.name) || 'id';
        if (!tableName) {
            throw new Error(`${info.constructor.name} 未指定表名`);
        }
        let paramArr: Array<string> = [];
        for (const field of Object.keys(info)) {
            if (info[field] !== undefined && typeof info[field] !== 'function') {
                paramArr.push(field);
            }
        }
        // 'INSERT IGNORE' or 'ON DUPLICATE KEY UPDATE'
        let ignoreStr = '';
        let duplicateStr = '';
        if (options && options.ignoreDuplicate === true) {
            ignoreStr = 'IGNORE';
        } else if (options && options.updateFieldsOnDuplicate) {
            let keyStrArr: Array<string> = [];
            if (options.updateFieldsOnDuplicate.length) {
                keyStrArr = options.updateFieldsOnDuplicate.map(k => `${k} = VALUES(${k})`);
            } else {
                for (const field of paramArr) {
                    if (field !== primaryKey) {
                        keyStrArr.push(`${field} = VALUES(${field})`);
                    }
                }
            }
            duplicateStr = ` ON DUPLICATE KEY UPDATE ${keyStrArr.join(',')}`;
        }

        let affectedRows: number = 0;
        let tmpArr: Array<T> = [];
        const batchCount = options && options.batchCount ? options.batchCount : 500;
        const totalCount = infoArr.length;
        const connect = conn ? conn : await db.getConnection();
        try {
            if (totalCount > batchCount) {
                await connect.beginTransaction();
            }

            while (infoArr.length > 0) {
                let valueArr: Array<any> = [];
                tmpArr = infoArr.splice(0, batchCount);
                tmpArr.forEach(tmp => {
                    let singleValueArr: Array<any> = [];
                    for (const field of Object.keys(tmp)) {
                        if (tmp[field] !== undefined && typeof tmp[field] !== 'function') {
                            if (field === primaryKey && (tmp[field] === '' || tmp[field] === 0)) {
                                singleValueArr.push(null);
                            } else {
                                singleValueArr.push(tmp[field]);
                            }
                        }
                    }
                    valueArr.push(singleValueArr);
                });
                const [affectedResult] = await connect.query(
                    `INSERT ${ignoreStr} INTO \`${tableName}\` ( ${paramArr.join(',')} ) 
                        VALUES ? ${duplicateStr}`,
                    [valueArr],
                );
                affectedRows += affectedResult['affectedRows'];
            }

            if (totalCount > batchCount) {
                await connect.commit();
            }
        } catch (e) {
            if (totalCount > batchCount) {
                await connect.rollback();
            }
            throw new Error(`批量插入表${tableName}出错: ${e}`);
        }

        if (!conn) {
            connect.release();
        }

        return affectedRows;
    }

    /**
     * 批量修改
     * @param infoArr 待修改对象列表
     * @param updateColNameArr 修改字段数组
     * @param keyArr 指定主键或联合主键
     */
    protected static async _batchUpdate<T extends Model>(
        infoArr: Array<T>,
        options?: BatchUpdateOptions,
        conn?: PoolConnection,
    ): Promise<number> {
        if (infoArr.length === 0) {
            return 0;
        }
        const info = infoArr[0];
        const tableName = ModelMeta.tables.get(info.constructor.name);
        const primaryKey = ModelMeta.primaryKeys.get(info.constructor.name) || 'id';
        if (!tableName) {
            throw new Error(`${info.constructor.name} 未指定表名`);
        }

        // 没有指定修改的字段时 默认修改除key外的全部字段
        let updateColNameArr: string[] = [];
        if (!options || !options.updateFields || !options.updateFields.length) {
            const tmpArr: Array<string> = [];
            for (const field of Object.keys(info)) {
                if (field !== primaryKey && info[field] !== undefined && typeof info[field] !== 'function') {
                    tmpArr.push(field);
                }
            }
            updateColNameArr = tmpArr;
        } else {
            updateColNameArr = options.updateFields;
        }

        // 没有指定主键或联合主键时，默认取主键
        let keyArr: string[] = [];
        if (!options || !options.keyFields || !options.keyFields.length) {
            keyArr = [primaryKey];
        } else {
            keyArr = options.keyFields;
        }

        // 检查数据中是否真的包含指定的每个主键
        for (const key of keyArr) {
            if (Object.keys(info).indexOf(key) === -1) {
                throw new Error(`待修改的数据中不存在主键 ${key}`);
            }
        }

        let affectedRows: number = 0;
        let tmpArr: Array<T> = [];
        const batchCount = options && options.batchCount ? options.batchCount : 300;
        const connect = conn ? conn : await db.getConnection();
        const totalCount = infoArr.length;
        try {
            if (totalCount > batchCount) {
                await connect.beginTransaction();
            }

            while (infoArr.length > 0) {
                tmpArr = infoArr.splice(0, batchCount);
                let sql = `UPDATE \`${tableName}\` set `;
                const whereInMap: Map<string, Array<any>> = new Map();
                for (const key of keyArr) {
                    whereInMap.set(key, []);
                }
                const valueArr: Array<any> = [];
                const setStrArr: Array<string> = [];
                // 拼set xxx = xxx
                for (const col of updateColNameArr) {
                    let whenSql = '';
                    for (const tmp of tmpArr) {
                        // 拼 when a=? and b=? then
                        whenSql += ` when `;
                        const whenStrArr: Array<string> = [];
                        for (const key of keyArr) {
                            whenStrArr.push(` \`${key}\`=${tmp[key]} `);
                            whereInMap.get(key)?.push(tmp[key]);
                        }
                        whenSql += whenStrArr.join('and');
                        whenSql += `then ?`;
                        valueArr.push(tmp[col]);
                    }
                    setStrArr.push(` \`${col}\` = (case ${whenSql} end) `);
                }
                sql += setStrArr.join(',');
                sql += ` where `;
                // 拼where xxx in(xxx)
                const whereStrArr: Array<string> = [];
                for (const [k, v] of whereInMap) {
                    whereStrArr.push(` ${k} in (${v.join(',')}) `);
                }
                sql += whereStrArr.join('and');

                const [affectedResult] = await connect.query(sql, valueArr);
                affectedRows += affectedResult['affectedRows'];
            }

            if (totalCount > batchCount) {
                await connect.commit();
            }
        } catch (e) {
            if (totalCount > batchCount) {
                await connect.rollback();
            }
            throw new Error(`批量更新表${tableName}出错: ${e}`);
        }

        if (!conn) {
            connect.release();
        }
        return affectedRows;
    }
}
