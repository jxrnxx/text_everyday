/**
 * RankSystem.ts
 * Handles player rank progression ("境界突破")
 * 
 * Rules:
 * - MaxLevel = (Rank + 1) * 10
 * - Faith Cost = 100 * (Rank + 1)
 */

import { reloadable } from '../utils/tstl-utils';
import { CustomStats } from './CustomStats';
import { EconomySystem } from '../mechanics/EconomySystem';

// Rank name mapping for display/sound
const RANK_NAMES: { [key: number]: string } = {
    0: '凡胎',
    1: '觉醒',
    2: '宗师',
    3: '半神',
    4: '神话',
    5: '禁忌',
};

@reloadable
export class RankSystem {
    private static instance: RankSystem;

    public static GetInstance(): RankSystem {
        if (!this.instance) {
            this.instance = new RankSystem();
        }
        return this.instance;
    }

    public constructor() {
        this.Initialize();
    }

    private Initialize() {
        // Listen for rank up requests from client
        CustomGameEventManager.RegisterListener('cmd_attempt_rank_up', (_, event) => {
            const playerID = (event as any).PlayerID as PlayerID;
            this.AttemptRankUp(playerID);
        });

        print('[RankSystem] Initialized');
    }

    /**
     * Calculate the maximum level for a given rank
     * Formula: MaxLevel = (Rank + 1) * 10
     */
    public static GetMaxLevelForRank(rank: number): number {
        return (rank + 1) * 10;
    }

    /**
     * Calculate the faith cost for ranking up from current rank
     * Formula: Cost = 100 * (Rank + 1)
     */
    public static GetRankUpCost(currentRank: number): number {
        return 100 * (currentRank + 1);
    }

    /**
     * Check if a player is at their level cap
     */
    public static IsAtLevelCap(hero: CDOTA_BaseNPC_Hero): boolean {
        if (!hero || hero.IsNull()) return false;
        
        const currentLevel = hero.GetLevel();
        const rank = CustomStats.GetStat(hero, 'rank') || 0;
        const maxLevel = this.GetMaxLevelForRank(rank);
        
        return currentLevel >= maxLevel;
    }

    /**
     * Attempt to rank up a player
     */
    private AttemptRankUp(playerID: PlayerID) {
        const player = PlayerResource.GetPlayer(playerID);
        if (!player) {
            print(`[RankSystem] Invalid player: ${playerID}`);
            return;
        }

        const hero = player.GetAssignedHero();
        if (!hero) {
            this.SendResult(player, false, 0, '未找到英雄');
            return;
        }

        // Get current rank (0-indexed internally, displayed as 1-indexed names)
        const currentRank = CustomStats.GetStat(hero, 'rank') || 0;
        const currentLevel = hero.GetLevel();
        const maxLevel = RankSystem.GetMaxLevelForRank(currentRank);

        // Check 1: Must be at level cap
        if (currentLevel < maxLevel) {
            this.SendResult(player, false, currentRank, `必须达到${maxLevel}级才能突破`);
            return;
        }

        // Check 2: Faith cost
        const cost = RankSystem.GetRankUpCost(currentRank);
        const currentFaith = EconomySystem.GetInstance().GetFaith(playerID);

        if (currentFaith < cost) {
            this.SendResult(player, false, currentRank, `信仰不足 (需要${cost})`);
            return;
        }

        // Check 3: Max rank limit (optional safety)
        if (currentRank >= 5) {
            this.SendResult(player, false, currentRank, '已达最高境界');
            return;
        }

        // === SUCCESS ===
        // 1. Deduct Faith
        EconomySystem.GetInstance().AddFaith(playerID, -cost);

        // 2. Increment Rank
        const newRank = currentRank + 1;
        CustomStats.AddStat(hero, 'rank', 1);

        // 3. Play Sound
        EmitSoundOn('Hero_Juggernaut.OmniSlash.Arcana', hero);

        // 4. Visual Effect
        const particle = ParticleManager.CreateParticle(
            'particles/econ/items/juggernaut/jugg_arcana/juggernaut_arcana_v2_trigger.vpcf',
            ParticleAttachment.ABSORIGIN_FOLLOW,
            hero
        );
        ParticleManager.ReleaseParticleIndex(particle);

        // 5. Log and notify
        const rankName = RANK_NAMES[newRank] || `境界${newRank}`;
        print(`[RankSystem] Player ${playerID} ranked up to ${rankName} (Rank ${newRank})`);
        
        this.SendResult(player, true, newRank, `突破成功！晋升${rankName}`);

        // 6. Notify all clients for UI updates (NetTable already updated by CustomStats)
        CustomStats.SendStatsToClient(hero);
    }

    private SendResult(player: CDOTAPlayerController, success: boolean, newRank: number, message: string) {
        CustomGameEventManager.Send_ServerToPlayer(player, 'rank_up_result', {
            success,
            new_rank: newRank,
            message,
        });
    }
}
