/**
 * 背包系统 - 管理玩家物品存储
 */

interface KnapsackItem {
    itemName: string;
    itemId: number;
    charges: number;
    stackable: boolean;
    icon?: string;
}

interface PlayerKnapsack {
    items: (KnapsackItem | null)[];
}

export class KnapsackSystem {
    private static instance: KnapsackSystem;
    private playerKnapsacks: Map<PlayerID, PlayerKnapsack> = new Map();
    private readonly BAG_SIZE = 32;

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
     * 注册事件监听器
     */
    private RegisterEventListeners(): void {
        // 使用物品
        CustomGameEventManager.RegisterListener('knapsack_use_item', (_, event) => {
            this.UseItem(event.PlayerID, event.index, event.targetIndex);
        });

        // 交换物品
        CustomGameEventManager.RegisterListener('knapsack_swap_item', (_, event) => {
            this.SwapItems(event.PlayerID, event.index_in, event.index_out);
        });

        // 丢弃物品
        CustomGameEventManager.RegisterListener('knapsack_drop_item', (_, event) => {
            this.DropItem(event.PlayerID, event.index, event.position);
        });

        // 整理背包
        CustomGameEventManager.RegisterListener('knapsack_tidy_up', (_, event) => {
            this.TidyUp(event.PlayerID);
        });

        // 分解物品
        CustomGameEventManager.RegisterListener('knapsack_decompose', (_, event) => {
            this.DecomposeItems(event.PlayerID);
        });

        // 技能商人购买
        CustomGameEventManager.RegisterListener('cmd_ability_shop_purchase', (_, event) => {
            print(`[KnapsackSystem] 收到购买事件: ${event.item_id} ${event.item_name} ${event.price}`);
            this.HandleAbilityShopPurchase(event.PlayerID, event.item_id, event.item_name, event.price, event.currency);
        });

        print('[KnapsackSystem] 事件监听器已注册');
    }

    /**
     * 初始化玩家背包
     */
    public InitPlayerKnapsack(playerId: PlayerID): void {
        if (!this.playerKnapsacks.has(playerId)) {
            const items: (KnapsackItem | null)[] = [];
            for (let i = 0; i < this.BAG_SIZE; i++) {
                items.push(null);
            }
            this.playerKnapsacks.set(playerId, {
                items: items,
            });
            this.SyncToClient(playerId);
            print(`[KnapsackSystem] 玩家 ${playerId} 背包已初始化`);
        }
    }

    /**
     * 添加物品到背包
     */
    public AddItem(playerId: PlayerID, item: KnapsackItem): boolean {
        const knapsack = this.playerKnapsacks.get(playerId);
        if (!knapsack) {
            this.InitPlayerKnapsack(playerId);
            return this.AddItem(playerId, item);
        }

        // 如果是可堆叠物品，先尝试堆叠
        if (item.stackable) {
            for (let i = 0; i < this.BAG_SIZE; i++) {
                const existingItem = knapsack.items[i];
                if (existingItem && existingItem.itemName === item.itemName) {
                    existingItem.charges += item.charges;
                    this.SyncToClient(playerId);
                    print(`[KnapsackSystem] 物品 ${item.itemName} 已堆叠到槽位 ${i}`);
                    return true;
                }
            }
        }

        // 找空槽位
        for (let i = 0; i < this.BAG_SIZE; i++) {
            if (!knapsack.items[i]) {
                knapsack.items[i] = item;
                this.SyncToClient(playerId);
                print(`[KnapsackSystem] 物品 ${item.itemName} 已添加到槽位 ${i}`);
                return true;
            }
        }

        // 背包已满
        const player = PlayerResource.GetPlayer(playerId);
        if (player) {
            CustomGameEventManager.Send_ServerToPlayer(player, 'custom_toast', {
                message: '背包已满！',
                duration: 3,
            } as never);
        }
        print(`[KnapsackSystem] 玩家 ${playerId} 背包已满`);
        return false;
    }

    /**
     * 从背包移除物品
     */
    public RemoveItem(playerId: PlayerID, index: number): KnapsackItem | null {
        const knapsack = this.playerKnapsacks.get(playerId);
        if (!knapsack || index < 0 || index >= this.BAG_SIZE) {
            return null;
        }

        const item = knapsack.items[index];
        knapsack.items[index] = null;
        this.SyncToClient(playerId);
        return item;
    }

    /**
     * 使用物品
     */
    private UseItem(playerId: PlayerID, index: number, _targetIndex: EntityIndex): void {
        const knapsack = this.playerKnapsacks.get(playerId);
        if (!knapsack) return;

        const item = knapsack.items[index];
        if (!item) return;

        // 根据物品类型执行不同操作
        this.ExecuteItemEffect(playerId, item, index);
    }

    /**
     * 执行物品效果
     */
    private ExecuteItemEffect(playerId: PlayerID, item: KnapsackItem, index: number): void {
        const hero = PlayerResource.GetSelectedHeroEntity(playerId);
        if (!hero) return;

        // 根据物品名称执行不同效果
        switch (item.itemName) {
            case 'item_skill_book':
                // 技能书效果 - 随机获得一个技能
                print(`[KnapsackSystem] 玩家 ${playerId} 使用了技能书`);
                this.ConsumeItem(playerId, index, 1);
                break;

            case 'item_skill_reset':
                // 技能重置卷轴
                print(`[KnapsackSystem] 玩家 ${playerId} 使用了技能重置卷轴`);
                this.ConsumeItem(playerId, index, 1);
                break;

            case 'item_skill_upgrade':
                // 技能升级卷轴
                print(`[KnapsackSystem] 玩家 ${playerId} 使用了技能升级卷轴`);
                this.ConsumeItem(playerId, index, 1);
                break;

            case 'item_blank_rubbing':
                // 空白拓本
                print(`[KnapsackSystem] 玩家 ${playerId} 使用了空白拓本`);
                this.ConsumeItem(playerId, index, 1);
                break;

            case 'item_enhance_stone_white':
            case 'item_enhance_stone_green':
            case 'item_enhance_stone_blue':
            case 'item_enhance_stone_purple':
                // 强化石 - 需要选择装备
                print(`[KnapsackSystem] 玩家 ${playerId} 尝试使用强化石`);
                break;

            default:
                print(`[KnapsackSystem] 未知物品: ${item.itemName}`);
        }
    }

    /**
     * 消耗物品
     */
    private ConsumeItem(playerId: PlayerID, index: number, amount: number): void {
        const knapsack = this.playerKnapsacks.get(playerId);
        if (!knapsack) return;

        const item = knapsack.items[index];
        if (!item) return;

        if (item.stackable && item.charges > amount) {
            item.charges -= amount;
        } else {
            knapsack.items[index] = null;
        }
        this.SyncToClient(playerId);
    }

    /**
     * 交换物品位置
     */
    private SwapItems(playerId: PlayerID, indexIn: number, indexOut: number): void {
        const knapsack = this.playerKnapsacks.get(playerId);
        if (!knapsack) return;

        if (indexIn < 0 || indexIn >= this.BAG_SIZE || indexOut < 0 || indexOut >= this.BAG_SIZE) {
            return;
        }

        const temp = knapsack.items[indexIn];
        knapsack.items[indexIn] = knapsack.items[indexOut];
        knapsack.items[indexOut] = temp;

        this.SyncToClient(playerId);
        print(`[KnapsackSystem] 玩家 ${playerId} 交换物品 ${indexIn} <-> ${indexOut}`);
    }

    /**
     * 丢弃物品到地面
     */
    private DropItem(playerId: PlayerID, index: number, position: Vector): void {
        const item = this.RemoveItem(playerId, index);
        if (!item) return;

        // 在地面创建物品实体
        const hero = PlayerResource.GetSelectedHeroEntity(playerId);
        if (hero) {
            // 创建地面物品 - 注意: 背包物品是虚拟的，丢弃时只是移除
            // 如果未来需要真正创建物品实体，需要在 npc_items_custom.txt 中定义
            print(`[KnapsackSystem] 物品 ${item.itemName} 已从背包移除`);
        }

        print(`[KnapsackSystem] 玩家 ${playerId} 丢弃物品 ${item.itemName} 到地面`);
    }

    /**
     * 整理背包 - 将所有物品移到前面，合并同类可堆叠物品
     */
    private TidyUp(playerId: PlayerID): void {
        const knapsack = this.playerKnapsacks.get(playerId);
        if (!knapsack) return;

        // 收集所有非空物品
        const nonNullItems: KnapsackItem[] = [];
        for (const item of knapsack.items) {
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

        // 重新排列
        const newItems: (KnapsackItem | null)[] = [];
        for (let i = 0; i < this.BAG_SIZE; i++) {
            newItems.push(null);
        }
        for (let i = 0; i < mergedItems.length && i < this.BAG_SIZE; i++) {
            newItems[i] = mergedItems[i];
        }
        knapsack.items = newItems;

        this.SyncToClient(playerId);
        print(`[KnapsackSystem] 玩家 ${playerId} 整理了背包`);
    }

    /**
     * 处理技能商人购买
     */
    private HandleAbilityShopPurchase(
        playerId: PlayerID,
        itemId: number,
        itemName: string,
        price: number,
        currency: string
    ): void {
        // 检查玩家货币是否足够
        const hero = PlayerResource.GetSelectedHeroEntity(playerId);
        if (!hero) {
            print(`[KnapsackSystem] 玩家 ${playerId} 没有英雄`);
            return;
        }

        // 获取玩家信仰货币 (通过 EconomySystem)
        const economyData = CustomNetTables.GetTableValue('economy', `player_${playerId}`) as any;
        const currentFaith = economyData?.faith || 0;

        if (currentFaith < price) {
            // 货币不足
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

        // 根据商品ID创建物品名称映射
        // ID 1: 演武残卷 -> 获得武道·横扫技能书
        // ID 2-8: 直接获得对应物品
        const itemNameMap: Record<number, string> = {
            1: 'item_book_martial_cleave_1', // 演武残卷 -> 武道·横扫技能书
            2: 'item_ask_dao_lot', // 问道签
            3: 'item_derive_paper', // 衍法灵笺
            4: 'item_blank_rubbing', // 空白拓本
            5: 'item_upgrade_stone_1', // 悟道石·凡
            6: 'item_upgrade_stone_2', // 悟道石·灵
            7: 'item_upgrade_stone_3', // 悟道石·仙
            8: 'item_upgrade_stone_4', // 悟道石·神
        };

        // 是否可堆叠 (技能书不可堆叠)
        const stackableMap: Record<number, boolean> = {
            1: false, // 技能书不可堆叠
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

        // 创建物品并添加到背包
        const newItem: KnapsackItem = {
            itemName: internalItemName,
            itemId: itemId,
            charges: 1,
            stackable: isStackable,
        };

        const success = this.AddItem(playerId, newItem);
        if (success) {
            // 扣除货币 - 通过 EconomySystem
            const newFaith = currentFaith - price;
            CustomNetTables.SetTableValue('economy', `player_${playerId}`, {
                spirit_coin: economyData?.spirit_coin || 0,
                faith: newFaith,
            } as any);

            // 显示成功消息
            const player = PlayerResource.GetPlayer(playerId);
            if (player) {
                CustomGameEventManager.Send_ServerToPlayer(player, 'custom_toast', {
                    message: `购买成功: ${itemName}`,
                    duration: 2,
                } as never);
            }

            print(
                `[KnapsackSystem] 玩家 ${playerId} 购买了 ${itemName} -> ${internalItemName}，花费 ${price} ${currency}`
            );
        }
    }

    /**
     * 分解物品 (待实现)
     */
    private DecomposeItems(_playerId: PlayerID): void {
        print('[KnapsackSystem] 分解功能待实现');
    }

    /**
     * 同步数据到客户端
     */
    private SyncToClient(playerId: PlayerID): void {
        const knapsack = this.playerKnapsacks.get(playerId);
        if (!knapsack) return;

        const data: Record<string, KnapsackItem | null> = {};
        for (let i = 0; i < this.BAG_SIZE; i++) {
            data[i.toString()] = knapsack.items[i];
        }

        // 写入 public_storage NetTable
        CustomNetTables.SetTableValue('public_storage' as any, `player_${playerId}`, data as any);
        print(`[KnapsackSystem] 同步背包到 public_storage: player_${playerId}`);

        // 发送事件通知客户端更新背包
        const player = PlayerResource.GetPlayer(playerId);
        if (player) {
            CustomGameEventManager.Send_ServerToPlayer(player, 'backpack_updated' as never, {
                items: data
            } as never);
            print(`[KnapsackSystem] 发送 backpack_updated 事件给玩家 ${playerId}`);
        }
    }

    /**
     * 获取玩家背包数据
     */
    public GetPlayerKnapsack(playerId: PlayerID): PlayerKnapsack | undefined {
        return this.playerKnapsacks.get(playerId);
    }
}

// 导出单例
export const knapsackSystem = KnapsackSystem.GetInstance();
