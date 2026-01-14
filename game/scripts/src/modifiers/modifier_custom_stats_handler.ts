import { BaseModifier, registerModifier } from '../utils/dota_ts_adapter';
import { CustomStats } from '../systems/CustomStats';
import * as json_heroes from '../json/npc_heroes_custom.json';

/**
 * 自定义属性处理器 - 简化版
 * 
 * 设计理念（参考 zhanshen）：
 * 1. 不使用"补偿法" - 太脆弱且依赖硬编码值
 * 2. 使用 OnIntervalThink 定期直接设置 MaxHealth/MaxMana
 * 3. 其他属性（攻击、攻速等）通过 modifier 加成实现
 */

// 目标配置值
const CONFIGURED_STATUS_MANA = 100;   // npc_heroes_custom.txt 中配置的 StatusMana
const CONFIGURED_STATUS_HEALTH = 1;   // npc_heroes_custom.txt 中配置的 StatusHealth

@registerModifier('modifier_custom_stats_handler')
export class modifier_custom_stats_handler extends BaseModifier {
    mainStat: string = '';
    originalBaseDamage: number = 0;
    
    // 上次设置的目标值（用于检测变化，避免重复设置）
    lastTargetHealth: number = 0;
    lastTargetMana: number = 0;

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

        // 攻击力偏移配置（原版英雄有自己的基础攻击力）
        const OVERRIDE_HERO_DAMAGE_OFFSET: { [key: string]: number } = {
            'npc_dota_hero_juggernaut': 22,
            'npc_dota_hero_kunkka': 56,
        };
        
        // @ts-ignore
        const heroData = json_heroes[unitName];
        const overrideHero = heroData?.override_hero || 'npc_dota_hero_juggernaut';
        this.originalBaseDamage = OVERRIDE_HERO_DAMAGE_OFFSET[overrideHero] || 22;

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

        // 立即应用一次属性
        this.ApplyCustomStats();

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
        
        // 定期应用自定义属性
        this.ApplyCustomStats();
    }
    
    // 核心方法：直接设置 MaxHealth 和 MaxMana
    ApplyCustomStats(): void {
        const parent = this.GetParent();
        if (!parent || parent.IsNull()) return;
        
        const stats = CustomStats.GetAllStats(parent);
        const level = parent.GetLevel();
        
        // 计算目标生命值 = 根骨面板 × 50 + StatusHealth
        const panelConstitution = Math.floor((stats.constitution_base + (level - 1) * stats.constitution_gain + stats.extra_constitution) * (1 + stats.constitution_bonus));
        const targetHealth = panelConstitution * 50 + CONFIGURED_STATUS_HEALTH;
        
        // 计算目标法力值 = StatusMana + extra_max_mana
        const extraMana = stats.extra_max_mana || 0;
        const targetMana = CONFIGURED_STATUS_MANA + extraMana;
        
        // 只在值变化时设置（避免闪烁）
        const currentMaxHealth = parent.GetMaxHealth();
        const currentMaxMana = parent.GetMaxMana();
        
        if (targetHealth !== this.lastTargetHealth || currentMaxHealth !== targetHealth) {
            // 保存当前生命百分比
            const healthPercent = currentMaxHealth > 0 ? parent.GetHealth() / currentMaxHealth : 1;
            
            // 设置新的最大生命值
            parent.SetMaxHealth(targetHealth);
            
            // 按比例恢复当前生命
            parent.SetHealth(Math.floor(targetHealth * healthPercent));
            
            this.lastTargetHealth = targetHealth;
        }
        
        if (targetMana !== this.lastTargetMana || currentMaxMana !== targetMana) {
            // 保存当前法力百分比
            const manaPercent = currentMaxMana > 0 ? parent.GetMana() / currentMaxMana : 1;
            
            // 设置新的最大法力值
            parent.SetMaxMana(targetMana);
            
            // 按比例恢复当前法力
            parent.SetMana(Math.floor(targetMana * manaPercent));
            
            this.lastTargetMana = targetMana;
        }
    }

    DeclareFunctions(): ModifierFunction[] {
        return [
            // 不再使用 HEALTH_BONUS 和 MANA_BONUS - 直接用 SetMaxHealth/SetMaxMana
            ModifierFunction.HEALTH_REGEN_CONSTANT,
            ModifierFunction.BASEATTACK_BONUSDAMAGE,
            ModifierFunction.ATTACKSPEED_BONUS_CONSTANT,
            ModifierFunction.MANA_REGEN_CONSTANT,
            ModifierFunction.PHYSICAL_ARMOR_BONUS,
            ModifierFunction.LIFESTEAL_AMPLIFY_PERCENTAGE,
            ModifierFunction.MOVESPEED_BONUS_CONSTANT,
            ModifierFunction.PREATTACK_BONUS_DAMAGE,
        ];
    }

    // 根骨 → 生命回复 (面板根骨 * 0.5)
    GetModifierConstantHealthRegen(): number {
        const parent = this.GetParent();
        const stats = CustomStats.GetAllStats(parent);
        const level = parent.GetLevel();
        const panelConstitution = Math.floor((stats.constitution_base + (level - 1) * stats.constitution_gain + stats.extra_constitution) * (1 + stats.constitution_bonus));
        return panelConstitution * 0.5;
    }

    // 攻击力 = (基础攻击 + (等级-1) * 攻击成长 + 额外攻击) * (1 + 攻击加成) + 主属性面板*2
    GetModifierBaseAttack_BonusDamage(): number {
        const parent = this.GetParent();
        const stats = CustomStats.GetAllStats(parent);
        const level = parent.GetLevel();
        
        // 计算主属性面板值
        let mainStatValue = 0;
        switch (this.mainStat) {
            case 'Martial':
                mainStatValue = Math.floor((stats.martial_base + (level - 1) * stats.martial_gain + stats.extra_martial) * (1 + stats.martial_bonus));
                break;
            case 'Divinity':
                mainStatValue = Math.floor((stats.divinity_base + (level - 1) * stats.divinity_gain + stats.extra_divinity) * (1 + stats.divinity_bonus));
                break;
            case 'Agility':
                mainStatValue = Math.floor((stats.agility_base + (level - 1) * stats.agility_gain + stats.extra_agility) * (1 + stats.agility_bonus));
                break;
        }
        
        // 计算基础攻击力
        const baseDamage = Math.floor((stats.damage_base + (level - 1) * stats.damage_gain + stats.extra_base_damage) * (1 + stats.damage_bonus));
        
        // 总攻击力 = 基础攻击 + 主属性*2 - 原版英雄攻击偏移
        return baseDamage + mainStatValue * 2 - this.originalBaseDamage;
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

    // 额外攻击力（来自商店购买等）
    GetModifierPreAttack_BonusDamage(): number {
        return CustomStats.GetStat(this.GetParent(), 'extra_base_damage');
    }
}
