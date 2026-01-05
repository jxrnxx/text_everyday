import { BaseAbility, BaseModifier, registerAbility, registerModifier } from "../utils/dota_ts_adapter";


@registerAbility("soldier_war_strike")
export class soldier_war_strike extends BaseAbility {
    GetIntro() {
        return "每攻击2次，第3次攻击造成AOE暴击。";
    }

    GetIntrinsicModifierName() {
        return "modifier_soldier_war_strike";
    }

    Precache(context: CScriptPrecacheContext) {
        PrecacheResource("particle", "particles/econ/items/tuskarr/ti9_tusk_jungle_arms/ti9_tusk_arms_ambient_gem_glow.vpcf", context);
        PrecacheResource("particle", "particles/units/heroes/hero_nevermore/nevermore_shadowraze.vpcf", context);
        PrecacheResource("particle", "particles/units/heroes/hero_juggernaut/juggernaut_crit_tgt.vpcf", context);
    }
}

@registerModifier("modifier_soldier_war_strike")
export class modifier_soldier_war_strike extends BaseModifier {
    attacks_to_proc: number = 3;
    damage_pct: number = 250;
    cleave_radius: number = 400;
    cleave_angle: number = 120; // 假设扇形角度

    OnCreated(params: any): void {
        const ability = this.GetAbility();
        if (ability) {
            const proc = ability.GetSpecialValueFor("attacks_to_proc");
            this.attacks_to_proc = (proc && proc > 0) ? proc : 3;
            
            const dmg = ability.GetSpecialValueFor("damage_pct");
            this.damage_pct = (dmg && dmg > 0) ? dmg : 250;
            
            const rad = ability.GetSpecialValueFor("cleave_radius");
            this.cleave_radius = (rad && rad > 0) ? rad : 400;
            
            const ang = ability.GetSpecialValueFor("cleave_angle");
            this.cleave_angle = (ang && ang > 0) ? ang : 120;
        }
        if (IsServer()) {
            this.SetStackCount(0);
        }
    }

    DeclareFunctions(): ModifierFunction[] {
        return [
            ModifierFunction.ON_ATTACK_LANDED,
            ModifierFunction.PREATTACK_CRITICALSTRIKE, 
        ];
    }

    IsHidden(): boolean {
        return false;
    }

    IsPurgable(): boolean {
        return false;
    }

    RemoveOnDeath(): boolean {
        return false;
    }

    // 预攻击暴击判定 (仅用于暴击红字显示，逻辑在Landed处理)
    GetModifierPreAttack_CriticalStrike(event: ModifierAttackEvent): number {
        if (!IsServer()) return 0;
        // logic: if stack is 2, next hit (this one) is 3rd, so it crits.
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
        
        // Target: Trigger on 3rd hit.
        // Stacks start at 0.
        // Hit 1: Stacks 0 -> 1
        // Hit 2: Stacks 1 -> 2
        // Hit 3: Stacks 2 -> Trigger -> Reset 0
        
        if (currentStacks >= this.attacks_to_proc - 1) {
            this.TriggerWarStrike(event.target);
            this.SetStackCount(0);
        } else {
            this.SetStackCount(currentStacks + 1);
            // print(`[WarStrike] Stack increased to: ${this.GetStackCount()}`);
        }
    }


    TriggerWarStrike(mainTarget: CDOTA_BaseNPC) {
        const ability = this.GetAbility();
        
        const r = ability?.GetSpecialValueFor("cleave_radius");
        const a = ability?.GetSpecialValueFor("cleave_angle");
        const d = ability?.GetSpecialValueFor("damage_pct");

        this.cleave_radius = (r && r > 0) ? r : 400;
        this.cleave_angle = (a && a > 0) ? a : 120;
        this.damage_pct = (d && d > 0) ? d : 250;

        const caster = this.GetParent();
        const origin = caster.GetAbsOrigin();
        
        // Calculate Forward Direction (2D)
        const forward = caster.GetForwardVector();
        forward.z = 0; 
        const forward2D = forward.Normalized();

        // 1. Particle: Tusk Gem Glow (Ambient)
        // Position: In front of the caster (replacing the fan).
        const p1 = ParticleManager.CreateParticle("particles/econ/items/tuskarr/ti9_tusk_jungle_arms/ti9_tusk_arms_ambient_gem_glow.vpcf", ParticleAttachment.CUSTOMORIGIN, caster);
        
        // Offset: 200 units in front + 50 units Z (Chest/Head height)
        const frontPos = (origin + (forward2D * 200) as Vector + Vector(0,0,50)) as Vector;
        ParticleManager.SetParticleControl(p1, 0, frontPos);
        
        // Duration: Increased to 2.5s so user can clearly see it.
        Timers.CreateTimer(2.5, () => {
             ParticleManager.DestroyParticle(p1, false);
             ParticleManager.ReleaseParticleIndex(p1);
        });

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
        // print(`[WarStrike] Damage Calc: Base ${baseDamage} * ${this.damage_pct}% = ${damage}`);

        const angleThreshold = Math.cos((this.cleave_angle / 2) * (Math.PI / 180));

        // print(`[WarStrike] Radius: ${this.cleave_radius}, DegAngle: ${this.cleave_angle}, Threshold: ${angleThreshold.toFixed(3)}`);

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
                    const pHit = ParticleManager.CreateParticle("particles/units/heroes/hero_juggernaut/juggernaut_crit_tgt.vpcf", ParticleAttachment.ABSORIGIN_FOLLOW, enemy);
                    ParticleManager.ReleaseParticleIndex(pHit);
                }
            }
        }
    }
}
