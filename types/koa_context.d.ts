/// <reference types="node"/>

import * as Koa from 'koa';

declare module 'koa' {
    interface ExtendableContext {
        // convert http params methods
        getQueryInt: (fieldName: string, defaultValue = 0, isRequired = false) => number | undefined;
        getQueryNumber: (fieldName: string, defaultValue = 0, isRequired = false) => number | undefined;
        getQueryString: (fieldName: string, defaultValue = '', isRequired = false) => string | undefined;
        getQueryArray: (fieldName: string, defaultValue = [], isRequired = false) => any[] | undefined;
        getQueryObject: (fieldName: string, defaultValue = {}, isRequired = false) => object | undefined;
        getQueryBool: (fieldName: string, defaultValue = false, isRequired = false) => boolean | undefined;
        getBodyInt: (fieldName: string, defaultValue = 0, isRequired = false) => number | undefined;
        getBodyNumber: (fieldName: string, defaultValue = 0, isRequired = false) => number | undefined;
        getBodyString: (fieldName: string, defaultValue = '', isRequired = false) => string | undefined;
        getBodyArray: (fieldName: string, defaultValue = [], isRequired = false) => any[] | undefined;
        getBodyObject: (fieldName: string, defaultValue = {}, isRequired = false) => object | undefined;
        getBodyBool: (fieldName: string, defaultValue = false, isRequired = false) => boolean | undefined;
    }
}
