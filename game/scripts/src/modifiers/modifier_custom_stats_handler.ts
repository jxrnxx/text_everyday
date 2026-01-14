import { BaseModifier, registerModifier } from '../utils/dota_ts_adapter';
import { CustomStats } from '../systems/CustomStats';
import * as json_heroes from '../json/npc_heroes_custom.json';

@registerModifier('modifier_custom_stats_handler')
export class modifier_custom_stats_handler extends BaseModifier {
    mainStat: string = '';

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

        // 从配置读取主属性 / Read main stat from JSON
        // @ts-ignore
        const heroData = json_heroes[unitName];
        if (heroData && heroData.CustomMainStat) {
            this.mainStat = heroData.CustomMainStat;
        } else {
            // 默认兜底 / Default fallback
            this.mainStat = 'Martial';
        }

        this.StartIntervalThink(1.0);
    }

    DeclareFunctions(): ModifierFunction[] {
        return [
            ModifierFunction.HEALTH_BONUS,
            ModifierFunction.HEALTH_REGEN_CONSTANT,
            ModifierFunction.BASEATTACK_BONUSDAMAGE,
            ModifierFunction.ATTACKSPEED_BONUS_CONSTANT,
            ModifierFunction.MANA_REGEN_CONSTANT,
            ModifierFunction.PHYSICAL_ARMOR_BONUS,
            ModifierFunction.MANA_BONUS,
            ModifierFunction.LIFESTEAL_AMPLIFY_PERCENTAGE,
            ModifierFunction.MOVESPEED_BONUS_CONSTANT,
            ModifierFunction.PREATTACK_BONUS_DAMAGE,
        ];
    }

    // 根骨 → 生命加成 (面板根骨 * 50)
    GetModifierHealthBonus(): number {
        const parent = this.GetParent();
        const stats = CustomStats.GetAllStats(parent);
        const level = parent.GetLevel();
        // 面板根骨 = (基础 + (等级-1) * 成长) * (1 + 加成)
        const panelConstitution = Math.floor((stats.constitution_base + (level - 1) * stats.constitution_gain) * (1 + stats.constitution_bonus));
        return panelConstitution * 50;
    }

    // 根骨 → 生命回复 (面板根骨 * 0.5)
    GetModifierConstantHealthRegen(): number {
        const parent = this.GetParent();
        const stats = CustomStats.GetAllStats(parent);
        const level = parent.GetLevel();
        const panelConstitution = Math.floor((stats.constitution_base + (level - 1) * stats.constitution_gain) * (1 + stats.constitution_bonus));
        return panelConstitution * 0.5;
    }

    // 攻击力 = (基础攻击 + (等级-1) * 攻击成长) * (1 + 攻击加成) + 主属性面板*2 + 商店购买
    GetModifierBaseAttack_BonusDamage(): number {
        const parent = this.GetParent();
        const stats = CustomStats.GetAllStats(parent);
        const level = parent.GetLevel();
        
        // 基础攻击力计算
        const baseDamage = Math.floor((stats.damage_base + (level - 1) * stats.damage_gain) * (1 + stats.damage_bonus));
        
        // 主属性面板值计算
        let mainStatPanel = 0;
        if (stats.main_stat === 'Martial') {
            mainStatPanel = Math.floor((stats.martial_base + (level - 1) * stats.martial_gain) * (1 + stats.martial_bonus));
        } else if (stats.main_stat === 'Divinity') {
            mainStatPanel = Math.floor((stats.divinity_base + (level - 1) * stats.divinity_gain) * (1 + stats.divinity_bonus));
        }
        
        // 攻击力 = 基础 + 主属性*2 + 商店购买
        return baseDamage + (mainStatPanel * 2) + stats.purchased_base_damage;
    }

    // 攻速加成 = 身法面板 + 商人购买的攻速
    GetModifierAttackSpeedBonus_Constant(): number {
        const parent = this.GetParent();
        const stats = CustomStats.GetAllStats(parent);
        const level = parent.GetLevel();
        
        // 身法面板 = (基础 + (等级-1) * 成长) * (1 + 加成)
        const panelAgility = Math.floor((stats.agility_base + (level - 1) * stats.agility_gain) * (1 + stats.agility_bonus));
        
        return panelAgility + stats.purchased_attack_speed;
    }

    // 内息 → 法力回复
    GetModifierConstantManaRegen(): number {
        return CustomStats.GetStat(this.GetParent(), 'purchased_mana_regen');
    }

    // 护甲加成
    GetModifierPhysicalArmorBonus(): number {
        return CustomStats.GetStat(this.GetParent(), 'purchased_armor');
    }

    // 最大法力加成
    GetModifierManaBonus(): number {
        return CustomStats.GetStat(this.GetParent(), 'purchased_max_mana');
    }

    // 吸血百分比
    GetModifierLifestealRegenAmplify_Percentage(): number {
        return CustomStats.GetStat(this.GetParent(), 'lifesteal');
    }
    
    // 移速加成 = 身法面板 * 0.4 + 商店移速
    GetModifierMoveSpeedBonus_Constant(): number {
        const parent = this.GetParent();
        const stats = CustomStats.GetAllStats(parent);
        const level = parent.GetLevel();
        
        // 身法面板 = (基础 + (等级-1) * 成长) * (1 + 加成)
        const panelAgility = Math.floor((stats.agility_base + (level - 1) * stats.agility_gain) * (1 + stats.agility_bonus));
        
        // 移速加成 = 身法 * 0.4 + 商店购买
        return Math.floor(panelAgility * 0.4) + stats.purchased_move_speed;
    }
    
    // 商店购买的基础攻击加成已经在 GetModifierBaseAttack_BonusDamage 中计算
    GetModifierPreAttack_BonusDamage(): number {
        return 0;  // 攻击力由 GetModifierBaseAttack_BonusDamage 统一处理
    }
}
