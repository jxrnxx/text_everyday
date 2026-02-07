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
    constitution?: number;
    martial?: number;
    divinity?: number;
    agility?: number;
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

        // 升级蒙尘神器 (Tier 0 -> Tier 1)
        CustomGameEventManager.RegisterListener('cmd_upgrade_artifact', (_, event: any) => {
            this.UpgradeDormantArtifact(event.PlayerID, event.slot);
        });

        print('[ArtifactSystem] 事件监听器已注册');
    }

    /**
     * 初始化玩家神器数据
     */
    public InitPlayerArtifacts(playerId: PlayerID): void {
        if (!this.playerArtifacts.has(playerId)) {
            // Tier 0 蒙尘神器默认装备
            const tier0Items: { itemName: string; displayName: string }[] = [
                { itemName: 'item_artifact_weapon_t0', displayName: '蒙尘武器' },
                { itemName: 'item_artifact_armor_t0', displayName: '蒙尘衣甲' },
                { itemName: 'item_artifact_helm_t0', displayName: '蒙尘头冠' },
                { itemName: 'item_artifact_accessory_t0', displayName: '蒙尘饰品' },
                { itemName: 'item_artifact_boots_t0', displayName: '蒙尘靴子' },
                { itemName: 'item_artifact_amulet_t0', displayName: '蒙尘护符' },
            ];

            const slots: ArtifactSlotData[] = [];
            for (let i = 0; i < this.SLOT_COUNT; i++) {
                slots.push({
                    itemName: tier0Items[i].itemName,
                    tier: 0,
                    displayName: tier0Items[i].displayName,
                });
            }

            this.playerArtifacts.set(playerId, { slots });

            // 刷新英雄属性（应用 Tier 0 加成）
            const hero = PlayerResource.GetSelectedHeroEntity(playerId);
            if (hero) {
                this.RefreshHeroModifier(hero);
            }

            this.SyncToClient(playerId);
            print(`[ArtifactSystem] 玩家 ${playerId} 神器数据已初始化 (装备6件蒙尘神器)`);
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
     * 升级蒙尘神器 (Tier 0 -> Tier 1)
     */
    public UpgradeDormantArtifact(playerId: PlayerID, slotIndex: number): boolean {
        const artifacts = this.playerArtifacts.get(playerId);
        if (!artifacts) {
            print(`[ArtifactSystem] 玩家 ${playerId} 没有神器数据`);
            return false;
        }

        if (slotIndex < 0 || slotIndex >= this.SLOT_COUNT) {
            print(`[ArtifactSystem] 无效槽位: ${slotIndex}`);
            return false;
        }

        const currentSlot = artifacts.slots[slotIndex];
        if (!currentSlot.itemName || currentSlot.tier !== 0) {
            print(`[ArtifactSystem] 槽位 ${slotIndex} 不是蒙尘神器`);
            return false;
        }

        // 根据槽位确定 Tier 1 物品名称
        const slotToT1Item: Record<number, string> = {
            0: 'item_artifact_weapon_tier1',
            1: 'item_artifact_armor_tier1',
            2: 'item_artifact_helm_tier1',
            3: 'item_artifact_accessory_tier1',
            4: 'item_artifact_boots_tier1',
            5: 'item_artifact_amulet_tier1',
        };

        const t1ItemName = slotToT1Item[slotIndex];
        if (!t1ItemName) {
            print(`[ArtifactSystem] 无法找到槽位 ${slotIndex} 的 Tier 1 物品`);
            return false;
        }

        // 获取 Tier 1 物品信息
        const t1Info = this.GetArtifactInfo(t1ItemName);
        if (!t1Info) {
            print(`[ArtifactSystem] 无法获取 ${t1ItemName} 的信息`);
            return false;
        }

        // KV 使用纯 ASCII 名，在此映射中文显示名
        const chineseDisplayNames: Record<string, string> = {
            item_artifact_weapon_tier1: '凡铁剑',
            item_artifact_armor_tier1: '凡铁甲',
            item_artifact_helm_tier1: '凡铁冠',
            item_artifact_accessory_tier1: '凡铁戒',
            item_artifact_boots_tier1: '凡铁靴',
            item_artifact_amulet_tier1: '凡铁令',
            item_artifact_weapon_t2: '精钢剑',
            item_artifact_armor_t2: '精钢甲',
            item_artifact_helm_t2: '精钢冠',
            item_artifact_accessory_t2: '精钢戒',
            item_artifact_boots_t2: '精钢靴',
            item_artifact_amulet_t2: '精钢令',
        };
        const displayName = chineseDisplayNames[t1ItemName] || t1Info.displayName;

        // 升级到 Tier 1
        artifacts.slots[slotIndex] = {
            itemName: t1ItemName,
            tier: t1Info.tier,
            displayName: displayName,
        };
        print(
            `[ArtifactSystem] 槽位 ${slotIndex} 升级后 tier=${artifacts.slots[slotIndex].tier}, displayName=${artifacts.slots[slotIndex].displayName}`
        );

        // 播放音效和特效
        const hero = PlayerResource.GetSelectedHeroEntity(playerId);
        if (hero) {
            // 播放自定义破碎音效
            EmitSoundOn('Artifact.Awaken', hero);

            // 创建主特效 - 升级光柱
            const particleMain = ParticleManager.CreateParticle(
                'particles/generic_hero_status/hero_levelup.vpcf',
                ParticleAttachment.ABSORIGIN_FOLLOW,
                hero
            );
            ParticleManager.ReleaseParticleIndex(particleMain);

            // 创建辅助特效 - 物品获得光芒
            const particleGlow = ParticleManager.CreateParticle(
                'particles/generic_gameplay/rune_doubledamage_owner.vpcf',
                ParticleAttachment.ABSORIGIN_FOLLOW,
                hero
            );
            // 1.5秒后销毁辅助特效
            Timers.CreateTimer(1.5, () => {
                ParticleManager.DestroyParticle(particleGlow, false);
                ParticleManager.ReleaseParticleIndex(particleGlow);
            });

            // 刷新属性
            this.RefreshHeroModifier(hero);
        }

        this.SyncToClient(playerId);
        print(`[ArtifactSystem] 玩家 ${playerId} 升级了 ${currentSlot.displayName} -> ${t1Info.displayName}`);
        return true;
    }

    /**
     * [Debug] 升级所有神器到下一阶 (通用: T0→T1→T2→...)
     * 返回成功升级的槽位数量
     */
    public UpgradeAllArtifacts(playerId: PlayerID): number {
        const artifacts = this.playerArtifacts.get(playerId);
        if (!artifacts) {
            print(`[ArtifactSystem] 玩家 ${playerId} 没有神器数据`);
            return 0;
        }

        // 槽位类型名称
        const slotTypes = ['weapon', 'armor', 'helm', 'accessory', 'boots', 'amulet'];

        // 每个 tier 的物品名后缀 (适配不一致的命名: _t0, _tier1, _t2, _t3, _t4)
        const tierSuffixes: Record<number, string> = {
            0: '_t0',
            1: '_tier1',
            2: '_t2',
            3: '_t3',
            4: '_t4',
        };

        // 中文显示名
        const tierDisplayNames: Record<string, Record<number, string>> = {
            weapon: { 0: '蒙尘武器', 1: '凡铁剑', 2: '精钢剑', 3: '玄玉剑', 4: '天罡剑' },
            armor: { 0: '蒙尘衣甲', 1: '凡铁甲', 2: '精钢甲', 3: '玄玉甲', 4: '天罡甲' },
            helm: { 0: '蒙尘头冠', 1: '凡铁冠', 2: '精钢冠', 3: '玄玉冠', 4: '天罡冠' },
            accessory: { 0: '蒙尘饰品', 1: '凡铁戒', 2: '精钢戒', 3: '玄玉戒', 4: '天罡戒' },
            boots: { 0: '蒙尘靴子', 1: '凡铁靴', 2: '精钢靴', 3: '玄玉靴', 4: '天罡靴' },
            amulet: { 0: '蒙尘护符', 1: '凡铁令', 2: '精钢令', 3: '玄玉令', 4: '天罡令' },
        };

        const MAX_TIER = 4;
        let upgraded = 0;

        for (let slot = 0; slot < this.SLOT_COUNT; slot++) {
            const current = artifacts.slots[slot];
            if (!current.itemName) continue;

            const nextTier = current.tier + 1;
            if (nextTier > MAX_TIER) {
                print(`[ArtifactSystem] 槽位 ${slot} 已达最高阶 (T${current.tier})`);
                continue;
            }

            const slotType = slotTypes[slot];
            const nextSuffix = tierSuffixes[nextTier];
            const nextItemName = `item_artifact_${slotType}${nextSuffix}`;

            // 尝试获取 KV 信息 (如果 KV 中不存在该物品，仍然升级但用默认值)
            const nextInfo = this.GetArtifactInfo(nextItemName);
            const displayName =
                tierDisplayNames[slotType]?.[nextTier] || nextInfo?.displayName || `T${nextTier} ${slotType}`;

            artifacts.slots[slot] = {
                itemName: nextItemName,
                tier: nextTier,
                displayName: displayName,
            };

            print(
                `[ArtifactSystem] 槽位 ${slot} 升级: ${current.displayName} (T${current.tier}) -> ${displayName} (T${nextTier})`
            );
            upgraded++;
        }

        if (upgraded > 0) {
            const hero = PlayerResource.GetSelectedHeroEntity(playerId);
            if (hero) {
                // 播放音效
                EmitSoundOn('Artifact.Awaken', hero);

                // 升级光柱特效
                const particleMain = ParticleManager.CreateParticle(
                    'particles/generic_hero_status/hero_levelup.vpcf',
                    ParticleAttachment.ABSORIGIN_FOLLOW,
                    hero
                );
                ParticleManager.ReleaseParticleIndex(particleMain);

                // 辅助光芒特效
                const particleGlow = ParticleManager.CreateParticle(
                    'particles/generic_gameplay/rune_doubledamage_owner.vpcf',
                    ParticleAttachment.ABSORIGIN_FOLLOW,
                    hero
                );
                Timers.CreateTimer(1.5, () => {
                    ParticleManager.DestroyParticle(particleGlow, false);
                    ParticleManager.ReleaseParticleIndex(particleGlow);
                });

                // 刷新属性
                this.RefreshHeroModifier(hero);
            }

            this.SyncToClient(playerId);
            print(`[ArtifactSystem] 玩家 ${playerId} 全部神器升级完成, 共 ${upgraded} 个槽位`);
        }

        return upgraded;
    }

    /**
     * 获取玩家神器数据
     */
    public GetPlayerArtifacts(playerId: PlayerID): PlayerArtifacts | null {
        return this.playerArtifacts.get(playerId) || null;
    }

    /**
     * 计算玩家神器总加成 (统一累加所有KV属性)
     */
    public CalculateTotalBonuses(playerId: PlayerID): ArtifactBonuses {
        const artifacts = this.playerArtifacts.get(playerId);
        const bonuses: ArtifactBonuses = {
            damage: 0,
            armorPen: 0,
            hp: 0,
            armor: 0,
            constitution: 0,
            martial: 0,
            divinity: 0,
            agility: 0,
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

            // 统一累加所有属性字段
            bonuses.damage! += info.bonusDamage || 0;
            bonuses.armorPen! += info.bonusArmorPen || 0;
            bonuses.hp! += info.bonusHP || 0;
            bonuses.armor! += info.bonusArmor || 0;
            bonuses.constitution! += info.bonusConstitution || 0;
            bonuses.martial! += info.bonusMartial || 0;
            bonuses.divinity! += info.bonusDivinity || 0;
            bonuses.agility! += info.bonusAgility || 0;
            bonuses.manaRegen! += info.bonusManaRegen || 0;
            bonuses.critChance! += info.bonusCritChance || 0;
            bonuses.critDamage! += info.bonusCritDamage || 0;
            bonuses.moveSpeed! += info.bonusMoveSpeed || 0;
            bonuses.evasion! += info.bonusEvasion || 0;
            bonuses.allStats! += info.bonusAllStats || 0;
            bonuses.finalDmgReduct! += info.bonusFinalDmgReduct || 0;
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
        bonusConstitution?: number;
        bonusDivinity?: number;
        bonusMartial?: number;
        bonusManaRegen?: number;
        bonusCritChance?: number;
        bonusCritDamage?: number;
        bonusMoveSpeed?: number;
        bonusAgility?: number;
        bonusEvasion?: number;
        bonusAllStats?: number;
        bonusFinalDmgReduct?: number;
    } | null {
        // 物品也使用 GetAbilityKeyValuesByName
        const kv = GetAbilityKeyValuesByName(itemName) as any;
        if (!kv) {
            print(`[ArtifactSystem] GetAbilityKeyValuesByName 返回null: ${itemName}`);
            return null;
        }

        return {
            slot: Number(kv.ArtifactSlot) || 0,
            tier: Number(kv.ArtifactTier) || 1,
            displayName: kv.ArtifactName || itemName,
            bonusDamage: Number(kv.BonusDamage) || 0,
            bonusArmorPen: Number(kv.BonusArmorPen) || 0,
            bonusHP: Number(kv.BonusHP) || 0,
            bonusArmor: Number(kv.BonusArmor) || 0,
            bonusConstitution: Number(kv.BonusConstitution) || 0,
            bonusDivinity: Number(kv.BonusDivinity) || 0,
            bonusMartial: Number(kv.BonusMartial) || 0,
            bonusManaRegen: Number(kv.BonusManaRegen) || 0,
            bonusCritChance: Number(kv.BonusCritChance) || 0,
            bonusCritDamage: Number(kv.BonusCritDamage) || 0,
            bonusMoveSpeed: Number(kv.BonusMoveSpeed) || 0,
            bonusAgility: Number(kv.BonusAgility) || 0,
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
