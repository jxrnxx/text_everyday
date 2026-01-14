/**
 * blink_dash.ts
 * 冲刺技能 - 按D键向鼠标方向极速冲刺，带拖尾残影效果
 */

// 冲刺参数
const DASH_DISTANCE = 400;      // 冲刺距离
const DASH_SPEED = 2500;        // 冲刺速度 (单位/秒)
const DASH_MANA_COST = 14;      // 统一蓝耗

// 计算冲刺持续时间
const DASH_DURATION = DASH_DISTANCE / DASH_SPEED; // 约0.16秒



// 记录当前正在冲刺的英雄
const dashingHeroes: Set<EntityIndex> = new Set();

/**
 * 执行冲刺 (从事件获取目标位置)
 * @param playerID 玩家ID
 * @param targetWorldPos 鼠标世界坐标
 */
export function ExecuteDash(playerID: PlayerID, targetWorldPos: Vector) {
    const hero = PlayerResource.GetSelectedHeroEntity(playerID);
    if (!hero || hero.IsNull() || !hero.IsAlive()) {
        return;
    }
    PerformDash(hero, playerID, targetWorldPos);
}

/**
 * 执行冲刺 (从控制台命令触发 - 使用英雄前方向)
 * @param playerID 玩家ID
 */
export function ExecuteDashFromCommand(playerID: PlayerID) {
    const hero = PlayerResource.GetSelectedHeroEntity(playerID);
    if (!hero || hero.IsNull() || !hero.IsAlive()) {
        return;
    }
    
    // 使用英雄当前朝向作为冲刺方向
    const heroPos = hero.GetAbsOrigin();
    const forward = hero.GetForwardVector();
    const targetPos = (heroPos + forward * DASH_DISTANCE) as Vector;
    
    PerformDash(hero, playerID, targetPos);
}

/**
 * 执行冲刺的核心逻辑
 */
function PerformDash(hero: CDOTA_BaseNPC_Hero, playerID: PlayerID, targetWorldPos: Vector) {
    // 检查是否正在冲刺中
    if (dashingHeroes.has(hero.entindex())) {
        return;
    }

    // 检查蓝量
    const currentMana = hero.GetMana();
    if (currentMana < DASH_MANA_COST) {
        // 蓝量不足，直接返回
        return;
    }

    // 扣蓝
    hero.SpendMana(DASH_MANA_COST, undefined);

    // 计算冲刺方向和目标位置
    const heroPos = hero.GetAbsOrigin();
    const direction = ((targetWorldPos - heroPos) as Vector).Normalized();
    const dashTarget = (heroPos + direction * DASH_DISTANCE) as Vector;

    // 检查目标位置是否可通行
    const finalTarget = GetGroundPosition(dashTarget, hero);

    // 开始冲刺
    StartDash(hero, finalTarget, direction);
}

/**
 * 开始冲刺动画和移动
 */
function StartDash(hero: CDOTA_BaseNPC_Hero, targetPos: Vector, direction: Vector) {
    const heroIndex = hero.entindex();
    dashingHeroes.add(heroIndex);

    // 让英雄面向冲刺方向
    hero.SetForwardVector(direction);

    // 记录起始位置
    const startPos = hero.GetAbsOrigin();
    const startTime = GameRules.GetGameTime();

    // 使用高频思考来平滑移动英雄
    hero.SetContextThink('DashMovement', () => {
        const elapsed = GameRules.GetGameTime() - startTime;
        const progress = Math.min(elapsed / DASH_DURATION, 1);

        // 计算当前位置 (线性插值)
        const currentPos = (startPos + direction * (DASH_DISTANCE * progress)) as Vector;
        const groundPos = GetGroundPosition(currentPos, hero);
        
        FindClearSpaceForUnit(hero, groundPos, false);

        if (progress >= 1) {
            // 冲刺结束
            EndDash(hero);
            return undefined;
        }

        return 0.01; // 每0.01秒更新一次位置（约100fps）
    }, 0);
}

/**
 * 结束冲刺
 */
function EndDash(hero: CDOTA_BaseNPC_Hero) {
    const heroIndex = hero.entindex();
    dashingHeroes.delete(heroIndex);
}

// 导出初始化函数
export function InitBlinkDash() {
    print('[BlinkDash] Initialized');
}
