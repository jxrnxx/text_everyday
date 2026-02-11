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
const CONFIGURED_STATUS_MANA = 100; // npc_heroes_custom.txt 中配置的 StatusMana
const CONFIGURED_STATUS_HEALTH = 1; // npc_heroes_custom.txt 中配置的 StatusHealth

@registerModifier('modifier_custom_stats_handler')
export class modifier_custom_stats_handler extends BaseModifier {
    mainStat: string = '';
    engineBaseDamage: number = 0; // 引擎原始攻击力（在 modifier 添加 bonus 前获取）

    // 缓存计算后的额外血量、蓝量和攻击力（用于 modifier 返回值）
    cachedExtraHealth: number = 0;
    cachedExtraMana: number = 0;
    cachedBonusDamage: number = 0;
    cachedPanelConstitution: number = 0;
    cachedPanelAgility: number = 0;
    cachedArtArmor: number = 0;
    cachedArtMoveSpeed: number = 0;
    cachedArtManaRegen: number = 0;

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

        // 在 modifier 添加任何 bonus 之前，获取引擎原始攻击力
        // 这样就能动态适应不同英雄模型
        this.engineBaseDamage = Math.floor((parent.GetBaseDamageMin() + parent.GetBaseDamageMax()) / 2);

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

        // 通过 StackCount 变化触发引擎刷新 modifier 属性
        const currentStack = this.GetStackCount();
        this.SetStackCount(currentStack + 1);
        this.SetStackCount(currentStack);

        // 强制重新计算 modifier 声明的函数
        const parent = this.GetParent();
        if (parent && !parent.IsNull()) {
            (parent as any).CalculateStatBonus?.(true);
        }
    }

    // 重新计算所有属性
    RecalculateStats(): void {
        const parent = this.GetParent();
        if (!parent || parent.IsNull()) return;

        const stats = CustomStats.GetAllStats(parent);
        // 使用 display_level 而不是引擎等级，确保升级后属性正确更新
        const currentLevel = stats.display_level ?? parent.GetLevel();

        // ====== 读取神器加成 ======
        const artifactMod = parent.FindModifierByName('modifier_artifact_bonus') as any;
        let artCon = 0,
            artMar = 0,
            artDiv = 0,
            artAgi = 0,
            artAllStats = 0;
        let artCritChance = 0,
            artCritDamage = 0,
            artSpellDmg = 0;
        let artFinalInc = 0,
            artFinalRed = 0,
            artBlock = 0;
        let artEvasion = 0;
        // 直接数值加成
        let artDamage = 0,
            artHP = 0,
            artArmor = 0,
            artMoveSpeed = 0,
            artManaRegen = 0;
        if (artifactMod) {
            artCon = artifactMod.GetBonusConstitution() || 0;
            artMar = artifactMod.GetBonusMartial() || 0;
            artDiv = artifactMod.GetBonusDivinity() || 0;
            artAgi = artifactMod.GetBonusAgility() || 0;
            artAllStats = artifactMod.GetBonusAllStats() || 0;
            artCritChance = artifactMod.GetBonusCritChance() || 0;
            artCritDamage = artifactMod.GetBonusCritDamage() || 0;
            artSpellDmg = artifactMod.GetBonusSpellDamage() || 0;
            artFinalInc = artifactMod.GetBonusFinalDmgIncrease() || 0;
            artFinalRed = artifactMod.GetBonusFinalDmgReduct() || 0;
            artBlock = artifactMod.GetBonusBlock() || 0;
            artEvasion = artifactMod.GetBonusEvasion() || 0;
            // 直接数值加成 (来自 KV 的 BonusDamage/BonusHP 等)
            artDamage = artifactMod.cachedDamage || 0;
            artHP = artifactMod.cachedHP || 0;
            artArmor = artifactMod.cachedArmor || 0;
            artMoveSpeed = artifactMod.cachedMoveSpeed || 0;
            artManaRegen = artifactMod.cachedManaRegen || 0;
        }
        // 全属性 = 根骨 + 武道 + 神念 (不含身法)
        const artConTotal = artCon + artAllStats;
        const artMarTotal = artMar + artAllStats;
        const artDivTotal = artDiv + artAllStats;

        // 计算目标生命值 = 根骨面板 × 30 + StatusHealth
        // 根骨面板 = (基础 + (等级-1)*成长 + 额外 + 神器) * (1 + 加成)
        const panelConstitution = Math.floor(
            (stats.constitution_base +
                (currentLevel - 1) * stats.constitution_gain +
                stats.extra_constitution +
                artConTotal) *
            (1 + stats.constitution_bonus)
        );
        const targetHealth = panelConstitution * 30 + CONFIGURED_STATUS_HEALTH + artHP;

        // 获取引擎当前的基础最大血量（不含 modifier bonus）
        const engineBaseHealth = parent.GetBaseMaxHealth();
        this.cachedExtraHealth = targetHealth - engineBaseHealth;

        // 计算目标法力值 = StatusMana + extra_max_mana
        const extraMana = stats.extra_max_mana || 0;
        this.cachedExtraMana = extraMana;

        // 计算各维度面板值（含神器加成）
        const panelMartial = Math.floor(
            (stats.martial_base + (currentLevel - 1) * stats.martial_gain + stats.extra_martial + artMarTotal) *
            (1 + stats.martial_bonus)
        );
        const panelDivinity = Math.floor(
            (stats.divinity_base + (currentLevel - 1) * stats.divinity_gain + stats.extra_divinity + artDivTotal) *
            (1 + stats.divinity_bonus)
        );
        const panelAgility = Math.floor(
            (stats.agility_base + (currentLevel - 1) * stats.agility_gain + stats.extra_agility + artAgi) *
            (1 + stats.agility_bonus)
        );

        // 缓存面板值供 getter 方法使用
        this.cachedPanelConstitution = panelConstitution;
        this.cachedPanelAgility = panelAgility;

        // 计算攻击力 = (基础攻击 + (等级-1) * 攻击成长) * (1 + 攻击加成) + 主属性面板*1.5 + 额外攻击
        let mainStatValue = 0;
        switch (this.mainStat) {
            case 'Martial':
                mainStatValue = panelMartial;
                break;
            case 'Divinity':
                mainStatValue = panelDivinity;
                break;
            case 'Agility':
                mainStatValue = panelAgility;
                break;
        }

        const baseDamage = Math.floor(
            (stats.damage_base + (currentLevel - 1) * stats.damage_gain) * (1 + stats.damage_bonus)
        );
        const totalDamage = baseDamage + Math.floor(mainStatValue * 1.5) + (stats.extra_base_damage || 0) + artDamage;

        // 使用在 OnCreated 中获取的引擎原始攻击力
        this.cachedBonusDamage = totalDamage - this.engineBaseDamage;

        // 缓存神器直接数值加成，供 getter 使用
        this.cachedArtArmor = artArmor;
        this.cachedArtMoveSpeed = artMoveSpeed;
        this.cachedArtManaRegen = artManaRegen;

        // ====== 同步面板三维 + 战斗属性到 HeroStats/NetTable ======
        let dirty = false;

        // 面板三维（含神器全属性分配）
        if (stats.constitution !== panelConstitution) {
            stats.constitution = panelConstitution;
            dirty = true;
        }
        if (stats.martial !== panelMartial) {
            stats.martial = panelMartial;
            dirty = true;
        }
        if (stats.divinity !== panelDivinity) {
            stats.divinity = panelDivinity;
            dirty = true;
        }

        // ====== 战斗属性: base × (1 + bonus) 公式 ======
        // 会心 = (base + 神器) × (1 + bonus)
        const finalCritChance = Math.floor((stats.crit_chance_base + artCritChance) * (1 + stats.crit_chance_bonus));
        if (stats.crit_chance !== finalCritChance) {
            stats.crit_chance = finalCritChance;
            dirty = true;
        }

        // 爆伤 = (base + 神器) × (1 + bonus)
        const finalCritDamage = Math.floor((stats.crit_damage_base + artCritDamage) * (1 + stats.crit_damage_bonus));
        if (stats.crit_damage !== finalCritDamage) {
            stats.crit_damage = finalCritDamage;
            dirty = true;
        }

        // 技伤 = (base + 神器) × (1 + bonus)
        const finalSpellDmg = Math.floor((stats.spell_damage_base + artSpellDmg) * (1 + stats.spell_damage_bonus));
        if (stats.spell_damage !== finalSpellDmg) {
            stats.spell_damage = finalSpellDmg;
            dirty = true;
        }

        // 终伤增 = (base + 神器) × (1 + bonus)
        const finalDmgInc = Math.floor(
            (stats.final_dmg_increase_base + artFinalInc) * (1 + stats.final_dmg_increase_bonus)
        );
        if (stats.final_dmg_increase !== finalDmgInc) {
            stats.final_dmg_increase = finalDmgInc;
            dirty = true;
        }

        // 终伤减 = (base + 神器) × (1 + bonus)
        const finalDmgRed = Math.floor(
            (stats.final_dmg_reduct_base + artFinalRed) * (1 + stats.final_dmg_reduct_bonus)
        );
        if (stats.final_dmg_reduct !== finalDmgRed) {
            stats.final_dmg_reduct = finalDmgRed;
            dirty = true;
        }

        // 格挡 (仍然是直接值，无 base+bonus)
        if (stats.block !== artBlock) {
            stats.block = artBlock;
            dirty = true;
        }

        // 闪避 = (base + 神器) × (1 + bonus)
        const finalEvasion = Math.floor((stats.evasion_base + artEvasion) * (1 + stats.evasion_bonus));
        if (stats.evasion !== finalEvasion) {
            stats.evasion = finalEvasion;
            dirty = true;
        }

        // 同步神器加成值到 NetTable（供客户端公式显示）
        const artStats: Record<string, number> = {
            art_con: artConTotal,
            art_mar: artMarTotal,
            art_div: artDivTotal,
            art_agi: artAgi,
            art_all_stats: artAllStats,
            art_damage: artDamage,
            art_hp: artHP,
            art_armor: artArmor,
            art_move_speed: artMoveSpeed,
            art_mana_regen: artManaRegen,
            art_crit_chance: artCritChance,
            art_crit_damage: artCritDamage,
            art_spell_damage: artSpellDmg,
            art_final_inc: artFinalInc,
            art_final_red: artFinalRed,
            art_block: artBlock,
            art_evasion: artEvasion,
        };
        for (const [k, v] of Object.entries(artStats)) {
            if ((stats as any)[k] !== v) {
                (stats as any)[k] = v;
                dirty = true;
            }
        }

        if (dirty) {
            parent.SetCustomValue('_heroStats', stats);
            const unitIndex = tostring(parent.GetEntityIndex());
            CustomNetTables.SetTableValue('custom_stats' as any, unitIndex, stats);
        }
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
            // 攻击回血事件
            ModifierFunction.ON_ATTACK_LANDED,
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
        return this.cachedPanelConstitution * 0.2;
    }

    // 身法 → 攻速
    GetModifierAttackSpeedBonus_Constant(): number {
        const parent = this.GetParent();
        if (!parent || parent.IsNull()) return 0;
        const stats = CustomStats.GetAllStats(parent);
        return this.cachedPanelAgility + (stats.extra_attack_speed || 0);
    }

    // 内息 → 法力回复 + 神器回蓝
    GetModifierConstantManaRegen(): number {
        return CustomStats.GetStat(this.GetParent(), 'extra_mana_regen') + this.cachedArtManaRegen;
    }

    // 护甲加成 = 额外护甲 + 神器护甲
    GetModifierPhysicalArmorBonus(): number {
        return CustomStats.GetStat(this.GetParent(), 'extra_armor') + this.cachedArtArmor;
    }

    // 吸血百分比
    GetModifierLifestealRegenAmplify_Percentage(): number {
        return CustomStats.GetStat(this.GetParent(), 'lifesteal');
    }

    // 移速加成 = 身法面板 * 0.4 + 额外移速 + 神器移速
    GetModifierMoveSpeedBonus_Constant(): number {
        const parent = this.GetParent();
        if (!parent || parent.IsNull()) return 0;
        const stats = CustomStats.GetAllStats(parent);
        const bonusSpeed =
            Math.floor(this.cachedPanelAgility * 0.4) + (stats.extra_move_speed || 0) + this.cachedArtMoveSpeed;
        return bonusSpeed;
    }

    // 攻击回血 + 吸血 - 攻击命中时回复生命
    OnAttackLanded(event: ModifierAttackEvent): void {
        if (!IsServer()) return;

        // 只处理自己发起的攻击
        if (event.attacker !== this.GetParent()) return;

        const parent = this.GetParent();
        if (!parent || parent.IsNull()) return;

        const stats = CustomStats.GetAllStats(parent);
        const lifeOnHit = Number(stats.extra_life_on_hit) || 0;
        const lifestealPercent = Number(stats.lifesteal) || 0;

        let totalHeal = 0;

        // 攻击回血（固定值）
        if (lifeOnHit > 0) {
            totalHeal += lifeOnHit;
        }

        // 吸血（基于造成的伤害）
        if (lifestealPercent > 0 && event.damage > 0) {
            const lifestealHeal = event.damage * (lifestealPercent / 100);
            totalHeal += lifestealHeal;
        }

        // 回复生命
        if (totalHeal > 0) {
            parent.Heal(totalHeal, undefined);
        }
    }
}
