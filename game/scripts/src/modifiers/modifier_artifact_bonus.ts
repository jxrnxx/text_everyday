import { BaseModifier, registerModifier } from '../utils/dota_ts_adapter';

/**
 * 神器属性修饰器
 * 从 ArtifactSystem 读取玩家装备的神器，动态应用属性加成
 */
@registerModifier('modifier_artifact_bonus')
export class modifier_artifact_bonus extends BaseModifier {
    // 缓存属性值
    private cachedDamage: number = 0;
    private cachedHP: number = 0;
    private cachedArmor: number = 0;
    private cachedConstitution: number = 0;
    private cachedMartial: number = 0;
    private cachedMoveSpeed: number = 0;
    private cachedManaRegen: number = 0;
    private cachedArmorPen: number = 0;
    private cachedDivinity: number = 0;
    private cachedAgility: number = 0;
    private cachedCritChance: number = 0;
    private cachedCritDamage: number = 0;
    private cachedEvasion: number = 0;
    private cachedAllStats: number = 0;
    private cachedFinalDmgReduct: number = 0;
    private cachedSpellDamage: number = 0;
    private cachedBlock: number = 0;
    private cachedFinalDmgIncrease: number = 0;

    IsHidden(): boolean {
        return true;
    }

    IsPurgable(): boolean {
        return false;
    }

    IsPermanent(): boolean {
        return true;
    }

    OnCreated(): void {
        if (!IsServer()) return;

        this.RecalculateBonuses();
        this.StartIntervalThink(1.0); // 每秒更新一次
    }

    OnIntervalThink(): void {
        if (!IsServer()) return;
        this.RecalculateBonuses();
    }

    /**
     * 重新计算神器加成
     */
    RecalculateBonuses(): void {
        const parent = this.GetParent();
        if (!parent || parent.IsNull() || !parent.IsRealHero()) return;

        const playerId = parent.GetPlayerOwnerID();
        // 使用延迟 require 避免循环依赖导致注册失败
        const { ArtifactSystem } = require('../systems/ArtifactSystem') as { ArtifactSystem: any };
        const artifactSystem = ArtifactSystem.GetInstance();
        const bonuses = artifactSystem.CalculateTotalBonuses(playerId);


        this.cachedDamage = bonuses.damage || 0;
        this.cachedHP = bonuses.hp || 0;
        this.cachedArmor = bonuses.armor || 0;
        this.cachedConstitution = bonuses.constitution || 0;
        this.cachedMartial = bonuses.martial || 0;
        this.cachedMoveSpeed = bonuses.moveSpeed || 0;
        this.cachedManaRegen = bonuses.manaRegen || 0;
        this.cachedArmorPen = bonuses.armorPen || 0;
        this.cachedDivinity = bonuses.divinity || 0;
        this.cachedAgility = bonuses.agility || 0;
        this.cachedCritChance = bonuses.critChance || 0;
        this.cachedCritDamage = bonuses.critDamage || 0;
        this.cachedEvasion = bonuses.evasion || 0;
        this.cachedAllStats = bonuses.allStats || 0;
        this.cachedFinalDmgReduct = bonuses.finalDmgReduct || 0;
        this.cachedSpellDamage = bonuses.spellDamage || 0;
        this.cachedBlock = bonuses.block || 0;
        this.cachedFinalDmgIncrease = bonuses.finalDmgIncrease || 0;
    }

    /**
     * 强制刷新
     */
    ForceRefresh(): void {
        this.RecalculateBonuses();
    }

    // 注意: 不声明任何 DeclareFunctions / GetModifier* 方法
    // 所有引擎级属性（HP/攻击/护甲/移速/回蓝/暴击/闪避/技伤）
    // 全部由 modifier_custom_stats_handler 统一计算和应用
    // 本 modifier 仅作为数据缓存层，供 stats_handler 读取

    // 获取技伤%值 (用于 CustomStats 同步到 NetTable)
    GetBonusSpellDamage(): number {
        return this.cachedSpellDamage;
    }

    // 获取护甲穿透值 (用于伤害计算系统调用)
    GetArmorPenetration(): number {
        return this.cachedArmorPen;
    }

    // 获取额外根骨值 (用于 CustomStats 系统调用)
    GetBonusConstitution(): number {
        return this.cachedConstitution;
    }

    // 获取额外武道值 (用于 CustomStats 系统调用)
    GetBonusMartial(): number {
        return this.cachedMartial;
    }

    // 获取额外神念值 (用于 CustomStats 系统调用)
    GetBonusDivinity(): number {
        return this.cachedDivinity;
    }

    // 获取额外身法值 (用于 CustomStats 系统调用)
    GetBonusAgility(): number {
        return this.cachedAgility;
    }

    // 获取全属性加成 (用于 CustomStats 系统调用)
    // 全属性 = 根骨 + 武道 + 神念 (不含身法)
    GetBonusAllStats(): number {
        return this.cachedAllStats;
    }

    // 获取会心加成 (用于 CustomStats 同步)
    GetBonusCritChance(): number {
        return this.cachedCritChance;
    }

    // 获取爆伤加成 (用于 CustomStats 同步)
    GetBonusCritDamage(): number {
        return this.cachedCritDamage;
    }

    // 获取格挡值 (用于 DamageSystem 调用)
    GetBonusBlock(): number {
        return this.cachedBlock;
    }

    // 获取终伤增% (用于 DamageSystem 调用)
    GetBonusFinalDmgIncrease(): number {
        return this.cachedFinalDmgIncrease;
    }

    // 获取终伤减% (用于 DamageSystem 调用)
    GetBonusFinalDmgReduct(): number {
        return this.cachedFinalDmgReduct;
    }

    // 获取闪避% (用于 CustomStats 同步)
    GetBonusEvasion(): number {
        return this.cachedEvasion;
    }
}
