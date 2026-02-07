/**
 * 全局工具函数
 * 从 zhanshen 项目移植，适配当前项目
 */

// ============= 类型声明 =============
declare global {
    /** 角度转向量 */
    var AngleToVector: (angle: number) => Vector;
    /** 旋转2D向量 */
    var RotateVector2D: (vector: Vector, angle: number) => Vector;
    /** 生成扇形向量组 */
    var GetRotateVectors: (forwardVector: Vector, count: number, interval: number) => Vector[];
    /** 获取两向量夹角 */
    var GetAngleBetweenVectors: (vectorA: Vector, vectorB: Vector) => number;
    /** 查找最近可行走点 */
    var FindNearestWalkablePoint: (pos: Vector, searchRadius: number) => Vector;
    /** 2阶贝塞尔曲线 */
    var Bezier2: (points: Vector[], t: number) => Vector;
    /** 3阶贝塞尔曲线 */
    var Bezier3: (points: Vector[], t: number) => Vector;
    /** 深拷贝 */
    var deepClone: <T>(obj: T) => T;
    /** 判断是否有效 */
    var IsValid: (h: any) => boolean;
    /** 根据名称查找实体位置 */
    var FindVecByName: (name: string) => Vector;
    /** 创建特效到指定点 */
    var CreateParticleToPoint: (path: string, attach: number, pos: Vector, duration?: number) => ParticleID;

    // ============= 玩家系统 =============
    /** 设置玩家子系统 (存储 Player、Knapsack 等实例) */
    var SetPlayerSys: (playerid: PlayerID, key: string, value: any) => void;
    /** 获取玩家子系统 */
    var GetPlayerSys: (playerid: PlayerID | CDOTAPlayerController, key: string) => any;
    /** 设置玩家临时值 (全局版本) */
    var SetPlayerCustomValue: (playerId: PlayerID, key: string, value: any) => void;
    /** 获取玩家临时值 (全局版本) */
    var GetPlayerCustomValue: (playerId: PlayerID, key: string) => any;
}

// ============= 向量运算 =============

/**
 * 角度转化为向量
 * @param angle 角度（度）
 * @returns 单位向量
 */
AngleToVector = function (angle: number): Vector {
    const radian = angle * (Math.PI / 180);
    const x = Math.cos(radian);
    const y = Math.sin(radian);
    return Vector(x, y, 0);
};

/**
 * 旋转2D向量
 * @param vector 原向量
 * @param angle 旋转角度（度）
 * @returns 旋转后的向量
 */
RotateVector2D = function (vector: Vector, angle: number): Vector {
    const radians = angle * (Math.PI / 180);
    const cosTheta = Math.cos(radians);
    const sinTheta = Math.sin(radians);
    const rotatedX = vector.x * cosTheta - vector.y * sinTheta;
    const rotatedY = vector.x * sinTheta + vector.y * cosTheta;
    return Vector(rotatedX, rotatedY, vector.z);
};

/**
 * 生成一组扇形向量
 * @param forwardVector 中心方向向量
 * @param count 扇形数量
 * @param interval 扇形间隔角度
 * @returns 向量数组
 */
GetRotateVectors = function (forwardVector: Vector, count: number, interval: number): Vector[] {
    const vectors: Vector[] = [];
    for (let i = 0; i < count; i++) {
        const angleOffset = (i - (count - 1) / 2) * interval;
        const rotatedVector = RotateVector2D(forwardVector, angleOffset);
        vectors.push(rotatedVector);
    }
    return vectors;
};

/**
 * 获取两个向量间的角度
 * @returns 角度（度）
 */
GetAngleBetweenVectors = function (vectorA: Vector, vectorB: Vector): number {
    // 计算两个向量的点积
    const dotProduct = vectorA.x * vectorB.x + vectorA.y * vectorB.y + vectorA.z * vectorB.z;

    // 计算两个向量的长度
    const lengthA = Math.sqrt(vectorA.x ** 2 + vectorA.y ** 2 + vectorA.z ** 2);
    const lengthB = Math.sqrt(vectorB.x ** 2 + vectorB.y ** 2 + vectorB.z ** 2);

    // 避免除零
    if (lengthA === 0 || lengthB === 0) return 0;

    // 计算角度（弧度）
    const cosAngle = Math.max(-1, Math.min(1, dotProduct / (lengthA * lengthB)));
    const angleRadians = Math.acos(cosAngle);

    // 转换为度
    return angleRadians * (180 / Math.PI);
};

// ============= 地形相关 =============

/**
 * 查找最近可行走点
 * @param pos 起始位置
 * @param searchRadius 搜索半径
 * @returns 可行走点
 */
FindNearestWalkablePoint = function (pos: Vector, searchRadius: number): Vector {
    // 先检查原点是否可行走
    if (GridNav.IsTraversable(pos)) {
        return pos;
    }

    // 螺旋搜索
    const step = 64;
    for (let radius = step; radius <= searchRadius; radius += step) {
        for (let angle = 0; angle < 360; angle += 30) {
            const checkPos = (pos as any).__add(AngleToVector(angle).__mul(radius)) as Vector;
            if (GridNav.IsTraversable(checkPos)) {
                return GetGroundPosition(checkPos, undefined);
            }
        }
    }

    return pos;
};

/**
 * 根据实体名称查找位置
 */
FindVecByName = function (name: string): Vector {
    const entity = Entities.FindByName(undefined, name);
    if (entity) {
        return entity.GetAbsOrigin();
    }
    return Vector(0, 0, 0);
};

// ============= 贝塞尔曲线 =============

/**
 * 2阶贝塞尔曲线
 * @param points 3个控制点
 * @param t 进度 (0-1)
 */
Bezier2 = function (points: Vector[], t: number): Vector {
    const p0 = points[0];
    const p1 = points[1];
    const p2 = points[2];

    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;

    const x = mt2 * p0.x + 2 * mt * t * p1.x + t2 * p2.x;
    const y = mt2 * p0.y + 2 * mt * t * p1.y + t2 * p2.y;
    const z = mt2 * p0.z + 2 * mt * t * p1.z + t2 * p2.z;

    return Vector(x, y, z);
};

/**
 * 3阶贝塞尔曲线
 * @param points 4个控制点
 * @param t 进度 (0-1)
 */
Bezier3 = function (points: Vector[], t: number): Vector {
    const p0 = points[0];
    const p1 = points[1];
    const p2 = points[2];
    const p3 = points[3];

    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    const x = mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x;
    const y = mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y;
    const z = mt3 * p0.z + 3 * mt2 * t * p1.z + 3 * mt * t2 * p2.z + t3 * p3.z;

    return Vector(x, y, z);
};

// ============= 通用工具 =============

/**
 * 深拷贝对象
 */
deepClone = function <T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        const arrCopy: any[] = [];
        for (const item of obj) {
            arrCopy.push(deepClone(item));
        }
        return arrCopy as T;
    }

    const objCopy: any = {};
    for (const [key, value] of Object.entries(obj)) {
        objCopy[key] = deepClone(value);
    }
    return objCopy as T;
};

/**
 * 判断一个 handle 是否有效
 */
IsValid = function (h: any): boolean {
    return h !== null && h !== undefined && typeof h.IsNull === 'function' && !h.IsNull();
};

/**
 * 创建特效到指定点
 * @param path 特效路径
 * @param attach 附着类型
 * @param pos 位置
 * @param duration 持续时间（可选，自动销毁）
 */
CreateParticleToPoint = function (path: string, attach: number, pos: Vector, duration?: number): ParticleID {
    const fx = ParticleManager.CreateParticle(path, attach, undefined);
    ParticleManager.SetParticleControl(fx, 0, pos);

    if (duration && duration > 0) {
        Timers.CreateTimer(duration, () => {
            ParticleManager.DestroyParticle(fx, false);
            ParticleManager.ReleaseParticleIndex(fx);
            return undefined;
        });
    }

    return fx;
};

// ============= 玩家系统 =============

// 初始化全局存储
_G['PlayerSys'] = _G['PlayerSys'] || {};
_G['PlayerCustomValue'] = _G['PlayerCustomValue'] || {};

/**
 * 设置玩家子系统
 * @param playerid 玩家ID
 * @param key 子系统键名 (如 'assets', 'knapsack')
 * @param value 子系统实例
 */
SetPlayerSys = function (playerid: PlayerID, key: string, value: any) {
    _G['PlayerSys'][playerid] = _G['PlayerSys'][playerid] || {};
    _G['PlayerSys'][playerid][key] = value;
};

/**
 * 获取玩家子系统
 * @param playerid 玩家ID 或 CDOTAPlayerController
 * @param key 子系统键名
 * @returns 子系统实例，不存在返回 null
 */
GetPlayerSys = function (playerid: PlayerID | CDOTAPlayerController, key: string) {
    if (typeof playerid === 'object') {
        playerid = playerid.GetPlayerID();
    }
    if (!_G['PlayerSys']) return null;
    if (!_G['PlayerSys'][playerid]) return null;
    return _G['PlayerSys'][playerid][key];
};

/**
 * 设置玩家临时值 (全局版本)
 * @param playerId 玩家ID
 * @param key 键名
 * @param value 值
 */
SetPlayerCustomValue = function (playerId: PlayerID, key: string, value: any) {
    if (!_G['PlayerCustomValue'][playerId]) _G['PlayerCustomValue'][playerId] = {};
    _G['PlayerCustomValue'][playerId][key] = value;
};

/**
 * 获取玩家临时值 (全局版本)
 * @param playerId 玩家ID
 * @param key 键名
 * @returns 值，不存在返回 0
 */
GetPlayerCustomValue = function (playerId: PlayerID, key: string) {
    if (!_G['PlayerCustomValue'][playerId]) return 0;
    return _G['PlayerCustomValue'][playerId][key] || 0;
};

export { };
