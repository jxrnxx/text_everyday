/**
 * itemRarityConfig.ts
 * 物品品质配置 - 映射物品名称到品质等级和图标
 */

// 物品配置接口
export interface ItemConfig {
    rarity: number;      // 品质等级: 1=凡, 2=灵, 3=仙, 4=神
    icon: string;        // 透明图标路径
}

// 物品配置映射
export const ITEM_CONFIG_MAP: Record<string, ItemConfig> = {
    // === 消耗品 ===
    'item_scroll_gacha': {
        rarity: 1,
        icon: 'file://{resources}/images/custom_items/skill_book_blue.png',
    },
    'item_ask_dao_lot': {
        rarity: 2,
        icon: 'file://{images}/custom_game/hud/skill_fortune_sticks.png',
    },
    'item_derive_paper': {
        rarity: 2,
        icon: 'file://{resources}/images/custom_items/derivation_paper.png',
    },
    'item_blank_rubbing': {
        rarity: 3,
        icon: 'file://{resources}/images/custom_items/blank_rubbing.png',
    },

    // === 强化石 ===
    'item_upgrade_stone_1': {
        rarity: 1,
        icon: 'file://{resources}/images/custom_items/upgrade_stone_white.png',
    },
    'item_upgrade_stone_2': {
        rarity: 2,
        icon: 'file://{resources}/images/custom_items/upgrade_stone_green.png',
    },
    'item_upgrade_stone_3': {
        rarity: 3,
        icon: 'file://{resources}/images/custom_items/upgrade_stone_purple.png',
    },
    'item_upgrade_stone_4': {
        rarity: 4,
        icon: 'file://{resources}/images/custom_items/upgrade_stone_gold.png',
    },

    // === 技能书 ===
    'item_book_martial_cleave_1': {
        rarity: 1,
        icon: 'file://{images}/custom_game/hud/skill_cleave.png',
    },
};

// 品质等级对应的边框图片
export const RARITY_FRAME_MAP: Record<number, string> = {
    1: 'file://{images}/custom_game/hud/tier1_grey.png',
    2: 'file://{images}/custom_game/hud/tier2_green.png',
    3: 'file://{images}/custom_game/hud/tier3_purple.png',
    4: 'file://{images}/custom_game/hud/slot_frame_gold.png',
};

/**
 * 获取物品配置
 */
export function getItemConfig(itemName: string): ItemConfig | null {
    return ITEM_CONFIG_MAP[itemName] || null;
}

/**
 * 获取物品品质等级
 */
export function getItemRarity(itemName: string): number {
    return ITEM_CONFIG_MAP[itemName]?.rarity || 0;
}

/**
 * 获取物品图标路径
 */
export function getItemIcon(itemName: string): string | null {
    return ITEM_CONFIG_MAP[itemName]?.icon || null;
}

/**
 * 获取品质对应的边框图片
 */
export function getRarityFrame(rarity: number): string | null {
    return RARITY_FRAME_MAP[rarity] || null;
}
