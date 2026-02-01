/**
 * itemRarityConfig.ts
 * 物品品质配置 - 映射物品名称到品质等级和图标
 */

// 物品配置接口
export interface ItemConfig {
    rarity: number; // 品质等级: 1=凡, 2=灵, 3=仙, 4=神
    icon: string; // 透明图标路径
    displayName: string; // 显示名称
    description: string; // 物品描述
}

// 物品配置映射
export const ITEM_CONFIG_MAP: Record<string, ItemConfig> = {
    // === 消耗品 ===
    item_scroll_gacha: {
        rarity: 1,
        icon: 'file://{resources}/images/custom_items/skill_book_blue.png',
        displayName: '演武残卷',
        description:
            '天地为台，众生为戏。\n随机获得<font color="#c0c0c0">1星</font><font color="#66cc66">2星</font>技能书。极小概率获得<font color="#ffaa00">4星</font>技能书。',
    },
    item_ask_dao_lot: {
        rarity: 2,
        icon: 'file://{images}/custom_game/hud/skill_fortune_sticks.png',
        displayName: '问道签',
        description:
            '大道三千，弱水三千。\n选择<font color="#ff6666">武道</font>/<font color="#66ccff">神念</font>/<font color="#ffcc66">被动</font>，必得指定类型技能书。',
    },
    item_derive_paper: {
        rarity: 2,
        icon: 'file://{resources}/images/custom_items/derivation_paper.png',
        displayName: '衍法灵笺',
        description: '法无定法，式无定式。\n将技能随机变为<font color="#66ccff">同星级</font>的另一个技能。',
    },
    item_blank_rubbing: {
        rarity: 3,
        icon: 'file://{resources}/images/custom_items/blank_rubbing.png',
        displayName: '空白拓本',
        description:
            '前尘影事，皆可拓印。\n将已学技能<font color="#ff6666">剥离</font>，变回<font color="#66ccff">技能书</font>放入背包。',
    },

    // === 强化石 ===
    item_upgrade_stone_1: {
        rarity: 1,
        icon: 'file://{resources}/images/custom_items/upgrade_stone_white.png',
        displayName: '悟道石·凡',
        description:
            '初窥门径，略有所得。\n将<font color="#c0c0c0">1级</font>技能强化至<font color="#66cc66">2级</font>。',
    },
    item_upgrade_stone_2: {
        rarity: 2,
        icon: 'file://{resources}/images/custom_items/upgrade_stone_green.png',
        displayName: '悟道石·灵',
        description:
            '灵光一闪，融会贯通。\n将<font color="#66cc66">2级</font>技能强化至<font color="#cc66ff">3级</font>。',
    },
    item_upgrade_stone_3: {
        rarity: 3,
        icon: 'file://{resources}/images/custom_items/upgrade_stone_purple.png',
        displayName: '悟道石·仙',
        description:
            '羽化登仙，超脱凡俗。\n将<font color="#cc66ff">3级</font>技能强化至<font color="#ffaa00">4级</font>。',
    },
    item_upgrade_stone_4: {
        rarity: 4,
        icon: 'file://{resources}/images/custom_items/upgrade_stone_gold.png',
        displayName: '悟道石·神',
        description:
            '神恩如海，神威如狱。\n强化<font color="#ffaa00">4星</font>技能至<font color="#ff6666">等级上限</font>。',
    },

    // === 技能书 ===
    item_book_martial_cleave_1: {
        rarity: 1,
        icon: 'file://{images}/custom_game/hud/skill_cleave.png',
        displayName: '武道·横扫秘籍',
        description:
            '学习后获得<font color="#ffcc66">被动技能</font>：攻击时对周围敌人造成<font color="#ff6666">溅射伤害</font>',
    },
};

// 品质等级对应的边框图片 (使用 slot_frame 系列)
export const RARITY_FRAME_MAP: Record<number, string> = {
    1: 'file://{images}/custom_game/hud/slot_frame_grey.png', // 凡品 - 灰色
    2: 'file://{images}/custom_game/hud/slot_frame_green.png', // 灵品 - 绿色
    3: 'file://{images}/custom_game/hud/slot_frame_purple.png', // 仙品 - 紫色
    4: 'file://{images}/custom_game/hud/slot_frame_orange.png', // 神品 - 橙色
};

// 品质等级对应的背景图片 (使用 rarity_bg 系列)
export const RARITY_BG_MAP: Record<number, string> = {
    1: 'file://{images}/custom_game/hud/rarity_bg_1.png', // 凡品 - 灰色背景
    2: 'file://{images}/custom_game/hud/rarity_bg_2.png', // 灵品 - 绿色背景
    3: 'file://{images}/custom_game/hud/rarity_bg_3.png', // 仙品 - 紫色背景
    4: 'file://{images}/custom_game/hud/rarity_bg_4.png', // 神品 - 橙色背景
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

/**
 * 获取品质对应的背景图片
 */
export function getRarityBg(rarity: number): string | null {
    return RARITY_BG_MAP[rarity] || null;
}
