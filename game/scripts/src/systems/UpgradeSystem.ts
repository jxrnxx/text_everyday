/**
 * UpgradeSystem.ts
 * Handles stat upgrade logic and tier breakthrough for the Cultivation Shop
 * 
 * Rules:
 * - Max_Shop_Tier = Rank + 2
 * - Cannot breakthrough to a tier higher than allowed
 */

import { reloadable } from '../utils/tstl-utils';
import { CustomStats } from './CustomStats';

// Shop tier data structure (placeholder for actual shop implementation)
interface PlayerShopData {
    current_tier: number;
    slots_purchased: number;  // Out of 8 slots per tier
}

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
        // Listen for breakthrough requests
        CustomGameEventManager.RegisterListener('cmd_request_breakthrough', (_, event) => {
            const playerID = (event as any).PlayerID as PlayerID;
            const targetTier = (event as any).target_tier as number;
            this.AttemptBreakthrough(playerID, targetTier);
        });

        print('[UpgradeSystem] Initialized');
    }

    /**
     * Initialize shop data for a player
     */
    public InitPlayer(playerID: PlayerID) {
        if (!this.shopData[playerID]) {
            this.shopData[playerID] = {
                current_tier: 1,
                slots_purchased: 0,
            };
        }
    }

    /**
     * Get the maximum shop tier allowed for a given rank
     * Formula: Max_Shop_Tier = Rank + 2
     */
    public static GetMaxTierForRank(rank: number): number {
        return rank + 2;
    }

    /**
     * Get player's current shop data
     */
    public GetShopData(playerID: PlayerID): PlayerShopData {
        return this.shopData[playerID] || { current_tier: 1, slots_purchased: 0 };
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
        if (shopData.slots_purchased < 8) {
            return { allowed: false, reason: `需购买全部8个槽位 (${shopData.slots_purchased}/8)` };
        }

        return { allowed: true, reason: '' };
    }

    /**
     * Attempt to breakthrough to the next tier
     */
    private AttemptBreakthrough(playerID: PlayerID, targetTier: number) {
        const player = PlayerResource.GetPlayer(playerID);
        if (!player) {
            print(`[UpgradeSystem] Invalid player: ${playerID}`);
            return;
        }

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
        if (shopData.slots_purchased < 8) {
            this.SendResult(player, false, shopData.current_tier, `需购买全部8个槽位 (${shopData.slots_purchased}/8)`);
            return;
        }

        // === SUCCESS ===
        // 1. Increment tier and reset slots
        this.shopData[playerID] = {
            current_tier: targetTier,
            slots_purchased: 0,
        };

        // 2. Play sound
        EmitSoundOn('Hero_Invoker.LevelUp', hero);

        // 3. Log
        print(`[UpgradeSystem] Player ${playerID} broke through to Tier ${targetTier}`);

        this.SendResult(player, true, targetTier, `突破成功！当前境界 Tier ${targetTier}`);
    }

    /**
     * Purchase a slot in the current tier (placeholder for actual shop logic)
     */
    public PurchaseSlot(playerID: PlayerID): boolean {
        const shopData = this.GetShopData(playerID);
        
        if (shopData.slots_purchased >= 8) {
            return false;
        }

        this.shopData[playerID].slots_purchased++;
        return true;
    }

    private SendResult(player: CDOTAPlayerController, success: boolean, newTier: number, message: string) {
        CustomGameEventManager.Send_ServerToPlayer(player, 'breakthrough_result', {
            success,
            new_tier: newTier,
            message,
        });
    }
}
