/**
 * WaveManager.ts
 * 波次管理系统 - 控制游戏中怪物波次的生成
 *
 * 时间轴:
 * - 准备期: 2:30 (150秒)
 * - 波次间隔: 90秒
 * - 出怪时长: 20秒
 * - 休整时间: 70秒
 */

// ===== 时间轴常量 =====
export const WAVE_CONFIG = {
    /** 准备期时长(秒) - 第一波在游戏时间 2:30 开始 */
    PREP_TIME: 150.0,

    /** 波次间隔(秒) - 每波开始时间间隔 */
    WAVE_INTERVAL: 90.0,

    /** 出怪时长(秒) - 怪物生成持续时间 */
    SPAWN_DURATION: 20.0,

    /** 休整时间(秒) = WAVE_INTERVAL - SPAWN_DURATION */
    BREAK_TIME: 70.0,

    /** 总波数 */
    TOTAL_WAVES: 20,

    /** 每秒每路生成的怪物数量 */
    SPAWN_RATE: 1,

    /** 出生点名称 (与地图实体对应) */
    SPAWN_POINTS: ['spawner_1', 'spawner_2', 'spawner_3'],

    /** 备用出生点坐标 (如果地图上找不到出生点实体，使用这些坐标) */
    FALLBACK_SPAWN_POSITIONS: [
        { x: 5500, y: 5500, z: 256 }, // 右上角 Lane 1
        { x: 6000, y: 5000, z: 256 }, // 右上角 Lane 2 (中路Boss)
        { x: 5000, y: 6000, z: 256 }, // 右上角 Lane 3
    ],
} as const;

// ===== 波次类型 =====
export enum WaveType {
    Normal = 'normal',
    Boss = 'boss',
    FinalBoss = 'final_boss',
}

// ===== 波次状态 =====
export enum WaveState {
    Preparation = 'preparation', // 准备期
    Spawning = 'spawning', // 出怪中
    Break = 'break', // 休整期
    Completed = 'completed', // 所有波次完成
}

// ===== 波次配置接口 =====
export interface WaveConfig {
    waveNumber: number;
    type: WaveType;
    unitName: string;
    bossName?: string;
}

// ===== 波次配置表 =====
const WAVE_CONFIGS: WaveConfig[] = [
    // 普通波次 1-4
    { waveNumber: 1, type: WaveType.Normal, unitName: 'npc_creep_wave_1' },
    { waveNumber: 2, type: WaveType.Normal, unitName: 'npc_creep_wave_2' },
    { waveNumber: 3, type: WaveType.Normal, unitName: 'npc_creep_wave_3' },
    { waveNumber: 4, type: WaveType.Normal, unitName: 'npc_creep_wave_4' },

    // Boss波次 5 (小兵先出，Boss后出)
    { waveNumber: 5, type: WaveType.Boss, unitName: 'npc_creep_wave_5', bossName: 'npc_boss_wave_5' },

    // 普通波次 6-9
    { waveNumber: 6, type: WaveType.Normal, unitName: 'npc_creep_wave_6' },
    { waveNumber: 7, type: WaveType.Normal, unitName: 'npc_creep_wave_7' },
    { waveNumber: 8, type: WaveType.Normal, unitName: 'npc_creep_wave_8' },
    { waveNumber: 9, type: WaveType.Normal, unitName: 'npc_creep_wave_9' },

    // Boss波次 10 (小兵先出，Boss后出)
    { waveNumber: 10, type: WaveType.Boss, unitName: 'npc_creep_wave_10', bossName: 'npc_boss_wave_10' },

    // 普通波次 11-14
    { waveNumber: 11, type: WaveType.Normal, unitName: 'npc_creep_wave_11' },
    { waveNumber: 12, type: WaveType.Normal, unitName: 'npc_creep_wave_12' },
    { waveNumber: 13, type: WaveType.Normal, unitName: 'npc_creep_wave_13' },
    { waveNumber: 14, type: WaveType.Normal, unitName: 'npc_creep_wave_14' },

    // Boss波次 15 (小兵先出，Boss后出)
    { waveNumber: 15, type: WaveType.Boss, unitName: 'npc_creep_wave_15', bossName: 'npc_boss_wave_15' },

    // 普通波次 16-19
    { waveNumber: 16, type: WaveType.Normal, unitName: 'npc_creep_wave_16' },
    { waveNumber: 17, type: WaveType.Normal, unitName: 'npc_creep_wave_17' },
    { waveNumber: 18, type: WaveType.Normal, unitName: 'npc_creep_wave_18' },
    { waveNumber: 19, type: WaveType.Normal, unitName: 'npc_creep_wave_19' },

    // 最终Boss波次 20 (只有Boss+4护卫)
    { waveNumber: 20, type: WaveType.FinalBoss, unitName: '', bossName: 'npc_boss_wave_20' },
];

// ===== 波次管理器 =====
export class WaveManager {
    private static instance: WaveManager | null = null;

    private currentWave: number = 0;
    private currentState: WaveState = WaveState.Preparation;
    private spawnTimerId: string | null = null;
    private waveTimerId: string | null = null;
    private spawnedUnits: CDOTA_BaseNPC[] = [];
    private aliveCountTimerId: string | null = null;

    // 缓存的目标位置（避免每次都查找）
    private cachedTargetPos: Vector | undefined;

    private constructor() { }

    /**
     * 获取怪物进攻目标位置（带调试信息）
     * 优先级：npc_dota_home_base > dota_goodguys_fort > 玩家英雄 > 地图中心
     */
    private GetTargetPosition(): Vector {
        // 如果已缓存，直接返回
        if (this.cachedTargetPos) {
            return this.cachedTargetPos;
        }

        // 1. 尝试查找自定义基地
        const buildings = Entities.FindAllByClassname('npc_dota_building');
        for (const building of buildings) {
            const name = (building as CDOTA_BaseNPC).GetUnitName();
            if (name === 'npc_dota_home_base') {
                this.cachedTargetPos = building.GetAbsOrigin();
                return this.cachedTargetPos;
            }
        }

        // 2. 尝试默认基地 dota_goodguys_fort
        const defaultFort = Entities.FindByName(undefined, 'dota_goodguys_fort');
        if (defaultFort) {
            this.cachedTargetPos = defaultFort.GetAbsOrigin();
            return this.cachedTargetPos;
        }

        // 3. 查找玩家英雄
        const playerHero = PlayerResource.GetSelectedHeroEntity(0 as PlayerID);
        if (playerHero) {
            this.cachedTargetPos = playerHero.GetAbsOrigin();
            return this.cachedTargetPos;
        }

        // 4. 最后的 fallback：地图中心
        this.cachedTargetPos = Vector(0, 0, 128) as Vector;
        return this.cachedTargetPos;
    }

    public static GetInstance(): WaveManager {
        if (!WaveManager.instance) {
            WaveManager.instance = new WaveManager();
        }
        return WaveManager.instance;
    }

    /**
     * 初始化波次管理器
     * 在游戏开始时调用
     */
    public Initialize(): void {
        this.currentWave = 0;
        this.currentState = WaveState.Preparation;
        this.spawnedUnits = [];
        this.cachedTargetPos = undefined; // 清除缓存目标，强制重新查找

        // 发送初始状态
        this.SendStateUpdate();

        // 设置准备期定时器
        this.ScheduleNextWave(WAVE_CONFIG.PREP_TIME);
    }

    /**
     * 获取当前波次
     */
    public GetCurrentWave(): number {
        return this.currentWave;
    }

    /**
     * 获取当前状态
     */
    public GetCurrentState(): WaveState {
        return this.currentState;
    }

    /**
     * 获取波次配置
     */
    public GetWaveConfig(waveNumber: number): WaveConfig | undefined {
        return WAVE_CONFIGS.find(w => w.waveNumber === waveNumber);
    }

    /**
     * [Debug] 跳过当前计时器，立即开始下一波
     */
    public SkipToNextWave(): void {
        if (this.waveTimerId) {
            Timers.RemoveTimer(this.waveTimerId);
        }
        if (this.spawnTimerId) {
            Timers.RemoveTimer(this.spawnTimerId);
        }

        // 如果正在出怪，立即完成出怪
        if (this.currentState === WaveState.Spawning) {
            this.OnSpawningComplete();
        } else {
            // 否则立即开始下一波
            this.ScheduleNextWave(0.1);
        }
    }

    /**
     * [Debug] 跳转到指定波次
     */
    public JumpToWave(waveNumber: number): void {
        // 停止所有计时器
        if (this.waveTimerId) {
            Timers.RemoveTimer(this.waveTimerId);
        }
        if (this.spawnTimerId) {
            Timers.RemoveTimer(this.spawnTimerId);
        }

        // 清理所有怪物
        this.ClearAllUnits();

        // 设置波次（-1 因为 StartNextWave 会 +1）
        this.currentWave = waveNumber - 1;
        this.currentState = WaveState.Break;

        // 立即开始该波次
        this.StartNextWave();
    }

    /**
     * 调度下一波
     */
    private ScheduleNextWave(delay: number): void {
        if (this.waveTimerId) {
            Timers.RemoveTimer(this.waveTimerId);
        }

        this.waveTimerId = Timers.CreateTimer(delay, () => {
            this.StartNextWave();
            return undefined;
        });
    }

    /**
     * 开始下一波
     */
    private StartNextWave(): void {
        this.currentWave++;

        if (this.currentWave > WAVE_CONFIG.TOTAL_WAVES) {
            this.OnAllWavesCompleted();
            return;
        }

        const config = this.GetWaveConfig(this.currentWave);
        if (!config) {
            return;
        }

        this.currentState = WaveState.Spawning;
        this.SendStateUpdate();

        // 发送波次开始事件
        CustomGameEventManager.Send_ServerToAllClients('wave_started', {
            waveNumber: this.currentWave,
            waveType: config.type,
            isBossWave: config.type === WaveType.Boss || config.type === WaveType.FinalBoss,
        });

        // 启动aliveCount实时更新定时器
        this.StartAliveCountUpdater();

        // 开始生成怪物
        this.StartSpawning(config);
    }

    /**
     * 开始生成怪物
     */
    private StartSpawning(config: WaveConfig): void {
        let spawnCount = 0;
        const maxSpawns = WAVE_CONFIG.SPAWN_DURATION; // 20秒

        // 最终Boss波特殊处理
        if (config.type === WaveType.FinalBoss) {
            this.SpawnFinalBossWave(config);

            // 等待出怪时间结束
            Timers.CreateTimer(WAVE_CONFIG.SPAWN_DURATION, () => {
                this.OnSpawningComplete();
                return undefined;
            });
            return;
        }

        // 每秒生成怪物
        this.spawnTimerId = Timers.CreateTimer(0, () => {
            if (spawnCount >= maxSpawns) {
                // Boss波次：小兵出完后再Boss
                if (config.type === WaveType.Boss && config.bossName) {
                    this.SpawnBoss(config.bossName);
                }
                this.OnSpawningComplete();
                return undefined;
            }

            // 在3个出生点各生成1只怪物
            this.SpawnCreepsAtAllLanes(config.unitName);
            spawnCount++;

            return 1.0; // 每秒执行
        });
    }

    /**
     * 在所有路线生成小怪
     */
    private SpawnCreepsAtAllLanes(unitName: string): void {
        for (let i = 0; i < WAVE_CONFIG.SPAWN_POINTS.length; i++) {
            const spawnPointName = WAVE_CONFIG.SPAWN_POINTS[i];
            const spawnPoint = Entities.FindByName(undefined, spawnPointName);

            let origin: Vector;
            if (spawnPoint) {
                origin = spawnPoint.GetAbsOrigin();
            } else {
                // 使用备用坐标
                const fallback = WAVE_CONFIG.FALLBACK_SPAWN_POSITIONS[i];
                origin = Vector(fallback.x, fallback.y, fallback.z);
            }

            // 使用 Async 版本（与旧代码保持一致）
            CreateUnitByNameAsync(unitName, origin, true, undefined, undefined, DotaTeam.BADGUYS, unit => {
                if (unit) {
                    this.spawnedUnits.push(unit);

                    // 设置仇恨范围
                    unit.SetAcquisitionRange(700);

                    // 获取目标位置
                    const targetPos = this.GetTargetPosition();

                    // 延迟一帧后下达移动命令
                    Timers.CreateTimer(0.1, () => {
                        ExecuteOrderFromTable({
                            UnitIndex: unit.entindex(),
                            OrderType: UnitOrder.ATTACK_MOVE,
                            Position: targetPos,
                            Queue: false,
                        });
                        return undefined;
                    });

                    // 设置 AI 思考能力（与旧代码一致的仇恨逻辑）
                    unit.SetContextThink(
                        'CreepThink',
                        () => {
                            if (unit && !unit.IsNull() && unit.IsAlive()) {
                                const origin = unit.GetAbsOrigin();
                                const currentTarget = unit.GetAggroTarget();

                                // 1. Leash 机制（防风筝/脱战）
                                // 追英雄超过 1000 距离就放弃，继续去打基地
                                if (currentTarget && currentTarget.IsHero()) {
                                    const dist = CalcDistanceBetweenEntityOBB(unit, currentTarget);
                                    if (dist > 1000) {
                                        ExecuteOrderFromTable({
                                            UnitIndex: unit.entindex(),
                                            OrderType: UnitOrder.ATTACK_MOVE,
                                            Position: targetPos,
                                            Queue: false,
                                        });
                                        return 1.0;
                                    }
                                    return 0.5; // 正在追英雄，检查频率稍高
                                }

                                // 2. 转火机制
                                // 攻击建筑时，如果附近 800 范围有英雄，就转火
                                if (currentTarget && currentTarget.IsBuilding()) {
                                    const enemies = FindUnitsInRadius(
                                        unit.GetTeamNumber(),
                                        origin,
                                        undefined,
                                        800,
                                        UnitTargetTeam.ENEMY,
                                        UnitTargetType.HERO,
                                        UnitTargetFlags.NONE,
                                        FindOrder.CLOSEST,
                                        false
                                    );

                                    if (enemies.length > 0) {
                                        ExecuteOrderFromTable({
                                            UnitIndex: unit.entindex(),
                                            OrderType: UnitOrder.ATTACK_TARGET,
                                            TargetIndex: enemies[0].entindex(),
                                            Queue: false,
                                        });
                                        return 1.0;
                                    }
                                }

                                // 3. 发呆补救
                                // 如果单位 Idle，重新下达移动命令
                                if (unit.IsIdle()) {
                                    const canFindPath = GridNav.CanFindPath(origin, targetPos);
                                    if (!canFindPath) {
                                        FindClearSpaceForUnit(unit, origin, true);
                                    }
                                    ExecuteOrderFromTable({
                                        UnitIndex: unit.entindex(),
                                        OrderType: UnitOrder.ATTACK_MOVE,
                                        Position: targetPos,
                                        Queue: false,
                                    });
                                }
                                return 1.0;
                            }
                            return undefined;
                        },
                        0.1
                    );
                } else {
                }
            });
        }
    }

    /**
     * 生成Boss
     */
    private SpawnBoss(bossName: string): void {
        // Boss在中路出生点生成
        const spawnPoint = Entities.FindByName(undefined, 'spawner_2');

        let origin: Vector;
        if (spawnPoint) {
            origin = spawnPoint.GetAbsOrigin();
        } else {
            // 使用备用坐标 (Lane 2 = index 1)
            const fallback = WAVE_CONFIG.FALLBACK_SPAWN_POSITIONS[1];
            origin = Vector(fallback.x, fallback.y, fallback.z);
        }

        const boss = CreateUnitByName(bossName, origin, true, undefined, undefined, DotaTeam.BADGUYS);

        if (boss) {
            this.spawnedUnits.push(boss);
            boss.SetAcquisitionRange(700);

            // Boss也向目标移动
            const targetPos = this.GetTargetPosition();
            ExecuteOrderFromTable({
                UnitIndex: boss.entindex(),
                OrderType: UnitOrder.ATTACK_MOVE,
                Position: targetPos,
                Queue: false,
            });
        }
    }

    /**
     * 生成最终Boss波
     */
    private SpawnFinalBossWave(config: WaveConfig): void {
        // 生成最终Boss
        if (config.bossName) {
            this.SpawnBoss(config.bossName);
        }

        // 生成4个精英护卫 (在Boss周围)
        const spawnPoint = Entities.FindByName(undefined, 'spawner_2');

        let origin: Vector;
        if (spawnPoint) {
            origin = spawnPoint.GetAbsOrigin();
        } else {
            // 使用备用坐标
            const fallback = WAVE_CONFIG.FALLBACK_SPAWN_POSITIONS[1];
            origin = Vector(fallback.x, fallback.y, fallback.z);
        }

        const guardPositions = [
            Vector(origin.x + 200, origin.y, origin.z),
            Vector(origin.x - 200, origin.y, origin.z),
            Vector(origin.x, origin.y + 200, origin.z),
            Vector(origin.x, origin.y - 200, origin.z),
        ];

        for (const pos of guardPositions) {
            const guard = CreateUnitByName(
                'npc_creep_wave_19', // 使用最高级小怪作为精英护卫
                pos,
                true,
                undefined,
                undefined,
                DotaTeam.BADGUYS
            );

            if (guard) {
                this.spawnedUnits.push(guard);
                guard.SetAcquisitionRange(700);

                const targetPos = this.GetTargetPosition();
                ExecuteOrderFromTable({
                    UnitIndex: guard.entindex(),
                    OrderType: UnitOrder.ATTACK_MOVE,
                    Position: targetPos,
                    Queue: false,
                });
            }
        }
    }

    /**
     * 出怪完成
     */
    private OnSpawningComplete(): void {
        if (this.spawnTimerId) {
            Timers.RemoveTimer(this.spawnTimerId);
            this.spawnTimerId = null;
        }

        this.currentState = WaveState.Break;
        this.SendStateUpdate();

        // 发送波次完成事件
        CustomGameEventManager.Send_ServerToAllClients('wave_completed', {
            waveNumber: this.currentWave,
        });

        // 如果不是最后一波，调度下一波
        if (this.currentWave < WAVE_CONFIG.TOTAL_WAVES) {
            this.ScheduleNextWave(WAVE_CONFIG.BREAK_TIME);
        } else {
            // 最后一波，等待玩家击败Boss
            this.currentState = WaveState.Completed;
            this.SendStateUpdate();
        }
    }

    /**
     * 所有波次完成
     */
    private OnAllWavesCompleted(): void {
        this.currentState = WaveState.Completed;
        this.SendStateUpdate();
    }

    /**
     * 发送状态更新到客户端
     */
    private SendStateUpdate(): void {
        const duration = this.CalculateNextWaveTime();
        // 发送倒计时结束的绝对游戏时间，客户端用 endTime - currentGameTime 计算剩余时间
        const countdownEndTime = duration > 0 ? GameRules.GetGameTime() + duration : 0;

        CustomGameEventManager.Send_ServerToAllClients('wave_state_changed', {
            currentWave: this.currentWave,
            totalWaves: WAVE_CONFIG.TOTAL_WAVES,
            state: this.currentState,
            nextWaveTime: duration,
            countdownEndTime: countdownEndTime,
            isSpawning: this.currentState === WaveState.Spawning,
            canPause: this.currentState === WaveState.Break || this.currentState === WaveState.Preparation,
        });

        // 同步到 NetTable (保留现有的aliveCount)
        const existingData = CustomNetTables.GetTableValue('wave_state', 'current') as any;
        const currentAliveCount = existingData?.aliveCount || 0;
        CustomNetTables.SetTableValue('wave_state' as any, 'current', {
            wave: this.currentWave,
            total: WAVE_CONFIG.TOTAL_WAVES,
            state: this.currentState,
            nextWaveTime: duration,
            countdownEndTime: countdownEndTime,
            aliveCount: currentAliveCount,
        } as any);
    }

    /**
     * 启动存活怪物数量实时更新定时器
     */
    private StartAliveCountUpdater(): void {
        if (this.aliveCountTimerId) {
            Timers.RemoveTimer(this.aliveCountTimerId);
        }

        this.aliveCountTimerId = Timers.CreateTimer(0.5, () => {
            // 计算存活怪物数量
            let aliveCount = 0;
            for (const unit of this.spawnedUnits) {
                if (unit && !unit.IsNull() && unit.IsAlive()) {
                    aliveCount++;
                }
            }

            // 更新到NetTable
            const currentData = (CustomNetTables.GetTableValue('wave_state', 'current') as any) || {};
            currentData.aliveCount = aliveCount;
            CustomNetTables.SetTableValue('wave_state', 'current', currentData);

            // 继续定时更新，直到波次结束且所有怪物被消灭
            if (this.currentState === WaveState.Spawning || aliveCount > 0) {
                return 1.0;
            }
            return undefined;
        });
    }

    /**
     * 计算下一波时间
     */
    private CalculateNextWaveTime(): number {
        if (this.currentState === WaveState.Preparation) {
            return WAVE_CONFIG.PREP_TIME;
        } else if (this.currentState === WaveState.Break) {
            return WAVE_CONFIG.BREAK_TIME;
        }
        return 0;
    }

    /**
     * 清理所有生成的单位
     */
    public ClearAllUnits(): void {
        for (const unit of this.spawnedUnits) {
            if (unit && unit.IsAlive()) {
                unit.SafetyRemoveSelf();
            }
        }
        this.spawnedUnits = [];
    }

    /**
     * 重置波次管理器
     */
    public Reset(): void {
        if (this.spawnTimerId) {
            Timers.RemoveTimer(this.spawnTimerId);
        }
        if (this.waveTimerId) {
            Timers.RemoveTimer(this.waveTimerId);
        }

        this.ClearAllUnits();
        this.currentWave = 0;
        this.currentState = WaveState.Preparation;
    }
}
