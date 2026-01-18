/**
 * 权重池系统类型定义 (Pool Type Definitions)
 * 从 zhanshen 项目移植
 *
 * @example
 * ```typescript
 * const equipPool = pool('装备池');
 * equipPool.add('普通装备', 70);  // 70权重
 * equipPool.add('稀有装备', 25);  // 25权重
 * equipPool.add('传说装备', 5);   // 5权重
 *
 * const item = equipPool.random();  // 按权重随机抽取
 * const item2 = equipPool.randomAndRemove();  // 抽取后移除
 * ```
 */

/** 带权重的奖品对象 */
interface WeightPrize<T = any> {
    object: T;
    proportion: number;
    virtualProportion: number;
}

/** 权重池接口 */
interface IPool<T = any> {
    /** 池类型标识 */
    type: string;
    /** 池名称 */
    name: string;
    /** 池中物品数量 */
    len: number;
    /** 池容量上限 */
    upperLimit?: number;
    /** 总权重 */
    totalProportion: number;
    /** 虚拟总权重 */
    virtualTotalProportion: number;
    /** 增益系数 */
    gain: number;
    /** 数据数组 */
    data: WeightPrize<T>[];
    /** 映射表 */
    mappingTable: Record<string, WeightPrize<T>>;

    /**
     * 添加奖品到池中
     * @param object 奖品对象
     * @param proportion 权重值，默认1
     * @returns 池对象本身，支持链式调用
     */
    add(object: T, proportion?: number): this;

    /**
     * 降低奖品权重
     * @param object 奖品对象
     * @param proportion 要降低的权重值
     * @returns 池对象本身
     */
    sub(object: T, proportion: number): this | undefined;

    /**
     * 移除奖品
     * @param object 奖品对象
     * @returns 池对象本身
     */
    remove(object: T): this;

    /**
     * 获取奖品得奖概率
     * @param object 奖品对象
     * @returns [概率, 权重值]
     */
    getProbability(object: T): LuaMultiReturn<[number, number]>;

    /**
     * 获取奖品权重
     * @param object 奖品对象
     * @returns 权重值
     */
    get(object: T): number;

    /**
     * 获取奖品权重 (别名)
     * @param object 奖品对象
     * @returns 权重值
     */
    getWeightPrize(object: T): number;

    /**
     * 设置奖品权重
     * @param object 奖品对象
     * @param proportion 新权重值
     * @returns [旧权重, 新权重]
     */
    setWeightPrize(object: T, proportion: number): LuaMultiReturn<[number, number]> | undefined;

    /**
     * 随机抽取 (不移除)
     * @returns 抽取的奖品，空池返回undefined
     */
    random(): T | undefined;

    /**
     * 随机抽取并移除
     * @returns 抽取的奖品，空池返回undefined
     */
    randomAndRemove(): T | undefined;

    /**
     * 清空池
     * @returns 池对象本身
     */
    clear(): this;

    /**
     * 随机抽取n个不重复的对象
     * @param n 抽取数量
     * @returns 抽取结果数组
     */
    randomSole(n: number): T[];

    /**
     * 抽卡随机 (每次抽取权重-1)
     * @param n 抽取数量
     * @returns 抽取结果数组
     */
    randomCard(n: number): T[];
}

/**
 * 创建权重池
 * @param name 池名称
 * @param upperLimit 容量上限
 * @param gain 随机范围倍率增益
 */
declare function pool<T = any>(name?: string, upperLimit?: number, gain?: number): IPool<T>;
