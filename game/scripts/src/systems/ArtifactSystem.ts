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
    xp: number; // 当前经验值 (可超过100，显示时 clamp)
    xpRequired: number; // 升级所需经验 (固定100)
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
    spellDamage?: number;
    block?: number;
    finalDmgIncrease?: number;
}

export class ArtifactSystem {
    private static instance: ArtifactSystem;
    private playerArtifacts: Map<PlayerID, PlayerArtifacts> = new Map();

    private readonly SLOT_COUNT = 6;

    // 从 KV 加载的每阶所需经验 (tier -> xpRequired)
    private tierXPRequired: Record<number, number> = {};

    /** 获取指定阶级升级所需经验 (从 KV 读取) */
    public GetXPRequired(tier: number): number {
        return this.tierXPRequired[tier] ?? 0;
    }

    // KV 缓存: unitName -> { dropType(1-6), dropXP }
    private artifactDropCache: Record<string, { dropType: number; dropXP: number }> = {};

    private constructor() {
        this.LoadArtifactItemKVs();
        this.LoadArtifactDropKVs();
        this.RegisterEventListeners();
    }

    public static GetInstance(): ArtifactSystem {
        if (!ArtifactSystem.instance) {
            ArtifactSystem.instance = new ArtifactSystem();
        }
        return ArtifactSystem.instance;
    }

    /**
     * 从 npc_items_artifacts.txt 加载装备物品的 XPRequired
     * 按 tier 分组，取每个 tier 的 XPRequired
     */
    private LoadArtifactItemKVs(): void {
        const itemsKV = LoadKeyValues('scripts/npc/npc_items_artifacts.txt');
        if (!itemsKV || typeof itemsKV !== 'object') {
            print('[ArtifactSystem] 警告: 无法加载 npc_items_artifacts.txt');
            return;
        }

        let dotaItems = (itemsKV as any)['DOTAItems'];
        if (!dotaItems) {
            dotaItems = itemsKV;
        }

        for (const itemName in dotaItems) {
            const data = dotaItems[itemName];
            if (data && typeof data === 'object') {
                const tier = data['ArtifactTier'] ? Number(data['ArtifactTier']) : -1;
                const xpReq = data['XPRequired'] ? Number(data['XPRequired']) : 0;
                if (tier >= 0 && !(tier in this.tierXPRequired)) {
                    this.tierXPRequired[tier] = xpReq;
                }
            }
        }
        print(
            `[ArtifactSystem] 装备经验需求已加载: ${Object.keys(this.tierXPRequired)
                .map(t => `T${t}=${this.tierXPRequired[Number(t)]}`)
                .join(', ')}`
        );
    }

    /**
     * 从 KV 文件加载单位的装备经验掉落配置
     * 读取 custom_units.txt 中的 Artifact_Drop_Type 和 Artifact_Drop_XP 字段
     */
    private LoadArtifactDropKVs(): void {
        const unitsKV = LoadKeyValues('scripts/npc/custom_units.txt');
        if (!unitsKV || typeof unitsKV !== 'object') {
            print('[ArtifactSystem] 警告: 无法加载 custom_units.txt');
            return;
        }

        let dotaUnits = (unitsKV as any)['XLSXContent'];
        if (!dotaUnits) {
            dotaUnits = unitsKV;
        }

        let count = 0;
        for (const unitName in dotaUnits) {
            const data = dotaUnits[unitName];
            if (data && typeof data === 'object') {
                const dropType = data['Artifact_Drop_Type'] ? Number(data['Artifact_Drop_Type']) : 0;
                const dropXP = data['Artifact_Drop_XP'] ? Number(data['Artifact_Drop_XP']) : 0;
                if (dropType > 0 && dropXP > 0) {
                    this.artifactDropCache[unitName] = { dropType, dropXP };
                    count++;
                }
            }
        }
        print(`[ArtifactSystem] 装备经验掉落配置已加载, 共 ${count} 个单位`);
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

        // 监听击杀事件 - 处理装备经验掉落
        ListenToGameEvent('entity_killed', event => this.OnEntityKilled(event), undefined);

        print('[ArtifactSystem] 事件监听器已注册');
    }

    /**
     * 击杀事件处理 - 检查被杀单位是否掉落装备经验
     */
    private OnEntityKilled(event: EntityKilledEvent): void {
        const killedUnit = EntIndexToHScript(event.entindex_killed) as CDOTA_BaseNPC;
        const attackerUnit = EntIndexToHScript(event.entindex_attacker) as CDOTA_BaseNPC;
        if (!killedUnit || !attackerUnit) return;

        const unitName = killedUnit.GetUnitName();
        const dropInfo = this.artifactDropCache[unitName];
        if (!dropInfo) return;

        // 获取击杀者玩家ID
        let playerId: PlayerID;
        if (attackerUnit.IsRealHero()) {
            playerId = (attackerUnit as CDOTA_BaseNPC_Hero).GetPlayerID();
        } else {
            playerId = attackerUnit.GetPlayerOwnerID();
        }
        if (playerId < 0) return;

        const slotIndex = dropInfo.dropType - 1; // dropType 1-6 → slot 0-5
        const hero = attackerUnit.IsRealHero()
            ? (attackerUnit as CDOTA_BaseNPC_Hero)
            : PlayerResource.GetSelectedHeroEntity(playerId);

        // 先检查是否已经满足升阶条件 → 升阶（经验满了后下次击杀才升级）
        const artifacts = this.playerArtifacts.get(playerId);
        if (!artifacts) return;
        const slot = artifacts.slots[slotIndex];
        if (!slot || !slot.itemName) return;

        const required = this.GetXPRequired(slot.tier);
        const MAX_TIER = 5;
        if (slot.xp >= required && slot.tier < MAX_TIER) {
            print(`[ArtifactSystem] 击杀触发升阶: 槽位 ${slotIndex}, 经验 ${slot.xp}/${required}`);
            if (slot.tier === 0) {
                this.UpgradeDormantArtifact(playerId, slotIndex, hero || undefined);
            } else {
                this.UpgradeSingleArtifact(playerId, slotIndex);
            }
        }

        // 升阶后再给当前槽位加本次击杀的经验
        this.AddArtifactXP(playerId, slotIndex, dropInfo.dropXP, hero || undefined);
    }

    /**
     * 添加装备经验值
     * 只累加经验，不自动升阶（升阶需要杀特定怪物或使用指令触发）
     */
    public AddArtifactXP(
        playerId: PlayerID,
        slotIndex: number,
        xpAmount: number,
        heroOverride?: CDOTA_BaseNPC_Hero
    ): void {
        const artifacts = this.playerArtifacts.get(playerId);
        if (!artifacts) return;
        if (slotIndex < 0 || slotIndex >= this.SLOT_COUNT) return;

        const slot = artifacts.slots[slotIndex];
        if (!slot.itemName) return;

        slot.xp += xpAmount;
        const required = this.GetXPRequired(slot.tier);
        slot.xpRequired = required;
        print(`[ArtifactSystem] 槽位 ${slotIndex} 获得 ${xpAmount} 经验, 当前: ${slot.xp}/${required}`);

        if (slot.xp >= required) {
            print(`[ArtifactSystem] 槽位 ${slotIndex} 经验已满! 等待升阶触发`);
        }

        this.SyncToClient(playerId);
    }

    /**
     * 初始化玩家神器数据
     */
    public InitPlayerArtifacts(playerId: PlayerID, heroOverride?: CDOTA_BaseNPC_Hero): void {
        if (!this.playerArtifacts.has(playerId)) {
            // Tier 0 蒙尘神器默认装备
            const tier0Items: { itemName: string; displayName: string }[] = [
                { itemName: 'item_artifact_weapon_t0', displayName: '#ItemCn_item_artifact_weapon_t0' },
                { itemName: 'item_artifact_armor_t0', displayName: '#ItemCn_item_artifact_armor_t0' },
                { itemName: 'item_artifact_helm_t0', displayName: '#ItemCn_item_artifact_helm_t0' },
                {
                    itemName: 'item_artifact_accessory_t0',
                    displayName: '#ItemCn_item_artifact_accessory_t0',
                },
                { itemName: 'item_artifact_boots_t0', displayName: '#ItemCn_item_artifact_boots_t0' },
                { itemName: 'item_artifact_amulet_t0', displayName: '#ItemCn_item_artifact_amulet_t0' },
            ];

            const slots: ArtifactSlotData[] = [];
            for (let i = 0; i < this.SLOT_COUNT; i++) {
                slots.push({
                    itemName: tier0Items[i].itemName,
                    tier: 0,
                    displayName: tier0Items[i].displayName,
                    xp: 0,
                    xpRequired: this.GetXPRequired(0),
                });
            }

            this.playerArtifacts.set(playerId, { slots });

            // 刷新英雄属性（应用 Tier 0 加成）
            const hero = heroOverride || PlayerResource.GetSelectedHeroEntity(playerId);
            if (hero) {
                this.RefreshHeroModifier(hero);
            } else {
                print(`[ArtifactSystem] WARNING: 初始化时找不到英雄, playerId=${playerId}`);
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
            xp: 0,
            xpRequired: this.GetXPRequired(artifactInfo.tier),
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
            xp: 0,
            xpRequired: this.GetXPRequired(0),
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
    public UpgradeDormantArtifact(playerId: PlayerID, slotIndex: number, heroOverride?: CDOTA_BaseNPC_Hero): boolean {
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

        // 检查经验是否足够
        const required = this.GetXPRequired(currentSlot.tier);
        if (currentSlot.xp < required) {
            print(`[ArtifactSystem] 槽位 ${slotIndex} 经验不足: ${currentSlot.xp}/${required}`);
            return false;
        }
        const overflow = currentSlot.xp - required;

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

        // 使用本地化 token 作为显示名 (由 addon.csv 映射中文)
        const displayName = `#ItemCn_${t1ItemName}`;

        // 升级到 Tier 1
        artifacts.slots[slotIndex] = {
            itemName: t1ItemName,
            tier: t1Info.tier,
            displayName: displayName,
            xp: overflow,
            xpRequired: this.GetXPRequired(t1Info.tier),
        };
        print(
            `[ArtifactSystem] 槽位 ${slotIndex} 升级后 tier=${artifacts.slots[slotIndex].tier}, displayName=${artifacts.slots[slotIndex].displayName}`
        );

        // 播放音效和特效
        const hero = heroOverride || PlayerResource.GetSelectedHeroEntity(playerId);
        if (hero) {
            // 播放宝石拾取音效
            EmitSoundOn('Item.PickUpGemShop', hero);

            // 创建主特效 - 升级光柱
            const particleMain = ParticleManager.CreateParticle(
                'particles/generic_hero_status/hero_levelup.vpcf',
                ParticleAttachment.ABSORIGIN_FOLLOW,
                hero
            );
            ParticleManager.ReleaseParticleIndex(particleMain);

            // 创建辅助特效 - 白色光芒 (T0→T1 唤醒)
            const particleGlow = ParticleManager.CreateParticle(
                'particles/artifact_upgrade_t1.vpcf',
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
     * 升级单个神器槽位到下一阶 (通用: T0→T1→T2→...)
     * @returns 是否升级成功
     */
    public UpgradeSingleArtifact(playerId: PlayerID, slotIndex: number): boolean {
        const artifacts = this.playerArtifacts.get(playerId);
        if (!artifacts) {
            print(`[ArtifactSystem] 玩家 ${playerId} 没有神器数据`);
            return false;
        }

        if (slotIndex < 0 || slotIndex >= this.SLOT_COUNT) {
            print(`[ArtifactSystem] 无效槽位: ${slotIndex}`);
            return false;
        }

        // 槽位类型名称
        const slotTypes = ['weapon', 'armor', 'helm', 'accessory', 'boots', 'amulet'];

        // 每个 tier 的物品名后缀
        const tierSuffixes: Record<number, string> = {
            0: '_t0',
            1: '_tier1',
            2: '_t2',
            3: '_t3',
            4: '_t4',
            5: '_t5',
        };

        const MAX_TIER = 5;
        const current = artifacts.slots[slotIndex];
        if (!current.itemName) {
            print(`[ArtifactSystem] 槽位 ${slotIndex} 没有装备神器`);
            return false;
        }

        const nextTier = current.tier + 1;
        if (nextTier > MAX_TIER) {
            print(`[ArtifactSystem] 槽位 ${slotIndex} 已达最高阶 (T${current.tier})`);
            return false;
        }

        // 检查经验是否足够
        const required = this.GetXPRequired(current.tier);
        if (current.xp < required) {
            print(`[ArtifactSystem] 槽位 ${slotIndex} 经验不足: ${current.xp}/${required}`);
            return false;
        }
        const overflow = current.xp - required;

        const slotType = slotTypes[slotIndex];
        const nextSuffix = tierSuffixes[nextTier];
        const nextItemName = `item_artifact_${slotType}${nextSuffix}`;

        const nextInfo = this.GetArtifactInfo(nextItemName);
        // 使用本地化 token 作为显示名
        const displayName = `#ItemCn_${nextItemName}`;

        artifacts.slots[slotIndex] = {
            itemName: nextItemName,
            tier: nextTier,
            displayName: displayName,
            xp: overflow,
            xpRequired: this.GetXPRequired(nextTier),
        };

        print(
            `[ArtifactSystem] 槽位 ${slotIndex} 升级: ${current.displayName} (T${current.tier}) -> ${displayName} (T${nextTier})`
        );

        const hero = PlayerResource.GetSelectedHeroEntity(playerId);
        if (hero) {
            // 宝石拾取音效 (所有阶级通用)
            EmitSoundOn('Item.PickUpGemShop', hero);

            const particleMain = ParticleManager.CreateParticle(
                'particles/generic_hero_status/hero_levelup.vpcf',
                ParticleAttachment.ABSORIGIN_FOLLOW,
                hero
            );
            ParticleManager.ReleaseParticleIndex(particleMain);

            // 根据目标阶级选择不同颜色的光芒特效
            const tierParticles: { [key: number]: string } = {
                1: 'particles/artifact_upgrade_t1.vpcf',
                2: 'particles/artifact_upgrade_t2.vpcf',
                3: 'particles/artifact_upgrade_t3.vpcf',
                4: 'particles/artifact_upgrade_t4.vpcf',
                5: 'particles/artifact_upgrade_t5.vpcf',
            };
            const glowPath = tierParticles[nextTier] || 'particles/artifact_upgrade_t1.vpcf';

            const particleGlow = ParticleManager.CreateParticle(glowPath, ParticleAttachment.ABSORIGIN_FOLLOW, hero);
            Timers.CreateTimer(1.5, () => {
                ParticleManager.DestroyParticle(particleGlow, false);
                ParticleManager.ReleaseParticleIndex(particleGlow);
            });

            this.RefreshHeroModifier(hero);
        }

        this.SyncToClient(playerId);
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

        // 每个 tier 的物品名后缀 (适配不一致的命名: _t0, _tier1, _t2, _t3, _t4, _t5)
        const tierSuffixes: Record<number, string> = {
            0: '_t0',
            1: '_tier1',
            2: '_t2',
            3: '_t3',
            4: '_t4',
            5: '_t5',
        };

        // 中文显示名
        const tierDisplayNames: Record<string, Record<number, string>> = {
            weapon: { 0: '蒙尘武器', 1: '凡铁剑', 2: '精钢剑', 3: '玄玉剑', 4: '天仙剑', 5: '神魔剑' },
            armor: { 0: '蒙尘衣甲', 1: '凡铁甲', 2: '精钢甲', 3: '玄玉甲', 4: '天仙甲', 5: '神魔甲' },
            helm: { 0: '蒙尘头冠', 1: '凡铁冠', 2: '精钢冠', 3: '玄玉冠', 4: '天仙冠', 5: '神魔冠' },
            accessory: { 0: '蒙尘饰品', 1: '凡铁戒', 2: '精钢戒', 3: '玄玉戒', 4: '天仙戒', 5: '神魔戒' },
            boots: { 0: '蒙尘靴子', 1: '凡铁靴', 2: '精钢靴', 3: '玄玉靴', 4: '天仙靴', 5: '神魔靴' },
            amulet: { 0: '蒙尘护符', 1: '凡铁令', 2: '精钢令', 3: '玄玉令', 4: '天仙令', 5: '神魔令' },
        };

        const MAX_TIER = 5;
        let upgraded = 0;
        let maxTierReached = 1;

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

            // 计算溢出经验
            const required = this.GetXPRequired(current.tier);
            const overflow = Math.max(current.xp - required, 0);

            artifacts.slots[slot] = {
                itemName: nextItemName,
                tier: nextTier,
                displayName: displayName,
                xp: overflow,
                xpRequired: this.GetXPRequired(nextTier),
            };

            print(
                `[ArtifactSystem] 槽位 ${slot} 升级: ${current.displayName} (T${current.tier}) -> ${displayName} (T${nextTier})`
            );
            upgraded++;
            if (nextTier > maxTierReached) maxTierReached = nextTier;
        }

        if (upgraded > 0) {
            const hero = PlayerResource.GetSelectedHeroEntity(playerId);
            if (hero) {
                // 宝石拾取音效
                EmitSoundOn('Item.PickUpGemShop', hero);

                // 特效 - 升级光柱
                const particleMain = ParticleManager.CreateParticle(
                    'particles/generic_hero_status/hero_levelup.vpcf',
                    ParticleAttachment.ABSORIGIN_FOLLOW,
                    hero
                );
                ParticleManager.ReleaseParticleIndex(particleMain);

                // 根据目标阶级选择不同颜色的光芒特效
                const tierParticles: { [key: number]: string } = {
                    1: 'particles/artifact_upgrade_t1.vpcf',
                    2: 'particles/artifact_upgrade_t2.vpcf',
                    3: 'particles/artifact_upgrade_t3.vpcf',
                    4: 'particles/artifact_upgrade_t4.vpcf',
                    5: 'particles/artifact_upgrade_t5.vpcf',
                };
                const glowPath = tierParticles[maxTierReached] || 'particles/artifact_upgrade_t1.vpcf';

                const particleGlow = ParticleManager.CreateParticle(
                    glowPath,
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
            spellDamage: 0,
            block: 0,
            finalDmgIncrease: 0,
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
            bonuses.spellDamage! += info.bonusSpellDamage || 0;
            bonuses.block! += info.bonusBlock || 0;
            bonuses.finalDmgIncrease! += info.bonusFinalDmgIncrease || 0;
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
        bonusSpellDamage?: number;
        bonusBlock?: number;
        bonusFinalDmgIncrease?: number;
    } | null {
        // 物品也使用 GetAbilityKeyValuesByName
        const kv = GetAbilityKeyValuesByName(itemName) as any;
        if (!kv) {
            print(`[ArtifactSystem] GetAbilityKeyValuesByName 返回null: ${itemName}`);
            return null;
        }

        // 注意: 不能用 Number(x) || 0, 因为 TSTL 编译后 __TS__Number(nil) 返回 NaN,
        // 而 Lua 中 NaN 是 truthy, NaN or 0 → NaN! 必须用 tonumber 返回 nil, nil or 0 → 0
        const n = (v: any): number => tonumber(v) ?? 0;
        return {
            slot: n(kv.ArtifactSlot),
            tier: n(kv.ArtifactTier) || 1,
            displayName: `#ItemCn_${itemName}`, // 本地化 token，由 UI $.Localize() 解析
            bonusDamage: n(kv.BonusDamage),
            bonusArmorPen: n(kv.BonusArmorPen),
            bonusHP: n(kv.BonusHP),
            bonusArmor: n(kv.BonusArmor),
            bonusConstitution: n(kv.BonusConstitution),
            bonusDivinity: n(kv.BonusDivinity),
            bonusMartial: n(kv.BonusMartial),
            bonusManaRegen: n(kv.BonusManaRegen),
            bonusCritChance: n(kv.BonusCritChance),
            bonusCritDamage: n(kv.BonusCritDamage),
            bonusMoveSpeed: n(kv.BonusMoveSpeed),
            bonusAgility: n(kv.BonusAgility),
            bonusEvasion: n(kv.BonusEvasion),
            bonusAllStats: n(kv.BonusAllStats),
            bonusFinalDmgReduct: n(kv.BonusFinalDmgReduct),
            bonusSpellDamage: n(kv.BonusSpellDamage),
            bonusBlock: n(kv.BonusBlock),
            bonusFinalDmgIncrease: n(kv.BonusFinalDmgIncrease),
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
                xp: artifacts.slots[i].xp,
                xpRequired: artifacts.slots[i].xpRequired,
            };
        }

        CustomNetTables.SetTableValue('artifacts' as any, `player_${playerId}`, netTableData);
    }
}
