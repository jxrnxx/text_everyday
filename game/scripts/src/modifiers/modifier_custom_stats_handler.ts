import { BaseModifier, registerModifier } from '../utils/dota_ts_adapter';
import { CustomStats } from '../systems/CustomStats';
import * as json_heroes from '../json/npc_heroes_custom.json';

/**
 * 自定义属性处理器 - 修复版
 * 
 * 设计理念（参考 zhanshen）：
 * 1. 使用 EXTRA_HEALTH_BONUS 和 MANA_BONUS 通过 modifier 增加血量/蓝量上限
 *    这样就不会触发引擎的自动回血逻辑
 * 2. 其他属性（攻击、攻速等）通过 modifier 加成实现
 */

// 目标配置值
const CONFIGURED_STATUS_MANA = 100;   // npc_heroes_custom.txt 中配置的 StatusMana
const CONFIGURED_STATUS_HEALTH = 1;   // npc_heroes_custom.txt 中配置的 StatusHealth

@registerModifier('modifier_custom_stats_handler')
export class modifier_custom_stats_handler extends BaseModifier {
    mainStat: string = '';
    
    // 缓存计算后的额外血量、蓝量和攻击力（用于 modifier 返回值）
    cachedExtraHealth: number = 0;
    cachedExtraMana: number = 0;
    cachedBonusDamage: number = 0;

    IsHidden(): boolean {
        return true;
    }

    IsPurgable(): boolean {
        return false;
    }

    IsPermanent(): boolean {
        return true;
    }

    OnCreated(params: any): void {
        if (!IsServer()) return;

        const parent = this.GetParent();
        const unitName = parent.GetUnitName();
        
        // @ts-ignore
        const heroData = json_heroes[unitName];

        // 读取主属性
        if (heroData && heroData.CustomMainStat) {
            this.mainStat = heroData.CustomMainStat;
        } else {
            this.mainStat = 'Martial';
        }
        
        // 强制重置 Dota 原版三维属性为 0
        if (parent.IsRealHero()) {
            const hero = parent as CDOTA_BaseNPC_Hero;
            hero.SetBaseStrength(0);
            hero.SetBaseAgility(0);
            hero.SetBaseIntellect(0);
        }

        // 立即计算一次属性
        this.RecalculateStats();
        
        // 延迟一帧后设置满血满蓝（确保 modifier bonus 已生效）
        // 同时再次计算属性，确保攻击力等正确显示
        Timers.CreateTimer(0.03, () => {
            if (parent && !parent.IsNull()) {
                // 再次计算属性（确保攻击力等正确）
                this.RecalculateStats();
                // 设置满血满蓝
                parent.SetHealth(parent.GetMaxHealth());
                parent.SetMana(parent.GetMaxMana());
                print(`[Stats Debug] Initial full health/mana: ${parent.GetHealth()}/${parent.GetMaxHealth()}, Damage: ${parent.GetBaseDamageMin()}`);
            }
        });

        // 每 0.5 秒更新一次
        this.StartIntervalThink(0.5);
    }
    
    OnIntervalThink(): void {
        if (!IsServer()) return;
        
        const parent = this.GetParent();
        if (!parent || parent.IsNull()) return;
        
        // 持续重置三维属性
        if (parent.IsRealHero()) {
            const hero = parent as CDOTA_BaseNPC_Hero;
            if (hero.GetBaseStrength() !== 0 || hero.GetBaseAgility() !== 0 || hero.GetBaseIntellect() !== 0) {
                hero.SetBaseStrength(0);
                hero.SetBaseAgility(0);
                hero.SetBaseIntellect(0);
            }
        }
        
        // 定期重算属性
        this.RecalculateStats();
    }
    
    // 外部调用：强制立即刷新属性
    ForceRefresh(): void {
        this.RecalculateStats();
    }
    
    // 重新计算所有属性
    RecalculateStats(): void {
        const parent = this.GetParent();
        if (!parent || parent.IsNull()) return;
        
        const stats = CustomStats.GetAllStats(parent);
        const currentLevel = parent.GetLevel();
        
        // 计算目标生命值 = 根骨面板 × 30 + StatusHealth
        const panelConstitution = Math.floor((stats.constitution_base + (currentLevel - 1) * stats.constitution_gain + stats.extra_constitution) * (1 + stats.constitution_bonus));
        const targetHealth = panelConstitution * 30 + CONFIGURED_STATUS_HEALTH;
        
        // 获取引擎当前的基础最大血量（不含 modifier bonus）
        // 注意：GetBaseMaxHealth() 返回不含 modifier 加成的基础值
        const engineBaseHealth = parent.GetBaseMaxHealth();
        
        // 计算需要通过 modifier 增加的额外血量
        // 额外血量 = 目标血量 - 引擎基础血量
        this.cachedExtraHealth = targetHealth - engineBaseHealth;
        
        // 计算目标法力值 = StatusMana + extra_max_mana
        const extraMana = stats.extra_max_mana || 0;
        this.cachedExtraMana = extraMana;
        
        // 计算攻击力 = (基础攻击 + (等级-1) * 攻击成长) * (1 + 攻击加成) + 主属性面板*1.5 + 额外攻击
        let mainStatValue = 0;
        switch (this.mainStat) {
            case 'Martial':
                mainStatValue = Math.floor((stats.martial_base + (currentLevel - 1) * stats.martial_gain + stats.extra_martial) * (1 + stats.martial_bonus));
                break;
            case 'Divinity':
                mainStatValue = Math.floor((stats.divinity_base + (currentLevel - 1) * stats.divinity_gain + stats.extra_divinity) * (1 + stats.divinity_bonus));
                break;
            case 'Agility':
                mainStatValue = Math.floor((stats.agility_base + (currentLevel - 1) * stats.agility_gain + stats.extra_agility) * (1 + stats.agility_bonus));
                break;
        }
        
        const baseDamage = Math.floor((stats.damage_base + (currentLevel - 1) * stats.damage_gain) * (1 + stats.damage_bonus));
        const totalDamage = baseDamage + Math.floor(mainStatValue * 1.5) + (stats.extra_base_damage || 0);
        
        // 获取引擎当前的基础攻击力（不含 modifier bonus）
        const engineBaseDamage = parent.GetBaseDamageMin();
        
        // 计算需要通过 modifier 增加的额外攻击力
        // 这样原生 HUD 会正确显示总攻击力
        this.cachedBonusDamage = totalDamage - engineBaseDamage;
    }

    DeclareFunctions(): ModifierFunction[] {
        return [
            // 使用 EXTRA_HEALTH_BONUS 增加血量上限，不会触发回血！
            ModifierFunction.EXTRA_HEALTH_BONUS,
            // 使用 MANA_BONUS 增加蓝量上限
            ModifierFunction.MANA_BONUS,
            // 使用 BASEATTACK_BONUSDAMAGE 增加攻击力，原生 HUD 会正确显示
            ModifierFunction.BASEATTACK_BONUSDAMAGE,
            // 其他属性
            ModifierFunction.HEALTH_REGEN_CONSTANT,
            ModifierFunction.ATTACKSPEED_BONUS_CONSTANT,
            ModifierFunction.MANA_REGEN_CONSTANT,
            ModifierFunction.PHYSICAL_ARMOR_BONUS,
            ModifierFunction.LIFESTEAL_AMPLIFY_PERCENTAGE,
            ModifierFunction.MOVESPEED_BONUS_CONSTANT,
            // [暂时禁用] 经验获取控制
            // ModifierFunction.EXP_RATE_BOOST,
        ];
    }
    
    // [暂时禁用] 经验获取控制 - 可能导致性能问题
    // GetModifierPercentageExpRateBonus(): number {
    //     const parent = this.GetParent();
    //     if (!parent || parent.IsNull()) return 0;
    //     
    //     const currentLevel = parent.GetLevel();
    //     const stats = CustomStats.GetAllStats(parent);
    //     const rank = stats.rank ?? 0;
    //     const levelCap = (rank + 1) * 10;
    //     
    //     if (currentLevel >= levelCap) {
    //         return -100;
    //     }
    //     return 0;
    // }
    
    // 通过 modifier 增加额外血量上限（不会触发回血！）
    GetModifierExtraHealthBonus(): number {
        return this.cachedExtraHealth;
    }
    
    // 通过 modifier 增加额外蓝量上限
    GetModifierManaBonus(): number {
        return this.cachedExtraMana;
    }
    
    // 通过 modifier 增加额外攻击力（原生 HUD 会显示为绿字）
    GetModifierBaseAttack_BonusDamage(): number {
        return this.cachedBonusDamage;
    }

    // 根骨 → 生命回复 (面板根骨 * 0.2)
    GetModifierConstantHealthRegen(): number {
        const parent = this.GetParent();
        const stats = CustomStats.GetAllStats(parent);
        const level = parent.GetLevel();
        const panelConstitution = Math.floor((stats.constitution_base + (level - 1) * stats.constitution_gain + stats.extra_constitution) * (1 + stats.constitution_bonus));
        return panelConstitution * 0.2;
    }

    // 身法 → 攻速
    GetModifierAttackSpeedBonus_Constant(): number {
        const parent = this.GetParent();
        const stats = CustomStats.GetAllStats(parent);
        const level = parent.GetLevel();
        const panelAgility = Math.floor((stats.agility_base + (level - 1) * stats.agility_gain + stats.extra_agility) * (1 + stats.agility_bonus));
        return panelAgility + (stats.extra_attack_speed || 0);
    }

    // 内息 → 法力回复
    GetModifierConstantManaRegen(): number {
        return CustomStats.GetStat(this.GetParent(), 'extra_mana_regen');
    }

    // 护甲加成
    GetModifierPhysicalArmorBonus(): number {
        return CustomStats.GetStat(this.GetParent(), 'extra_armor');
    }

    // 吸血百分比
    GetModifierLifestealRegenAmplify_Percentage(): number {
        return CustomStats.GetStat(this.GetParent(), 'lifesteal');
    }
    
    // 移速加成 = 身法面板 * 0.4 + 额外移速
    GetModifierMoveSpeedBonus_Constant(): number {
        const parent = this.GetParent();
        const stats = CustomStats.GetAllStats(parent);
        const level = parent.GetLevel();
        const panelAgility = Math.floor((stats.agility_base + (level - 1) * stats.agility_gain + stats.extra_agility) * (1 + stats.agility_bonus));
        return Math.floor(panelAgility * 0.4) + (stats.extra_move_speed || 0);
    }
}
