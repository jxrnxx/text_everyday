import { BaseItem, registerAbility } from '../utils/dota_ts_adapter';
import { CustomStats } from '../systems/CustomStats';

@registerAbility('item_buy_constitution')
export class item_buy_constitution extends BaseItem {
    OnSpellStart(): void {
        const caster = this.GetCaster();
        if (caster.IsRealHero()) {
            CustomStats.AddStat(caster, 'constitution', 10);
            caster.EmitSound('Item.TomeOfKnowledge');
            this.SpendCharge(1); // Auto-destroys if charges == 0
        }
    }
}

@registerAbility('item_buy_martial')
export class item_buy_martial extends BaseItem {
    OnSpellStart(): void {
        const caster = this.GetCaster();
        if (caster.IsRealHero()) {
            CustomStats.AddStat(caster, 'martial', 10);
            caster.EmitSound('Item.TomeOfKnowledge');
            this.SpendCharge(1);
        }
    }
}

@registerAbility('item_buy_divinity')
export class item_buy_divinity extends BaseItem {
    OnSpellStart(): void {
        const caster = this.GetCaster();
        if (caster.IsRealHero()) {
            CustomStats.AddStat(caster, 'divinity', 10);
            caster.EmitSound('Item.TomeOfKnowledge');
            this.SpendCharge(1);
        }
    }
}
