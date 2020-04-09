import * as Koa from 'koa';
import { convert } from '../lib/param';
import * as constant from '../constant';

// 在 ctx 中挂载获取 http 参数并类型转化的方法
export async function convertHttpParmas(ctx: Koa.Context, next: Koa.Next) {
    ctx.getQueryInt = (fieldName: string, defaultValue = 0, isRequired = false): number | undefined => {
        return convert(ctx.query, fieldName, constant.PARAM_TYPE_INT, {
            defaultValue,
            isRequired,
        });
    };
    ctx.getQueryNumber = (fieldName: string, defaultValue = 0, isRequired = false): number | undefined => {
        return convert(ctx.query, fieldName, constant.PARAM_TYPE_NUMBER, {
            defaultValue,
            isRequired,
        });
    };
    ctx.getQueryString = (fieldName: string, defaultValue = '', isRequired = false): string | undefined => {
        return convert(ctx.query, fieldName, constant.PARAM_TYPE_STRING, {
            defaultValue,
            isRequired,
        });
    };
    ctx.getQueryArray = (fieldName: string, defaultValue = [], isRequired = false): any[] | undefined => {
        return convert(ctx.query, fieldName, constant.PARAM_TYPE_ARRAY, {
            defaultValue,
            isRequired,
        });
    };
    ctx.getQueryObject = (fieldName: string, defaultValue = {}, isRequired = false): object | undefined => {
        return convert(ctx.query, fieldName, constant.PARAM_TYPE_OBJECT, {
            defaultValue,
            isRequired,
        });
    };
    ctx.getQueryBool = (fieldName: string, defaultValue = false, isRequired = false): boolean | undefined => {
        return convert(ctx.query, fieldName, constant.PARAM_TYPE_BOOL, {
            defaultValue,
            isRequired,
        });
    };

    const bodyParams = ctx.request['body'] ? ctx.request.body : {};
    ctx.getBodyInt = (fieldName: string, defaultValue = 0, isRequired = false): number | undefined => {
        return convert(bodyParams, fieldName, constant.PARAM_TYPE_INT, {
            defaultValue,
            isRequired,
        });
    };
    ctx.getBodyNumber = (fieldName: string, defaultValue = 0, isRequired = false): number | undefined => {
        return convert(bodyParams, fieldName, constant.PARAM_TYPE_NUMBER, {
            defaultValue,
            isRequired,
        });
    };
    ctx.getBodyString = (fieldName: string, defaultValue = '', isRequired = false): string | undefined => {
        return convert(bodyParams, fieldName, constant.PARAM_TYPE_STRING, {
            defaultValue,
            isRequired,
        });
    };
    ctx.getBodyArray = (fieldName: string, defaultValue = [], isRequired = false): any[] | undefined => {
        return convert(bodyParams, fieldName, constant.PARAM_TYPE_ARRAY, {
            defaultValue,
            isRequired,
        });
    };
    ctx.getBodyObject = (fieldName: string, defaultValue = {}, isRequired = false): object | undefined => {
        return convert(bodyParams, fieldName, constant.PARAM_TYPE_OBJECT, {
            defaultValue,
            isRequired,
        });
    };
    ctx.getBodyBool = (fieldName: string, defaultValue = false, isRequired = false): boolean | undefined => {
        return convert(bodyParams, fieldName, constant.PARAM_TYPE_BOOL, {
            defaultValue,
            isRequired,
        });
    };

    await next();
}
