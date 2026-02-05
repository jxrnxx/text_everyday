/**
 * 神器系统 - 管理玩家装备的绑定神器
 *
 * 6 个槽位:
 * - Slot 0: 武器 (Zone 1)
 * - Slot 1: 护甲 (Zone 2)
 * - Slot 2: 头盔 (Zone 3)
 * - Slot 3: 饰品 (Zone 4)
 * - Slot 4: 鞋子 (Zone 5)
 * - Slot 5: 护符 (Zone 6)
 */

interface ArtifactSlotData {
    itemName: string | null; // 装备的神器物品名
    tier: number; // 1-5 阶
    displayName: string; // 显示名称 (凡铁剑, 精钢剑, etc.)
}

interface PlayerArtifacts {
    slots: ArtifactSlotData[]; // 6 个槽位
}

// 神器属性配置
interface ArtifactBonuses {
    damage?: number;
    armorPen?: number;
    hp?: number;
    armor?: number;
    divinity?: number;
    manaRegen?: number;
    critChance?: number;
    critDamage?: number;
    moveSpeed?: number;
    evasion?: number;
    allStats?: number;
    finalDmgReduct?: number;
}

export class ArtifactSystem {
    private static instance: ArtifactSystem;
    private playerArtifacts: Map<PlayerID, PlayerArtifacts> = new Map();

    private readonly SLOT_COUNT = 6;

    private constructor() {
        this.RegisterEventListeners();
    }

    public static GetInstance(): ArtifactSystem {
        if (!ArtifactSystem.instance) {
            ArtifactSystem.instance = new ArtifactSystem();
        }
        return ArtifactSystem.instance;
    }

    /**
     * 注册事件监听器
     */
    private RegisterEventListeners(): void {
        // 装备神器
        CustomGameEventManager.RegisterListener('artifact_equip', (_, event: any) => {
            this.EquipArtifact(event.PlayerID, event.slot, event.itemName);
        });

        // 卸下神器
        CustomGameEventManager.RegisterListener('artifact_unequip', (_, event: any) => {
            this.UnequipArtifact(event.PlayerID, event.slot);
        });

        print('[ArtifactSystem] 事件监听器已注册');
    }

    /**
     * 初始化玩家神器数据
     */
    public InitPlayerArtifacts(playerId: PlayerID): void {
        if (!this.playerArtifacts.has(playerId)) {
            const slots: ArtifactSlotData[] = [];
            for (let i = 0; i < this.SLOT_COUNT; i++) {
                slots.push({
                    itemName: null,
                    tier: 0,
                    displayName: '',
                });
            }

            this.playerArtifacts.set(playerId, { slots });
            this.SyncToClient(playerId);
            print(`[ArtifactSystem] 玩家 ${playerId} 神器数据已初始化`);
        }
    }

    /**
     * 装备神器
     */
    public EquipArtifact(playerId: PlayerID, slotIndex: number, itemName: string): boolean {
        let artifacts = this.playerArtifacts.get(playerId);
        if (!artifacts) {
            this.InitPlayerArtifacts(playerId);
            artifacts = this.playerArtifacts.get(playerId)!;
        }

        if (slotIndex < 0 || slotIndex >= this.SLOT_COUNT) {
            print(`[ArtifactSystem] 无效槽位: ${slotIndex}`);
            return false;
        }

        // 从 KV 获取神器信息
        const artifactInfo = this.GetArtifactInfo(itemName);
        if (!artifactInfo) {
            print(`[ArtifactSystem] 未知神器: ${itemName}`);
            return false;
        }

        // 检查槽位是否匹配
        if (artifactInfo.slot !== slotIndex) {
            print(`[ArtifactSystem] 神器 ${itemName} 不属于槽位 ${slotIndex}`);
            return false;
        }

        // 装备神器
        artifacts.slots[slotIndex] = {
            itemName: itemName,
            tier: artifactInfo.tier,
            displayName: artifactInfo.displayName,
        };

        // 刷新英雄属性
        const hero = PlayerResource.GetSelectedHeroEntity(playerId);
        if (hero) {
            this.RefreshHeroModifier(hero);
        }

        this.SyncToClient(playerId);
        print(`[ArtifactSystem] 玩家 ${playerId} 装备了 ${artifactInfo.displayName} (槽位${slotIndex})`);
        return true;
    }

    /**
     * 卸下神器
     */
    public UnequipArtifact(playerId: PlayerID, slotIndex: number): ArtifactSlotData | null {
        const artifacts = this.playerArtifacts.get(playerId);
        if (!artifacts) return null;

        if (slotIndex < 0 || slotIndex >= this.SLOT_COUNT) return null;

        const oldSlot = artifacts.slots[slotIndex];
        artifacts.slots[slotIndex] = {
            itemName: null,
            tier: 0,
            displayName: '',
        };

        // 刷新英雄属性
        const hero = PlayerResource.GetSelectedHeroEntity(playerId);
        if (hero) {
            this.RefreshHeroModifier(hero);
        }

        this.SyncToClient(playerId);
        return oldSlot;
    }

    /**
     * 获取玩家神器数据
     */
    public GetPlayerArtifacts(playerId: PlayerID): PlayerArtifacts | null {
        return this.playerArtifacts.get(playerId) || null;
    }

    /**
     * 计算玩家神器总加成
     */
    public CalculateTotalBonuses(playerId: PlayerID): ArtifactBonuses {
        const artifacts = this.playerArtifacts.get(playerId);
        const bonuses: ArtifactBonuses = {
            damage: 0,
            armorPen: 0,
            hp: 0,
            armor: 0,
            divinity: 0,
            manaRegen: 0,
            critChance: 0,
            critDamage: 0,
            moveSpeed: 0,
            evasion: 0,
            allStats: 0,
            finalDmgReduct: 0,
        };

        if (!artifacts) return bonuses;

        for (const slot of artifacts.slots) {
            if (!slot.itemName) continue;

            const info = this.GetArtifactInfo(slot.itemName);
            if (!info) continue;

            // 根据槽位累加不同属性
            switch (info.slot) {
                case 0: // 武器
                    bonuses.damage! += info.bonusDamage || 0;
                    bonuses.armorPen! += info.bonusArmorPen || 0;
                    break;
                case 1: // 护甲
                    bonuses.hp! += info.bonusHP || 0;
                    bonuses.armor! += info.bonusArmor || 0;
                    break;
                case 2: // 头盔
                    bonuses.divinity! += info.bonusDivinity || 0;
                    bonuses.manaRegen! += info.bonusManaRegen || 0;
                    break;
                case 3: // 饰品
                    bonuses.critChance! += info.bonusCritChance || 0;
                    bonuses.critDamage! += info.bonusCritDamage || 0;
                    break;
                case 4: // 鞋子
                    bonuses.moveSpeed! += info.bonusMoveSpeed || 0;
                    bonuses.evasion! += info.bonusEvasion || 0;
                    break;
                case 5: // 护符
                    bonuses.allStats! += info.bonusAllStats || 0;
                    bonuses.finalDmgReduct! += info.bonusFinalDmgReduct || 0;
                    break;
            }
        }

        return bonuses;
    }

    /**
     * 从 KV 获取神器信息
     */
    private GetArtifactInfo(itemName: string): {
        slot: number;
        tier: number;
        displayName: string;
        bonusDamage?: number;
        bonusArmorPen?: number;
        bonusHP?: number;
        bonusArmor?: number;
        bonusDivinity?: number;
        bonusManaRegen?: number;
        bonusCritChance?: number;
        bonusCritDamage?: number;
        bonusMoveSpeed?: number;
        bonusEvasion?: number;
        bonusAllStats?: number;
        bonusFinalDmgReduct?: number;
    } | null {
        const kv = GetAbilityKeyValuesByName(itemName) as any;
        if (!kv) return null;

        return {
            slot: Number(kv.ArtifactSlot) || 0,
            tier: Number(kv.ArtifactTier) || 1,
            displayName: kv.ArtifactName || itemName,
            bonusDamage: Number(kv.BonusDamage) || 0,
            bonusArmorPen: Number(kv.BonusArmorPen) || 0,
            bonusHP: Number(kv.BonusHP) || 0,
            bonusArmor: Number(kv.BonusArmor) || 0,
            bonusDivinity: Number(kv.BonusDivinity) || 0,
            bonusManaRegen: Number(kv.BonusManaRegen) || 0,
            bonusCritChance: Number(kv.BonusCritChance) || 0,
            bonusCritDamage: Number(kv.BonusCritDamage) || 0,
            bonusMoveSpeed: Number(kv.BonusMoveSpeed) || 0,
            bonusEvasion: Number(kv.BonusEvasion) || 0,
            bonusAllStats: Number(kv.BonusAllStats) || 0,
            bonusFinalDmgReduct: Number(kv.BonusFinalDmgReduct) || 0,
        };
    }

    /**
     * 刷新英雄的神器修饰器
     */
    private RefreshHeroModifier(hero: CDOTA_BaseNPC_Hero): void {
        // 移除旧的修饰器
        hero.RemoveModifierByName('modifier_artifact_bonus');

        // 添加新的修饰器
        hero.AddNewModifier(hero, undefined, 'modifier_artifact_bonus', {});
    }

    /**
     * 同步数据到客户端 NetTable
     */
    private SyncToClient(playerId: PlayerID): void {
        const artifacts = this.playerArtifacts.get(playerId);
        if (!artifacts) return;

        // 转换为 NetTable 格式
        const netTableData: any = {};
        for (let i = 0; i < this.SLOT_COUNT; i++) {
            netTableData[`slot_${i}`] = {
                itemName: artifacts.slots[i].itemName || '',
                tier: artifacts.slots[i].tier,
                displayName: artifacts.slots[i].displayName,
            };
        }

        CustomNetTables.SetTableValue('artifacts' as any, `player_${playerId}`, netTableData);
    }
}
