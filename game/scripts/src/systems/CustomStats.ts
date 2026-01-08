import { reloadable } from '../utils/tstl-utils';
import * as json_heroes from '../json/npc_heroes_custom.json';

// Custom Game Event Declarations moved to shared/gameevents.d.ts

// 定义自定义属性接口
interface HeroStats {
    constitution: number;
    martial: number;
    divinity: number;
    // New Stats
    rank: number;
    crit_chance: number;
    crit_damage: number;
    main_stat: string;
    profession?: string;
}

const DEFAULT_STATS: HeroStats = {
    constitution: 5,
    martial: 5,
    divinity: 5,
    rank: 1,
    crit_chance: 0,
    crit_damage: 150,
    main_stat: 'Martial'
};

@reloadable
export class CustomStats {
    // Server-side memory cache to guarantee immediate data access
    private static cache: { [key: string]: HeroStats } = {};

    /**
     * 初始化英雄的自定义属性
     */
    public static InitializeHeroStats(hero: CDOTA_BaseNPC_Hero) {
        if (!hero || hero.IsNull()) return;

        // 检查是否已经有数据 (Check Cache first)
        const unitIndex = tostring(hero.GetEntityIndex());
        if (this.cache[unitIndex]) return;

        // ... (Keep existing JSON lookup logic) ...
        const unitName = hero.GetUnitName();
        // @ts-ignore
        const jsonImport = json_heroes;
        // @ts-ignore
        const root = jsonImport.DOTAHeroes || jsonImport.XLSXContent || (jsonImport.default && jsonImport.default.XLSXContent) || jsonImport;
        
        let heroData = root[unitName];
        
        if (!heroData) {
            // Reverse lookup logic
            for (const key in root) {
                const candidate = root[key];
                if (candidate && candidate.override_hero === unitName) {
                    heroData = candidate;
                    break;
                }
            }
        }

        const mainStat = (heroData && heroData.CustomMainStat) ? heroData.CustomMainStat : 'Martial';

        const initialStats: HeroStats = {
            constitution: 5,
            martial: 2,
            divinity: 2,
            rank: 1,
            crit_chance: 0,
            crit_damage: 150,
            main_stat: mainStat,
            profession: (heroData && heroData.CustomJob) ? heroData.CustomJob : "无名小卒"
        };
        
        // Logic for specific stats
        if (mainStat === 'Martial') {
            initialStats.martial = 8;
            initialStats.divinity = 2;
        } else if (mainStat === 'Divinity') {
            initialStats.divinity = 8;
            initialStats.martial = 2;
        } else {
            initialStats.martial = 5;
            initialStats.divinity = 5;
        }
        
        // 1. Write to Cache (Source of Truth)
        this.cache[unitIndex] = initialStats;

        // 2. Write to NetTable (For Client Sync)
        CustomNetTables.SetTableValue('custom_stats' as any, unitIndex, initialStats);

        // Add Modifier
        hero.AddNewModifier(hero, undefined, 'modifier_custom_stats_handler', {});

        print(`[CustomStats] Initialized stats for ${unitName} (Job: ${initialStats.profession})`);
        
        // Send to client immediately
        this.SendStatsToClient(hero, initialStats);
    }

    /**
     * 增加指定属性
     */
    public static AddStat(unit: CDOTA_BaseNPC, statType: keyof HeroStats, value: number) {
        if (!unit || unit.IsNull()) return;

        const unitIndex = tostring(unit.GetEntityIndex());
        // Read from Cache -> Fallback to NetTable -> Fallback to Default
        const currentStats = this.cache[unitIndex] || CustomNetTables.GetTableValue('custom_stats' as any, unitIndex) || { ...DEFAULT_STATS };

        if (currentStats[statType] !== undefined && typeof currentStats[statType] === 'number') {
            (currentStats as any)[statType] += value;
            
            // Update Cache & NetTable
            this.cache[unitIndex] = currentStats;
            CustomNetTables.SetTableValue('custom_stats' as any, unitIndex, currentStats);
        } else {
            print(`[CustomStats] Invalid or non-numeric stat type: ${statType}`);
        }
    }

    /**
     * 获取指定单位的属性
     */
    public static GetStat(unit: CDOTA_BaseNPC, statType: keyof HeroStats): number {
        if (!unit || unit.IsNull()) return 0;
        const stats = this.GetAllStats(unit);
        if (stats && stats[statType] !== undefined) {
            const val = (stats as any)[statType];
            return typeof val === 'number' ? val : 0;
        }
        return 0;
    }

    /**
     * 获取所有属性
     */
    public static GetAllStats(unit: CDOTA_BaseNPC): HeroStats {
        if (!unit || unit.IsNull()) return { ...DEFAULT_STATS };
        const unitIndex = tostring(unit.GetEntityIndex());
        // Prioritize Cache
        return this.cache[unitIndex] || CustomNetTables.GetTableValue('custom_stats' as any, unitIndex) || { ...DEFAULT_STATS };
    }
    
    /**
     * 发送属性数据给客户端
     */
    public static SendStatsToClient(unit: CDOTA_BaseNPC, explicitStats?: HeroStats) {
        if (!unit || unit.IsNull() || !unit.IsRealHero()) return;

        const player = PlayerResource.GetPlayer(unit.GetPlayerOwnerID());
        if (!player) return;

        // Use explicit, or fetch from Cache via GetAllStats
        const stats = explicitStats || this.GetAllStats(unit);
        
        CustomGameEventManager.Send_ServerToPlayer(player, "custom_stats_update", {
            entindex: unit.GetEntityIndex(),
            stats: stats
        });
    }

    public static Init() {
        CustomGameEventManager.RegisterListener("request_custom_stats", (_, event) => {
            const playerId = event.PlayerID;
            const player = PlayerResource.GetPlayer(playerId);
            if (!player) return;
            const hero = player.GetAssignedHero();
            if (hero) {
                // This now triggers GetAllStats -> Reads from Cache -> Returns Correct Data
                CustomStats.SendStatsToClient(hero);
            }
        });
        print("[CustomStats] System Initialized with Memory Cache.");
    }
}
