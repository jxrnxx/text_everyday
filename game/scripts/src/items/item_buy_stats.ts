import { BaseItem, registerAbility } from '../utils/dota_ts_adapter';
import { CustomStats } from '../systems/CustomStats';

// 根骨 +5 → +250 HP, +2.5 HP/秒
@registerAbility('item_buy_constitution')
export class item_buy_constitution extends BaseItem {
    OnSpellStart(): void {
        const caster = this.GetCaster();
        if (caster.IsRealHero()) {
            CustomStats.AddStat(caster, 'constitution', 5);
            caster.EmitSound('Item.TomeOfKnowledge');
            this.SpendCharge(1);
        }
    }
}

// 武道 +5 → +10 攻击力
@registerAbility('item_buy_martial')
export class item_buy_martial extends BaseItem {
    OnSpellStart(): void {
        const caster = this.GetCaster();
        if (caster.IsRealHero()) {
            CustomStats.AddStat(caster, 'martial', 5);
            caster.EmitSound('Item.TomeOfKnowledge');
            this.SpendCharge(1);
        }
    }
}

// 神念 +5 → +10 攻击力(法系)
@registerAbility('item_buy_divinity')
export class item_buy_divinity extends BaseItem {
    OnSpellStart(): void {
        const caster = this.GetCaster();
        if (caster.IsRealHero()) {
            CustomStats.AddStat(caster, 'divinity', 5);
            caster.EmitSound('Item.TomeOfKnowledge');
            this.SpendCharge(1);
        }
    }
}

// 攻速 +5
@registerAbility('item_buy_attack_speed')
export class item_buy_attack_speed extends BaseItem {
    OnSpellStart(): void {
        const caster = this.GetCaster();
        if (caster.IsRealHero()) {
            CustomStats.AddStat(caster, 'purchased_attack_speed', 5);
            caster.EmitSound('Item.TomeOfKnowledge');
            this.SpendCharge(1);
        }
    }
}

// 内息 +2 法力回复/秒
@registerAbility('item_buy_mana_regen')
export class item_buy_mana_regen extends BaseItem {
    OnSpellStart(): void {
        const caster = this.GetCaster();
        if (caster.IsRealHero()) {
            CustomStats.AddStat(caster, 'purchased_mana_regen', 2);
            caster.EmitSound('Item.TomeOfKnowledge');
            this.SpendCharge(1);
        }
    }
}

// 护甲 +2
@registerAbility('item_buy_armor')
export class item_buy_armor extends BaseItem {
    OnSpellStart(): void {
        const caster = this.GetCaster();
        if (caster.IsRealHero()) {
            CustomStats.AddStat(caster, 'purchased_armor', 2);
            caster.EmitSound('Item.TomeOfKnowledge');
            this.SpendCharge(1);
        }
    }
}

// 法力 +20 最大法力
@registerAbility('item_buy_max_mana')
export class item_buy_max_mana extends BaseItem {
    OnSpellStart(): void {
        const caster = this.GetCaster();
        if (caster.IsRealHero()) {
            CustomStats.AddStat(caster, 'purchased_max_mana', 20);
            caster.EmitSound('Item.TomeOfKnowledge');
            this.SpendCharge(1);
        }
    }
}

// 吸血 +2%
@registerAbility('item_buy_lifesteal')
export class item_buy_lifesteal extends BaseItem {
    OnSpellStart(): void {
        const caster = this.GetCaster();
        if (caster.IsRealHero()) {
            CustomStats.AddStat(caster, 'lifesteal', 2);
            caster.EmitSound('Item.TomeOfKnowledge');
            this.SpendCharge(1);
        }
    }
}
