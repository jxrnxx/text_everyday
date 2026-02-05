import { BaseItem, registerAbility } from '../utils/dota_ts_adapter';
import { ArtifactSystem } from '../systems/ArtifactSystem';

/**
 * 神器物品脚本
 * 用于处理神器物品的使用逻辑
 */
@registerAbility('item_artifact')
export class item_artifact extends BaseItem {
    OnSpellStart(): void {
        const caster = this.GetCaster();
        if (!caster || !caster.IsRealHero()) return;

        const playerId = caster.GetPlayerOwnerID();
        const itemName = this.GetAbilityName();

        // 从 KV 获取槽位信息
        const kv = GetAbilityKeyValuesByName(itemName) as any;
        if (!kv) {
            print(`[item_artifact] 无法获取物品 KV: ${itemName}`);
            return;
        }

        const slotIndex = Number(kv.ArtifactSlot) || 0;
        const displayName = kv.ArtifactName || itemName;

        // 装备神器
        const artifactSystem = ArtifactSystem.GetInstance();
        const success = artifactSystem.EquipArtifact(playerId, slotIndex, itemName);

        if (success) {
            // 播放装备音效
            EmitSoundOn('Item.PickUpGemShop', caster);

            // 通知客户端
            const player = PlayerResource.GetPlayer(playerId);
            if (player) {
                CustomGameEventManager.Send_ServerToPlayer(player, 'custom_toast', {
                    message: `装备了 ${displayName}`,
                    duration: 2,
                } as never);
            }

            // 消耗物品 (从背包中移除)
            this.SpendCharge(1);
        } else {
            // 装备失败音效
            EmitSoundOn('General.CastFail_NoMana', caster);
        }
    }
}
