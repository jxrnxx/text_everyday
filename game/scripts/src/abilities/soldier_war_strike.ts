import { BaseAbility, BaseModifier, registerAbility, registerModifier } from '../utils/dota_ts_adapter';

@registerAbility('soldier_war_strike')
export class soldier_war_strike extends BaseAbility {
    GetIntro() {
        return '每第3次攻击造成250%暴击伤害并对前方扇形区域内敌人造成等额物理伤害。';
    }

    GetIntrinsicModifierName() {
        return 'modifier_soldier_war_strike';
    }

    Precache(context: CScriptPrecacheContext) {
        PrecacheResource('particle', 'particles/mars_shield_bash_crit_strike_text.vpcf', context);
        PrecacheResource('particle', 'particles/units/heroes/hero_mars/mars_shield_bash_crit.vpcf', context);  // 原版 Mars
        PrecacheResource('particle', 'particles/units/heroes/hero_nevermore/nevermore_shadowraze.vpcf', context);
        PrecacheResource('particle', 'particles/units/heroes/hero_juggernaut/juggernaut_crit_tgt.vpcf', context);
    }
}

@registerModifier('modifier_soldier_war_strike')
export class modifier_soldier_war_strike extends BaseModifier {
    attacks_to_proc: number = 3;
    damage_pct: number = 250;
    cleave_radius: number = 400;
    cleave_angle: number = 120; // 假设扇形角度

    OnCreated(params: any): void {
        const ability = this.GetAbility();
        if (ability) {
            const proc = ability.GetSpecialValueFor('attacks_to_proc');
            this.attacks_to_proc = proc && proc > 0 ? proc : 4;

            const dmg = ability.GetSpecialValueFor('damage_pct');
            this.damage_pct = dmg && dmg > 0 ? dmg : 250;

            const rad = ability.GetSpecialValueFor('cleave_radius');
            this.cleave_radius = rad && rad > 0 ? rad : 400;

            const ang = ability.GetSpecialValueFor('cleave_angle');
            this.cleave_angle = ang && ang > 0 ? ang : 120;
        }
        if (IsServer()) {
            this.SetStackCount(0);
        }
    }

    DeclareFunctions(): ModifierFunction[] {
        return [ModifierFunction.ON_ATTACK_LANDED, ModifierFunction.PREATTACK_CRITICALSTRIKE, ModifierFunction.TOOLTIP];
    }

    // 只有在有层数时才显示buff图标
    IsHidden(): boolean {
        return this.GetStackCount() === 0;
    }

    // 返回Buff的图标贴图
    GetTexture(): string {
        return "soldier_war_strike";
    }

    IsPurgable(): boolean {
        return false;
    }

    RemoveOnDeath(): boolean {
        return false;
    }

    // Tooltip显示当前攻击计数 (1-4)
    OnTooltip(): number {
        return this.GetStackCount() + 1;
    }

    // 预攻击暴击判定 (仅用于暴击红字显示，逻辑在Landed处理)
    GetModifierPreAttack_CriticalStrike(event: ModifierAttackEvent): number {
        if (!IsServer()) return 0;
        // logic: if stack is 3, next hit (this one) is 4th, so it crits.
        if (this.GetStackCount() >= this.attacks_to_proc - 1) {
            return this.damage_pct;
        }
        return 0;
    }

    OnAttackLanded(event: ModifierAttackEvent): void {
        if (!IsServer()) return;
        if (event.attacker !== this.GetParent()) return;
        if (event.target.IsBuilding() || event.target.IsOther()) return;

        const currentStacks = this.GetStackCount();

        // 第3刀暴击逻辑:
        // 初始: Stack 0 (隐藏图标)
        // 第1刀: Stack 0 -> 1 (显示"1")
        // 第2刀: Stack 1 -> 2 (显示"2")
        // 第3刀: Stack 2 -> 触发暴击 -> Reset to 0 (隐藏图标)

        if (currentStacks >= this.attacks_to_proc - 1) {
            this.TriggerWarStrike(event.target);
            this.SetStackCount(0);
        } else {
            this.SetStackCount(currentStacks + 1);
        }
    }

    TriggerWarStrike(mainTarget: CDOTA_BaseNPC) {
        const ability = this.GetAbility();

        const r = ability?.GetSpecialValueFor('cleave_radius');
        const a = ability?.GetSpecialValueFor('cleave_angle');
        const d = ability?.GetSpecialValueFor('damage_pct');

        this.cleave_radius = r && r > 0 ? r : 400;
        this.cleave_angle = a && a > 0 ? a : 120;
        this.damage_pct = d && d > 0 ? d : 250;

        const caster = this.GetParent();
        const origin = caster.GetAbsOrigin();

        // 1. 获取基础信息
        // caster/origin defined above at lines 111-112
        const forward = caster.GetForwardVector();
        const forward2D = Vector(forward.x, forward.y, 0).Normalized();

        // 2. [修正] 距离改为 100 (贴脸释放)
        const distance = 100;

        // 3. 计算 CP1 位置 (扇形中心点)
        const targetPos = Vector(
            origin.x + forward.x * distance,
            origin.y + forward.y * distance,
            origin.z + 60 // 抬高高度
        ) as Vector;

        // 4. 创建特效 (自定义扇形斩击)
        const pIndex = ParticleManager.CreateParticle(
            'particles/mars_shield_bash_crit_strike_text.vpcf',
            ParticleAttachment.ABSORIGIN_FOLLOW,
            caster
        );

        // CP 0: 英雄脚下
        ParticleManager.SetParticleControl(pIndex, 0, origin);

        // CP 1: 扇形位置
        ParticleManager.SetParticleControl(pIndex, 1, targetPos);

        // CP 2: 你要求的参数 (5, 0, 0)
        ParticleManager.SetParticleControl(pIndex, 2, Vector(5, 0, 0));

        // [关键一步!] 强制设置特效的“正前方”为英雄的“正前方”
        // 这能解决扇形“反向/内凹”的问题
        ParticleManager.SetParticleControlForward(pIndex, 0, forward);
        ParticleManager.SetParticleControlForward(pIndex, 1, forward);

        ParticleManager.ReleaseParticleIndex(pIndex);

        // 2. Particle: Explosion - REMOVED
        // User felt SF Raze was "too obvious" / distracting.
        // Focusing purely on the Tusk ring for now.
        /*
        const explosionPos = (origin + (forward2D * (this.cleave_radius / 2)) as Vector) as Vector;
        const p2 = ParticleManager.CreateParticle("particles/units/heroes/hero_nevermore/nevermore_shadowraze.vpcf", ParticleAttachment.WORLDORIGIN, undefined);
        ParticleManager.SetParticleControl(p2, 0, explosionPos);
        ParticleManager.SetParticleControl(p2, 1, Vector(100, 100, 100)); 
        ParticleManager.ReleaseParticleIndex(p2); 
        */

        // 4. AOE Damage Logic
        const enemies = FindUnitsInRadius(
            caster.GetTeamNumber(),
            origin,
            undefined,
            this.cleave_radius,
            UnitTargetTeam.ENEMY,
            UnitTargetType.HERO + UnitTargetType.BASIC,
            UnitTargetFlags.NONE,
            FindOrder.ANY,
            false
        );

        const baseDamage = caster.GetAverageTrueAttackDamage(mainTarget);
        const damage = baseDamage * (this.damage_pct / 100);

        const angleThreshold = Math.cos((this.cleave_angle / 2) * (Math.PI / 180));


        for (const enemy of enemies) {
            if (enemy !== mainTarget && enemy.IsAlive()) {
                const enemyPos = enemy.GetAbsOrigin();

                // Calculate direction to enemy (2D)
                const toEnemy = (enemyPos - origin) as Vector;
                toEnemy.z = 0;
                const toEnemyNormalized = toEnemy.Normalized();

                const dot = forward2D.Dot(toEnemyNormalized);

                if (dot >= angleThreshold) {
                    ApplyDamage({
                        victim: enemy,
                        attacker: caster,
                        damage: damage,
                        damage_type: DamageTypes.PHYSICAL,
                        ability: ability,
                    });
                    // Hit Particle
                    const pHit = ParticleManager.CreateParticle(
                        'particles/units/heroes/hero_juggernaut/juggernaut_crit_tgt.vpcf',
                        ParticleAttachment.ABSORIGIN_FOLLOW,
                        enemy
                    );
                    ParticleManager.ReleaseParticleIndex(pHit);
                }
            }
        }
    }
}
