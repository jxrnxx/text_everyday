import { reloadable } from '../utils/tstl-utils';

/**
 * AbilityShopManager - 技能商人管理系统
 *
 * 在主基地生成技能商人，根据玩家数量在 ability_shop_1 到 ability_shop_4 位置生成
 * 玩家点击商人打开技能商店面板
 */
@reloadable
export class AbilityShopManager {
    private static instance: AbilityShopManager;

    private readonly MERCHANT_UNIT_NAME = 'npc_ability_merchant'; // 技能商人专用模型
    private merchantEntities: Map<number, EntityIndex> = new Map(); // 商人实体索引
    private initialized: boolean = false;

    public static GetInstance(): AbilityShopManager {
        if (!this.instance) {
            this.instance = new AbilityShopManager();
        }
        return this.instance;
    }

    /**
     * 初始化技能商人系统
     * 在游戏开始时调用，根据玩家数量生成对应数量的商人
     */
    public Initialize(): void {
        if (this.initialized) return;
        this.initialized = true;

        // 延迟执行，确保玩家已经连接
        Timers.CreateTimer(1.0, () => {
            this.SpawnAbilityShops();
        });
    }

    /**
     * 根据玩家数量生成技能商人
     */
    private SpawnAbilityShops(): void {
        // 获取当前连接的玩家数量
        let playerCount = 0;
        for (let i = 0; i < 4; i++) {
            if (PlayerResource.IsValidPlayerID(i as PlayerID)) {
                const player = PlayerResource.GetPlayer(i as PlayerID);
                if (player) {
                    playerCount++;
                }
            }
        }

        // 至少生成1个商人
        playerCount = Math.max(1, playerCount);

        // 在每个位置生成商人
        for (let i = 0; i < playerCount; i++) {
            this.SpawnSingleMerchant(i);
        }
    }

    /**
     * 在指定位置生成单个技能商人
     */
    private SpawnSingleMerchant(index: number): void {
        // 检查是否已存在
        const existingIndex = this.merchantEntities.get(index);
        if (existingIndex !== undefined) {
            const existing = EntIndexToHScript(existingIndex) as CDOTA_BaseNPC;
            if (existing && !existing.IsNull() && existing.IsAlive()) {
                return;
            }
        }

        // 查找生成点: ability_shop_1, ability_shop_2, etc.
        const spawnPointName = `ability_shop_${index + 1}`;
        const spawnPoint = Entities.FindByName(undefined, spawnPointName);

        if (!spawnPoint) {
            return;
        }

        // 生成商人
        const spawnPos = spawnPoint.GetAbsOrigin();
        const merchant = CreateUnitByName(
            this.MERCHANT_UNIT_NAME,
            spawnPos,
            true,
            undefined,
            undefined,
            DotaTeam.GOODGUYS
        );

        if (merchant) {
            // 设置实体名称用于交互识别: ability_shop_1, ability_shop_2, etc.
            merchant.SetEntityName(`ability_shop_${index + 1}`);

            // 让商人面向相反方向（转头180度）
            const centerPoint = Entities.FindByName(undefined, 'start_player_1');
            if (centerPoint) {
                const centerPos = centerPoint.GetAbsOrigin();
                const direction = ((centerPos - spawnPos) as Vector).Normalized();
                // 反转方向，旋转180度
                merchant.SetForwardVector(Vector(-direction.x, -direction.y, direction.z));
            }

            // 持续播放空闲动画
            merchant.SetContextThink(
                'AbilityMerchantIdleAnim',
                () => {
                    if (merchant && !merchant.IsNull() && merchant.IsAlive()) {
                        merchant.StartGesture(GameActivity.DOTA_IDLE);
                        return 3.0;
                    }
                    return undefined;
                },
                0
            );

            // 保存引用
            this.merchantEntities.set(index, merchant.entindex());
        }
    }

    /**
     * 检查实体是否是技能商人
     */
    public IsAbilityShopMerchant(entity: CDOTA_BaseNPC): boolean {
        const name = entity.GetName();
        return name.startsWith('ability_shop_');
    }

    /**
     * 获取商人编号（用于确定玩家归属）
     */
    public GetMerchantIndex(entity: CDOTA_BaseNPC): number {
        const name = entity.GetName();
        if (name.startsWith('ability_shop_')) {
            return parseInt(name.replace('ability_shop_', '')) - 1;
        }
        return -1;
    }
}
