/**
 * UpgradeSystem.ts
 * Handles stat upgrade logic and tier breakthrough for the Cultivation Shop
 *
 * Rules:
 * - Max_Shop_Tier = Rank + 2
 * - Cannot breakthrough to a tier higher than allowed
 *
 * Tier Progression:
 * - Tier 1 (入门期): Basic stats, cost 200
 * - Tier 2 (觉醒期): Explosive stats for Wave 5+ difficulty, cost 800
 * - Tier 3 (凝丹期): Advanced stats, cost 2000
 */

import { reloadable } from '../utils/tstl-utils';
import { CustomStats } from './CustomStats';

// Slot configuration for each tier
export interface TierSlotConfig {
    stat_type: string; // constitution, martial, etc.
    name: string; // 中文名称
    value: number; // 数值
    is_percent?: boolean; // 是否百分比
}

// Tier configuration structure
export interface TierConfig {
    tier: number;
    name: string; // Tier 名称
    cost_per_slot: number; // 每个槽位费用
    slots: TierSlotConfig[];
}

// ========================
// UPGRADE TIER CONFIGURATION
// 8个境界：入门境、觉醒境、宗师境、破绽境、超凡境、入圣境、神座境、禁忌境
// 价格：200、800、2500、6500、18000、50000、150000、500000
// ========================
export const UPGRADE_TIER_CONFIG: TierConfig[] = [
    // Tier 1: 入门境
    {
        tier: 1,
        name: '入门境',
        cost_per_slot: 200,
        slots: [
            { stat_type: 'constitution', name: '根骨', value: 5 },
            { stat_type: 'martial', name: '武道', value: 5 },
            { stat_type: 'divinity', name: '神念', value: 5 },
            { stat_type: 'armor', name: '戒守', value: 2 },
            { stat_type: 'mana_regen', name: '回能', value: 2 },
            { stat_type: 'attack_speed', name: '极速', value: 15 },
            { stat_type: 'life_on_hit', name: '饮血', value: 10 },
            { stat_type: 'base_damage', name: '破军', value: 15 },
        ],
    },
    // Tier 2: 觉醒境
    {
        tier: 2,
        name: '觉醒境',
        cost_per_slot: 800,
        slots: [
            { stat_type: 'constitution', name: '根骨', value: 40 },
            { stat_type: 'martial', name: '武道', value: 40 },
            { stat_type: 'divinity', name: '神念', value: 40 },
            { stat_type: 'armor', name: '戒守', value: 8 },
            { stat_type: 'mana_regen', name: '回能', value: 5 },
            { stat_type: 'attack_speed', name: '极速', value: 50 },
            { stat_type: 'lifesteal_pct', name: '饮血', value: 5, is_percent: true },
            { stat_type: 'base_damage', name: '破军', value: 80 },
        ],
    },
    // Tier 3: 宗师境
    {
        tier: 3,
        name: '宗师境',
        cost_per_slot: 2500,
        slots: [
            { stat_type: 'constitution', name: '根骨', value: 100 },
            { stat_type: 'martial', name: '武道', value: 100 },
            { stat_type: 'divinity', name: '神念', value: 100 },
            { stat_type: 'armor', name: '戒守', value: 15 },
            { stat_type: 'mana_regen', name: '回能', value: 10 },
            { stat_type: 'attack_speed', name: '极速', value: 80 },
            { stat_type: 'lifesteal_pct', name: '饮血', value: 10, is_percent: true },
            { stat_type: 'base_damage', name: '破军', value: 150 },
        ],
    },
    // Tier 4: 破绽境 (待设计具体技能)
    {
        tier: 4,
        name: '破绽境',
        cost_per_slot: 6500,
        slots: [
            { stat_type: 'constitution', name: '根骨', value: 200 },
            { stat_type: 'martial', name: '武道', value: 200 },
            { stat_type: 'divinity', name: '神念', value: 200 },
            { stat_type: 'armor', name: '戒守', value: 25 },
            { stat_type: 'mana_regen', name: '回能', value: 20 },
            { stat_type: 'attack_speed', name: '极速', value: 120 },
            { stat_type: 'lifesteal_pct', name: '饮血', value: 15, is_percent: true },
            { stat_type: 'base_damage', name: '破军', value: 300 },
        ],
    },
    // Tier 5: 超凡境 (待设计具体技能)
    {
        tier: 5,
        name: '超凡境',
        cost_per_slot: 18000,
        slots: [
            { stat_type: 'constitution', name: '根骨', value: 400 },
            { stat_type: 'martial', name: '武道', value: 400 },
            { stat_type: 'divinity', name: '神念', value: 400 },
            { stat_type: 'armor', name: '戒守', value: 40 },
            { stat_type: 'mana_regen', name: '回能', value: 35 },
            { stat_type: 'attack_speed', name: '极速', value: 180 },
            { stat_type: 'lifesteal_pct', name: '饮血', value: 20, is_percent: true },
            { stat_type: 'base_damage', name: '破军', value: 600 },
        ],
    },
    // Tier 6: 入圣境 (待设计具体技能)
    {
        tier: 6,
        name: '入圣境',
        cost_per_slot: 50000,
        slots: [
            { stat_type: 'constitution', name: '根骨', value: 800 },
            { stat_type: 'martial', name: '武道', value: 800 },
            { stat_type: 'divinity', name: '神念', value: 800 },
            { stat_type: 'armor', name: '戒守', value: 60 },
            { stat_type: 'mana_regen', name: '回能', value: 50 },
            { stat_type: 'attack_speed', name: '极速', value: 250 },
            { stat_type: 'lifesteal_pct', name: '饮血', value: 25, is_percent: true },
            { stat_type: 'base_damage', name: '破军', value: 1000 },
        ],
    },
    // Tier 7: 神座境 (待设计具体技能)
    {
        tier: 7,
        name: '神座境',
        cost_per_slot: 150000,
        slots: [
            { stat_type: 'constitution', name: '根骨', value: 1500 },
            { stat_type: 'martial', name: '武道', value: 1500 },
            { stat_type: 'divinity', name: '神念', value: 1500 },
            { stat_type: 'armor', name: '戒守', value: 100 },
            { stat_type: 'mana_regen', name: '回能', value: 80 },
            { stat_type: 'attack_speed', name: '极速', value: 350 },
            { stat_type: 'lifesteal_pct', name: '饮血', value: 30, is_percent: true },
            { stat_type: 'base_damage', name: '破军', value: 1800 },
        ],
    },
    // Tier 8: 禁忌境 (待设计具体技能)
    {
        tier: 8,
        name: '禁忌境',
        cost_per_slot: 500000,
        slots: [
            { stat_type: 'constitution', name: '根骨', value: 3000 },
            { stat_type: 'martial', name: '武道', value: 3000 },
            { stat_type: 'divinity', name: '神念', value: 3000 },
            { stat_type: 'armor', name: '戒守', value: 150 },
            { stat_type: 'mana_regen', name: '回能', value: 120 },
            { stat_type: 'attack_speed', name: '极速', value: 500 },
            { stat_type: 'lifesteal_pct', name: '饮血', value: 40, is_percent: true },
            { stat_type: 'base_damage', name: '破军', value: 3000 },
        ],
    },
];

// Shop tier data structure
interface PlayerShopData {
    current_tier: number;
    slots_purchased: boolean[]; // Array of 8 booleans for each slot
}

// Default empty slots array
const DEFAULT_SLOTS = (): boolean[] => [false, false, false, false, false, false, false, false];

@reloadable
export class UpgradeSystem {
    private static instance: UpgradeSystem;

    // In-memory cache of player shop progress
    private shopData: { [playerID: number]: PlayerShopData } = {};

    public static GetInstance(): UpgradeSystem {
        if (!this.instance) {
            this.instance = new UpgradeSystem();
        }
        return this.instance;
    }

    public constructor() {
        this.Initialize();
    }

    private Initialize() {
        // Listen for breakthrough requests (manual breakthrough button)
        CustomGameEventManager.RegisterListener('cmd_request_breakthrough', (_, event) => {
            const playerID = (event as any).PlayerID as PlayerID;
            const targetTier = (event as any).target_tier as number;
            this.AttemptBreakthrough(playerID, targetTier);
        });

        // Note: cmd_merchant_purchase is handled in CustomStats.ts, which calls MarkSlotPurchased()
    }

    /**
     * Initialize shop data for a player
     */
    public InitPlayer(playerID: PlayerID) {
        if (!this.shopData[playerID]) {
            this.shopData[playerID] = {
                current_tier: 1,
                slots_purchased: DEFAULT_SLOTS(),
            };
            // Sync to client
            this.SyncShopDataToClient(playerID);
        }
    }

    /**
     * Get the maximum shop tier allowed for a given rank
     * Formula: Max_Shop_Tier = Rank + 3
     */
    public static GetMaxTierForRank(rank: number): number {
        return rank + 3;
    }

    /**
     * Get tier configuration by tier number
     */
    public static GetTierConfig(tier: number): TierConfig | undefined {
        // 使用 for 循环而非 .find() 以兼容 Lua
        for (let i = 0; i < UPGRADE_TIER_CONFIG.length; i++) {
            if (UPGRADE_TIER_CONFIG[i].tier === tier) {
                return UPGRADE_TIER_CONFIG[i];
            }
        }
        return undefined;
    }

    /**
     * Get player's current shop data
     */
    public GetShopData(playerID: PlayerID): PlayerShopData {
        if (!this.shopData[playerID]) {
            this.InitPlayer(playerID);
        }
        return this.shopData[playerID];
    }

    /**
     * Get the count of purchased slots
     */
    private GetPurchasedCount(slots: boolean[]): number {
        // 使用 for 循环而非 .filter() 以兼容 Lua
        let count = 0;
        for (let i = 0; i < slots.length; i++) {
            if (slots[i]) count++;
        }
        return count;
    }

    /**
     * Check if all slots are purchased
     */
    private AllSlotsPurchased(slots: boolean[]): boolean {
        // 使用 for 循环而非 .every() 以兼容 Lua
        for (let i = 0; i < slots.length; i++) {
            if (!slots[i]) return false;
        }
        return true;
    }
    /**
     * Mark a slot as purchased and check for auto-breakthrough
     */
    public MarkSlotPurchased(playerID: PlayerID, slotIndex: number) {
        const shopData = this.GetShopData(playerID);

        if (slotIndex < 0 || slotIndex >= 8) return;

        shopData.slots_purchased[slotIndex] = true;

        // Check if all 8 slots are purchased - trigger auto breakthrough
        if (this.AllSlotsPurchased(shopData.slots_purchased)) {
            this.TriggerBreakthrough(playerID);
        }

        // Sync to client
        this.SyncShopDataToClient(playerID);
    }

    /**
     * Called after player ranks up to check if they can now breakthrough
     * If all 8 slots were purchased but couldn't breakthrough before due to tier cap,
     * this will trigger the breakthrough now.
     */
    public CheckBreakthroughAfterRankUp(playerID: PlayerID) {
        const shopData = this.GetShopData(playerID);

        // If all 8 slots are purchased, try to breakthrough
        if (this.AllSlotsPurchased(shopData.slots_purchased)) {
            this.TriggerBreakthrough(playerID);
        }
    }

    /**
     * Check if player can breakthrough to the next tier
     */
    public CanBreakthrough(playerID: PlayerID): { allowed: boolean; reason: string } {
        const hero = PlayerResource.GetSelectedHeroEntity(playerID);
        if (!hero) {
            return { allowed: false, reason: '未找到英雄' };
        }

        const shopData = this.GetShopData(playerID);
        const currentRank = CustomStats.GetStat(hero, 'rank') || 0;
        const maxTier = UpgradeSystem.GetMaxTierForRank(currentRank);
        const nextTier = shopData.current_tier + 1;

        // Check 1: Tier cap based on rank
        if (nextTier > maxTier) {
            return { allowed: false, reason: '需提升阶位' };
        }

        // Check 2: Must purchase all 8 slots in current tier
        const purchasedCount = this.GetPurchasedCount(shopData.slots_purchased);
        if (purchasedCount < 8) {
            return { allowed: false, reason: `需购买全部8个槽位 (${purchasedCount}/8)` };
        }

        return { allowed: true, reason: '' };
    }

    /**
     * Trigger breakthrough when all slots are purchased (auto-breakthrough)
     */
    private TriggerBreakthrough(playerID: PlayerID) {
        const player = PlayerResource.GetPlayer(playerID);
        if (!player) return;

        const hero = player.GetAssignedHero();
        if (!hero) return;

        const shopData = this.GetShopData(playerID);
        const currentRank = CustomStats.GetStat(hero, 'rank') || 0;
        const maxTier = UpgradeSystem.GetMaxTierForRank(currentRank);
        const nextTier = shopData.current_tier + 1;

        // Check if can progress to next tier
        if (nextTier > maxTier) {
            // Can't breakthrough - at tier cap, show special message
            const capMessage = '你的灵魂太轻，承载不了这份重量。去历练吧。';

            // Send refresh event with cap message (for toast display)
            CustomGameEventManager.Send_ServerToPlayer(player, 'refresh_merchant_ui', {
                new_tier: shopData.current_tier,
                tier_name: '',
                message: capMessage,
                at_tier_cap: true,
            });

            // Also send result
            CustomGameEventManager.Send_ServerToPlayer(player, 'breakthrough_result', {
                success: false,
                new_tier: shopData.current_tier,
                message: capMessage,
            });
            return;
        }

        // === SUCCESS: BREAKTHROUGH! ===
        this.PerformBreakthrough(playerID, player, hero, nextTier);
    }

    /**
     * Attempt to breakthrough to the next tier (manual button)
     */
    private AttemptBreakthrough(playerID: PlayerID, targetTier: number) {
        const player = PlayerResource.GetPlayer(playerID);
        if (!player) return;

        const hero = player.GetAssignedHero();
        if (!hero) {
            this.SendResult(player, false, 0, '未找到英雄');
            return;
        }

        const shopData = this.GetShopData(playerID);
        const currentRank = CustomStats.GetStat(hero, 'rank') || 0;
        const maxTier = UpgradeSystem.GetMaxTierForRank(currentRank);

        // Validate target tier
        if (targetTier !== shopData.current_tier + 1) {
            this.SendResult(player, false, shopData.current_tier, '无效的突破目标');
            return;
        }

        // Check tier cap
        if (targetTier > maxTier) {
            this.SendResult(player, false, shopData.current_tier, '需提升阶位');
            return;
        }

        // Check slots purchased
        const purchasedCount = this.GetPurchasedCount(shopData.slots_purchased);
        if (purchasedCount < 8) {
            this.SendResult(player, false, shopData.current_tier, `需购买全部8个槽位 (${purchasedCount}/8)`);
            return;
        }

        // === SUCCESS ===
        this.PerformBreakthrough(playerID, player, hero, targetTier);
    }

    /**
     * Perform the actual breakthrough with visual/audio feedback
     */
    private PerformBreakthrough(
        playerID: PlayerID,
        player: CDOTAPlayerController,
        hero: CDOTA_BaseNPC_Hero,
        newTier: number
    ) {
        const currentTierConfig = UpgradeSystem.GetTierConfig(this.shopData[playerID].current_tier);
        const newTierConfig = UpgradeSystem.GetTierConfig(newTier);

        // 1. Increment tier and reset slots
        this.shopData[playerID] = {
            current_tier: newTier,
            slots_purchased: DEFAULT_SLOTS(),
        };

        // 2. Play breakthrough sound (Thunder!)
        EmitSoundOn('Hero_Zeus.GodsWrath.Target', hero);

        // 3. Create breakthrough particle effect
        const particleId = ParticleManager.CreateParticle(
            'particles/econ/items/effigies/status_fx_effigies/gold_effigy_ambient_radiant.vpcf',
            ParticleAttachment.ABSORIGIN_FOLLOW,
            hero
        );
        ParticleManager.SetParticleControl(particleId, 0, hero.GetAbsOrigin());

        // Cleanup particle after 3 seconds
        Timers.CreateTimer(3.0, () => {
            ParticleManager.DestroyParticle(particleId, false);
            ParticleManager.ReleaseParticleIndex(particleId);
        });

        // 4. Screen shake for dramatic effect
        ScreenShake(hero.GetAbsOrigin(), 5, 100, 0.5, 2000, 0, true);

        // 5. Sync to client and notify
        this.SyncShopDataToClient(playerID);

        // 6. Send event to client to refresh UI
        CustomGameEventManager.Send_ServerToPlayer(player, 'refresh_merchant_ui', {
            new_tier: newTier,
            tier_name: newTierConfig?.name || '',
            message: `突破成功！进入${newTierConfig?.name || `Tier ${newTier}`}！`,
            at_tier_cap: false,
        });

        // 8. Send success result
        this.SendResult(player, true, newTier, `突破成功！进入${newTierConfig?.name || `Tier ${newTier}`}！`);
    }

    /**
     * Purchase a specific slot in the current tier
     */
    public PurchaseSlot(playerID: PlayerID, slotIndex: number): boolean {
        const shopData = this.GetShopData(playerID);

        if (slotIndex < 0 || slotIndex >= 8) return false;
        if (shopData.slots_purchased[slotIndex]) return false;

        shopData.slots_purchased[slotIndex] = true;

        // Check for auto-breakthrough
        if (this.AllSlotsPurchased(shopData.slots_purchased)) {
            this.TriggerBreakthrough(playerID);
        }

        this.SyncShopDataToClient(playerID);
        return true;
    }

    /**
     * Sync shop data to client via NetTable
     */
    private SyncShopDataToClient(playerID: PlayerID) {
        const shopData = this.GetShopData(playerID);
        const tierConfig = UpgradeSystem.GetTierConfig(shopData.current_tier);

        // 将 slots 数组转换为 Lua 风格的 1-indexed 对象
        // 注意：NetTable 不支持 boolean，需要使用 1/0
        const slotsObject: { [key: number]: number } = {};
        for (let i = 0; i < shopData.slots_purchased.length; i++) {
            slotsObject[i + 1] = shopData.slots_purchased[i] ? 1 : 0; // true -> 1, false -> 0
        }

        // 将 slots_config 转换为 Lua 风格的 1-indexed 对象
        // 注意：NetTable 不支持 boolean，需要将 is_percent 转换为 1/0
        const slotsConfigObject: { [key: number]: any } = {};
        if (tierConfig?.slots) {
            for (let i = 0; i < tierConfig.slots.length; i++) {
                const slot = tierConfig.slots[i];
                slotsConfigObject[i + 1] = {
                    stat_type: slot.stat_type,
                    name: slot.name,
                    value: slot.value,
                    is_percent: slot.is_percent ? 1 : 0, // boolean -> 1/0
                };
            }
        }

        const netTableData = {
            current_tier: shopData.current_tier,
            tier_name: tierConfig?.name || '',
            cost_per_slot: tierConfig?.cost_per_slot || 200,
            slots_purchased: slotsObject,
            slots_config: slotsConfigObject,
        };

        // 写入 NetTable
        CustomNetTables.SetTableValue('upgrade_system' as any, `player_${playerID}`, netTableData as any);
    }

    /**
     * Send result to player
     */
    private SendResult(player: CDOTAPlayerController, success: boolean, newTier: number, message: string) {
        CustomGameEventManager.Send_ServerToPlayer(player, 'breakthrough_result', {
            success,
            new_tier: newTier,
            message,
        });
    }
}
