import { reloadable } from '../utils/tstl-utils';
import * as json_heroes from '../json/npc_heroes_custom.json';
import { EconomySystem } from '../mechanics/EconomySystem';

// Custom Game Event Declarations moved to shared/gameevents.d.ts

// 定义自定义属性接口
interface HeroStats {
    // ===== 基础属性 (从英雄配置读取) =====
    // 根骨系统
    constitution_base: number;   // 基础根骨
    constitution_gain: number;   // 根骨成长
    constitution_bonus: number;  // 根骨加成百分比
    // 武道系统
    martial_base: number;        // 基础武道
    martial_gain: number;        // 武道成长
    martial_bonus: number;       // 武道加成百分比
    // 神念系统
    divinity_base: number;       // 基础神念
    divinity_gain: number;       // 神念成长
    divinity_bonus: number;      // 神念加成百分比
    // 身法系统
    agility_base: number;        // 基础身法
    agility_gain: number;        // 身法成长
    agility_bonus: number;       // 身法加成百分比
    // 攻击力系统
    damage_base: number;         // 基础攻击力
    damage_gain: number;         // 攻击力成长
    damage_bonus: number;        // 攻击力加成百分比
    
    // ===== 计算后的面板属性 (用于显示) =====
    constitution: number;        // 面板根骨
    martial: number;             // 面板武道
    divinity: number;            // 面板神念
    
    // ===== 其他属性 =====
    rank: number;
    crit_chance: number;
    crit_damage: number;
    main_stat: string;           // 主属性: 'Martial' 或 'Divinity'
    profession?: string;
    
    // ===== 额外获得的属性 (商人/游戏奖励/装备等) =====
    extra_constitution: number;      // 额外根骨
    extra_martial: number;           // 额外武道
    extra_divinity: number;          // 额外神念
    extra_agility: number;           // 额外身法
    extra_attack_speed: number;      // 额外攻速
    extra_mana_regen: number;        // 额外回蓝
    extra_armor: number;             // 额外护甲
    extra_max_mana: number;          // 额外最大法力
    extra_move_speed: number;        // 额外移速
    extra_base_damage: number;       // 额外攻击力
    lifesteal: number;               // 吸血百分比
}

const DEFAULT_STATS: HeroStats = {
    // 基础属性
    constitution_base: 5, constitution_gain: 0, constitution_bonus: 0,
    martial_base: 5, martial_gain: 0, martial_bonus: 0,
    divinity_base: 5, divinity_gain: 0, divinity_bonus: 0,
    agility_base: 0, agility_gain: 0, agility_bonus: 0,
    damage_base: 1, damage_gain: 0, damage_bonus: 0,
    // 面板属性
    constitution: 5, martial: 5, divinity: 5,
    // 其他
    rank: 1, crit_chance: 0, crit_damage: 150,
    main_stat: 'Martial',
    // 额外属性
    extra_constitution: 0, extra_martial: 0, extra_divinity: 0, extra_agility: 0,
    extra_attack_speed: 0, extra_mana_regen: 0, extra_armor: 0,
    extra_max_mana: 0, extra_move_speed: 0, extra_base_damage: 0,
    lifesteal: 0,
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
                    print(`[CustomStats DEBUG] Found heroData via override_hero lookup for ${unitName}`);
                    break;
                }
            }
        }
        
        // 调试输出：确认读取的值
        print(`[CustomStats DEBUG] unitName: ${unitName}`);
        print(`[CustomStats DEBUG] heroData found: ${heroData ? 'YES' : 'NO'}`);
        
        // 备用方案：如果仍未找到，直接使用 npc_dota_hero_juggernaut
        if (!heroData) {
            heroData = root['npc_dota_hero_juggernaut'];
            print(`[CustomStats DEBUG] Fallback to npc_dota_hero_juggernaut: ${heroData ? 'YES' : 'NO'}`);
        }
        
        if (heroData) {
            print(`[CustomStats DEBUG] Raw AttributeBaseAgility: ${heroData.AttributeBaseAgility}`);
            print(`[CustomStats DEBUG] Raw AttributeAgilityGain: ${heroData.AttributeAgilityGain}`);
            print(`[CustomStats DEBUG] Raw AttributeBaseConstitution: ${heroData.AttributeBaseConstitution}`);
        }

        const mainStat = (heroData && heroData.CustomMainStat) ? heroData.CustomMainStat : 'Martial';
        
        // 从英雄配置读取所有基础/成长/加成属性
        // 根骨
        const constitutionBase = (heroData && heroData.AttributeBaseConstitution) ? Number(heroData.AttributeBaseConstitution) : 5;
        const constitutionGain = (heroData && heroData.AttributeConstitutionGain) ? Number(heroData.AttributeConstitutionGain) : 0;
        const constitutionBonus = (heroData && heroData.AttributeConstitutionBonus) ? Number(heroData.AttributeConstitutionBonus) : 0;
        // 武道
        const martialBase = (heroData && heroData.AttributeBaseMartial) ? Number(heroData.AttributeBaseMartial) : 5;
        const martialGain = (heroData && heroData.AttributeMartialGain) ? Number(heroData.AttributeMartialGain) : 0;
        const martialBonus = (heroData && heroData.AttributeMartialBonus) ? Number(heroData.AttributeMartialBonus) : 0;
        // 神念
        const divinityBase = (heroData && heroData.AttributeBaseDivinity) ? Number(heroData.AttributeBaseDivinity) : 5;
        const divinityGain = (heroData && heroData.AttributeDivinityGain) ? Number(heroData.AttributeDivinityGain) : 0;
        const divinityBonus = (heroData && heroData.AttributeDivinityBonus) ? Number(heroData.AttributeDivinityBonus) : 0;
        // 身法
        const agilityBase = (heroData && heroData.AttributeBaseAgility) ? Number(heroData.AttributeBaseAgility) : 0;
        const agilityGain = (heroData && heroData.AttributeAgilityGain) ? Number(heroData.AttributeAgilityGain) : 0;
        const agilityBonus = (heroData && heroData.AttributeAgilityBonus) ? Number(heroData.AttributeAgilityBonus) : 0;
        // 攻击力
        const damageBase = (heroData && heroData.AttributeBaseDamage) ? Number(heroData.AttributeBaseDamage) : 1;
        const damageGain = (heroData && heroData.AttributeDamageGain) ? Number(heroData.AttributeDamageGain) : 0;
        const damageBonus = (heroData && heroData.AttributeDamageBonus) ? Number(heroData.AttributeDamageBonus) : 0;

        const initialStats: HeroStats = {
            // 基础属性
            constitution_base: constitutionBase,
            constitution_gain: constitutionGain,
            constitution_bonus: constitutionBonus,
            martial_base: martialBase,
            martial_gain: martialGain,
            martial_bonus: martialBonus,
            divinity_base: divinityBase,
            divinity_gain: divinityGain,
            divinity_bonus: divinityBonus,
            agility_base: agilityBase,
            agility_gain: agilityGain,
            agility_bonus: agilityBonus,
            damage_base: damageBase,
            damage_gain: damageGain,
            damage_bonus: damageBonus,
            // 面板属性 (初始等于基础值，后续会动态计算)
            constitution: constitutionBase,
            martial: martialBase,
            divinity: divinityBase,
            // 其他
            rank: 1,
            crit_chance: 0,
            crit_damage: 150,
            main_stat: mainStat,
            profession: (heroData && heroData.CustomJob) ? heroData.CustomJob : `#Job_${unitName}`,
            // 额外属性
            extra_constitution: 0,
            extra_martial: 0,
            extra_divinity: 0,
            extra_agility: 0,
            extra_attack_speed: 0,
            extra_mana_regen: 0,
            extra_armor: 0,
            extra_max_mana: 0,
            extra_move_speed: 0,
            extra_base_damage: 0,
            lifesteal: 0,
        };        
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
            
            // 刷新 Modifier 使属性生效
            // 方法: 移除并重新添加 modifier
            if (unit.HasModifier('modifier_custom_stats_handler')) {
                unit.RemoveModifierByName('modifier_custom_stats_handler');
                unit.AddNewModifier(unit, undefined, 'modifier_custom_stats_handler', {});
            }
            
            // 通知客户端属性已更新
            if (unit.IsRealHero()) {
                this.SendStatsToClient(unit);
            }
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
     * 计算身法值
     * 公式: (基础身法 + (等级-1) * 身法成长) * (1 + 身法加成)
     */
    public static GetAgility(unit: CDOTA_BaseNPC): number {
        if (!unit || unit.IsNull()) return 0;
        
        const stats = this.GetAllStats(unit);
        const level = unit.GetLevel();
        
        // 公式: (基础身法 + (等级-1) * 身法成长) * (1 + 身法加成)
        const baseAgility = stats.agility_base + (level - 1) * stats.agility_gain;
        const totalAgility = Math.floor(baseAgility * (1 + stats.agility_bonus));
        
        return totalAgility;
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
        
        // 商人购买属性事件处理
        CustomGameEventManager.RegisterListener("cmd_merchant_purchase", (_, event: any) => {
            const playerId = event.PlayerID;
            const player = PlayerResource.GetPlayer(playerId);
            if (!player) return;
            const hero = player.GetAssignedHero();
            if (!hero) return;
            
            const statType = event.stat_type as string;
            const amount = event.amount as number || 0;
            const cost = 200; // 每个技能费用 200 灵石
            
            // 检查灵石是否足够
            const economy = EconomySystem.GetInstance();
            const currentCoin = economy.GetSpiritCoin(playerId);
            
            if (currentCoin < cost) {
                // 灵石不足
                hero.EmitSound('General.CastFail_NoMana');
                print(`[CustomStats] Player ${playerId} - 灵石不足! 需要: ${cost}, 拥有: ${currentCoin}`);
                return;
            }
            
            // 属性映射表 - 增加额外属性
            const statMap: { [key: string]: { stat: keyof HeroStats; amount: number } } = {
                'constitution': { stat: 'extra_constitution', amount: 5 },
                'martial': { stat: 'extra_martial', amount: 5 },
                'divinity': { stat: 'extra_divinity', amount: 5 },
                'agility': { stat: 'extra_agility', amount: 5 },
                'armor': { stat: 'extra_armor', amount: 2 },
                'mana_regen': { stat: 'extra_mana_regen', amount: 2 },
                'attack_speed': { stat: 'extra_attack_speed', amount: 15 },
                'move_speed': { stat: 'extra_move_speed', amount: 20 },
                'base_damage': { stat: 'extra_base_damage', amount: 15 },
            };
            
            const mapping = statMap[statType];
            if (mapping) {
                // 扣除灵石
                economy.AddSpiritCoin(playerId, -cost);
                
                // 添加属性
                CustomStats.AddStat(hero, mapping.stat, amount || mapping.amount);
                hero.EmitSound('Item.TomeOfKnowledge');
                print(`[CustomStats] Player ${playerId} purchased ${statType} +${amount || mapping.amount} for ${cost} 灵石`);
            } else {
                print(`[CustomStats] Unknown stat type: ${statType}`);
            }
        });
        
        print("[CustomStats] System Initialized with Memory Cache.");
    }
}
