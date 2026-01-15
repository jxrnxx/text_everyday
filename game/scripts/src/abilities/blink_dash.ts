/**
 * blink_dash.ts
 * 瞬移技能 - 按D键向鼠标方向瞬移
 * 使用幽灵假人法实现残影（方案一）
 */

import { BaseModifier, registerModifier } from '../utils/dota_ts_adapter';

// 瞬移参数
const MAX_DASH_DISTANCE = 600;   // 最大瞬移距离
const DASH_SPEED = 3000;         // 瞬移速度 (单位/秒)
const DASH_MANA_COST = 14;       // 蓝耗
const INVINCIBLE_DURATION = 0.2; // 无敌时间

// 残影参数
const AFTERIMAGE_FADE_DURATION = 0.5;  // 淡出时间
const AFTERIMAGE_START_ALPHA = 150;    // 起始透明度 (0-255)

// 记录当前正在瞬移的英雄
const dashingHeroes: Set<EntityIndex> = new Set();

/**
 * 执行瞬移 (从事件获取目标位置)
 */
export function ExecuteDash(playerID: PlayerID, targetWorldPos: Vector) {
    const hero = PlayerResource.GetSelectedHeroEntity(playerID);
    if (!hero || hero.IsNull() || !hero.IsAlive()) {
        return;
    }
    PerformDash(hero, playerID, targetWorldPos);
}

/**
 * 执行瞬移 (从控制台命令触发)
 */
export function ExecuteDashFromCommand(playerID: PlayerID) {
    const hero = PlayerResource.GetSelectedHeroEntity(playerID);
    if (!hero || hero.IsNull() || !hero.IsAlive()) {
        return;
    }
    
    const heroPos = hero.GetAbsOrigin();
    const forward = hero.GetForwardVector();
    const targetPos = (heroPos + forward * MAX_DASH_DISTANCE) as Vector;
    
    PerformDash(hero, playerID, targetPos);
}

/**
 * 执行瞬移的核心逻辑
 */
function PerformDash(hero: CDOTA_BaseNPC_Hero, playerID: PlayerID, targetWorldPos: Vector) {
    if (dashingHeroes.has(hero.entindex())) {
        return;
    }

    const currentMana = hero.GetMana();
    if (currentMana < DASH_MANA_COST) {
        return;
    }

    hero.SpendMana(DASH_MANA_COST, undefined);

    const heroPos = hero.GetAbsOrigin();
    const toTarget = (targetWorldPos - heroPos) as Vector;
    toTarget.z = 0;
    
    const mouseDistance = toTarget.Length2D();
    let actualDistance = Math.min(mouseDistance, MAX_DASH_DISTANCE);
    
    if (actualDistance < 50) {
        return;
    }
    
    const direction = toTarget.Normalized();
    
    actualDistance = FindMaxTraversableDistance(hero, heroPos, direction, actualDistance);
    
    if (actualDistance < 50) {
        return;
    }
    
    const dashTarget = (heroPos + direction * actualDistance) as Vector;
    const finalTarget = GetGroundPosition(dashTarget, hero);

    StartDash(hero, heroPos, finalTarget, direction, actualDistance);
}

/**
 * 检查路径上的障碍物
 */
function FindMaxTraversableDistance(hero: CDOTA_BaseNPC_Hero, startPos: Vector, direction: Vector, maxDistance: number): number {
    const checkInterval = 32;
    let lastValidDistance = 0;
    
    for (let dist = checkInterval; dist <= maxDistance; dist += checkInterval) {
        const checkPos = (startPos + direction * dist) as Vector;
        const groundPos = GetGroundPosition(checkPos, hero);
        
        if (!GridNav.IsTraversable(groundPos) || GridNav.IsBlocked(groundPos)) {
            return lastValidDistance;
        }
        
        lastValidDistance = dist;
    }
    
    const finalPos = (startPos + direction * maxDistance) as Vector;
    const finalGroundPos = GetGroundPosition(finalPos, hero);
    if (!GridNav.IsTraversable(finalGroundPos) || GridNav.IsBlocked(finalGroundPos)) {
        return lastValidDistance;
    }
    
    return maxDistance;
}

/**
 * 开始瞬移
 */
function StartDash(hero: CDOTA_BaseNPC_Hero, startPos: Vector, targetPos: Vector, direction: Vector, distance: number) {
    const heroIndex = hero.entindex();
    dashingHeroes.add(heroIndex);

    hero.SetForwardVector(direction);

    const dashDuration = distance / DASH_SPEED;
    const startTime = GameRules.GetGameTime();

    hero.AddNewModifier(hero, undefined, 'modifier_blink_dash_invulnerable', { duration: INVINCIBLE_DURATION });

    // 起点残影
    CreateGhostAfterimage(hero, startPos, direction);

    let midEffectPlayed = false;

    hero.SetContextThink('DashMovement', () => {
        const elapsed = GameRules.GetGameTime() - startTime;
        const progress = Math.min(elapsed / dashDuration, 1);

        const currentPos = (startPos + direction * (distance * progress)) as Vector;
        const groundPos = GetGroundPosition(currentPos, hero);
        
        hero.SetAbsOrigin(groundPos);

        // 在50%进度时播放中途残影
        if (!midEffectPlayed && progress >= 0.5) {
            midEffectPlayed = true;
            CreateGhostAfterimage(hero, groundPos, direction);
        }

        if (progress >= 1) {
            EndDash(hero, targetPos, direction);
            return undefined;
        }

        return 0.01;
    }, 0);
}

/**
 * 幽灵假人法 - 创建一个没有任何游戏功能的假模型
 */
function CreateGhostAfterimage(hero: CDOTA_BaseNPC_Hero, position: Vector, direction: Vector) {
    // 创建一个基础单位
    const afterimage = CreateUnitByName(
        'npc_blink_afterimage',
        position,
        false,
        undefined,
        undefined,
        DotaTeam.NEUTRALS
    );
    
    if (!afterimage) return;
    
    // 暂时使用不朽尸王僵尸模型测试（这是一个完整模型）
    // TODO: 后续改成带装备的英雄模型
    const testModel = 'models/heroes/undying/undying_minion.vmdl';
    afterimage.SetModel(testModel);
    afterimage.SetOriginalModel(testModel);
    
    // 设置朝向
    afterimage.SetForwardVector(direction);
    
    // 设置位置
    afterimage.SetAbsOrigin(position);
    
    // 复制英雄的装备（wearables）- 尝试使用相同的模型缩放
    const heroScale = hero.GetModelScale();
    afterimage.SetModelScale(heroScale);
    
    // 设置淡蓝色半透明 (水墨风/幽灵风)
    afterimage.SetRenderColor(150, 200, 255);  // 淡蓝色
    afterimage.SetRenderAlpha(AFTERIMAGE_START_ALPHA);
    
    // 添加残影修饰器（去光圈、无血条、不可选中）
    afterimage.AddNewModifier(afterimage, undefined, 'modifier_blink_dash_ghost', {
        duration: AFTERIMAGE_FADE_DURATION + 1
    });
    
    // 渐变淡出
    const fadeStartTime = GameRules.GetGameTime();
    const fadeInterval = 0.02;
    
    Timers.CreateTimer(0, () => {
        if (!afterimage || afterimage.IsNull()) {
            return undefined;
        }
        
        const elapsed = GameRules.GetGameTime() - fadeStartTime;
        const fadeProgress = Math.min(elapsed / AFTERIMAGE_FADE_DURATION, 1);
        
        // 从 AFTERIMAGE_START_ALPHA 渐变到 0
        const currentAlpha = Math.floor(AFTERIMAGE_START_ALPHA * (1 - fadeProgress));
        afterimage.SetRenderAlpha(currentAlpha);
        
        if (fadeProgress >= 1) {
            // 完全透明后，使用 RemoveSelf 静默删除（无爆炸）
            Timers.CreateTimer(0.5, () => {
                if (afterimage && !afterimage.IsNull()) {
                    afterimage.RemoveSelf();
                }
            });
            return undefined;
        }
        
        return fadeInterval;
    });
}

/**
 * 结束瞬移
 */
function EndDash(hero: CDOTA_BaseNPC_Hero, endPos: Vector, direction: Vector) {
    const heroIndex = hero.entindex();
    dashingHeroes.delete(heroIndex);
    
    hero.SetAbsOrigin(endPos);
    
    // 终点残影
    CreateGhostAfterimage(hero, (endPos + direction * -50) as Vector, direction);
}

/**
 * 自定义无敌修饰器
 */
@registerModifier('modifier_blink_dash_invulnerable')
export class modifier_blink_dash_invulnerable extends BaseModifier {
    IsHidden(): boolean {
        return true;
    }
    
    IsPurgable(): boolean {
        return false;
    }
    
    CheckState(): Partial<Record<ModifierState, boolean>> {
        return {
            [ModifierState.INVULNERABLE]: true,
        };
    }
}

/**
 * 幽灵残影修饰器 - 去光圈、无血条、不可选中
 */
@registerModifier('modifier_blink_dash_ghost')
export class modifier_blink_dash_ghost extends BaseModifier {
    IsHidden(): boolean {
        return true;
    }
    
    IsPurgable(): boolean {
        return false;
    }
    
    CheckState(): Partial<Record<ModifierState, boolean>> {
        return {
            [ModifierState.INVULNERABLE]: true,
            [ModifierState.NO_HEALTH_BAR]: true,
            [ModifierState.UNSELECTABLE]: true,
            [ModifierState.NOT_ON_MINIMAP]: true,
            [ModifierState.NO_UNIT_COLLISION]: true,
            [ModifierState.STUNNED]: true,
            [ModifierState.OUT_OF_GAME]: true,
            [ModifierState.COMMAND_RESTRICTED]: true,
        };
    }
}

// 导出初始化函数
export function InitBlinkDash() {
    print('[BlinkDash] Initialized - MaxDistance: 600, Ghost Afterimage');
}
