/**
 * 伤害系统
 * 在 Dota2 伤害计算前进行预处理：
 * 1. 护甲穿透（破势）
 * 2. 暴击计算
 * 3. 吸血处理
 * 4. 攻击回血
 */

import { CustomStats } from './CustomStats';

// Event 是全局变量，由 event.d.ts 声明

// 伤害显示事件数据
interface DamageShowEvent {
    attacker: CDOTA_BaseNPC;
    victim: CDOTA_BaseNPC;
    damage: number;
    isCrit: boolean;
    damageType: DamageTypes;
}

export class DamageSystem {
    private static instance: DamageSystem | null = null;

    public static GetInstance(): DamageSystem {
        if (!this.instance) {
            this.instance = new DamageSystem();
        }
        return this.instance;
    }

    /**
     * 初始化伤害系统
     * 在 GameMode.Activate 中调用
     */
    public static Init(): void { }

    /**
     * 伤害过滤器 - 所有伤害都会经过这里
     * @returns true 允许伤害生效，false 阻止伤害
     */
    public static OnDamageFilter(event: DamageFilterEvent): boolean {
        if (event.damage < 1) return true;

        const attackerIndex = event.entindex_attacker_const;
        const victimIndex = event.entindex_victim_const;

        if (!attackerIndex || !victimIndex) return true;

        const attacker = EntIndexToHScript(attackerIndex) as CDOTA_BaseNPC;
        const victim = EntIndexToHScript(victimIndex) as CDOTA_BaseNPC;

        if (!attacker || attacker.IsNull() || !victim || victim.IsNull()) {
            return true;
        }

        // 仅处理玩家英雄或其召唤物的攻击
        const playerOwner = attacker.GetPlayerOwnerID();
        if (playerOwner < 0) return true;

        // 获取攻击者的 stats（英雄或主人的）
        let stats = this.GetAttackerStats(attacker, playerOwner);
        if (!stats) return true;

        const originalDamage = event.damage;
        let damageMultiplier = 1;
        let isCrit = false;
        let armorPenBonus = 1;

        // 1. 护甲穿透（破势）- 仅物理伤害
        if (event.damagetype_const === DamageTypes.PHYSICAL) {
            armorPenBonus = this.CalculateArmorPen(stats.armor_pen || 0, victim);
            damageMultiplier *= armorPenBonus;
        }

        // 2. 暴击计算 - 物理和魔法伤害
        if (event.damagetype_const !== DamageTypes.PURE) {
            const critResult = this.CalculateCrit(attacker, stats);
            damageMultiplier *= critResult.multiplier;
            isCrit = critResult.isCrit;
        }

        // 应用伤害倍率
        let finalDamage = event.damage * damageMultiplier;

        // 3. 终伤增% (攻击者) — 从神器修饰器读取
        const attackerArtifactMod = attacker.FindModifierByName('modifier_artifact_bonus') as any;
        if (attackerArtifactMod && attackerArtifactMod.GetBonusFinalDmgIncrease) {
            const finalDmgIncrease = attackerArtifactMod.GetBonusFinalDmgIncrease();
            if (finalDmgIncrease > 0) {
                finalDamage *= 1 + finalDmgIncrease / 100;
            }
        }

        // 4. 终伤减% (受害者) — 从神器修饰器读取
        const victimArtifactMod = victim.FindModifierByName('modifier_artifact_bonus') as any;
        if (victimArtifactMod && victimArtifactMod.GetBonusFinalDmgReduct) {
            const finalDmgReduct = victimArtifactMod.GetBonusFinalDmgReduct();
            if (finalDmgReduct > 0) {
                finalDamage /= 1 + finalDmgReduct / 100;
            }
        }

        // 5. 格挡 (受害者) — 固定减伤
        if (victimArtifactMod && victimArtifactMod.GetBonusBlock) {
            const block = victimArtifactMod.GetBonusBlock();
            if (block > 0) {
                finalDamage = Math.max(1, finalDamage - block);
            }
        }

        event.damage = finalDamage;

        // 6. 吸血处理
        if (stats.lifesteal > 0 && finalDamage > 0) {
            this.HandleLifesteal(attacker, finalDamage, stats.lifesteal);
        }

        // 7. 攻击回血 - 仅普通攻击（物理伤害）
        if (event.damagetype_const === DamageTypes.PHYSICAL && stats.life_on_hit > 0) {
            this.HandleLifeOnHit(attacker, stats.life_on_hit);
        }

        // 发送伤害显示事件
        Event.send('damage-show', {
            attacker: attacker,
            victim: victim,
            damage: finalDamage,
            isCrit: isCrit,
            damageType: event.damagetype_const,
        } as DamageShowEvent);

        return true;
    }

    /**
     * 获取攻击者的属性（如果是召唤物则获取主人的）
     */
    private static GetAttackerStats(attacker: CDOTA_BaseNPC, playerOwner: PlayerID): any {
        if (attacker.IsRealHero()) {
            return CustomStats.GetAllStats(attacker);
        } else {
            // 召唤物：从主人获取
            const ownerHero = PlayerResource.GetSelectedHeroEntity(playerOwner);
            if (ownerHero && !ownerHero.IsNull()) {
                return CustomStats.GetAllStats(ownerHero);
            }
        }
        return null;
    }

    /**
     * 护甲穿透计算（破势）
     * 使用 Dota2 护甲公式
     */
    private static CalculateArmorPen(armorPen: number, victim: CDOTA_BaseNPC): number {
        if (armorPen <= 0) return 1;

        // 获取目标当前护甲
        const victimArmor = victim.GetPhysicalArmorValue(false);

        // 计算有效护甲 (最低为0)
        const effectiveArmor = Math.max(0, victimArmor - armorPen);

        // Dota2护甲公式: Damage Reduction = (armor * 0.052) / (1 + armor * 0.052)
        // 原护甲的伤害乘数
        const originalMultiplier = 1 - (victimArmor * 0.052) / (1 + Math.abs(victimArmor) * 0.052);
        // 有效护甲的伤害乘数
        const newMultiplier = 1 - (effectiveArmor * 0.052) / (1 + Math.abs(effectiveArmor) * 0.052);

        // 计算需要调整的伤害比例
        if (originalMultiplier > 0) {
            return newMultiplier / originalMultiplier;
        }

        return 1;
    }

    /**
     * 暴击计算
     */
    private static CalculateCrit(attacker: CDOTA_BaseNPC, stats: any): { multiplier: number; isCrit: boolean } {
        const critChance = stats.crit_chance || 0;
        const critDamage = stats.crit_damage || 150;

        if (critChance <= 0) {
            return { multiplier: 1, isCrit: false };
        }

        // 使用伪随机暴击
        if (RollPseudoRandomPercentage(critChance, PseudoRandom.CUSTOM_GAME_1, attacker)) {
            return {
                multiplier: critDamage / 100,
                isCrit: true,
            };
        }

        return { multiplier: 1, isCrit: false };
    }

    /**
     * 吸血处理
     */
    private static HandleLifesteal(attacker: CDOTA_BaseNPC, damage: number, lifestealPercent: number): void {
        if (!attacker.IsAlive()) return;

        const healAmount = (damage * lifestealPercent) / 100;
        if (healAmount > 0) {
            attacker.Heal(healAmount, undefined);

            // 吸血特效
            const pfx = ParticleManager.CreateParticle(
                'particles/items3_fx/octarine_core_lifesteal.vpcf',
                ParticleAttachment.ABSORIGIN_FOLLOW,
                attacker
            );
            ParticleManager.ReleaseParticleIndex(pfx);
        }
    }

    /**
     * 攻击回血处理
     */
    private static HandleLifeOnHit(attacker: CDOTA_BaseNPC, lifeOnHit: number): void {
        if (!attacker.IsAlive()) return;
        if (lifeOnHit <= 0) return;

        attacker.Heal(lifeOnHit, undefined);
    }

    /**
     * 监听伤害显示事件（用于 UI 显示暴击等）
     */
    public static OnDamageShow(callback: (event: DamageShowEvent) => void): void {
        Event.on('damage-show', callback);
    }
}
