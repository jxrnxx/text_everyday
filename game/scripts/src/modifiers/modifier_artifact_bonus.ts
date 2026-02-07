import { BaseModifier, registerModifier } from '../utils/dota_ts_adapter';
import { ArtifactSystem } from '../systems/ArtifactSystem';

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
    }

    /**
     * 强制刷新
     */
    ForceRefresh(): void {
        this.RecalculateBonuses();
    }

    DeclareFunctions(): ModifierFunction[] {
        return [
            ModifierFunction.EXTRA_HEALTH_BONUS,
            ModifierFunction.BASEATTACK_BONUSDAMAGE,
            ModifierFunction.PHYSICAL_ARMOR_BONUS,
            ModifierFunction.MOVESPEED_BONUS_CONSTANT,
            ModifierFunction.MANA_REGEN_CONSTANT,
            ModifierFunction.PREATTACK_CRITICALSTRIKE,
            ModifierFunction.EVASION_CONSTANT,
            ModifierFunction.INCOMING_DAMAGE_PERCENTAGE,
        ];
    }

    // 额外生命值 (护甲槽位)
    GetModifierExtraHealthBonus(): number {
        return this.cachedHP;
    }

    // 额外攻击力 (武器槽位)
    GetModifierBaseAttack_BonusDamage(): number {
        return this.cachedDamage;
    }

    // 额外护甲 (护甲槽位)
    GetModifierPhysicalArmorBonus(): number {
        return this.cachedArmor;
    }

    // 额外移速 (鞋子槽位)
    GetModifierMoveSpeedBonus_Constant(): number {
        return this.cachedMoveSpeed;
    }

    // 额外回蓝 (头盔槽位)
    GetModifierConstantManaRegen(): number {
        return this.cachedManaRegen;
    }

    // 暴击 (饰品槽位)
    GetModifierPreAttack_CriticalStrike(event: ModifierAttackEvent): number {
        if (!IsServer()) return 0;
        if (this.cachedCritChance <= 0) return 0;

        // 检查是否触发暴击
        if (RandomFloat(0, 100) < this.cachedCritChance) {
            // 返回暴击倍率 (150% 基础 + 额外暴击伤害)
            return 150 + this.cachedCritDamage;
        }
        return 0;
    }

    // 闪避 (鞋子槽位)
    GetModifierEvasion_Constant(): number {
        return this.cachedEvasion;
    }

    // 最终减伤 (护符槽位)
    GetModifierIncomingDamage_Percentage(): number {
        // 负值表示减少伤害
        return -this.cachedFinalDmgReduct;
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
    GetBonusAllStats(): number {
        return this.cachedAllStats;
    }
}
