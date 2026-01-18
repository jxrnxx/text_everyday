/**
 * Timers 类型定义
 * 用于为已存在的 timers.lua 提供 TypeScript 类型支持
 */

/** 计时器回调函数类型 */
type TimerCallback = () => number | void | undefined;

/** 计时器配置对象 */
interface TimerConfig {
    /** 延迟时间(秒)，不填则立即执行 */
    endTime?: number;
    /** 回调函数 */
    callback: TimerCallback;
    /** 是否使用游戏时间，默认true，false则使用实时时间(不受暂停影响) */
    useGameTime?: boolean;
}

/** 计时器系统接口 */
interface ITimers {
    /**
     * 创建计时器
     * @param callback 立即执行的回调函数，返回数字则循环执行
     */
    CreateTimer(callback: TimerCallback): string;

    /**
     * 创建计时器
     * @param delay 延迟时间(秒)
     * @param callback 回调函数
     */
    CreateTimer(delay: number, callback: TimerCallback): string;

    /**
     * 创建计时器
     * @param config 计时器配置对象
     */
    CreateTimer(config: TimerConfig): string;

    /**
     * 下一帧执行回调
     * @param callback 回调函数
     */
    NextTick(callback: () => void): void;

    /**
     * 移除计时器
     * @param timerId 计时器ID
     */
    RemoveTimer(timerId: string): void;
}

/** 全局计时器实例 */
declare const Timers: ITimers;

/** GameRules 上的计时器引用 */
declare interface CDOTAGameRules {
    Timers: ITimers;
}
