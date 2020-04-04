import { mw } from '../core';

interface routerActionMetaInfo {
    method?: string;
    path?: string;
}

interface routerControllerMetaInfo {
    actionMetaMap?: Map<string, routerActionMetaInfo>;
}

interface controllerMiddlewareMetaInfo {
    middlewares?: Array<mw>;
    actionMap?: Map<string, Array<mw>>;
}

export class RouterMeta {
    private static controllerMetaMap: Map<object, routerControllerMetaInfo> = new Map();
    private static controllerMiddlewareMetaMap: Map<object, controllerMiddlewareMetaInfo> = new Map();

    static get(controllerClass: object, actionName: string): routerActionMetaInfo | undefined {
        const metaInfo = RouterMeta.controllerMetaMap.get(controllerClass);
        if (metaInfo && metaInfo.actionMetaMap) {
            return metaInfo.actionMetaMap.get(actionName);
        }
        return undefined;
    }

    static set(controllerClass: object, actionName: string, info: routerActionMetaInfo) {
        const controllerMetaInfo = RouterMeta.controllerMetaMap.get(controllerClass);
        if (controllerMetaInfo && controllerMetaInfo.actionMetaMap) {
            controllerMetaInfo.actionMetaMap.set(actionName, info);
        } else {
            const actionMetaMap: Map<string, routerActionMetaInfo> = new Map();
            actionMetaMap.set(actionName, info);
            RouterMeta.controllerMetaMap.set(controllerClass, { actionMetaMap });
        }
    }

    static getControllerMiddlewares(controllerClass: object): Array<mw> | undefined {
        const metaInfo = RouterMeta.controllerMiddlewareMetaMap.get(controllerClass);
        if (metaInfo && metaInfo.middlewares) {
            return metaInfo.middlewares;
        }
        return undefined;
    }

    static setControllerMiddlewares(controllerClass: object, mws: Array<mw>) {
        let metaInfo = RouterMeta.controllerMiddlewareMetaMap.get(controllerClass);
        if (!metaInfo) {
            metaInfo = { middlewares: mws };
        } else {
            if (metaInfo.middlewares) {
                metaInfo.middlewares.push(...mws);
            } else {
                metaInfo.middlewares = mws;
            }
        }
        RouterMeta.controllerMiddlewareMetaMap.set(controllerClass, metaInfo);
    }

    static getActionMiddlewares(controllerClass: object, actionName: string): Array<mw> | undefined {
        const metaInfo = RouterMeta.controllerMiddlewareMetaMap.get(controllerClass);
        if (metaInfo && metaInfo.actionMap) {
            return metaInfo.actionMap.get(actionName);
        }
        return undefined;
    }

    static setActionMiddlewares(controllerClass: object, actionName: string, mws: Array<mw>) {
        let metaInfo = RouterMeta.controllerMiddlewareMetaMap.get(controllerClass);
        if (!metaInfo) {
            const actionMap: Map<string, Array<mw>> = new Map();
            actionMap.set(actionName, mws);
            metaInfo = { actionMap };
        } else if (!metaInfo.actionMap) {
            const actionMap: Map<string, Array<mw>> = new Map();
            actionMap.set(actionName, mws);
            metaInfo.actionMap = actionMap;
        } else if (!metaInfo.actionMap.has(actionName)) {
            metaInfo.actionMap.set(actionName, mws);
        } else {
            const originMws = metaInfo.actionMap.get(actionName);
            if (originMws) {
                originMws?.push(...mws);
                metaInfo.actionMap.set(actionName, originMws);
            }
        }
        RouterMeta.controllerMiddlewareMetaMap.set(controllerClass, metaInfo);
    }
}

export class ModelMeta {
    static tables: Map<string, string> = new Map();
    static primaryKeys: Map<string, string> = new Map();
}
