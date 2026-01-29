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
    publicItems: (KnapsackItem | null)[];  // 公用仓库 16格
    privateItems: (KnapsackItem | null)[]; // 私人背包 40格
}

export class KnapsackSystem {
    private static instance: KnapsackSystem;
    private playerStorage: Map<PlayerID, PlayerStorage> = new Map();

    // 仓库大小配置
    private readonly PUBLIC_SIZE = 16;   // 2行 x 8列
    private readonly PRIVATE_SIZE = 40;  // 5行 x 8列

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
        CustomGameEventManager.RegisterListener('backpack_use_item', (_, event) => {
            this.UseItem(event.PlayerID, event.storageType, event.index, event.targetIndex);
        });

        // 交换物品 (拖拽)
        CustomGameEventManager.RegisterListener('backpack_swap_item', (_, event) => {
            this.SwapItems(
                event.PlayerID,
                event.sourceType,
                event.sourceIndex,
                event.targetType,
                event.targetIndex
            );
        });

        // 丢弃物品 (右键拖出)
        CustomGameEventManager.RegisterListener('backpack_drop_item', (_, event) => {
            this.DropItem(event.PlayerID, event.storageType, event.index, event.position);
        });

        // 整理背包
        CustomGameEventManager.RegisterListener('backpack_tidy_up', (_, event) => {
            this.TidyUp(event.PlayerID);
        });

        // 分解物品
        CustomGameEventManager.RegisterListener('backpack_decompose', (_, event) => {
            this.DecomposeItems(event.PlayerID);
        });

        // 合成装备
        CustomGameEventManager.RegisterListener('backpack_combine_equip', (_, event) => {
            print(`[KnapsackSystem] 合成装备功能待实现`);
        });

        // 合成技能
        CustomGameEventManager.RegisterListener('backpack_combine_skill', (_, event) => {
            print(`[KnapsackSystem] 合成技能功能待实现`);
        });

        // 技能商人购买
        CustomGameEventManager.RegisterListener('cmd_ability_shop_purchase', (_, event) => {
            print(`[KnapsackSystem] 收到购买事件: ${event.item_id} ${event.item_name} ${event.price}`);
            this.HandleAbilityShopPurchase(event.PlayerID, event.item_id, event.item_name, event.price, event.currency);
        });

        print('[KnapsackSystem] 事件监听器已注册 (backpack_* 前缀)');
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
            print(`[KnapsackSystem] 玩家 ${playerId} 存储已初始化 (公用${this.PUBLIC_SIZE}格 + 私人${this.PRIVATE_SIZE}格)`);
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
                    print(`[KnapsackSystem] 物品 ${item.itemName} 已堆叠到 ${storageType} 槽位 ${i}`);
                    return true;
                }
            }
        }

        // 找空槽位
        for (let i = 0; i < maxSize; i++) {
            if (!items[i]) {
                items[i] = item;
                this.SyncToClient(playerId);
                print(`[KnapsackSystem] 物品 ${item.itemName} 已添加到 ${storageType} 槽位 ${i}`);
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
        print(`[KnapsackSystem] 玩家 ${playerId} ${storageType} 已满`);
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
    private UseItem(playerId: PlayerID, storageType: 'public' | 'private', index: number, _targetIndex: EntityIndex): void {
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
    private ExecuteItemEffect(playerId: PlayerID, storageType: 'public' | 'private', item: KnapsackItem, index: number): void {
        const hero = PlayerResource.GetSelectedHeroEntity(playerId);
        if (!hero) return;

        // 根据物品名称执行不同效果
        switch (item.itemName) {
            case 'item_book_martial_cleave_1':
                // 技能书效果 - 学习技能
                print(`[KnapsackSystem] 玩家 ${playerId} 使用了技能书: ${item.itemName}`);
                this.ConsumeItem(playerId, storageType, index, 1);
                break;

            case 'item_scroll_gacha':
                // 演武残卷 - 随机获得技能书
                print(`[KnapsackSystem] 玩家 ${playerId} 使用了演武残卷`);
                this.ConsumeItem(playerId, storageType, index, 1);
                break;

            case 'item_ask_dao_lot':
                // 问道签 - 打开选择界面
                print(`[KnapsackSystem] 玩家 ${playerId} 使用了问道签`);
                break;

            case 'item_derive_paper':
                // 衍法灵笺 - 变换技能
                print(`[KnapsackSystem] 玩家 ${playerId} 使用了衍法灵笺`);
                break;

            case 'item_blank_rubbing':
                // 空白拓本 - 剥离技能
                print(`[KnapsackSystem] 玩家 ${playerId} 使用了空白拓本`);
                break;

            case 'item_upgrade_stone_1':
            case 'item_upgrade_stone_2':
            case 'item_upgrade_stone_3':
            case 'item_upgrade_stone_4':
                // 强化石 - 需要选择技能
                print(`[KnapsackSystem] 玩家 ${playerId} 尝试使用强化石 ${item.itemName}`);
                break;

            default:
                print(`[KnapsackSystem] 未知物品: ${item.itemName}`);
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
        print(`[KnapsackSystem] 玩家 ${playerId} 交换物品 ${sourceType}[${sourceIndex}] <-> ${targetType}[${targetIndex}]`);
    }

    /**
     * 丢弃物品到地面
     */
    private DropItem(playerId: PlayerID, storageType: 'public' | 'private', index: number, position: Vector): void {
        const item = this.RemoveItem(playerId, storageType, index);
        if (!item) return;

        print(`[KnapsackSystem] 玩家 ${playerId} 丢弃物品 ${item.itemName} (物品已移除)`);
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
        print(`[KnapsackSystem] 玩家 ${playerId} 整理了背包`);
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
            print(`[KnapsackSystem] 玩家 ${playerId} 没有英雄`);
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
            print(`[KnapsackSystem] 玩家 ${playerId} 信仰不足: ${currentFaith} < ${price}`);
            return;
        }

        // 物品ID映射
        const itemNameMap: Record<number, string> = {
            1: 'item_scroll_gacha',      // 演武残卷
            2: 'item_ask_dao_lot',       // 问道签
            3: 'item_derive_paper',      // 衍法灵笺
            4: 'item_blank_rubbing',     // 空白拓本
            5: 'item_upgrade_stone_1',   // 悟道石·凡
            6: 'item_upgrade_stone_2',   // 悟道石·灵
            7: 'item_upgrade_stone_3',   // 悟道石·仙
            8: 'item_upgrade_stone_4',   // 悟道石·神
        };

        // 是否可堆叠
        const stackableMap: Record<number, boolean> = {
            1: true,  // 演武残卷可堆叠
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
            print(`[KnapsackSystem] 未知商品ID: ${itemId}`);
            return;
        }

        const isStackable = stackableMap[itemId] ?? true;

        // 创建物品并添加到私人背包
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

            print(`[KnapsackSystem] 玩家 ${playerId} 购买 ${itemName} -> ${internalItemName}，进入私人背包`);
        }
    }

    /**
     * 分解物品 (待实现)
     */
    private DecomposeItems(_playerId: PlayerID): void {
        print('[KnapsackSystem] 分解功能待实现');
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

        print(`[KnapsackSystem] 同步到客户端: public_storage(${this.PUBLIC_SIZE}格) + private_backpack(${this.PRIVATE_SIZE}格)`);

        // 发送事件通知客户端
        const player = PlayerResource.GetPlayer(playerId);
        if (player) {
            CustomGameEventManager.Send_ServerToPlayer(player, 'backpack_updated' as never, {
                publicItems: publicData,
                privateItems: privateData,
            } as never);
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
