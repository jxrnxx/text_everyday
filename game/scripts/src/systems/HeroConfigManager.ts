/**
 * HeroConfigManager.ts
 * 统一的英雄配置管理器
 *
 * 数据流: Excel → KV → JSON → HeroConfigManager → CustomStats
 *
 * 职责:
 * - 从 JSON 配置读取英雄数据
 * - 提供类型安全的属性访问
 * - 统一所有英雄属性的获取入口
 */

import * as json_heroes from '../json/npc_heroes_custom.json';

// ===== 类型定义 =====

/** 英雄配置接口 - 从 Excel/JSON 读取 */
export interface HeroConfig {
    // 基础信息
    override_hero?: string;
    ModelScale?: number;

    // 技能配置
    Ability1?: string;
    Ability2?: string;
    Ability3?: string;
    Ability4?: string;
    Ability5?: string;
    Ability6?: string;

    // 根骨属性
    AttributeBaseConstitution?: number;
    AttributeConstitutionGain?: number;
    AttributeConstitutionBonus?: number;

    // 武道属性
    AttributeBaseMartial?: number;
    AttributeMartialGain?: number;
    AttributeMartialBonus?: number;

    // 神念属性
    AttributeBaseDivinity?: number;
    AttributeDivinityGain?: number;
    AttributeDivinityBonus?: number;

    // 身法属性
    AttributeBaseAgility?: number;
    AttributeAgilityGain?: number;
    AttributeAgilityBonus?: number;

    // 攻击力属性
    AttributeBaseDamage?: number;
    AttributeDamageGain?: number;
    AttributeDamageBonus?: number;

    // 其他属性
    MovementSpeed?: number;
    LifeOnHit?: number;
    CustomMainStat?: 'Martial' | 'Divinity';
    CustomJob?: string;

    // 战斗属性
    ArmorPhysical?: number;
    BaseAttackSpeed?: number;
    StatusHealth?: number;
    StatusMana?: number;
    StatusHealthRegen?: number;
    StatusManaRegen?: number;

    // 战斗属性 (base + bonus)
    AttributeBaseCritChance?: number;
    AttributeCritChanceBonus?: number;
    AttributeBaseCritDamage?: number;
    AttributeCritDamageBonus?: number;
    AttributeBaseSpellDamage?: number;
    AttributeSpellDamageBonus?: number;
    AttributeBaseFinalDmgIncrease?: number;
    AttributeFinalDmgIncreaseBonus?: number;
    AttributeBaseFinalDmgReduct?: number;
    AttributeFinalDmgReductBonus?: number;
    AttributeBaseEvasion?: number;
    AttributeEvasionBonus?: number;
}

/** 可用英雄列表 */
export const AVAILABLE_HEROES: { [id: string]: { name: string; description: string } } = {
    npc_dota_hero_juggernaut: {
        name: '剑圣',
        description: '兵神道起始英雄，物理输出型',
    },
    npc_dota_hero_marci: {
        name: '玛西',
        description: '测试英雄，高根骨',
    },
};

// ===== 配置管理器 =====

export class HeroConfigManager {
    private static configRoot: any = null;

    /**
     * 初始化配置管理器
     * 在游戏启动时调用一次
     */
    public static Initialize(): void {
        // 直接使用导入的 JSON，它已经是正确格式
        const jsonData = json_heroes as any;
        this.configRoot = jsonData.DOTAHeroes || jsonData.XLSXContent || jsonData.default?.XLSXContent || jsonData;
    }

    /**
     * 获取英雄配置
     * @param heroName 英雄单位名称 (例如 npc_dota_hero_juggernaut)
     * @returns 英雄配置，如果未找到返回 null
     */
    public static GetHeroConfig(heroName: string): HeroConfig | null {
        if (!this.configRoot) {
            this.Initialize();
        }

        // 直接查找
        let config = this.configRoot[heroName];

        // 如果未找到，尝试通过 override_hero 反向查找
        if (!config) {
            for (const key in this.configRoot) {
                const candidate = this.configRoot[key];
                if (candidate && candidate.override_hero === heroName) {
                    config = candidate;
                    break;
                }
            }
        }

        if (!config) {
            return null;
        }

        return config as HeroConfig;
    }

    /**
     * 获取英雄配置，带默认值
     * @param heroName 英雄单位名称
     * @returns 英雄配置，如果未找到返回剑圣配置作为默认
     */
    public static GetHeroConfigWithFallback(heroName: string): HeroConfig {
        let config = this.GetHeroConfig(heroName);

        if (!config) {
            config = this.GetHeroConfig('npc_dota_hero_juggernaut');
        }

        return config || this.getDefaultConfig();
    }

    /**
     * 获取安全的属性值
     */
    public static GetAttribute(config: HeroConfig, attr: keyof HeroConfig, defaultValue: number = 0): number {
        const value = config[attr];
        return typeof value === 'number' ? value : defaultValue;
    }

    /**
     * 检查英雄是否可用
     */
    public static IsHeroAvailable(heroName: string): boolean {
        return AVAILABLE_HEROES[heroName] !== undefined;
    }

    /**
     * 获取所有可用英雄
     */
    public static GetAvailableHeroes(): string[] {
        return Object.keys(AVAILABLE_HEROES);
    }

    /**
     * 默认配置
     */
    private static getDefaultConfig(): HeroConfig {
        return {
            AttributeBaseConstitution: 5,
            AttributeConstitutionGain: 0,
            AttributeConstitutionBonus: 0,
            AttributeBaseMartial: 5,
            AttributeMartialGain: 0,
            AttributeMartialBonus: 0,
            AttributeBaseDivinity: 5,
            AttributeDivinityGain: 0,
            AttributeDivinityBonus: 0,
            AttributeBaseAgility: 0,
            AttributeAgilityGain: 0,
            AttributeAgilityBonus: 0,
            AttributeBaseDamage: 1,
            AttributeDamageGain: 0,
            AttributeDamageBonus: 0,
            MovementSpeed: 300,
            LifeOnHit: 0,
            CustomMainStat: 'Martial',
            // 战斗属性
            AttributeBaseCritChance: 0,
            AttributeCritChanceBonus: 0,
            AttributeBaseCritDamage: 105,
            AttributeCritDamageBonus: 0,
            AttributeBaseSpellDamage: 0,
            AttributeSpellDamageBonus: 0,
            AttributeBaseFinalDmgIncrease: 0,
            AttributeFinalDmgIncreaseBonus: 0,
            AttributeBaseFinalDmgReduct: 0,
            AttributeFinalDmgReductBonus: 0,
            AttributeBaseEvasion: 0,
            AttributeEvasionBonus: 0,
        };
    }
}
