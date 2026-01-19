/**
 * CDOTA_BaseNPC 扩展方法
 * 从 zhanshen 项目移植，适配当前项目
 *
 * 该文件用于扩展 CDOTA_BaseNPC 类，不允许内部有 enhance 以外的依赖
 */

import { CustomStats } from '../systems/CustomStats';

// ============= 类型声明 =============
declare global {
    interface CDOTA_BaseNPC {
        // 自定义值存取
        CustomValue: Record<string, any>;
        GetCustomValue(key: string): any;
        SetCustomValue(key: string, value: any): void;
        AddCustomValue(key: string, value: number): void;
        ClearCustomValue(): void;

        // 移动相关
        Mover(
            targetPosition: Vector,
            time: number,
            callback?: (pos: Vector) => void,
            noFix?: boolean,
            bounce?: boolean,
            ignoreNav?: boolean
        ): void;
        Pause(time: number): void;

        // 目标选取
        GetMinDistanceUnit(range: number, p?: Vector): CDOTA_BaseNPC | null;
        GetMinAngleUnit(range: number): CDOTA_BaseNPC | null;

        // 范围效果
        RoundAOE(
            radius: number,
            position: Vector,
            callback: (unit: CDOTA_BaseNPC) => void,
            tag?: string,
            cooldown?: number
        ): void;

        // 安全操作
        SafetyRemoveSelf(): void;

        // 治疗效果
        RecoverBlood(value: number, inflictor?: CDOTABaseAbility, source?: string, target?: CDOTA_BaseNPC): void;

        // 属性修改快捷方法
        AddMaxBaseHealth(value: number): void;
        AddBaseDamage(value: number): void;
        AddBaseArmor(value: number): void;
        AddAttackSpeed(value: number): void;
        AddMoveSpeed(value: number): void;
    }
}

// ============= 自定义值存取 =============

/**
 * 获取自定义值
 * 注意：不存在的 key 返回 undefined（而不是 0，因为 Lua 中 0 是 truthy）
 */
CDOTA_BaseNPC.GetCustomValue = function (key: string): any {
    const t = (this as any).CustomValue || {};
    return t[key]; // 返回 undefined 如果 key 不存在
};

/**
 * 设置自定义值
 */
CDOTA_BaseNPC.SetCustomValue = function (key: string, value: any): void {
    if (!(this as any).CustomValue) {
        (this as any).CustomValue = {};
    }
    (this as any).CustomValue[key] = value;
};

/**
 * 增加自定义值（用于数值型）
 */
CDOTA_BaseNPC.AddCustomValue = function (key: string, value: number): void {
    if (!(this as any).CustomValue) {
        (this as any).CustomValue = {};
    }
    if (!(this as any).CustomValue[key]) {
        (this as any).CustomValue[key] = 0;
    }
    (this as any).CustomValue[key] += value;
};

/**
 * 清空自定义值
 */
CDOTA_BaseNPC.ClearCustomValue = function (): void {
    (this as any).CustomValue = {};
};

// ============= 移动相关 =============

/**
 * 简易运动器 - 使用 Tween 平滑移动单位
 * @param targetPosition 目标位置
 * @param time 移动时间
 * @param callback 每帧回调
 * @param noFix 为 true 时结束不修复位置
 * @param bounce 撞墙后轻微反弹防卡墙
 * @param ignoreNav 无视地形
 */
CDOTA_BaseNPC.Mover = function (
    targetPosition: Vector,
    time: number,
    callback?: (pos: Vector) => void,
    noFix?: boolean,
    bounce?: boolean,
    ignoreNav?: boolean
): void {
    const unit = this as CDOTA_BaseNPC;
    const interval = 0.03;
    const startPos = unit.GetAbsOrigin();

    if (!targetPosition) return;

    const forwardVector = ((targetPosition as any).__sub(startPos) as Vector).Normalized();
    let elapsedTime = 0;

    // 计算总距离和每帧移动量
    const dx = targetPosition.x - startPos.x;
    const dy = targetPosition.y - startPos.y;
    const dz = targetPosition.z - startPos.z;

    Timers.CreateTimer(interval, () => {
        if (!unit || unit.IsNull()) return undefined;

        // 检查是否被定身
        const idealSpeed = unit.GetIdealSpeed();
        if (idealSpeed < 5) {
            // 被定身时反弹一点防止卡住
            const newPos = (unit.GetOrigin() as any).__add((forwardVector as any).__mul(-80)) as Vector;
            unit.SetOrigin(newPos);
            return undefined;
        }

        elapsedTime += interval;

        // 使用缓动公式: outQuad = 1 - (1-t)^2
        const t = Math.min(elapsedTime / time, 1);
        const eased = 1 - Math.pow(1 - t, 2);

        const newX = startPos.x + dx * eased;
        const newY = startPos.y + dy * eased;
        const newZ = startPos.z + dz * eased;
        const newPosition = Vector(newX, newY, newZ);

        // 防止距离异常
        const dist = ((unit.GetAbsOrigin() as any).__sub(newPosition) as Vector).Length2D();
        if (dist > 1000) return undefined;

        // 碰撞检测
        const checkPos = (newPosition as any).__add((forwardVector as any).__mul(60)) as Vector;

        if (!ignoreNav && (!GridNav.IsTraversable(newPosition) || !GridNav.IsTraversable(checkPos))) {
            // 碰到障碍物，尝试后退
            const backPos = (newPosition as any).__sub((forwardVector as any).__mul(60)) as Vector;
            if (GridNav.IsTraversable(backPos)) {
                unit.SetAbsOrigin(backPos);
            }
            return undefined;
        }

        // 正常移动
        if (callback) callback(newPosition);
        unit.SetAbsOrigin(newPosition);

        // 完成移动
        if (elapsedTime >= time) {
            if (bounce && GridNav.IsTraversable(newPosition)) {
                const bouncePos = (unit.GetOrigin() as any).__add((forwardVector as any).__mul(-80)) as Vector;
                unit.SetOrigin(bouncePos);
            }
            if (!noFix) {
                FindClearSpaceForUnit(unit, unit.GetOrigin(), true);
            }
            return undefined;
        }

        return interval;
    });
};

/**
 * 暂停单位指定时间
 */
CDOTA_BaseNPC.Pause = function (time: number): void {
    this.AddNewModifier(this, undefined, 'modifier_stunned', { duration: time });
};

// ============= 目标选取 =============

/**
 * 获取范围内距离最近的敌方单位
 */
CDOTA_BaseNPC.GetMinDistanceUnit = function (range: number, p?: Vector): CDOTA_BaseNPC | null {
    let minDistance = range;
    let target: CDOTA_BaseNPC | null = null;
    const searchPos = p || this.GetOrigin();

    const units = FindUnitsInRadius(
        this.GetTeamNumber(),
        searchPos,
        undefined,
        range,
        UnitTargetTeam.ENEMY,
        UnitTargetType.HERO + UnitTargetType.BASIC + UnitTargetType.BUILDING,
        UnitTargetFlags.NONE,
        FindOrder.ANY,
        false
    );

    for (const unit of units) {
        const distance = ((searchPos as any).__sub(unit.GetOrigin()) as Vector).Length2D();
        if (distance < minDistance) {
            minDistance = distance;
            target = unit;
        }
    }

    return target;
};

/**
 * 获取范围内面向角度最小的敌方单位
 */
CDOTA_BaseNPC.GetMinAngleUnit = function (range: number): CDOTA_BaseNPC | null {
    let minAngle = 360;
    let target: CDOTA_BaseNPC | null = null;
    const self = this as CDOTA_BaseNPC;

    const units = FindUnitsInRadius(
        self.GetTeamNumber(),
        self.GetOrigin(),
        undefined,
        range,
        UnitTargetTeam.ENEMY,
        UnitTargetType.HERO + UnitTargetType.BASIC + UnitTargetType.BUILDING,
        UnitTargetFlags.NONE,
        FindOrder.ANY,
        false
    );

    for (const unit of units) {
        const toUnit = ((unit.GetOrigin() as any).__sub(self.GetOrigin()) as Vector).Normalized();
        const forward = self.GetForwardVector();

        // 计算点积得到角度
        const dot = forward.x * toUnit.x + forward.y * toUnit.y;
        const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);

        if (angle < minAngle) {
            minAngle = angle;
            target = unit;
        }
    }

    return target;
};

// ============= 范围效果 =============

/**
 * 圆形范围选取并对每个单位执行回调
 * @param radius 半径
 * @param position 中心位置
 * @param callback 对每个单位执行的回调
 * @param tag 冷却标记（可选）
 * @param cooldown 冷却时间（可选）
 */
CDOTA_BaseNPC.RoundAOE = function (
    radius: number,
    position: Vector,
    callback: (unit: CDOTA_BaseNPC) => void,
    tag?: string,
    cooldown: number = 1
): void {
    const searchPos = position || this.GetAbsOrigin();

    const units = FindUnitsInRadius(
        this.GetTeamNumber(),
        searchPos,
        undefined,
        radius,
        UnitTargetTeam.ENEMY,
        UnitTargetType.HERO + UnitTargetType.BASIC + UnitTargetType.BUILDING,
        UnitTargetFlags.NONE,
        FindOrder.ANY,
        false
    );

    const currentTime = GameRules.GetGameTime();

    for (const unit of units) {
        if (!unit || unit.IsNull() || !unit.IsAlive()) continue;

        // 检查冷却标记
        if (tag) {
            const lastHit = unit.GetContext(tag);
            if (lastHit && currentTime - tonumber(lastHit)! < cooldown) {
                continue;
            }
            unit.SetContext(tag, tostring(currentTime + cooldown), 1);
        }

        callback(unit);
    }
};

// ============= 安全操作 =============

/**
 * 安全移除单位（防止直接移除找不到单位报错）
 */
CDOTA_BaseNPC.SafetyRemoveSelf = function (): void {
    if (!this || this.IsNull()) return;

    // 移到场外
    this.SetAbsOrigin(Vector(9999, 9999, 1000));
    // 强制击杀
    this.ForceKill(false);
    // 发送死亡事件
    Event.send('怪物-死亡', { entindex_killed: this.GetEntityIndex() });
};

// ============= 治疗效果 =============

/**
 * 恢复生命值（带治疗特效）
 */
CDOTA_BaseNPC.RecoverBlood = function (
    value: number,
    inflictor?: CDOTABaseAbility,
    source?: string,
    target?: CDOTA_BaseNPC
): void {
    const healTarget = target || this;

    if (!healTarget || healTarget.IsNull() || !healTarget.IsAlive()) return;

    // 创建治疗特效
    const healFx = ParticleManager.CreateParticle(
        'particles/items3_fx/octarine_core_lifesteal.vpcf',
        ParticleAttachment.ABSORIGIN_FOLLOW,
        healTarget
    );
    ParticleManager.ReleaseParticleIndex(healFx);

    // 执行治疗
    healTarget.Heal(value, inflictor);
};

// ============= 属性修改快捷方法 =============

/**
 * 增加最大生命值
 */
CDOTA_BaseNPC.AddMaxBaseHealth = function (value: number): void {
    const currentMax = this.GetMaxHealth();
    this.SetBaseMaxHealth(currentMax + value);
    this.SetHealth(this.GetHealth() + value);
};

/**
 * 增加基础攻击力
 */
CDOTA_BaseNPC.AddBaseDamage = function (value: number): void {
    const current = this.GetBaseDamageMin();
    this.SetBaseDamageMin(current + value);
    this.SetBaseDamageMax(current + value);
};

/**
 * 增加基础护甲
 */
CDOTA_BaseNPC.AddBaseArmor = function (value: number): void {
    const current = this.GetPhysicalArmorBaseValue();
    this.SetPhysicalArmorBaseValue(current + value);
};

/**
 * 增加攻击速度
 */
CDOTA_BaseNPC.AddAttackSpeed = function (value: number): void {
    this.AddCustomValue('bonus_attack_speed', value);
    // 通过 modifier 或其他方式应用
};

/**
 * 增加移动速度
 */
CDOTA_BaseNPC.AddMoveSpeed = function (value: number): void {
    const current = this.GetBaseMoveSpeed();
    this.SetBaseMoveSpeed(current + value);
};

export { };
