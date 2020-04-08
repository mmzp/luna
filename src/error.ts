// 错误码范围

// 1000 ~ 1999 => 公用业务错误码
//// 11000 ~ 11999 => 数据库相关错误
////// 11000: 连接失败
////// 11001: 主键重复
////// 11002: SQL 执行失败
export const DB_DUPLICATE_KEY = 11001;
export const DB_SQL_EXECUTE_ERROR = 11002;

export class LunaError extends Error {
    code: number = 0;
}

export class DbError extends LunaError {
    code: number;
    errno: number;
    sqlState: string;
    stack?: string;
    query?: string;
    params?: Array<any>;

    constructor(
        code: number,
        message: string,
        errno: number,
        sqlState: string,
        stack?: string,
        query?: string,
        params?: Array<any>,
    ) {
        super(message);

        this.code = code;
        this.errno = errno;
        this.sqlState = sqlState;
        this.stack = stack;
        this.query = query;
        this.params = params;
    }
}
