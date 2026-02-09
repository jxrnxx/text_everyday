/**
 * itemRarityConfig.ts
 * 物品品质配置 —— 所有数据从 Excel 生成的 JSON 自动读取
 *
 * Excel 列说明 (npc_items_custom sheet):
 *   col  | 中文字段名      | KV字段名         | 说明
 *   ---- | --------------- | ---------------- | ----
 *   1    | 物品名          | name             | 物品内部名，如 item_scroll_gacha
 *   2    | 中文显示名(Loc) | #LocItemCn_{}    | → $.Localize('#ItemCn_xxx')
 *   3    | 物品描述(Loc)   | #LocItemDesc_{}  | → $.Localize('#ItemDesc_xxx')
 *   17   | 物品品质        | ItemQuality      | 1=凡 2=灵 3=仙 4=神
 *   20   | 图标路径        | IconPath         | Panorama 图标路径，如 file://{resources}/...
 *   21   | 是否可使用      | ItemUsable       | 1=可双击/右键使用 0=不可
 *   22   | 是否技能书      | IsSkillBook      | 1=右键显示"参悟" 0=普通"使用"
 */

// 导入 Excel → KV → JSON 自动生成的物品数据
import itemsCustomData from '../json/npc_items_custom.json';

// ==================== 类型定义 ====================

/** 物品配置接口 */
export interface ItemConfig {
    rarity: number; // 品质等级: 1=凡, 2=灵, 3=仙, 4=神 (Excel: 物品品质 / ItemQuality)
    icon: string; // 透明图标路径 (Excel: 图标路径 / IconPath)
    itemName: string; // 物品内部名 (Excel: 物品名 / name)
    usable: boolean; // 是否可使用 (Excel: 是否可使用 / ItemUsable)
    isSkillBook: boolean; // 是否技能书 (Excel: 是否技能书 / IsSkillBook)
}

// ==================== 本地化函数 ====================

/**
 * 获取本地化的物品显示名
 * Excel: 中文显示名(Loc) / #LocItemCn_{}
 */
export function getLocalizedName(itemName: string): string {
    const token = `#ItemCn_${itemName}`;
    const localized = $.Localize(token);
    return localized && localized !== token ? localized : itemName;
}

/**
 * 获取本地化的物品描述
 * Excel: 物品描述(Loc) / #LocItemDesc_{}
 */
export function getLocalizedDesc(itemName: string): string {
    const token = `#ItemDesc_${itemName}`;
    const localized = $.Localize(token);
    return localized && localized !== token ? localized : '';
}

// ==================== 从 JSON 构建配置映射 ====================

const _jsonData = itemsCustomData as Record<string, any>;

/**
 * 从 Excel 生成的 JSON 自动构建 ITEM_CONFIG_MAP
 * 只纳入有 IconPath 字段的物品（即 Excel 里配了图标的才会出现在 UI 配置中）
 */
function buildConfigMap(): Record<string, ItemConfig> {
    const map: Record<string, ItemConfig> = {};
    for (const [itemName, data] of Object.entries(_jsonData)) {
        if (data && data.IconPath) {
            map[itemName] = {
                rarity: Number(data.ItemQuality) || 0, // 物品品质
                icon: String(data.IconPath), // 图标路径
                itemName, // 物品内部名
                usable: Number(data.ItemUsable) === 1, // 是否可使用
                isSkillBook: Number(data.IsSkillBook) === 1, // 是否技能书
            };
        }
    }
    return map;
}

/** 物品配置映射 — 全部从 Excel 自动生成，无需手动维护 */
export const ITEM_CONFIG_MAP: Record<string, ItemConfig> = buildConfigMap();

// ==================== 价格 / 边框 / 背景 ====================

/** 出售价格映射（按品质等级） */
export const SELL_PRICE_MAP: Record<number, number> = {
    1: 20, // 凡品
    2: 50, // 灵品
    3: 100, // 仙品
    4: 200, // 神品
};

/** 品质等级对应的边框图片 */
export const RARITY_FRAME_MAP: Record<number, string> = {
    1: 'file://{images}/custom_game/hud/slot_frame_grey.png', // 凡品 - 灰色
    2: 'file://{images}/custom_game/hud/slot_frame_green.png', // 灵品 - 绿色
    3: 'file://{images}/custom_game/hud/slot_frame_purple.png', // 仙品 - 紫色
    4: 'file://{images}/custom_game/hud/slot_frame_orange.png', // 神品 - 橙色
};

/** 品质等级对应的背景图片 */
export const RARITY_BG_MAP: Record<number, string> = {
    1: 'file://{images}/custom_game/hud/rarity_bg_1.png', // 凡品
    2: 'file://{images}/custom_game/hud/rarity_bg_2.png', // 灵品
    3: 'file://{images}/custom_game/hud/rarity_bg_3.png', // 仙品
    4: 'file://{images}/custom_game/hud/rarity_bg_4.png', // 神品
};

// ==================== 查询函数 ====================

/** 获取物品配置 */
export function getItemConfig(itemName: string): ItemConfig | null {
    return ITEM_CONFIG_MAP[itemName] || null;
}

/** 获取物品品质等级 (Excel: 物品品质 / ItemQuality) */
export function getItemRarity(itemName: string): number {
    return ITEM_CONFIG_MAP[itemName]?.rarity || 0;
}

/** 获取物品图标路径 (Excel: 图标路径 / IconPath) */
export function getItemIcon(itemName: string): string | null {
    return ITEM_CONFIG_MAP[itemName]?.icon || null;
}

/** 获取品质对应的边框图片 */
export function getRarityFrame(rarity: number): string | null {
    return RARITY_FRAME_MAP[rarity] || null;
}

/** 获取品质对应的背景图片 */
export function getRarityBg(rarity: number): string | null {
    return RARITY_BG_MAP[rarity] || null;
}

/** 获取物品出售价格 */
export function getSellPrice(rarity: number): number {
    return SELL_PRICE_MAP[rarity] || 10;
}

/** 检查物品是否可使用 (Excel: 是否可使用 / ItemUsable) */
export function isItemUsable(itemName: string): boolean {
    return ITEM_CONFIG_MAP[itemName]?.usable || false;
}

/** 检查物品是否是技能书 (Excel: 是否技能书 / IsSkillBook) */
export function isSkillBook(itemName: string): boolean {
    return ITEM_CONFIG_MAP[itemName]?.isSkillBook || false;
}
