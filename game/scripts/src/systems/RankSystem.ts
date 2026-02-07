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
import { UpgradeSystem } from './UpgradeSystem';

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

        // 测试用：快速升阶（绕过信仰和等级检查）
        CustomGameEventManager.RegisterListener('cmd_test_rank_up', (_, event) => {
            const playerID = (event as any).PlayerID as PlayerID;
            this.TestRankUp(playerID);
        });
    }

    /**
     * Calculate the maximum level for a given rank
     * Formula: MaxLevel = (Rank + 1) * 10, 但最高50级
     * rank=0: 10, rank=1: 20, rank=2: 30, rank=3: 40, rank=4: 50, rank=5: 50
     */
    public static GetMaxLevelForRank(rank: number): number {
        const calculatedMax = (rank + 1) * 10;
        return Math.min(calculatedMax, 50); // 最高50级
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

        // Check 3: Max rank limit (禁忌rank=5 是最高阶位)
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

        this.SendResult(player, true, newRank, `突破成功！晋升${rankName}`);

        // 6. Notify all clients for UI updates (NetTable already updated by CustomStats)
        CustomStats.SendStatsToClient(hero);

        // 7. Check if can now breakthrough in shop (after rank up, tier cap increases)
        const upgradeSystem = UpgradeSystem.GetInstance();
        upgradeSystem.CheckBreakthroughAfterRankUp(playerID);
    }

    /**
     * 测试用快速升阶 - 绕过所有检查
     */
    private TestRankUp(playerID: PlayerID) {
        const player = PlayerResource.GetPlayer(playerID);
        if (!player) return;

        const hero = player.GetAssignedHero();
        if (!hero) return;

        const currentRank = CustomStats.GetStat(hero, 'rank') || 0;

        // rank=5 是禁忌，最高阶位
        if (currentRank >= 5) {
            this.SendResult(player, false, currentRank, '已达最高境界');
            return;
        }

        // 记录升阶前的阶位最大等级
        const prevMaxLevel = RankSystem.GetMaxLevelForRank(currentRank);

        // 直接升阶
        const newRank = currentRank + 1;
        CustomStats.AddStat(hero, 'rank', 1);

        // 根据新阶位处理显示等级和经验
        if (newRank === 5) {
            // 禁忌阶位：保持50级，经验条直接满
            CustomStats.SetDisplayLevel(hero, 50);
            CustomStats.SetCustomExpFull(hero);
        } else {
            // 其他阶位：等级保持在上一阶位最大等级，经验重置为0
            CustomStats.SetDisplayLevel(hero, prevMaxLevel);
            CustomStats.ResetCustomExp(hero);
        }

        // 播放特效
        EmitSoundOn('Hero_Juggernaut.OmniSlash.Arcana', hero);
        const particle = ParticleManager.CreateParticle(
            'particles/econ/items/juggernaut/jugg_arcana/juggernaut_arcana_v2_trigger.vpcf',
            ParticleAttachment.ABSORIGIN_FOLLOW,
            hero
        );
        ParticleManager.ReleaseParticleIndex(particle);

        const RANK_NAMES: { [key: number]: string } = {
            0: '凡胎',
            1: '觉醒',
            2: '宗师',
            3: '半神',
            4: '神话',
            5: '禁忌',
        };
        const rankName = RANK_NAMES[newRank] || `境界${newRank}`;

        this.SendResult(player, true, newRank, `晋升${rankName}`);
        CustomStats.SendStatsToClient(hero);

        // Check if can now breakthrough in shop
        const upgradeSystem = UpgradeSystem.GetInstance();
        upgradeSystem.CheckBreakthroughAfterRankUp(playerID);
    }

    private SendResult(player: CDOTAPlayerController, success: boolean, newRank: number, message: string) {
        CustomGameEventManager.Send_ServerToPlayer(player, 'rank_up_result', {
            success,
            new_rank: newRank,
            message,
        });
    }
}
