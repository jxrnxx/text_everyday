/**
 * ZoneManager.ts
 * 域守卫管理系统 - 管理6个域的封印守卫的生成与复活
 *
 * 机制:
 * - 每个域有一个守卫，在地图上的 spawn_guardian_zone_{i} 点生成
 * - 守卫为中立阵营，原地不动，仅攻击靠近的敌人
 * - 击杀守卫后触发对应槽位的神器解封 (Tier 0 -> Tier 1)
 * - 守卫死亡后 30 秒自动复活
 */

import { ArtifactSystem } from './ArtifactSystem';

const ZONE_CONFIG = {
    /** 域的总数 */
    ZONE_COUNT: 6,

    /** 守卫复活时间 (秒) */
    RESPAWN_TIME: 30,

    /** 守卫单位名前缀 */
    UNIT_PREFIX: 'npc_guardian_zone_',

    /** 地图出生点名前缀 */
    SPAWN_PREFIX: 'spawn_guardian_zone_',

    /** 备用坐标 (如果地图上找不到出生点) */
    FALLBACK_POSITIONS: [
        { x: -3000, y: 3000, z: 256 }, // Zone 1 - 武器
        { x: -2000, y: 3000, z: 256 }, // Zone 2 - 护甲
        { x: -1000, y: 3000, z: 256 }, // Zone 3 - 头盔
        { x: 0, y: 3000, z: 256 }, // Zone 4 - 饰品
        { x: 1000, y: 3000, z: 256 }, // Zone 5 - 鞋子
        { x: 2000, y: 3000, z: 256 }, // Zone 6 - 护符
    ],

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

    /** 每个域的守卫实体引用 */
    private guardians: Map<number, CDOTA_BaseNPC> = new Map();

    /** 每个域的出生点位置缓存 */
    private spawnPositions: Map<number, Vector> = new Map();

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
        print('[ZoneManager] 初始化域守卫系统...');

        // 缓存出生点位置
        for (let zone = 1; zone <= ZONE_CONFIG.ZONE_COUNT; zone++) {
            const pos = this.FindSpawnPosition(zone);
            this.spawnPositions.set(zone, pos);
            print(`[ZoneManager] Zone ${zone} 出生点: (${pos.x}, ${pos.y}, ${pos.z})`);
        }

        // 生成所有守卫
        for (let zone = 1; zone <= ZONE_CONFIG.ZONE_COUNT; zone++) {
            this.SpawnGuardian(zone);
        }

        // 监听 entity_killed 事件
        ListenToGameEvent('entity_killed', event => this.OnEntityKilled(event), undefined);

        print('[ZoneManager] 域守卫系统初始化完成');
    }

    /**
     * 查找域出生点位置
     */
    private FindSpawnPosition(zoneId: number): Vector {
        // 尝试查找地图实体
        const spawnName = `${ZONE_CONFIG.SPAWN_PREFIX}${zoneId}`;
        const spawnEntity = Entities.FindByName(undefined, spawnName);

        if (spawnEntity) {
            return spawnEntity.GetAbsOrigin();
        }

        // 备用坐标
        const fallback = ZONE_CONFIG.FALLBACK_POSITIONS[zoneId - 1];
        print(`[ZoneManager] 未找到 ${spawnName}，使用备用坐标`);
        return Vector(fallback.x, fallback.y, fallback.z) as Vector;
    }

    /**
     * 生成域守卫
     */
    private SpawnGuardian(zoneId: number): void {
        const unitName = `${ZONE_CONFIG.UNIT_PREFIX}${zoneId}`;
        const pos = this.spawnPositions.get(zoneId);

        if (!pos) {
            print(`[ZoneManager] Zone ${zoneId} 没有出生点`);
            return;
        }

        const guardian = CreateUnitByName(unitName, pos, true, undefined, undefined, DotaTeam.NEUTRALS);

        if (guardian) {
            this.guardians.set(zoneId, guardian);

            // 原地不动 - 不下达移动命令
            // 设置仇恨范围
            guardian.SetAcquisitionRange(300);

            print(`[ZoneManager] Zone ${zoneId} 守卫已生成: ${unitName}`);
        } else {
            print(`[ZoneManager] Zone ${zoneId} 守卫生成失败!`);
        }
    }

    /**
     * 处理实体死亡事件
     */
    private OnEntityKilled(event: EntityKilledEvent): void {
        const killedUnit = EntIndexToHScript(event.entindex_killed) as CDOTA_BaseNPC;
        if (!killedUnit) return;

        const unitName = killedUnit.GetUnitName();

        // 检查是否是域守卫
        if (!unitName.startsWith(ZONE_CONFIG.UNIT_PREFIX)) return;

        // 提取 Zone ID
        const zoneIdStr = unitName.replace(ZONE_CONFIG.UNIT_PREFIX, '');
        const zoneId = parseInt(zoneIdStr);

        if (isNaN(zoneId) || zoneId < 1 || zoneId > ZONE_CONFIG.ZONE_COUNT) return;

        print(`[ZoneManager] Zone ${zoneId} 守卫被击杀!`);

        // 获取击杀者
        const killerEntity = EntIndexToHScript(event.entindex_attacker) as CDOTA_BaseNPC;
        if (killerEntity && killerEntity.IsRealHero()) {
            const hero = killerEntity as CDOTA_BaseNPC_Hero;
            const playerId = hero.GetPlayerID();

            // 尝试解封对应槽位的神器
            const slotIndex = ZONE_CONFIG.ZONE_TO_SLOT[zoneId];
            if (slotIndex !== undefined) {
                const success = ArtifactSystem.GetInstance().UpgradeDormantArtifact(playerId, slotIndex);
                if (success) {
                    // 发送头顶消息
                    CustomGameEventManager.Send_ServerToAllClients(
                        'show_overhead_alert' as any,
                        {
                            heroIndex: hero.entindex(),
                            message: '器灵觉醒!',
                        } as any
                    );
                    print(`[ZoneManager] 玩家 ${playerId} 解封了 Zone ${zoneId} 的神器!`);
                }
            }
        }

        // 清除引用
        this.guardians.delete(zoneId);

        // 设置复活定时器
        Timers.CreateTimer(ZONE_CONFIG.RESPAWN_TIME, () => {
            print(`[ZoneManager] Zone ${zoneId} 守卫复活中...`);
            this.SpawnGuardian(zoneId);
            return undefined;
        });
    }

    /**
     * 获取守卫是否存活
     */
    public IsGuardianAlive(zoneId: number): boolean {
        const guardian = this.guardians.get(zoneId);
        return guardian !== undefined && !guardian.IsNull() && guardian.IsAlive();
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
