import { ModelMeta } from './meta';

// 表实体装饰器
export function table(tableName: string) {
    // 类装饰器
    return function(target: any) {
        ModelMeta.tables.set(target.name, tableName);
    };
}

// 表主键装饰器
export function primaryKey(target: Object, propertyKey: string) {
    // 属性装饰器
    ModelMeta.primaryKeys.set(target.constructor.name, propertyKey);
}
