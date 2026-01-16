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
    
    /** 出生点名称 */
    SPAWN_POINTS: ['spawner_lane_1', 'spawner_lane_2', 'spawner_lane_3'],
} as const;

// ===== 波次类型 =====
export enum WaveType {
    Normal = 'normal',
    Boss = 'boss',
    FinalBoss = 'final_boss',
}

// ===== 波次状态 =====
export enum WaveState {
    Preparation = 'preparation',  // 准备期
    Spawning = 'spawning',        // 出怪中
    Break = 'break',              // 休整期
    Completed = 'completed',      // 所有波次完成
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
    
    private constructor() {}
    
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
        
        // 发送初始状态
        this.SendStateUpdate();
        
        // 设置准备期定时器
        this.ScheduleNextWave(WAVE_CONFIG.PREP_TIME);
        
        print(`[WaveManager] Initialized. First wave starts in ${WAVE_CONFIG.PREP_TIME} seconds.`);
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
            print(`[WaveManager] ERROR: Wave ${this.currentWave} config not found!`);
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
        for (const spawnPointName of WAVE_CONFIG.SPAWN_POINTS) {
            const spawnPoint = Entities.FindByName(undefined, spawnPointName);
            if (spawnPoint) {
                const origin = spawnPoint.GetAbsOrigin();
                const unit = CreateUnitByName(
                    unitName,
                    origin,
                    true,
                    undefined,
                    undefined,
                    DotaTeam.BADGUYS
                );
                
                if (unit) {
                    this.spawnedUnits.push(unit);
                    
                    // 设置AI行为：向基地移动
                    const homeBase = Entities.FindByName(undefined, 'npc_dota_home_base');
                    if (homeBase) {
                        unit.MoveToPositionAggressive(homeBase.GetAbsOrigin());
                    }
                }
            }
        }
    }
    
    /**
     * 生成Boss
     */
    private SpawnBoss(bossName: string): void {
        // Boss在中路出生点生成
        const spawnPoint = Entities.FindByName(undefined, 'spawner_lane_2');
        if (spawnPoint) {
            const origin = spawnPoint.GetAbsOrigin();
            const boss = CreateUnitByName(
                bossName,
                origin,
                true,
                undefined,
                undefined,
                DotaTeam.BADGUYS
            );
            
            if (boss) {
                this.spawnedUnits.push(boss);
                
                // Boss也向基地移动
                const homeBase = Entities.FindByName(undefined, 'npc_dota_home_base');
                if (homeBase) {
                    boss.MoveToPositionAggressive(homeBase.GetAbsOrigin());
                }
            }
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
        const spawnPoint = Entities.FindByName(undefined, 'spawner_lane_2');
        if (spawnPoint) {
            const origin = spawnPoint.GetAbsOrigin();
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
                    
                    const homeBase = Entities.FindByName(undefined, 'npc_dota_home_base');
                    if (homeBase) {
                        guard.MoveToPositionAggressive(homeBase.GetAbsOrigin());
                    }
                }
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
        
        print(`[WaveManager] All ${WAVE_CONFIG.TOTAL_WAVES} waves completed!`);
    }
    
    /**
     * 发送状态更新到客户端
     */
    private SendStateUpdate(): void {
        const nextWaveTime = this.CalculateNextWaveTime();
        
        CustomGameEventManager.Send_ServerToAllClients('wave_state_changed', {
            currentWave: this.currentWave,
            totalWaves: WAVE_CONFIG.TOTAL_WAVES,
            state: this.currentState,
            nextWaveTime: nextWaveTime,
            isSpawning: this.currentState === WaveState.Spawning,
            canPause: this.currentState === WaveState.Break || this.currentState === WaveState.Preparation,
        });
        
        // 同步到 NetTable
        CustomNetTables.SetTableValue('wave_state', 'current', {
            wave: this.currentWave,
            total: WAVE_CONFIG.TOTAL_WAVES,
            state: this.currentState,
            nextWaveTime: nextWaveTime,
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
                unit.ForceKill(false);
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
