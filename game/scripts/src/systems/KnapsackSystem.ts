/**
 * 背包系统 - 管理玩家物品存储
 *
 * 公用仓库: 2行 x 8列 = 16格
 * 私人背包: 5行 x 8列 = 40格
 */

interface KnapsackItem {
    itemName: string;
    itemId: number;
    charges: number;
    stackable: boolean;
    icon?: string;
}

interface PlayerStorage {
    publicItems: (KnapsackItem | null)[]; // 公用仓库 16格
    privateItems: (KnapsackItem | null)[]; // 私人背包 40格
}

export class KnapsackSystem {
    private static instance: KnapsackSystem;
    private playerStorage: Map<PlayerID, PlayerStorage> = new Map();

    // 仓库大小配置
    private readonly PUBLIC_SIZE = 16; // 2行 x 8列
    private readonly PRIVATE_SIZE = 40; // 5行 x 8列

    private constructor() {
        this.RegisterEventListeners();
    }

    public static GetInstance(): KnapsackSystem {
        if (!KnapsackSystem.instance) {
            KnapsackSystem.instance = new KnapsackSystem();
        }
        return KnapsackSystem.instance;
    }

    /**
     * 注册事件监听器 - 使用 backpack_* 前缀匹配客户端
     */
    private RegisterEventListeners(): void {
        // 使用物品 (双击)
        CustomGameEventManager.RegisterListener('backpack_use_item', (_, event: any) => {
            this.UseItem(event.PlayerID, event.storageType, event.index, event.targetIndex);
        });

        // 交换物品 (拖拽)
        CustomGameEventManager.RegisterListener('backpack_swap_item', (_, event: any) => {
            this.SwapItems(event.PlayerID, event.sourceType, event.sourceIndex, event.targetType, event.targetIndex);
        });

        // 丢弃物品 (右键拖出)
        CustomGameEventManager.RegisterListener('backpack_drop_item', (_, event: any) => {
            this.DropItem(event.PlayerID, event.storageType, event.index, event.position);
        });

        // 整理背包
        CustomGameEventManager.RegisterListener('backpack_tidy_up', (_, event: any) => {
            this.TidyUp(event.PlayerID);
        });

        // 分解物品
        CustomGameEventManager.RegisterListener('backpack_decompose', (_, event) => {
            this.DecomposeItems(event.PlayerID);
        });

        // 合成装备
        CustomGameEventManager.RegisterListener('backpack_combine_equip', (_, event) => { });

        // 合成技能
        CustomGameEventManager.RegisterListener('backpack_combine_skill', (_, event) => { });

        // 技能商人购买
        CustomGameEventManager.RegisterListener('cmd_ability_shop_purchase', (_, event) => {
            this.HandleAbilityShopPurchase(event.PlayerID, event.item_id, event.item_name, event.price, event.currency);
        });

        // 技能替换确认 (玩家选择了要替换的格子)
        CustomGameEventManager.RegisterListener('cmd_skill_replace_confirm', (_, event: any) => {
            this.HandleSkillReplaceConfirm(
                event.PlayerID,
                event.slot_key,
                event.skill_to_learn,
                event.storage_type,
                event.item_index
            );
        });

        // 存入仓库 (私人背包 → 公用仓库)
        CustomGameEventManager.RegisterListener('backpack_store_item', (_, event: any) => {
            this.StoreItem(event.PlayerID, event.sourceIndex);
        });

        // 取出物品 (公用仓库 → 私人背包)
        CustomGameEventManager.RegisterListener('backpack_retrieve_item', (_, event: any) => {
            this.RetrieveItem(event.PlayerID, event.sourceIndex);
        });

        // 出售物品
        CustomGameEventManager.RegisterListener('backpack_sell_item', (_, event: any) => {
            this.SellItem(event.PlayerID, event.storageType, event.index, event.price);
        });
    }

    /**
     * 初始化玩家存储
     */
    public InitPlayerStorage(playerId: PlayerID): void {
        if (!this.playerStorage.has(playerId)) {
            const publicItems: (KnapsackItem | null)[] = [];
            const privateItems: (KnapsackItem | null)[] = [];

            for (let i = 0; i < this.PUBLIC_SIZE; i++) {
                publicItems.push(null);
            }
            for (let i = 0; i < this.PRIVATE_SIZE; i++) {
                privateItems.push(null);
            }

            this.playerStorage.set(playerId, {
                publicItems,
                privateItems,
            });

            this.SyncToClient(playerId);
        }
    }

    /**
     * 添加物品到私人背包 (购买时默认进私人背包)
     */
    public AddItemToPrivate(playerId: PlayerID, item: KnapsackItem): boolean {
        return this.AddItem(playerId, 'private', item);
    }

    /**
     * 添加物品到指定存储
     */
    public AddItem(playerId: PlayerID, storageType: 'public' | 'private', item: KnapsackItem): boolean {
        let storage = this.playerStorage.get(playerId);
        if (!storage) {
            this.InitPlayerStorage(playerId);
            storage = this.playerStorage.get(playerId)!;
        }

        const items = storageType === 'public' ? storage.publicItems : storage.privateItems;
        const maxSize = storageType === 'public' ? this.PUBLIC_SIZE : this.PRIVATE_SIZE;

        // 如果是可堆叠物品，先尝试堆叠
        if (item.stackable) {
            for (let i = 0; i < maxSize; i++) {
                const existingItem = items[i];
                if (existingItem && existingItem.itemName === item.itemName) {
                    existingItem.charges += item.charges;
                    this.SyncToClient(playerId);
                    return true;
                }
            }
        }

        // 找空槽位
        for (let i = 0; i < maxSize; i++) {
            if (!items[i]) {
                items[i] = item;
                this.SyncToClient(playerId);
                return true;
            }
        }

        // 背包已满
        const player = PlayerResource.GetPlayer(playerId);
        if (player) {
            CustomGameEventManager.Send_ServerToPlayer(player, 'custom_toast', {
                message: storageType === 'public' ? '公用仓库已满！' : '私人背包已满！',
                duration: 3,
            } as never);
        }
        return false;
    }

    /**
     * 从存储移除物品
     */
    public RemoveItem(playerId: PlayerID, storageType: 'public' | 'private', index: number): KnapsackItem | null {
        const storage = this.playerStorage.get(playerId);
        if (!storage) return null;

        const items = storageType === 'public' ? storage.publicItems : storage.privateItems;
        const maxSize = storageType === 'public' ? this.PUBLIC_SIZE : this.PRIVATE_SIZE;

        if (index < 0 || index >= maxSize) return null;

        const item = items[index];
        items[index] = null;
        this.SyncToClient(playerId);
        return item;
    }

    /**
     * 使用物品 (双击)
     */
    private UseItem(
        playerId: PlayerID,
        storageType: 'public' | 'private',
        index: number,
        _targetIndex: EntityIndex
    ): void {
        const storage = this.playerStorage.get(playerId);
        if (!storage) return;

        const items = storageType === 'public' ? storage.publicItems : storage.privateItems;
        const item = items[index];
        if (!item) return;

        // 根据物品类型执行不同操作
        this.ExecuteItemEffect(playerId, storageType, item, index);
    }

    /**
     * 执行物品效果
     */
    private ExecuteItemEffect(
        playerId: PlayerID,
        storageType: 'public' | 'private',
        item: KnapsackItem,
        index: number
    ): void {
        const hero = PlayerResource.GetSelectedHeroEntity(playerId);
        if (!hero) return;

        // 检查是否是神器物品
        if (item.itemName.startsWith('item_artifact_')) {
            this.EquipArtifactFromBackpack(playerId, storageType, item, index);
            return;
        }

        // 根据物品名称执行不同效果
        switch (item.itemName) {
            case 'item_book_martial_cleave_1':
                // 技能书效果 - 学习技能
                this.LearnSkillFromBook(playerId, hero, item, storageType, index);
                break;

            case 'item_scroll_gacha':
                // 演武残卷 - 随机获得技能书
                this.ConsumeItem(playerId, storageType, index, 1);
                break;

            case 'item_ask_dao_lot':
                // 问道签 - 打开选择界面
                break;

            case 'item_derive_paper':
                // 衍法灵笺 - 变换技能
                break;

            case 'item_blank_rubbing':
                // 空白拓本 - 剥离技能
                break;

            case 'item_upgrade_stone_1':
            case 'item_upgrade_stone_2':
            case 'item_upgrade_stone_3':
            case 'item_upgrade_stone_4':
                // 强化石 - 需要选择技能
                break;

            default:
        }
    }

    /**
     * 从背包装备神器
     */
    private EquipArtifactFromBackpack(
        playerId: PlayerID,
        storageType: 'public' | 'private',
        item: KnapsackItem,
        index: number
    ): void {
        // 动态导入 ArtifactSystem 避免循环依赖
        const { ArtifactSystem } = require('./ArtifactSystem');
        const artifactSystem = ArtifactSystem.GetInstance();

        // 从 KV 获取槽位信息
        const kv = GetAbilityKeyValuesByName(item.itemName) as any;
        if (!kv) {
            return;
        }

        const slotIndex = Number(kv.ArtifactSlot) || 0;
        const displayName = kv.ArtifactName || item.itemName;

        // 装备神器
        const success = artifactSystem.EquipArtifact(playerId, slotIndex, item.itemName);

        if (success) {
            // 从背包移除物品
            this.ConsumeItem(playerId, storageType, index, 1);

            // 播放装备音效
            const hero = PlayerResource.GetSelectedHeroEntity(playerId);
            if (hero) {
                EmitSoundOn('Item.PickUpGemShop', hero);
            }

            // 通知客户端
            const player = PlayerResource.GetPlayer(playerId);
            if (player) {
                CustomGameEventManager.Send_ServerToPlayer(player, 'custom_toast', {
                    message: `装备了 ${displayName}`,
                    duration: 2,
                } as never);
            }
        } else {
            // 装备失败
            const hero = PlayerResource.GetSelectedHeroEntity(playerId);
            if (hero) {
                EmitSoundOn('General.CastFail_NoMana', hero);
            }
        }
    }

    /**
     * 消耗物品
     */
    private ConsumeItem(playerId: PlayerID, storageType: 'public' | 'private', index: number, amount: number): void {
        const storage = this.playerStorage.get(playerId);
        if (!storage) return;

        const items = storageType === 'public' ? storage.publicItems : storage.privateItems;
        const item = items[index];
        if (!item) return;

        if (item.stackable && item.charges > amount) {
            item.charges -= amount;
        } else {
            items[index] = null;
        }
        this.SyncToClient(playerId);
    }

    // 技能书名到技能名的映射
    private readonly SKILL_BOOK_MAP: Record<string, string> = {
        item_book_martial_cleave_1: 'ability_public_martial_cleave', // 武道·横扫
        // 未来添加更多技能书映射
    };

    // 公共技能格索引 (对应 Ability3, Ability4, Ability5 = F, G, R)
    private readonly PUBLIC_SKILL_SLOTS = [2, 3, 4]; // 0-indexed: Ability3=2, Ability4=3, Ability5=4

    /**
     * 从技能书学习技能
     * 规则：
     * - 按F/G/R顺序填充空格子
     * - 第三格(R)需要玩家达到3阶(rank>=2, 即宗师)
     * - 格子满时弹出替换选择提示
     */
    private LearnSkillFromBook(
        playerId: PlayerID,
        hero: CDOTA_BaseNPC_Hero,
        item: KnapsackItem,
        storageType: 'public' | 'private',
        itemIndex: number
    ): void {
        const abilityName = this.SKILL_BOOK_MAP[item.itemName];
        if (!abilityName) {
            return;
        }

        // 获取玩家阶位
        const rankData = CustomNetTables.GetTableValue('custom_stats', `player_${playerId}`) as any;
        const playerRank = rankData?.rank || 0;

        // 检查是否已学习该技能
        const existingAbility = hero.FindAbilityByName(abilityName);
        if (existingAbility && existingAbility.GetLevel() > 0) {
            const player = PlayerResource.GetPlayer(playerId);
            if (player) {
                CustomGameEventManager.Send_ServerToPlayer(player, 'custom_toast', {
                    message: '你已经学会这个技能了！',
                    duration: 2,
                } as never);
            }
            return;
        }

        // 查找空的技能格子
        let emptySlotIndex = -1;
        const occupiedSlots: { slot: number; key: string; abilityName: string }[] = [];

        for (let i = 0; i < this.PUBLIC_SKILL_SLOTS.length; i++) {
            const slotIndex = this.PUBLIC_SKILL_SLOTS[i];
            const ability = hero.GetAbilityByIndex(slotIndex);
            const slotKey = i === 0 ? 'F' : i === 1 ? 'G' : 'R';

            // 第三格(R)需要3阶
            if (i === 2 && playerRank < 2) {
                // 宗师(rank=2)才能解锁R格
                continue;
            }

            if (!ability || ability.GetAbilityName() === 'generic_hidden' || ability.GetLevel() === 0) {
                // 找到空格子
                if (emptySlotIndex === -1) {
                    emptySlotIndex = slotIndex;
                }
            } else {
                // 记录已占用的格子
                occupiedSlots.push({
                    slot: slotIndex,
                    key: slotKey,
                    abilityName: ability.GetAbilityName(),
                });
            }
        }

        // 如果有空格子，直接学习
        if (emptySlotIndex !== -1) {
            this.DoLearnAbility(playerId, hero, abilityName, emptySlotIndex);
            this.ConsumeItem(playerId, storageType, itemIndex, 1);
            return;
        }

        // 格子满了，需要选择替换
        const player = PlayerResource.GetPlayer(playerId);
        if (!player) return;

        // 根据阶位决定可替换的格子
        const availableSlots: string[] = [];
        if (playerRank < 2) {
            // 3阶前只有F/G两个格子
            availableSlots.push('F', 'G');
        } else {
            // 3阶后有F/G/R三个格子
            availableSlots.push('F', 'G', 'R');
        }

        // 发送事件到客户端，让玩家选择替换哪个技能
        CustomGameEventManager.Send_ServerToPlayer(player, 'skill_replace_prompt', {
            skill_to_learn: abilityName,
            skill_book_name: item.itemName,
            available_slots: availableSlots,
            occupied_slots: occupiedSlots,
            storage_type: storageType,
            item_index: itemIndex,
        } as never);
    }

    /**
     * 执行学习技能
     * 注意: hero.AddAbility() 会把技能添加到第一个空位
     * SwapAbilities 不能真正交换槽位，只改变可见性
     * 所以我们只需添加技能并确保可见，UI会按技能名查找
     */
    private DoLearnAbility(playerId: PlayerID, hero: CDOTA_BaseNPC_Hero, abilityName: string, slotIndex: number): void {
        // 添加新技能
        hero.AddAbility(abilityName);
        const newAbility = hero.FindAbilityByName(abilityName);

        if (!newAbility) {
            return;
        }

        // 设置技能属性 - 确保技能可见且激活
        newAbility.SetLevel(1);
        newAbility.SetHidden(false);
        newAbility.SetActivated(true);

        const currentIndex = newAbility.GetAbilityIndex();

        // 再次确保技能不隐藏（有时候需要延迟设置）
        Timers.CreateTimer(0.1, () => {
            const ab = hero.FindAbilityByName(abilityName);
            if (ab) {
                ab.SetHidden(false);
                ab.SetActivated(true);
            }
        });

        // 打印学习后所有技能状态
        for (let i = 0; i < 24; i++) {
            const ab = hero.GetAbilityByIndex(i);
            if (ab && ab.GetAbilityName() !== 'generic_hidden') {
            }
        }

        // 槽位 2/3/4 对应 F/G/R
        const slotKey = slotIndex === 2 ? 'F' : slotIndex === 3 ? 'G' : 'R';

        const player = PlayerResource.GetPlayer(playerId);
        if (player) {
            CustomGameEventManager.Send_ServerToPlayer(player, 'custom_toast', {
                message: `学习成功！技能已放入 ${slotKey} 格`,
                duration: 2,
            } as never);
        }

        // 播放学习特效
        EmitSoundOn('General.LevelUp', hero);
    }

    /**
     * 处理技能替换确认
     */
    private HandleSkillReplaceConfirm(
        playerId: PlayerID,
        slotKey: string,
        skillToLearn: string,
        storageType: 'public' | 'private',
        itemIndex: number
    ): void {
        const hero = PlayerResource.GetSelectedHeroEntity(playerId);
        if (!hero) return;

        // 将格子键转换为槽位索引
        let slotIndex: number;
        switch (slotKey) {
            case 'F':
                slotIndex = 2;
                break;
            case 'G':
                slotIndex = 3;
                break;
            case 'R':
                slotIndex = 4;
                break;
            default:
                return;
        }

        // 执行替换
        this.DoLearnAbility(playerId, hero, skillToLearn, slotIndex);
        this.ConsumeItem(playerId, storageType, itemIndex, 1);
    }

    /**
     * 交换物品位置 (支持跨仓库)
     */
    private SwapItems(
        playerId: PlayerID,
        sourceType: 'public' | 'private',
        sourceIndex: number,
        targetType: 'public' | 'private',
        targetIndex: number
    ): void {
        const storage = this.playerStorage.get(playerId);
        if (!storage) return;

        const sourceItems = sourceType === 'public' ? storage.publicItems : storage.privateItems;
        const targetItems = targetType === 'public' ? storage.publicItems : storage.privateItems;
        const sourceMax = sourceType === 'public' ? this.PUBLIC_SIZE : this.PRIVATE_SIZE;
        const targetMax = targetType === 'public' ? this.PUBLIC_SIZE : this.PRIVATE_SIZE;

        if (sourceIndex < 0 || sourceIndex >= sourceMax || targetIndex < 0 || targetIndex >= targetMax) {
            return;
        }

        // 交换物品
        const temp = sourceItems[sourceIndex];
        sourceItems[sourceIndex] = targetItems[targetIndex];
        targetItems[targetIndex] = temp;

        this.SyncToClient(playerId);
    }

    /**
     * 丢弃物品到地面
     */
    private DropItem(playerId: PlayerID, storageType: 'public' | 'private', index: number, position: Vector): void {
        const item = this.RemoveItem(playerId, storageType, index);
        if (!item) return;
    }

    /**
     * 整理背包 - 合并同类可堆叠物品并排序
     */
    private TidyUp(playerId: PlayerID): void {
        const storage = this.playerStorage.get(playerId);
        if (!storage) return;

        // 整理公用仓库
        this.TidyStorage(storage.publicItems, this.PUBLIC_SIZE);
        // 整理私人背包
        this.TidyStorage(storage.privateItems, this.PRIVATE_SIZE);

        this.SyncToClient(playerId);
    }

    /**
     * 整理单个存储
     */
    private TidyStorage(items: (KnapsackItem | null)[], maxSize: number): void {
        // 收集所有非空物品
        const nonNullItems: KnapsackItem[] = [];
        for (const item of items) {
            if (item) {
                nonNullItems.push(item);
            }
        }

        // 合并同类可堆叠物品
        const mergedItems: KnapsackItem[] = [];
        for (const item of nonNullItems) {
            if (item.stackable) {
                const existing = mergedItems.find(i => i.itemName === item.itemName);
                if (existing) {
                    existing.charges += item.charges;
                    continue;
                }
            }
            mergedItems.push({ ...item });
        }

        // 清空并重新排列
        for (let i = 0; i < maxSize; i++) {
            items[i] = i < mergedItems.length ? mergedItems[i] : null;
        }
    }

    /**
     * 处理技能商人购买 - 物品进入私人背包
     */
    private HandleAbilityShopPurchase(
        playerId: PlayerID,
        itemId: number,
        itemName: string,
        price: number,
        currency: string
    ): void {
        const hero = PlayerResource.GetSelectedHeroEntity(playerId);
        if (!hero) {
            return;
        }

        // 获取玩家信仰货币
        const economyData = CustomNetTables.GetTableValue('economy', `player_${playerId}`) as any;
        const currentFaith = economyData?.faith || 0;

        if (currentFaith < price) {
            const player = PlayerResource.GetPlayer(playerId);
            if (player) {
                CustomGameEventManager.Send_ServerToPlayer(player, 'custom_toast', {
                    message: '信仰不足！',
                    duration: 3,
                } as never);
            }
            return;
        }

        // 物品ID映射
        const itemNameMap: Record<number, string> = {
            1: 'item_scroll_gacha', // 演武残卷
            2: 'item_ask_dao_lot', // 问道签
            3: 'item_derive_paper', // 衍法灵笺
            4: 'item_blank_rubbing', // 空白拓本
            5: 'item_upgrade_stone_1', // 悟道石·凡
            6: 'item_upgrade_stone_2', // 悟道石·灵
            7: 'item_upgrade_stone_3', // 悟道石·仙
            8: 'item_upgrade_stone_4', // 悟道石·神
        };

        // 是否可堆叠
        const stackableMap: Record<number, boolean> = {
            1: true, // 演武残卷可堆叠
            2: true,
            3: true,
            4: true,
            5: true,
            6: true,
            7: true,
            8: true,
        };

        const internalItemName = itemNameMap[itemId];
        if (!internalItemName) {
            return;
        }

        const isStackable = stackableMap[itemId] ?? true;

        // === 特殊处理：演武残卷 (itemId=1) ===
        // 演武残卷购买后直接给玩家一本随机技能书，而不是演武残卷本身
        if (itemId === 1) {
            // 技能书池 (目前只有一本，以后可以扩展)
            const skillBooks = [
                { name: 'item_book_martial_cleave_1', displayName: '武道·横扫秘籍', rarity: 1 },
                // 未来可以添加更多技能书：
                // { name: 'item_book_xxx_2', displayName: 'xxx', rarity: 2 },
            ];

            // 随机选择一本技能书 (目前只有一本，未来可以加入概率逻辑)
            const selectedBook = skillBooks[0]; // 目前固定给武道·横扫

            const skillBookItem: KnapsackItem = {
                itemName: selectedBook.name,
                itemId: 100 + skillBooks.indexOf(selectedBook), // 技能书ID从100开始
                charges: 1,
                stackable: false, // 技能书不可堆叠
            };

            const success = this.AddItemToPrivate(playerId, skillBookItem);
            if (success) {
                // 扣除货币
                const newFaith = currentFaith - price;
                CustomNetTables.SetTableValue('economy', `player_${playerId}`, {
                    spirit_coin: economyData?.spirit_coin || 0,
                    faith: newFaith,
                } as any);

                const player = PlayerResource.GetPlayer(playerId);
                if (player) {
                    CustomGameEventManager.Send_ServerToPlayer(player, 'custom_toast', {
                        message: `使用演武残卷，获得: ${selectedBook.displayName}`,
                        duration: 2,
                    } as never);
                }
            }
            return;
        }

        // === 其他道具：正常添加到背包 ===
        const newItem: KnapsackItem = {
            itemName: internalItemName,
            itemId: itemId,
            charges: 1,
            stackable: isStackable,
        };

        // 添加到私人背包
        const success = this.AddItemToPrivate(playerId, newItem);
        if (success) {
            // 扣除货币
            const newFaith = currentFaith - price;
            CustomNetTables.SetTableValue('economy', `player_${playerId}`, {
                spirit_coin: economyData?.spirit_coin || 0,
                faith: newFaith,
            } as any);

            const player = PlayerResource.GetPlayer(playerId);
            if (player) {
                CustomGameEventManager.Send_ServerToPlayer(player, 'custom_toast', {
                    message: `购买成功: ${itemName}`,
                    duration: 2,
                } as never);
            }
        }
    }

    /**
     * 分解物品 (待实现)
     */
    private DecomposeItems(_playerId: PlayerID): void { }

    /**
     * 存入仓库 (私人背包 → 公用仓库)
     */
    private StoreItem(playerId: PlayerID, sourceIndex: number): void {
        const storage = this.playerStorage.get(playerId);
        if (!storage) return;

        // 获取私人背包中的物品
        const item = storage.privateItems[sourceIndex];
        if (!item) {
            return;
        }

        // 检查公用仓库是否有空位
        let emptySlot = -1;
        for (let i = 0; i < this.PUBLIC_SIZE; i++) {
            if (!storage.publicItems[i]) {
                emptySlot = i;
                break;
            }
        }

        if (emptySlot === -1) {
            // 公用仓库已满
            const player = PlayerResource.GetPlayer(playerId);
            if (player) {
                CustomGameEventManager.Send_ServerToPlayer(player, 'custom_toast', {
                    message: '公用仓库已满！',
                    duration: 2,
                } as never);
            }
            return;
        }

        // 移动物品
        storage.publicItems[emptySlot] = item;
        storage.privateItems[sourceIndex] = null;

        this.SyncToClient(playerId);
    }

    /**
     * 取出物品 (公用仓库 → 私人背包)
     */
    private RetrieveItem(playerId: PlayerID, sourceIndex: number): void {
        const storage = this.playerStorage.get(playerId);
        if (!storage) return;

        // 获取公用仓库中的物品
        const item = storage.publicItems[sourceIndex];
        if (!item) {
            return;
        }

        // 检查私人背包是否有空位
        let emptySlot = -1;
        for (let i = 0; i < this.PRIVATE_SIZE; i++) {
            if (!storage.privateItems[i]) {
                emptySlot = i;
                break;
            }
        }

        if (emptySlot === -1) {
            // 私人背包已满
            const player = PlayerResource.GetPlayer(playerId);
            if (player) {
                CustomGameEventManager.Send_ServerToPlayer(player, 'custom_toast', {
                    message: '私人背包已满！',
                    duration: 2,
                } as never);
            }
            return;
        }

        // 移动物品
        storage.privateItems[emptySlot] = item;
        storage.publicItems[sourceIndex] = null;

        this.SyncToClient(playerId);
    }

    /**
     * 出售物品
     */
    private SellItem(playerId: PlayerID, storageType: 'public' | 'private', index: number, price: number): void {
        const storage = this.playerStorage.get(playerId);
        if (!storage) return;

        const items = storageType === 'public' ? storage.publicItems : storage.privateItems;
        const item = items[index];

        if (!item) {
            return;
        }

        // 移除物品
        items[index] = null;

        // 增加信仰值
        const economyData = CustomNetTables.GetTableValue('economy', `player_${playerId}`) as any;
        const currentFaith = economyData?.faith || 0;
        const newFaith = currentFaith + price;

        CustomNetTables.SetTableValue('economy', `player_${playerId}`, {
            spirit_coin: economyData?.spirit_coin || 0,
            faith: newFaith,
        } as any);

        this.SyncToClient(playerId);

        // 发送提示
        const player = PlayerResource.GetPlayer(playerId);
        if (player) {
            CustomGameEventManager.Send_ServerToPlayer(player, 'custom_toast', {
                message: `出售成功，获得 ${price} 信仰`,
                duration: 2,
            } as never);
        }
    }

    /**
     * 同步数据到客户端 - 分别同步公用仓库和私人背包
     */
    private SyncToClient(playerId: PlayerID): void {
        const storage = this.playerStorage.get(playerId);
        if (!storage) return;

        // 公用仓库数据
        const publicData: Record<string, KnapsackItem | null> = {};
        for (let i = 0; i < this.PUBLIC_SIZE; i++) {
            publicData[i.toString()] = storage.publicItems[i];
        }

        // 私人背包数据
        const privateData: Record<string, KnapsackItem | null> = {};
        for (let i = 0; i < this.PRIVATE_SIZE; i++) {
            privateData[i.toString()] = storage.privateItems[i];
        }

        // 写入 NetTable
        CustomNetTables.SetTableValue('public_storage' as any, `player_${playerId}`, publicData as any);
        CustomNetTables.SetTableValue('private_backpack' as any, `player_${playerId}`, privateData as any);

        // 发送事件通知客户端
        const player = PlayerResource.GetPlayer(playerId);
        if (player) {
            CustomGameEventManager.Send_ServerToPlayer(
                player,
                'backpack_updated' as never,
                {
                    publicItems: publicData,
                    privateItems: privateData,
                } as never
            );
        }
    }

    /**
     * 获取玩家存储数据
     */
    public GetPlayerStorage(playerId: PlayerID): PlayerStorage | undefined {
        return this.playerStorage.get(playerId);
    }
}

// 导出单例
export const knapsackSystem = KnapsackSystem.GetInstance();
