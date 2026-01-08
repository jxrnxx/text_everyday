import { reloadable } from '../utils/tstl-utils';
import * as json_heroes from '../json/npc_heroes_custom.json';

declare global {
    interface CustomGameEventDeclarations {
        custom_stats_changed: {
            unit_index: EntityIndex;
            stats: {
                constitution: number;
                martial: number;
                divinity: number;
            };
        };
    }
}

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
    constructor() {
        // 构造函数，如果需要单例模式可以调整，这里作为静态工具类使用也很方便
    }

    /**
     * 初始化英雄的自定义属性 (在此之前通常先检查是否已存在)
     */
    public static InitializeHeroStats(hero: CDOTA_BaseNPC_Hero) {
        if (!hero || hero.IsNull()) return;

        // 检查是否已经有数据，避免重生重置
        const existing = CustomNetTables.GetTableValue('custom_stats' as any, tostring(hero.GetEntityIndex()));
        if (existing) return;

        // -------------------------------------------------------------------------
        // Initial Stats Logic (Starter Package)
        // -------------------------------------------------------------------------
        const unitName = hero.GetUnitName();
        // @ts-ignore
        const heroData = json_heroes[unitName];
        const mainStat = (heroData && heroData.CustomMainStat) ? heroData.CustomMainStat : 'Martial';

        const initialStats: HeroStats = {
            constitution: 5, // Universal Base (250 HP)
            martial: 2,
            divinity: 2,
            rank: 1,
            crit_chance: 0,
            crit_damage: 150,
            main_stat: mainStat
        };

        if (mainStat === 'Martial') {
            initialStats.martial = 8;
            initialStats.divinity = 2;
        } else if (mainStat === 'Divinity') {
            initialStats.divinity = 8;
            initialStats.martial = 2;
        } else {
            // Default split if unknown
            initialStats.martial = 5;
            initialStats.divinity = 5;
        }
        
        // 写入初始数据
        CustomNetTables.SetTableValue('custom_stats' as any, tostring(hero.GetEntityIndex()), initialStats);

        // 添加属性处理器 Modifier
        // 确保 modifier_custom_stats_handler 已经注册
        hero.AddNewModifier(hero, undefined, 'modifier_custom_stats_handler', {});

        print(`[CustomStats] Initialized stats for ${unitName}: Con=${initialStats.constitution}, Mar=${initialStats.martial}, Div=${initialStats.divinity}`);
    }

    /**
     * 增加指定属性
     * @param unit 目标单位
     * @param statType 属性类型: "constitution" | "martial" | "divinity"
     * @param value 增加的值 (可以是负数)
     */
    public static AddStat(unit: CDOTA_BaseNPC, statType: keyof HeroStats, value: number) {
        if (!unit || unit.IsNull()) return;

        const unitIndex = tostring(unit.GetEntityIndex());
        const currentStats = CustomNetTables.GetTableValue('custom_stats' as any, unitIndex) || { ...DEFAULT_STATS };

        if (currentStats[statType] !== undefined) {
            currentStats[statType] = (currentStats[statType] as number) + value;
            CustomNetTables.SetTableValue('custom_stats' as any, unitIndex, currentStats);

            // 可以发送事件通知前端显示飘字等 (可选)
            // CustomGameEventManager.Send_ServerToAllClients("custom_stats_changed", { unit_index: unit.GetEntityIndex(), stats: currentStats });
        } else {
            print(`[CustomStats] Invalid stat type: ${statType}`);
        }
    }

    /**
     * 获取指定单位的属性
     */
    public static GetStat(unit: CDOTA_BaseNPC, statType: keyof HeroStats): number {
        if (!unit || unit.IsNull()) return 0;
        const stats = CustomNetTables.GetTableValue('custom_stats' as any, tostring(unit.GetEntityIndex()));
        if (stats && stats[statType] !== undefined) {
            return stats[statType];
        }
        return 0;
    }

    /**
     * 获取所有属性
     */
    public static GetAllStats(unit: CDOTA_BaseNPC): HeroStats {
        if (!unit || unit.IsNull()) return { ...DEFAULT_STATS };
        const stats = CustomNetTables.GetTableValue('custom_stats' as any, tostring(unit.GetEntityIndex()));
        return stats ? (stats as HeroStats) : { ...DEFAULT_STATS };
    }
}
