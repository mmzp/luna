import { ErrParamNotExist, ErrParamUnknownType } from '../error';
import * as constant from '../constant';
import { parseSafeInt } from './utils';

function errParamNotExist(fieldName: string) {
    return new ErrParamNotExist(400, `参数错误，${fieldName} 为必填参数`);
}

function errParamUnknownType() {
    return new ErrParamUnknownType(500, '不支持的参数类型');
}

interface ConvertOptions {
    defaultValue?: any;
    isRequired?: boolean;
}

/**
 * 转化 HTTP 请求的 queryString 中的某个参数字段
 * @param {object} params HTTP 请求的 queryString 参数
 * @param {string} fieldName 字段名称
 * @param {int} type 字段类型
 * @param {{defaultValue:any, isRequired:bool}} options 可选项
 */
export function convert(params: object, fieldName: string, type: number, options?: ConvertOptions) {
    let defaultValue = options && options.defaultValue ? options.defaultValue : undefined;
    const isRequired = options && options.isRequired ? true : false;
    switch (type) {
        case constant.PARAM_TYPE_INT:
            if (params[fieldName] !== undefined) {
                return parseSafeInt(params[fieldName]);
            }
            if (!isRequired && defaultValue !== undefined) {
                defaultValue = parseSafeInt(defaultValue);
            }
            break;
        case constant.PARAM_TYPE_NUMBER:
            if (params[fieldName] !== undefined) {
                const result = Number(params[fieldName]);
                if (!isNaN(result)) {
                    return result;
                }
                return 0;
            }
            if (!isRequired && defaultValue !== undefined) {
                defaultValue = Number(defaultValue) || 0;
            }
            break;
        case constant.PARAM_TYPE_STRING:
            if (params[fieldName] !== undefined) {
                return typeof params[fieldName] === 'number' && isNaN(params[fieldName])
                    ? ''
                    : String(params[fieldName]);
            }
            if (!isRequired && defaultValue !== undefined) {
                defaultValue = typeof defaultValue === 'number' && isNaN(defaultValue) ? '' : String(defaultValue);
            }
            break;
        case constant.PARAM_TYPE_ARRAY:
            if (params[fieldName] !== undefined) {
                if (Array.isArray(params[fieldName])) {
                    return params[fieldName];
                }
                return [];
            }
            if (!isRequired && defaultValue !== undefined) {
                defaultValue = Array.isArray(defaultValue) ? defaultValue : [];
            }
            break;
        case constant.PARAM_TYPE_OBJECT:
            if (params[fieldName] !== undefined) {
                if (
                    typeof params[fieldName] === 'object' &&
                    params[fieldName].length === undefined &&
                    !(params[fieldName] instanceof Set) &&
                    !(params[fieldName] instanceof Map)
                ) {
                    return params[fieldName];
                }
                return {};
            }
            if (!isRequired && defaultValue !== undefined) {
                defaultValue =
                    typeof defaultValue === 'object' &&
                    defaultValue.length === undefined &&
                    !(defaultValue instanceof Set) &&
                    !(defaultValue instanceof Map)
                        ? defaultValue
                        : {};
            }
            break;
        case constant.PARAM_TYPE_BOOL:
            if (params[fieldName] !== undefined) {
                return params[fieldName] === '0' || params[fieldName] === 'false' ? false : Boolean(params[fieldName]);
            }
            if (!isRequired && defaultValue !== undefined) {
                defaultValue = defaultValue === '0' || defaultValue === 'false' ? false : Boolean(defaultValue);
            }
            break;
        default:
            throw errParamUnknownType();
            break;
    }

    // 字段不存在，但非必填，则返回默认值
    if (!isRequired) {
        return defaultValue;
    }

    // 字段不存在，且需要必填，则抛出异常
    throw errParamNotExist(fieldName);
}
