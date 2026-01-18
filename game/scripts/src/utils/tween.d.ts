/**
 * 补间动画系统类型定义 (Tween Type Definitions)
 * 从 zhanshen 项目移植
 *
 * @example
 * ```typescript
 * const obj = { x: 0, y: 0 };
 * const tw = Tween.New(2, obj, { x: 100, y: 200 }, 'outQuad');
 *
 * // 在计时器中更新
 * Timers.CreateTimer(0.01, () => {
 *     const complete = tw.update(0.01);
 *     if (complete) {
 *         print('动画完成!');
 *         return undefined;
 *     }
 *     return 0.01;
 * });
 * ```
 */

/** 缓动函数类型 */
type EasingFunction = (t: number, b: number, c: number, d: number) => number;

/** 缓动函数名称 */
type EasingName =
    | 'linear'
    | 'inQuad' | 'outQuad' | 'inOutQuad' | 'outInQuad'
    | 'inCubic' | 'outCubic' | 'inOutCubic' | 'outInCubic'
    | 'inQuart' | 'outQuart' | 'inOutQuart' | 'outInQuart'
    | 'inQuint' | 'outQuint' | 'inOutQuint' | 'outInQuint'
    | 'inSine' | 'outSine' | 'inOutSine' | 'outInSine'
    | 'inExpo' | 'outExpo' | 'inOutExpo' | 'outInExpo'
    | 'inCirc' | 'outCirc' | 'inOutCirc' | 'outInCirc'
    | 'inElastic' | 'outElastic' | 'inOutElastic' | 'outInElastic'
    | 'inBack' | 'outBack' | 'inOutBack' | 'outInBack'
    | 'inBounce' | 'outBounce' | 'inOutBounce' | 'outInBounce'
    // 中文别名
    | '线性' | '二元入' | '二元出' | '二元入出'
    | '三元入' | '三元出' | '三元入出'
    | '正弦入' | '正弦出' | '正弦入出'
    | '弹性入' | '弹性出' | '弹性入出'
    | '弹跳入' | '弹跳出' | '弹跳入出';

/** 补间对象接口 */
interface ITween<T extends object = object> {
    /** 持续时间 */
    duration: number;
    /** 目标对象 */
    subject: T;
    /** 目标值 */
    target: Partial<T>;
    /** 缓动函数 */
    easing: EasingFunction;
    /** 当前时间 */
    clock: number;
    /** 初始值 */
    initial?: Partial<T>;

    /**
     * 设置动画时间
     * @param clock 时间值
     * @returns 是否完成
     */
    set(clock: number): boolean;

    /**
     * 重置动画
     * @returns 是否完成
     */
    reset(): boolean;

    /**
     * 更新动画
     * @param dt 增量时间
     * @returns 是否完成
     */
    update(dt: number): boolean;
}

/** 补间动画系统接口 */
interface ITweenStatic {
    /** 缓动函数集合 */
    easing: Record<EasingName, EasingFunction>;

    /**
     * 创建补间动画
     * @param duration 持续时间(秒)
     * @param subject 目标对象
     * @param target 目标值
     * @param easing 缓动函数名或函数，默认'linear'
     * @returns 补间对象
     */
    New<T extends object>(
        duration: number,
        subject: T,
        target: Partial<T>,
        easing?: EasingName | EasingFunction
    ): ITween<T>;
}

/** 全局补间动画实例 */
declare const Tween: ITweenStatic;

/** GameRules 上的补间动画引用 */
declare interface CDOTAGameRules {
    Tween: ITweenStatic;
}
