/**
 * 事件系统类型定义 (Event System Type Definitions)
 * 从 zhanshen 项目移植
 *
 * @example
 * ```typescript
 * // 注册事件
 * const id = Event.on('怪物击杀', (killer, victim) => {
 *     print(`${killer.GetName()} 击杀了 ${victim.GetName()}`);
 * });
 *
 * // 触发事件
 * Event.send('怪物击杀', attacker, target);
 *
 * // 解注册
 * Event.unregisterByID(id);
 * ```
 */

/** 事件优先级常量 */
declare const EVENT_LEVEL_NONE: 0;
declare const EVENT_LEVEL_LOW: 10000;
declare const EVENT_LEVEL_MEDIUM: 20000;
declare const EVENT_LEVEL_HIGH: 30000;
declare const EVENT_LEVEL_ULTRA: 40000;

/** 事件优先级类型 */
type EventLevel =
    | typeof EVENT_LEVEL_NONE
    | typeof EVENT_LEVEL_LOW
    | typeof EVENT_LEVEL_MEDIUM
    | typeof EVENT_LEVEL_HIGH
    | typeof EVENT_LEVEL_ULTRA;

/** 事件回调函数类型 */
type EventCallback<T extends any[] = any[]> = (...args: T) => boolean | void;

/** 事件系统接口 */
interface IEvent {
    /**
     * 注册事件监听器
     * @param eventName 事件名称
     * @param callback 回调函数，返回 true 则自动解注册
     * @param bindObj 绑定对象，可选
     * @param priority 优先级，值越大越优先执行，默认 EVENT_LEVEL_NONE
     * @param bindID 指定注册ID，可选
     * @returns 注册ID，用于解注册
     */
    on<T extends any[] = any[]>(
        eventName: string,
        callback: EventCallback<T>,
        bindObj?: object,
        priority?: EventLevel | number,
        bindID?: number
    ): number;

    /**
     * 解注册事件监听器
     * @param eventName 事件名称
     * @param callback 回调函数
     * @param bindObj 绑定对象，可选
     * @returns 是否成功解注册
     */
    unregister(
        eventName: string,
        callback: EventCallback,
        bindObj?: object
    ): boolean | undefined;

    /**
     * 通过ID解注册事件监听器
     * @param id 注册时返回的ID
     * @param eventName 事件名称，可选，提供可提升性能
     * @returns 是否成功解注册
     */
    unregisterByID(id: number, eventName?: string): boolean;

    /**
     * 批量解注册事件监听器
     * @param ids 注册ID数组
     */
    unregisterByIDs(ids: number[]): void;

    /**
     * 解除所有注册的事件监听器
     */
    unregisterAll(): void;

    /**
     * 触发事件
     * @param eventName 事件名称
     * @param args 传递给监听器的参数
     */
    send<T extends any[] = any[]>(eventName: string, ...args: T): void;
}

/** 全局事件系统实例 */
declare const Event: IEvent;

/** GameRules 上的事件系统引用 */
declare interface CDOTAGameRules {
    Event: IEvent;
}
