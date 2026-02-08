/**
 * ZoneManager.ts
 * 域守卫管理系统 - 管理6个域的封印守卫的生成与复活
 *
 * 机制:
 * - 每个域有2个守卫，分别在 spawn_guardian_zone_{i}_a 和 spawn_guardian_zone_{i}_b 生成
 * - 每个域有一个传送点 point_teleport_zone_{i}
 * - 守卫为中立阵营，仅攻击打它的敌人 (AttackAcquisitionRange=0)
 * - 击杀守卫后触发对应槽位的神器解封 (Tier 0 -> Tier 1)
 * - 守卫死亡后 5 秒自动复活
 * - 守卫 AI 使用 SetContextThink 实现追击/回归逻辑
 */

import { ArtifactSystem } from './ArtifactSystem';

const ZONE_CONFIG = {
    /** 域的总数 */
    ZONE_COUNT: 6,

    /** 守卫复活时间 (秒) */
    RESPAWN_TIME: 5,

    /** 守卫单位名前缀 */
    UNIT_PREFIX: 'npc_guardian_zone_',

    /** 地图出生点名前缀 */
    SPAWN_PREFIX: 'spawn_guardian_zone_',

    /** 传送点名前缀 */
    TELEPORT_PREFIX: 'point_teleport_zone_',

    /** 每个域的出生点后缀 */
    SPAWN_SUFFIXES: ['a', 'b'] as const,

    /** 守卫最大追击距离 (超过此距离强制回归) */
    MAX_CHASE_DISTANCE: 1000,

    /** Zone ID -> Artifact Slot 映射 */
    ZONE_TO_SLOT: {
        1: 0, // Zone 1 -> Weapon (Slot 0)
        2: 1, // Zone 2 -> Armor  (Slot 1)
        3: 2, // Zone 3 -> Helm   (Slot 2)
        4: 3, // Zone 4 -> Accessory (Slot 3)
        5: 4, // Zone 5 -> Boots  (Slot 4)
        6: 5, // Zone 6 -> Amulet (Slot 5)
    } as Record<number, number>,
} as const;

export class ZoneManager {
    private static instance: ZoneManager | null = null;

    /** 每个守卫的实体引用, key 格式: "zone_{i}_{a|b}" */
    private guardians: Map<string, CDOTA_BaseNPC> = new Map();

    /** 每个出生点位置缓存, key 格式: "zone_{i}_{a|b}" */
    private spawnPositions: Map<string, Vector> = new Map();

    /** 每个域的传送点位置缓存 */
    private teleportPositions: Map<number, Vector> = new Map();

    /** 已解封的域 (每个玩家每个域只能解封一次), key: "playerId_zoneId" */
    private unlockedZones: Set<string> = new Set();

    /** 已访问的域 (用于首次访问才播放电影通知), key: "playerId_zoneId" */
    private visitedZones: Set<string> = new Set();

    private constructor() { }

    public static GetInstance(): ZoneManager {
        if (!ZoneManager.instance) {
            ZoneManager.instance = new ZoneManager();
        }
        return ZoneManager.instance;
    }

    /**
     * 初始化域守卫系统 - 在游戏开始时调用
     */
    public Initialize(): void {
        // 缓存传送点位置
        for (let zone = 1; zone <= ZONE_CONFIG.ZONE_COUNT; zone++) {
            const teleportName = `${ZONE_CONFIG.TELEPORT_PREFIX}${zone}`;
            const teleportEntity = Entities.FindByName(undefined, teleportName);
            if (teleportEntity) {
                this.teleportPositions.set(zone, teleportEntity.GetAbsOrigin());
            }
        }

        // 缓存出生点位置 & 生成守卫
        for (let zone = 1; zone <= ZONE_CONFIG.ZONE_COUNT; zone++) {
            for (const suffix of ZONE_CONFIG.SPAWN_SUFFIXES) {
                const key = `zone_${zone}_${suffix}`;
                const pos = this.FindSpawnPosition(zone, suffix);
                this.spawnPositions.set(key, pos);
                this.SpawnGuardian(zone, suffix);
            }
        }

        // 监听 entity_killed 事件
        ListenToGameEvent('entity_killed', event => this.OnEntityKilled(event), undefined);

        // 监听传送命令 (客户端点击蒙尘神器 -> 传送到对应域)
        CustomGameEventManager.RegisterListener('cmd_teleport_to_zone', (_, event: any) => {
            const playerId = event.PlayerID as PlayerID;
            const slotIndex = event.slot as number;
            const zoneId = slotIndex + 1;
            this.TeleportPlayerToZone(playerId, zoneId);
        });
    }

    /**
     * 查找域出生点位置
     */
    private FindSpawnPosition(zoneId: number, suffix: string): Vector {
        // 尝试查找地图实体: spawn_guardian_zone_{i}_{a|b}
        const spawnName = `${ZONE_CONFIG.SPAWN_PREFIX}${zoneId}_${suffix}`;
        const spawnEntity = Entities.FindByName(undefined, spawnName);

        if (spawnEntity) {
            return spawnEntity.GetAbsOrigin();
        }

        // 如果找不到带后缀的, 回退到不带后缀的 (兼容旧地图)
        const fallbackName = `${ZONE_CONFIG.SPAWN_PREFIX}${zoneId}`;
        const fallbackEntity = Entities.FindByName(undefined, fallbackName);
        if (fallbackEntity) {
            const pos = fallbackEntity.GetAbsOrigin();
            if (suffix === 'b') {
                return Vector(pos.x + 100, pos.y + 100, pos.z) as Vector;
            }
            return pos;
        }

        // 默认坐标
        const offset = suffix === 'b' ? 100 : 0;
        return Vector(-3000 + (zoneId - 1) * 1000 + offset, 3000 + offset, 256) as Vector;
    }

    /**
     * 生成域守卫并设置 AI Think
     */
    private SpawnGuardian(zoneId: number, suffix: string): void {
        const unitName = `${ZONE_CONFIG.UNIT_PREFIX}${zoneId}`;
        const key = `zone_${zoneId}_${suffix}`;
        const pos = this.spawnPositions.get(key);

        if (!pos) return;

        const guardian = CreateUnitByName(unitName, pos, true, undefined, undefined, DotaTeam.NEUTRALS);

        if (guardian) {
            this.guardians.set(key, guardian);

            // 设置守卫 AI Think (与 WaveManager 小怪相同的 SetContextThink 模式)
            const spawnPos = pos;
            guardian.SetContextThink(
                'GuardianThink',
                () => {
                    if (!guardian || guardian.IsNull() || !guardian.IsAlive()) return -1;

                    const currentPos = guardian.GetAbsOrigin();
                    const dx = currentPos.x - spawnPos.x;
                    const dy = currentPos.y - spawnPos.y;
                    const distFromSpawn = math.sqrt(dx * dx + dy * dy);

                    const aggroTarget = guardian.GetAggroTarget();

                    // 1. 追击英雄超过最大距离 → 放弃，回归出生点
                    if (aggroTarget && aggroTarget.IsHero()) {
                        if (distFromSpawn > ZONE_CONFIG.MAX_CHASE_DISTANCE) {
                            guardian.Stop();
                            guardian.Purge(false, true, false, true, true);
                            ExecuteOrderFromTable({
                                UnitIndex: guardian.entindex(),
                                OrderType: UnitOrder.MOVE_TO_POSITION,
                                Position: spawnPos,
                                Queue: false,
                            });
                            return 1.0;
                        }
                        return 0.5; // 正在追英雄，检查频率稍高
                    }

                    // 2. 空闲且不在出生点 → 走回去
                    if (guardian.IsIdle() && distFromSpawn > 200) {
                        ExecuteOrderFromTable({
                            UnitIndex: guardian.entindex(),
                            OrderType: UnitOrder.MOVE_TO_POSITION,
                            Position: spawnPos,
                            Queue: false,
                        });
                        return 1.0;
                    }

                    return 1.0; // 普通情况每秒检查一次
                },
                1.0
            );
        }
    }

    /**
     * 处理实体死亡事件
     */
    private OnEntityKilled(event: EntityKilledEvent): void {
        const killedUnit = EntIndexToHScript(event.entindex_killed) as CDOTA_BaseNPC;
        if (!killedUnit) return;

        const unitName = killedUnit.GetUnitName();
        if (!unitName.startsWith(ZONE_CONFIG.UNIT_PREFIX)) return;

        const zoneIdStr = unitName.replace(ZONE_CONFIG.UNIT_PREFIX, '');
        const zoneId = parseInt(zoneIdStr);
        if (isNaN(zoneId) || zoneId < 1 || zoneId > ZONE_CONFIG.ZONE_COUNT) return;

        // 找到对应的 key
        let killedKey: string | undefined;
        for (const [key, unit] of this.guardians) {
            if (!unit.IsNull() && unit.entindex() === killedUnit.entindex()) {
                killedKey = key;
                break;
            }
        }
        if (!killedKey) return;

        const suffix = killedKey.split('_').pop() || 'a';

        // 获取击杀者，尝试解封神器
        const killerEntity = EntIndexToHScript(event.entindex_attacker) as CDOTA_BaseNPC;
        if (killerEntity && killerEntity.IsRealHero()) {
            const hero = killerEntity as CDOTA_BaseNPC_Hero;
            const playerId = hero.GetPlayerID();
            const unlockKey = `${playerId}_${zoneId}`;
            const slotIndex = ZONE_CONFIG.ZONE_TO_SLOT[zoneId];
            if (slotIndex !== undefined && !this.unlockedZones.has(unlockKey)) {
                const success = ArtifactSystem.GetInstance().UpgradeDormantArtifact(playerId, slotIndex, hero);
                if (success) {
                    this.unlockedZones.add(unlockKey);
                    CustomGameEventManager.Send_ServerToAllClients(
                        'show_overhead_alert' as any,
                        {
                            heroIndex: hero.entindex(),
                            message: '器灵觉醒!',
                        } as any
                    );
                }
            }
        }

        // 清除引用
        this.guardians.delete(killedKey);

        // 复活守卫 (使用 NextTick 延迟避免额外定时器)
        const respawnZoneId = zoneId;
        const respawnSuffix = suffix;
        let respawnCountdown = ZONE_CONFIG.RESPAWN_TIME;
        GameRules.GetGameModeEntity().SetContextThink(
            `GuardianRespawn_${killedKey}`,
            () => {
                respawnCountdown--;
                if (respawnCountdown <= 0) {
                    this.SpawnGuardian(respawnZoneId, respawnSuffix);
                    return -1; // 停止 think
                }
                return 1.0; // 每秒倒计时
            },
            1.0
        );
    }

    /**
     * 传送玩家到指定域
     */
    public TeleportPlayerToZone(playerId: PlayerID, zoneId: number): void {
        if (zoneId < 1 || zoneId > ZONE_CONFIG.ZONE_COUNT) return;

        const hero = PlayerResource.GetSelectedHeroEntity(playerId);
        if (!hero || hero.IsNull()) return;

        const teleportPos = this.teleportPositions.get(zoneId);
        if (!teleportPos) return;

        // 传送英雄
        hero.SetAbsOrigin(teleportPos);
        FindClearSpaceForUnit(hero, teleportPos, true);

        // 摄像机跟随 (使用 GameMode Think 代替 Timer)
        PlayerResource.SetCameraTarget(playerId, hero);
        GameRules.GetGameModeEntity().SetContextThink(
            `CameraRelease_${playerId}`,
            () => {
                PlayerResource.SetCameraTarget(playerId, undefined as any);
                return -1;
            },
            0.1
        );

        // 每次进入区域都发送区域通知
        const ZONE_NAMES: Record<number, string> = {
            1: '天枢界域',
            2: '极光界域',
            3: '红尘界域',
            4: '无极界域',
            5: '若水界域',
            6: '悬玉界域',
        };
        const zoneName = ZONE_NAMES[zoneId];
        if (zoneName) {
            const player = PlayerResource.GetPlayer(playerId);
            if (player) {
                CustomGameEventManager.Send_ServerToPlayer(
                    player,
                    'zone_enter_event' as never,
                    { zone_name: zoneName } as never
                );
            }
        }
    }

    /**
     * 获取域传送点位置
     */
    public GetTeleportPosition(zoneId: number): Vector | undefined {
        return this.teleportPositions.get(zoneId);
    }

    /**
     * 获取守卫是否存活 (任意一个存活即为 true)
     */
    public IsGuardianAlive(zoneId: number): boolean {
        for (const suffix of ZONE_CONFIG.SPAWN_SUFFIXES) {
            const key = `zone_${zoneId}_${suffix}`;
            const guardian = this.guardians.get(key);
            if (guardian && !guardian.IsNull() && guardian.IsAlive()) {
                return true;
            }
        }
        return false;
    }

    /**
     * 获取所有守卫状态
     */
    public GetAllGuardianStatus(): Record<number, boolean> {
        const status: Record<number, boolean> = {};
        for (let zone = 1; zone <= ZONE_CONFIG.ZONE_COUNT; zone++) {
            status[zone] = this.IsGuardianAlive(zone);
        }
        return status;
    }
}
