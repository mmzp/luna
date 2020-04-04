import { RouterMeta } from './meta';
import { mw } from '../core';

// 生成路由方法装饰器
function generateRouterMethodDecorator(method: string) {
    return function httpMethod(path = '') {
        return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
            RouterMeta.set(target.constructor, propertyKey, { method, path });
        };
    };
}

// 路由方法装饰器
export const get = generateRouterMethodDecorator('get');
export const post = generateRouterMethodDecorator('post');
export const put = generateRouterMethodDecorator('put');
export const link = generateRouterMethodDecorator('link');
export const unlink = generateRouterMethodDecorator('unlink');
export const del = generateRouterMethodDecorator('delete');
export const head = generateRouterMethodDecorator('head');
export const options = generateRouterMethodDecorator('options');
export const patch = generateRouterMethodDecorator('patch');
export const all = generateRouterMethodDecorator('all');

// 中间件装饰器（支持：类、方法）
export function middleware(...mws: Array<mw>) {
    return function(target: any, propertyKey?: string, descriptor?: PropertyDescriptor) {
        if (arguments.length === 1) {
            // 类装饰器
            RouterMeta.setControllerMiddlewares(target, mws);
        } else if (arguments.length === 3) {
            // 方法装饰器
            if (propertyKey) {
                RouterMeta.setActionMiddlewares(target.constructor, propertyKey, mws);
            }
        }
    };
}
